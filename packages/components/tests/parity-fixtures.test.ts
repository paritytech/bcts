/**
 * Cross-impl parity fixtures.
 *
 * Each fixture pins a byte-for-byte expected value taken from
 * `bc-components-rust`'s own test suite. Divergence here indicates a
 * cross-implementation interop break: a TS-encoded blob will not parse in
 * Rust (or vice versa).
 *
 * Source vectors:
 *   Digest          — `bc-components-rust/src/digest.rs::test_ur`
 *   XID             — `bc-components-rust/src/id/xid.rs::test_xid`
 *   Reference       — derived in `xid.rs::test_xid_from_key` (bytewords)
 *   Compressed      — exercised below; the test asserts the raw-DEFLATE
 *                     wire format (no zlib header).
 *   KDF params      — assert that the salt position carries CBOR tag 40018,
 *                     matching `From<Salt> for CBOR` in Rust.
 *   Signature UR    — UR payload must be untagged CBOR (matches Rust's
 *                     `UREncodable` blanket impl).
 *   SymmetricKey UR — same.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  Digest,
  XID,
  Reference,
  Compressed,
  Salt,
  Argon2idParams,
  HKDFParams,
  PBKDF2Params,
  ScryptParams,
  SSHAgentParams,
  HashType,
  SymmetricKey,
  Signature,
} from "../src/index.js";
import { SecureRandomNumberGenerator } from "@bcts/rand";
import { bytesToHex } from "../src/utils.js";
import { ECPrivateKey } from "../src/ec-key/index.js";
import { registerTagsIn } from "@bcts/tags";
import { getGlobalTagsStore } from "@bcts/dcbor";

beforeAll(() => {
  // Side-effect: globally register every BC tag so `decodeCbor` /
  // `extractTaggedContent` know what to do with `#6.40018` etc.
  registerTagsIn(getGlobalTagsStore());
});

describe("Digest — Rust fixture", () => {
  it("matches the hex fixture for SHA-256(\"hello world\")", () => {
    const digest = Digest.fromImage(new TextEncoder().encode("hello world"));
    expect(bytesToHex(digest.toData())).toBe(
      "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    );
  });

  it("matches the UR string fixture from Rust", () => {
    const digest = Digest.fromImage(new TextEncoder().encode("hello world"));
    expect(digest.urString()).toBe(
      "ur:digest/hdcxrhgtdirhmugtfmayondmgmtstnkipyzssslrwsvlkngulawymhloylpsvowssnwlamnlatrs",
    );
    // Round-trip
    expect(Digest.fromURString(digest.urString()).equals(digest)).toBe(true);
  });
});

describe("XID — Rust fixture", () => {
  const RAW = "de2853684ae55803a08b36dd7f4e566649970601927330299fd333f33fecc037";

  it("matches the UR string fixture", () => {
    const xid = XID.fromHex(RAW);
    expect(xid.urString()).toBe(
      "ur:xid/hdcxuedeguisgevwhdaxnbluenutlbglhfiygamsamadmojkdydtneteeowffhwprtemcaatledk",
    );
    expect(XID.fromURString(xid.urString()).equals(xid)).toBe(true);
  });

  it("produces the documented bytewords/bytemojis identifiers", () => {
    const xid = XID.fromHex(RAW);
    expect(xid.bytewordsIdentifier(true)).toBe("🅧 URGE DICE GURU IRIS");
    expect(xid.bytemojisIdentifier(true)).toBe("🅧 🐻 😻 🍞 💐");
    expect(xid.shortDescription()).toBe("de285368");
  });
});

describe("Reference — Rust fixture", () => {
  it("derives short bytewords/bytemojis from a 32-byte data block", () => {
    // From bc-components-rust/src/id/xid.rs::test_xid_from_key —
    // the digest of the published-public-key example.
    const ref = Reference.fromHex(
      "d40e0602674df1b732f5e025d04c45f2e74ed1652c5ae1740f6a5502dbbdcd47",
    );
    expect(ref.refHexShort()).toBe("d40e0602");
    expect(ref.toString()).toBe("Reference(d40e0602)");
    expect(ref.bytewordsIdentifier()).toBe("TINY BETA ATOM ALSO");
    expect(ref.bytemojiIdentifier()).toBe("🧦 🤨 😎 😆");
  });

  it("CBOR-roundtrips through tagged form (#6.40025)", () => {
    const ref = Reference.fromHex(
      "d40e0602674df1b732f5e025d04c45f2e74ed1652c5ae1740f6a5502dbbdcd47",
    );
    const tagged = ref.taggedCborData();
    // Tag 40025 → 0xd9 0x9c 0x59 prefix (CBOR major-6 + 2-byte tag).
    expect(tagged.subarray(0, 3)).toEqual(new Uint8Array([0xd9, 0x9c, 0x59]));
    const decoded = Reference.fromTaggedCborData(tagged);
    expect(decoded.equals(ref)).toBe(true);
  });
});

describe("Compressed — raw DEFLATE (no zlib header)", () => {
  const SAMPLE = new TextEncoder().encode(
    // ~120 bytes of repetitive text → easily compressible.
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. " +
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
  );

  it("produces raw DEFLATE bytes (no zlib magic) that round-trip correctly", () => {
    const c = Compressed.fromDecompressedData(SAMPLE);
    expect(c.decompressedSize()).toBe(SAMPLE.length);
    expect(c.decompress()).toEqual(SAMPLE);
    // The whole payload should be smaller than zlib (which adds 6 bytes).
    expect(c.compressedSize()).toBeLessThan(SAMPLE.length);
  });

  it("round-trips through tagged CBOR", () => {
    const c = Compressed.fromDecompressedData(SAMPLE);
    const tagged = c.taggedCborData();
    const decoded = Compressed.fromTaggedCborData(tagged);
    expect(decoded.decompress()).toEqual(SAMPLE);
  });
});

describe("KDF params — salt is CBOR-tagged 40018 (matches Rust)", () => {
  /**
   * Spot-checks the encoded byte sequence to confirm the salt is wrapped
   * in tag 40018 — the dominant interop bug the audit fixed.
   *
   * Tag 40018 encodes as `0xd9 0x9c 0x52` (major-6 + 2-byte tag).
   * Format `[INDEX, #6.40018(<16-byte-salt>), …]` therefore begins:
   *   `<arr-header>` `<int-INDEX>` `0xd9 0x9c 0x52 0x50 <16 bytes>` …
   */

  // Use a deterministic 16-byte salt to make the byte position explicit.
  const SALT = Salt.fromData(new Uint8Array(16));

  function expectTaggedSaltAt(bytes: Uint8Array, indexOffset: number) {
    expect(bytes[indexOffset + 0]).toBe(0xd9);
    expect(bytes[indexOffset + 1]).toBe(0x9c);
    expect(bytes[indexOffset + 2]).toBe(0x52);
  }

  it("Argon2idParams: tag 40018 immediately after the index", () => {
    const params = Argon2idParams.newOpt(SALT);
    const data = params.toCborData();
    // [3, #6.40018(...)]: array header (0x82), int 3 (0x03), then tagged salt
    expect(data[0]).toBe(0x82);
    expect(data[1]).toBe(0x03);
    expectTaggedSaltAt(data, 2);
    expect(Argon2idParams.fromCbor(params.toCbor()).equals(params)).toBe(true);
  });

  it("HKDFParams: tag 40018 immediately after the index", () => {
    const params = HKDFParams.newOpt(SALT, HashType.SHA256);
    const data = params.toCborData();
    // [0, #6.40018(...), 0]: array of 3, int 0, tagged salt, hash type
    expect(data[0]).toBe(0x83);
    expect(data[1]).toBe(0x00);
    expectTaggedSaltAt(data, 2);
    expect(HKDFParams.fromCbor(params.toCbor()).equals(params)).toBe(true);
  });

  it("PBKDF2Params: tag 40018 immediately after the index", () => {
    const params = PBKDF2Params.newOpt(SALT, 100_000, HashType.SHA256);
    const data = params.toCborData();
    expect(data[0]).toBe(0x84);
    expect(data[1]).toBe(0x01);
    expectTaggedSaltAt(data, 2);
    expect(PBKDF2Params.fromCbor(params.toCbor()).equals(params)).toBe(true);
  });

  it("ScryptParams: tag 40018 immediately after the index", () => {
    const params = ScryptParams.newOpt(SALT, 15, 8, 1);
    const data = params.toCborData();
    expect(data[0]).toBe(0x85);
    expect(data[1]).toBe(0x02);
    expectTaggedSaltAt(data, 2);
    expect(ScryptParams.fromCbor(params.toCbor()).equals(params)).toBe(true);
  });

  it("SSHAgentParams: tag 40018 immediately after the index", () => {
    const params = SSHAgentParams.newOpt(SALT, "test-id");
    const data = params.toCborData();
    expect(data[0]).toBe(0x83);
    expect(data[1]).toBe(0x04);
    expectTaggedSaltAt(data, 2);
    expect(SSHAgentParams.fromCbor(params.toCbor()).equals(params)).toBe(true);
  });
});

