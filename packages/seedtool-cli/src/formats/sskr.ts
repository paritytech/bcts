/**
 * SSKR format
 * Ported from seedtool-cli-rust/src/formats/sskr.rs
 */

import type { Cli, SSKRFormatKey } from "../cli.js";
import type { InputFormat, OutputFormat } from "./format.js";
import { Seed } from "../seed.js";
import { Envelope } from "@bcts/envelope";
import { SymmetricKey } from "@bcts/envelope";
import { SSKRShare, SSKRShareCbor, SSKRSecret, sskrGenerate, sskrCombine } from "@bcts/components";
import { encodeBytewords, decodeBytewords, BytewordsStyle, UR } from "@bcts/uniform-resources";
import { SSKR_SHARE, SSKR_SHARE_V1 } from "@bcts/tags";
import { toByteString, toTaggedValue, decodeCbor, expectBytes } from "@bcts/dcbor";

/**
 * SSKR format handler.
 * Round-trippable: sskr shares → seed → sskr shares.
 * Supports multiple sub-formats: envelope, btw, btwm, btwu, ur.
 */
export class SSKRFormat implements InputFormat, OutputFormat {
  name(): string {
    return "sskr";
  }

  roundTrippable(): boolean {
    return true;
  }

  processInput(state: Cli): Cli {
    const input = state.expectInput();
    state.seed = parseSskrSeed(input);
    return state;
  }

  processOutput(state: Cli): string {
    const spec = state.sskrSpec();
    const seed = state.expectSeed();
    const format = state.sskrFormat;
    return outputSskrSeed(seed, spec, format);
  }
}

//
// Output Helpers
//

function outputSskrSeed(
  seed: Seed,
  spec: import("@bcts/sskr").Spec,
  format: SSKRFormatKey,
): string {
  switch (format) {
    case "envelope": {
      const envelope = seed.toEnvelope();
      const contentKey = SymmetricKey.new();
      const encryptedEnvelope = envelope.wrap().encryptSubject(contentKey);
      const shareEnvelopes = encryptedEnvelope.sskrSplitFlattened(spec, contentKey);
      const shareEnvelopesStrings = shareEnvelopes.map((envelope) => envelope.urString());
      return shareEnvelopesStrings.join("\n");
    }
    case "btw": {
      return makeBytewordsShares(spec, seed, BytewordsStyle.Standard);
    }
    case "btwm": {
      return makeBytewordsShares(spec, seed, BytewordsStyle.Minimal);
    }
    case "btwu": {
      return makeBytewordsShares(spec, seed, BytewordsStyle.Uri);
    }
    case "ur": {
      const shares = makeShares(spec, seed);
      const urStrings = shares.map((share) => {
        const ur = UR.fromCbor("sskr", toByteString(share.asBytes()));
        return ur.toString();
      });
      return urStrings.join("\n");
    }
  }
}

function makeShares(spec: import("@bcts/sskr").Spec, seed: Seed): SSKRShareCbor[] {
  const secret = SSKRSecret.new(seed.data());
  const shareGroups = sskrGenerate(spec, secret);
  const flatShares: SSKRShareCbor[] = [];
  for (const group of shareGroups) {
    for (const shareData of group) {
      flatShares.push(SSKRShare.fromData(shareData));
    }
  }
  return flatShares;
}

function makeBytewordsShares(
  spec: import("@bcts/sskr").Spec,
  seed: Seed,
  style: BytewordsStyle,
): string {
  const shares = makeShares(spec, seed);
  const cborShares = shares.map((share) =>
    toTaggedValue(SSKR_SHARE.value, toByteString(share.asBytes())),
  );
  const sharesStrings = cborShares.map((share) => encodeBytewords(share.toData(), style));
  return sharesStrings.join("\n");
}

//
// Input Helpers
//

function parseEnvelopes(input: string): Seed | null {
  try {
    const shareStrings = input.split(/\s+/).filter((s) => s.length > 0);
    const shareEnvelopes: Envelope[] = [];
    for (const str of shareStrings) {
      try {
        const envelope = Envelope.fromURString(str);
        shareEnvelopes.push(envelope);
      } catch {
        // Skip non-envelope strings
      }
    }

    if (shareEnvelopes.length === 0) {
      return null;
    }

    const recoveredEnvelope = Envelope.sskrJoin(shareEnvelopes).unwrap();
    return Seed.fromEnvelope(recoveredEnvelope);
  } catch {
    return null;
  }
}

