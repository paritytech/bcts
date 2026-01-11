/**
 * Extract command - 1:1 port of cmd/extract.rs
 *
 * Extract the subject of the input envelope.
 */

import type { Exec } from "../exec.js";
import { readEnvelope } from "../utils.js";
import { bytesToHex } from "../data-types.js";
import { type Envelope } from "@bcts/envelope";
import { ARID, Digest, URI, UUID } from "@bcts/components";
import {
  type Cbor,
  CborDate,
  isTagged,
  tagValue,
  tagContent,
  cborData,
  expectBoolean,
  expectNumber,
  expectText,
  expectBytes,
} from "@bcts/dcbor";
import { KnownValue } from "@bcts/known-values";
import { UR } from "@bcts/uniform-resources";
import { XID } from "@bcts/xid";
import { getGlobalTagsStore, ENVELOPE } from "@bcts/tags";

// Helper functions to extract types from CBOR
const extractARID = (cbor: Cbor): ARID => ARID.fromTaggedCbor(cbor);
const extractDigest = (cbor: Cbor): Digest => Digest.fromTaggedCbor(cbor);
const extractURI = (cbor: Cbor): URI => URI.fromTaggedCbor(cbor);
const extractUUID = (cbor: Cbor): UUID => UUID.fromTaggedCbor(cbor);
const extractCborDate = (cbor: Cbor): CborDate => CborDate.fromTaggedCbor(cbor);
const extractXID = (cbor: Cbor): XID => XID.fromTaggedCbor(cbor);
const extractKnownValue = (cbor: Cbor): KnownValue => KnownValue.fromTaggedCbor(cbor);

/**
 * Subject types that can be extracted.
 */
export enum SubjectType {
  /** Extract as assertion (predicate and object) */
  Assertion = "assertion",
  /** Extract object from assertion */
  Object = "object",
  /** Extract predicate from assertion */
  Predicate = "predicate",
  /** ARID: Apparently Random Identifier (ur:arid) */
  Arid = "arid",
  /** ARID: Apparently Random Identifier (hex) */
  AridHex = "arid-hex",
  /** Boolean value */
  Bool = "bool",
  /** CBOR data in hex */
  Cbor = "cbor",
  /** Binary byte string in hex */
  Data = "data",
  /** Date (ISO 8601) */
  Date = "date",
  /** Cryptographic digest (ur:digest) */
  Digest = "digest",
  /** Envelope (ur:envelope) */
  Envelope = "envelope",
  /** Known Value (number or string) */
  Known = "known",
  /** Numeric value */
  Number = "number",
  /** UTF-8 String */
  String = "string",
  /** Uniform Resource (UR) */
  Ur = "ur",
  /** URI */
  Uri = "uri",
  /** UUID */
  Uuid = "uuid",
  /** Wrapped Envelope (ur:envelope) */
  Wrapped = "wrapped",
  /** XID */
  Xid = "xid",
}

/**
 * Command arguments for the extract command.
 */
export interface CommandArgs {
  /** Subject type to extract */
  type: SubjectType;
  /** The type for an extracted UR */
  urType?: string;
  /** The expected tag for an extracted UR */
  urTag?: number | bigint;
  /** The envelope to extract from */
  envelope?: string;
}

/**
 * Extract command implementation.
 */