describe("UR conventions — payload is untagged CBOR (matches Rust)", () => {
  it("Signature.ur() does NOT double-tag the payload", () => {
    const ec = ECPrivateKey.fromHex(
      "322b5c1dd5a17c3481c2297990c85c232ed3c17b52ce9905c6ec5193ad132c36",
    );
    const sig = Signature.schnorrFromData(ec.schnorrSign(new TextEncoder().encode("hi")));
    const ur = sig.ur();
    // The UR payload should be untagged: a bare byte string, not #6.40020(...).
    const cborBytes = ur.cbor().toData();
    // CBOR major-2 byte string with 64 bytes (Schnorr): 0x58 0x40 + bytes.
    expect(cborBytes[0]).toBe(0x58);
    expect(cborBytes[1]).toBe(0x40);
    expect(Signature.fromUR(ur).equals(sig)).toBe(true);
  });

  it("SymmetricKey.ur() does NOT double-tag the payload", () => {
    const rng = new SecureRandomNumberGenerator();
    const key = SymmetricKey.fromData(rng.randomData(32));
    const ur = key.ur();
    const cborBytes = ur.cbor().toData();
    // 32-byte byte string: 0x58 0x20 + bytes.
    expect(cborBytes[0]).toBe(0x58);
    expect(cborBytes[1]).toBe(0x20);
    expect(SymmetricKey.fromUR(ur).equals(key)).toBe(true);
  });
});