function fromUntaggedCborShares(untaggedCborShares: Uint8Array[]): Seed | null {
  try {
    const recoveredSecret = sskrCombine(untaggedCborShares);
    return Seed.new(recoveredSecret.getData());
  } catch {
    return null;
  }
}

function fromTaggedCborShares(taggedCborDataShares: Uint8Array[]): Seed | null {
  try {
    const untaggedShares: Uint8Array[] = [];
    for (const data of taggedCborDataShares) {
      const cbor = decodeCbor(data);
      // Extract the tagged value and ensure it's the expected tag
      const tagged = cbor as { tag?: number; value?: unknown };
      if (tagged.tag !== SSKR_SHARE.value && tagged.tag !== SSKR_SHARE_V1.value) {
        return null;
      }
      const content = (tagged.value as { buffer?: Uint8Array }) || cbor;
      const bytes = expectBytes(content as ReturnType<typeof decodeCbor>);
      untaggedShares.push(bytes);
    }
    return fromUntaggedCborShares(untaggedShares);
  } catch {
    return null;
  }
}

function parseBytewords(input: string, style: BytewordsStyle): Seed | null {
  try {
    // Standard bytewords include spaces, so we can only split on newlines.
    let shareStrings: string[];
    if (style === BytewordsStyle.Standard) {
      shareStrings = input.split("\n").filter((s) => s.length > 0);
    } else {
      shareStrings = input.split(/\s+/).filter((s) => s.length > 0);
    }

    const cborDataShares: Uint8Array[] = [];
    for (const s of shareStrings) {
      try {
        const decoded = decodeBytewords(s, style);
        cborDataShares.push(decoded);
      } catch {
        // Skip invalid bytewords
      }
    }

    if (cborDataShares.length === 0) {
      return null;
    }

    return fromTaggedCborShares(cborDataShares);
  } catch {
    return null;
  }
}

function parseUr(input: string, expectedTagValue: number, allowTaggedCbor: boolean): Seed | null {
  try {
    // Get the expected type name
    const expectedType = expectedTagValue === SSKR_SHARE.value ? "sskr" : "crypto-sskr";

    const shareStrings = input.split(/\s+/).filter((s) => s.length > 0);
    const urs: UR[] = [];

    for (const str of shareStrings) {
      try {
        const ur = UR.fromURString(str);
        urs.push(ur);
      } catch {
        // Skip non-UR strings
      }
    }

    if (urs.length === 0) {
      return null;
    }

    // Ensure every UR is of the expected type
    for (const ur of urs) {
      if (ur.type() !== expectedType) {
        return null;
      }
    }

    const untaggedCborShares: Uint8Array[] = [];
    for (const ur of urs) {
      let cbor = ur.cbor();

      // Legacy SSKR shares might have tagged CBOR, even though they're
      // URs so they shouldn't be.
      if (allowTaggedCbor) {
        try {
          const decoded = decodeCbor(cbor.toData());
          const tagged = decoded as { tag?: number; value?: unknown };
          if (tagged.tag === SSKR_SHARE.value || tagged.tag === SSKR_SHARE_V1.value) {
            const content = tagged.value as { buffer?: Uint8Array };
            cbor = content as unknown as ReturnType<typeof toByteString>;
          }
        } catch {
          // Not tagged CBOR, use as-is
        }
      }

      // The CBOR should be a byte string
      const bytes = expectBytes(cbor);
      untaggedCborShares.push(bytes);
    }

    return fromUntaggedCborShares(untaggedCborShares);
  } catch {
    return null;
  }
}

function parseSskrSeed(input: string): Seed {
  // Try envelope format first
  const envelopeResult = parseEnvelopes(input);
  if (envelopeResult !== null) {
    return envelopeResult;
  }

  // Try bytewords standard format
  const btwResult = parseBytewords(input, BytewordsStyle.Standard);
  if (btwResult !== null) {
    return btwResult;
  }

  // Try bytewords minimal format
  const btwmResult = parseBytewords(input, BytewordsStyle.Minimal);
  if (btwmResult !== null) {
    return btwmResult;
  }

  // Try bytewords uri format
  const btwuResult = parseBytewords(input, BytewordsStyle.Uri);
  if (btwuResult !== null) {
    return btwuResult;
  }

  // Try UR format (current tag)
  const urResult = parseUr(input, SSKR_SHARE.value, false);
  if (urResult !== null) {
    return urResult;
  }

  // Try legacy UR format (v1 tag, allow tagged cbor)
  const urLegacyResult = parseUr(input, SSKR_SHARE_V1.value, true);
  if (urLegacyResult !== null) {
    return urLegacyResult;
  }

  throw new Error("Insufficient or invalid SSKR shares.");
}