export class ExtractCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);

    switch (this.args.type) {
      case SubjectType.Assertion:
        return this.extractAssertion(envelope);
      case SubjectType.Object:
        return this.extractObject(envelope);
      case SubjectType.Predicate:
        return this.extractPredicate(envelope);
      case SubjectType.Arid:
        return envelope.extractSubject(extractARID).urString();
      case SubjectType.AridHex:
        return envelope.extractSubject(extractARID).hex();
      case SubjectType.Bool:
        return envelope.extractSubject((cbor) => expectBoolean(cbor)).toString();
      case SubjectType.Cbor:
        return this.extractCborString(envelope);
      case SubjectType.Data:
        return bytesToHex(expectBytes(envelope.subject().expectLeaf() as Cbor));
      case SubjectType.Date:
        return envelope.extractSubject(extractCborDate).toString();
      case SubjectType.Digest:
        return envelope.extractSubject(extractDigest).urString();
      case SubjectType.Envelope:
        return envelope.subject().urString();
      case SubjectType.Known:
        return this.extractKnownValueString(envelope);
      case SubjectType.Number:
        return envelope.extractSubject((cbor) => expectNumber(cbor)).toString();
      case SubjectType.String:
        return envelope.extractSubject((cbor) => expectText(cbor));
      case SubjectType.Ur:
        return this.extractUr(envelope);
      case SubjectType.Uri:
        return envelope.extractSubject(extractURI).toString();
      case SubjectType.Uuid:
        return envelope.extractSubject(extractUUID).toString();
      case SubjectType.Wrapped:
        return envelope.unwrap().urString();
      case SubjectType.Xid:
        return envelope.extractSubject(extractXID).urString();
    }
  }

  private extractAssertion(envelope: Envelope): string {
    const assertion = envelope.asAssertion();
    if (!assertion) {
      throw new Error("Envelope is not an assertion.");
    }
    const predicate = assertion.asPredicate();
    const object = assertion.asObject();
    if (!predicate || !object) {
      throw new Error("Invalid assertion.");
    }
    return `${predicate.urString()}\n${object.urString()}`;
  }

  private extractObject(envelope: Envelope): string {
    const assertion = envelope.asAssertion();
    if (!assertion) {
      throw new Error("Envelope is not an assertion.");
    }
    const object = assertion.asObject();
    if (!object) {
      throw new Error("Invalid assertion.");
    }
    return object.urString();
  }

  private extractPredicate(envelope: Envelope): string {
    const assertion = envelope.asAssertion();
    if (!assertion) {
      throw new Error("Envelope is not an assertion.");
    }
    const predicate = assertion.asPredicate();
    if (!predicate) {
      throw new Error("Invalid assertion.");
    }
    return predicate.urString();
  }

  private extractUr(envelope: Envelope): string {
    const subject = envelope.subject();
    const leaf = subject.asLeaf();

    if (leaf && isTagged(leaf)) {
      const tag = tagValue(leaf);
      const untaggedCbor = tagContent(leaf);

      if (tag === undefined || untaggedCbor === undefined) {
        throw new Error("Invalid tagged value");
      }

      // Look up the tag name
      const tagsStore = getGlobalTagsStore();
      const knownTag = tagsStore.tagForValue(tag);

      let urType = this.args.urType;
      if (knownTag?.name) {
        urType = knownTag.name;
      }

      if (!urType) {
        throw new Error("UR type required");
      }

      const ur = UR.new(urType, untaggedCbor);
      return ur.toString();
    }

    if (subject.isWrapped()) {
      if (this.args.urTag !== undefined || this.args.urType !== undefined) {
        if (this.args.urTag !== undefined && BigInt(this.args.urTag) !== ENVELOPE.value) {
          throw new Error("UR tag mismatch");
        }
        const tagsStore = getGlobalTagsStore();
        const envelopeName = tagsStore.nameForValue(ENVELOPE.value);
        if (this.args.urType !== undefined && this.args.urType !== envelopeName) {
          throw new Error("UR type mismatch");
        }
      }
      return envelope.unwrap().urString();
    }

    throw new Error("No CBOR data found in envelope subject");
  }

  private extractKnownValueString(envelope: Envelope): string {
    // Verify it's a known value
    envelope.extractSubject(extractKnownValue);
    return envelope.subject().format();
  }

  private extractCborString(envelope: Envelope): string {
    const subject = envelope.subject();
    const leaf = subject.asLeaf();

    if (leaf) {
      return bytesToHex(cborData(leaf));
    }

    if (subject.isWrapped()) {
      return bytesToHex(cborData(envelope.unwrap().toCbor() as Cbor));
    }

    const knownValue = subject.asKnownValue();
    if (knownValue) {
      return bytesToHex(cborData(knownValue.taggedCbor()));
    }

    throw new Error("No CBOR data found in envelope subject");
  }
}

/**
 * Execute the extract command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new ExtractCommand(args).exec();
}
