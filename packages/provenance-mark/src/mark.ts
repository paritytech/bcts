// Ported from provenance-mark-rust/src/mark.rs

import { toBase64, fromBase64, bytesToHex } from "./utils.js";
import { type Cbor, cbor, cborData, expectArray, expectBytes, decodeCbor } from "@bcts/dcbor";
import { PROVENANCE_MARK } from "@bcts/tags";
import {
  BytewordsStyle,
  encodeBytewords,
  decodeBytewords,
  encodeBytewordsIdentifier,
  encodeBytemojisIdentifier,
  UR,
} from "@bcts/uniform-resources";
import { Envelope } from "@bcts/envelope";

import { ProvenanceMarkError, ProvenanceMarkErrorType } from "./error.js";
import { validate as validateMarks } from "./validate.js";
import type { ValidationIssue, ValidationReport } from "./validate.js";
import {
  type ProvenanceMarkResolution,
  linkLength,
  keyRange,
  chainIdRange,
  hashRange,
  seqBytesRange,
  dateBytesRange,
  infoRangeStart,
  fixedLength,
  serializeDate,
  deserializeDate,
  serializeSeq,
  deserializeSeq,
  resolutionFromCbor,
  resolutionToCbor,
} from "./resolution.js";
import { sha256, sha256Prefix, obfuscate } from "./crypto-utils.js";

/**
 * A cryptographically-secured provenance mark.
 */
export class ProvenanceMark {
  private readonly _res: ProvenanceMarkResolution;
  private readonly _key: Uint8Array;
  private readonly _hash: Uint8Array;
  private readonly _chainId: Uint8Array;
  private readonly _seqBytes: Uint8Array;
  private readonly _dateBytes: Uint8Array;
  private readonly _infoBytes: Uint8Array;
  private readonly _seq: number;
  private readonly _date: Date;

  private constructor(
    res: ProvenanceMarkResolution,
    key: Uint8Array,
    hash: Uint8Array,
    chainId: Uint8Array,
    seqBytes: Uint8Array,
    dateBytes: Uint8Array,
    infoBytes: Uint8Array,
    seq: number,
    date: Date,
  ) {
    this._res = res;
    this._key = key;
    this._hash = hash;
    this._chainId = chainId;
    this._seqBytes = seqBytes;
    this._dateBytes = dateBytes;
    this._infoBytes = infoBytes;
    this._seq = seq;
    this._date = date;
  }

  res(): ProvenanceMarkResolution {
    return this._res;
  }

  key(): Uint8Array {
    return new Uint8Array(this._key);
  }

  hash(): Uint8Array {
    return new Uint8Array(this._hash);
  }

  chainId(): Uint8Array {
    return new Uint8Array(this._chainId);
  }

  seqBytes(): Uint8Array {
    return new Uint8Array(this._seqBytes);
  }

  dateBytes(): Uint8Array {
    return new Uint8Array(this._dateBytes);
  }

  seq(): number {
    return this._seq;
  }

  date(): Date {
    return this._date;
  }

  /**
   * Get the message (serialized bytes) of this mark.
   */
  message(): Uint8Array {
    const payload = new Uint8Array([
      ...this._chainId,
      ...this._hash,
      ...this._seqBytes,
      ...this._dateBytes,
      ...this._infoBytes,
    ]);
    const obfuscated = obfuscate(this._key, payload);
    return new Uint8Array([...this._key, ...obfuscated]);
  }

  /**
   * Get the info field as CBOR, if present.
   */
  info(): Cbor | undefined {
    if (this._infoBytes.length === 0) {
      return undefined;
    }
    return decodeCbor(this._infoBytes);
  }

  /**
   * Create a new provenance mark.
   */
  static new(
    res: ProvenanceMarkResolution,
    key: Uint8Array,
    nextKey: Uint8Array,
    chainId: Uint8Array,
    seq: number,
    date: Date,
    info?: Cbor,
  ): ProvenanceMark {
    const linkLen = linkLength(res);

    if (key.length !== linkLen) {
      throw new ProvenanceMarkError(ProvenanceMarkErrorType.InvalidKeyLength, undefined, {
        expected: linkLen,
        actual: key.length,
      });
    }
    if (nextKey.length !== linkLen) {
      throw new ProvenanceMarkError(ProvenanceMarkErrorType.InvalidNextKeyLength, undefined, {
        expected: linkLen,
        actual: nextKey.length,
      });
    }
    if (chainId.length !== linkLen) {
      throw new ProvenanceMarkError(ProvenanceMarkErrorType.InvalidChainIdLength, undefined, {
        expected: linkLen,
        actual: chainId.length,
      });
    }

    const dateBytes = serializeDate(res, date);
    const seqBytes = serializeSeq(res, seq);

    // Re-deserialize to get normalized date
    const normalizedDate = deserializeDate(res, dateBytes);

    const infoBytes = info !== undefined ? cborData(info) : new Uint8Array(0);

    const hash = ProvenanceMark.makeHash(
      res,
      key,
      nextKey,
      chainId,
      seqBytes,
      dateBytes,
      infoBytes,
    );

    return new ProvenanceMark(
      res,
      new Uint8Array(key),
      hash,
      new Uint8Array(chainId),
      seqBytes,
      dateBytes,
      infoBytes,
      seq,
      normalizedDate,
    );
  }

  /**
   * Create a provenance mark from a serialized message.
   */
  static fromMessage(res: ProvenanceMarkResolution, message: Uint8Array): ProvenanceMark {
    const minLen = fixedLength(res);
    if (message.length < minLen) {
      throw new ProvenanceMarkError(ProvenanceMarkErrorType.InvalidMessageLength, undefined, {
        expected: minLen,
        actual: message.length,
      });
    }

    const linkLen = linkLength(res);
    const keyRng = keyRange(res);
    const key = message.slice(keyRng.start, keyRng.end);

    const payload = obfuscate(key, message.slice(linkLen));

    // All ranges are for the payload, not the message
    const chainIdRng = chainIdRange(res);
    const chainId = payload.slice(chainIdRng.start, chainIdRng.end);

    const hashRng = hashRange(res);
    const hash = payload.slice(hashRng.start, hashRng.end);

    const seqRng = seqBytesRange(res);
    const seqBytes = payload.slice(seqRng.start, seqRng.end);
    const seq = deserializeSeq(res, seqBytes);

    const dateRng = dateBytesRange(res);
    const dateBytes = payload.slice(dateRng.start, dateRng.end);
    const date = deserializeDate(res, dateBytes);

    const infoStart = infoRangeStart(res);
    const infoBytes = payload.slice(infoStart);

    // Validate info CBOR if present
    if (infoBytes.length > 0) {
      try {
        decodeCbor(infoBytes);
      } catch {
        throw new ProvenanceMarkError(ProvenanceMarkErrorType.InvalidInfoCbor);
      }
    }

    return new ProvenanceMark(
      res,
      new Uint8Array(key),
      new Uint8Array(hash),
      new Uint8Array(chainId),
      new Uint8Array(seqBytes),
      new Uint8Array(dateBytes),
      new Uint8Array(infoBytes),
      seq,
      date,
    );
  }

  private static makeHash(
    res: ProvenanceMarkResolution,
    key: Uint8Array,
    nextKey: Uint8Array,
    chainId: Uint8Array,
    seqBytes: Uint8Array,
    dateBytes: Uint8Array,
    infoBytes: Uint8Array,
  ): Uint8Array {
    const buf = new Uint8Array([
      ...key,
      ...nextKey,
      ...chainId,
      ...seqBytes,
      ...dateBytes,
      ...infoBytes,
    ]);
    return sha256Prefix(buf, linkLength(res));
  }

  /**
   * Get the first four bytes of the hash as a hex string identifier.
   */
  identifier(): string {
    return Array.from(this._hash.slice(0, 4))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /**
   * Get the first four bytes of the hash as upper-case ByteWords.
   */
  bytewordsIdentifier(prefix: boolean): string {
    const bytes = this._hash.slice(0, 4);
    const s = encodeBytewordsIdentifier(bytes).toUpperCase();
    return prefix ? `\u{1F151} ${s}` : s;
  }

  /**
   * A compact 8-letter identifier derived from the upper-case ByteWords
   * identifier by taking the first and last letter of each ByteWords word
   * (4 words x 2 letters = 8 letters).
   *
   * Example: "ABLE ACID ALSO APEX" -> "AEADAOAX"
   * If prefix is true, prepends the provenance mark prefix character.
   */
  bytewordsMinimalIdentifier(prefix: boolean): string {
    const full = encodeBytewordsIdentifier(this._hash.slice(0, 4));

    const words = full.split(/\s+/);
    let out = "";
    if (words.length === 4) {
      for (const w of words) {
        if (w.length === 0) continue;
        out += w[0].toUpperCase();
        out += w[w.length - 1].toUpperCase();
      }
    }

    // Conservative fallback: if the input wasn't in the expected
    // space-separated 4-word format, remove whitespace and chunk the
    // remaining letters.
    if (out.length !== 8) {
      out = "";
      const compact = full.replace(/[^a-zA-Z]/g, "").toUpperCase();
      for (let i = 0; i + 3 < compact.length; i += 4) {
        out += compact[i];
        out += compact[i + 3];
      }
    }

    return prefix ? `\u{1F151} ${out}` : out;
  }

  /**
   * Get the first four bytes of the hash as Bytemoji.
   */
  bytemojiIdentifier(prefix: boolean): string {
    const bytes = this._hash.slice(0, 4);
    const s = encodeBytemojisIdentifier(bytes).toUpperCase();
    return prefix ? `\u{1F151} ${s}` : s;
  }

  /**
   * Check if this mark precedes another mark in the chain.
   */
  precedes(next: ProvenanceMark): boolean {
    try {
      this.precedesOpt(next);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if this mark precedes another mark, throwing on validation errors.
   * Errors carry a structured `validationIssue` in their details, matching Rust's
   * `Error::Validation(ValidationIssue)` pattern.
   */
  precedesOpt(next: ProvenanceMark): void {
    // `next` can't be a genesis
    if (next._seq === 0) {
      const issue: ValidationIssue = { type: "NonGenesisAtZero" };
      throw new ProvenanceMarkError(
        ProvenanceMarkErrorType.ValidationError,
        "non-genesis mark at sequence 0",
        { validationIssue: issue },
      );
    }
    if (arraysEqual(next._key, next._chainId)) {
      const issue: ValidationIssue = { type: "InvalidGenesisKey" };
      throw new ProvenanceMarkError(
        ProvenanceMarkErrorType.ValidationError,
        "genesis mark must have key equal to chain_id",
        { validationIssue: issue },
      );
    }
    // `next` must have the next highest sequence number
    if (this._seq !== next._seq - 1) {
      const issue: ValidationIssue = {
        type: "SequenceGap",
        expected: this._seq + 1,
        actual: next._seq,
      };
      throw new ProvenanceMarkError(
        ProvenanceMarkErrorType.ValidationError,
        `sequence gap: expected ${this._seq + 1}, got ${next._seq}`,
        { validationIssue: issue },
      );
    }
    // `next` must have an equal or later date
    if (this._date > next._date) {
      const dateStr = this._date.toISOString().replace(".000Z", "Z");
      const nextDateStr = next._date.toISOString().replace(".000Z", "Z");
      const issue: ValidationIssue = {
        type: "DateOrdering",
        previous: dateStr,
        next: nextDateStr,
      };
      throw new ProvenanceMarkError(
        ProvenanceMarkErrorType.ValidationError,
        `date ordering: ${dateStr} > ${nextDateStr}`,
        { validationIssue: issue },
      );
    }
    // `next` must reveal the key that was used to generate this mark's hash
    const expectedHash = ProvenanceMark.makeHash(
      this._res,
      this._key,
      next._key,
      this._chainId,
      this._seqBytes,
      this._dateBytes,
      this._infoBytes,
    );
    if (!arraysEqual(this._hash, expectedHash)) {
      const issue: ValidationIssue = {
        type: "HashMismatch",
        expected: bytesToHex(expectedHash),
        actual: bytesToHex(this._hash),
      };
      throw new ProvenanceMarkError(
        ProvenanceMarkErrorType.ValidationError,
        `hash mismatch: expected ${bytesToHex(expectedHash)}, got ${bytesToHex(this._hash)}`,
        { validationIssue: issue },
      );
    }
  }

  /**
   * Check if a sequence of marks is valid.
   */
  static isSequenceValid(marks: ProvenanceMark[]): boolean {
    if (marks.length < 2) {
      return false;
    }
    if (marks[0]._seq === 0 && !marks[0].isGenesis()) {
      return false;
    }
    for (let i = 0; i < marks.length - 1; i++) {
      if (!marks[i].precedes(marks[i + 1])) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if this is a genesis mark (seq 0 and key equals chain_id).
   */
  isGenesis(): boolean {
    return this._seq === 0 && arraysEqual(this._key, this._chainId);
  }

  /**
   * Encode as bytewords with the given style.
   */
  toBytewordsWithStyle(style: BytewordsStyle): string {
    return encodeBytewords(this.message(), style);
  }

  /**
   * Encode as standard bytewords.
   */
  toBytewords(): string {
    return this.toBytewordsWithStyle(BytewordsStyle.Standard);
  }

  /**
   * Decode from bytewords.
   */
  static fromBytewords(res: ProvenanceMarkResolution, bytewords: string): ProvenanceMark {
    const message = decodeBytewords(bytewords, BytewordsStyle.Standard);
    return ProvenanceMark.fromMessage(res, message);
  }

  /**
   * Encode for URL (minimal bytewords of tagged CBOR).
   */
  toUrlEncoding(): string {
    return encodeBytewords(this.toCborData(), BytewordsStyle.Minimal);
  }

  /**
   * Decode from URL encoding.
   */
  static fromUrlEncoding(urlEncoding: string): ProvenanceMark {
    const cborData = decodeBytewords(urlEncoding, BytewordsStyle.Minimal);
    const cborValue = decodeCbor(cborData);
    return ProvenanceMark.fromTaggedCbor(cborValue);
  }

  /**
   * Get the UR string representation (e.g., "ur:provenance/...").
   */
  urString(): string {
    const ur = UR.new("provenance", this.untaggedCbor());
    return ur.string();
  }

  /**
   * Create from a UR string.
   */
  static fromURString(urString: string): ProvenanceMark {
    const ur = UR.fromURString(urString);
    if (ur.urTypeStr() !== "provenance") {
      throw new ProvenanceMarkError(ProvenanceMarkErrorType.CborError, undefined, {
        message: `Expected UR type 'provenance', got '${ur.urTypeStr()}'`,
      });
    }
    return ProvenanceMark.fromUntaggedCbor(ur.cbor());
  }

  /**
   * Build a URL with this mark as a query parameter.
   */
  toUrl(base: string): URL {
    const url = new URL(base);
    url.searchParams.set("provenance", this.toUrlEncoding());
    return url;
  }

  /**
   * Parse a provenance mark from a URL.
   */
  static fromUrl(url: URL): ProvenanceMark {
    const param = url.searchParams.get("provenance");
    if (param === null || param === "") {
      throw new ProvenanceMarkError(ProvenanceMarkErrorType.MissingUrlParameter, undefined, {
        parameter: "provenance",
      });
    }
    return ProvenanceMark.fromUrlEncoding(param);
  }

  /**
   * Get the untagged CBOR representation.
   */
  untaggedCbor(): Cbor {
    return cbor([resolutionToCbor(this._res), cbor(this.message())]);
  }

  /**
   * Get the tagged CBOR representation.
   */
  taggedCbor(): Cbor {
    return cbor({ tag: PROVENANCE_MARK.value, value: this.untaggedCbor() });
  }

  /**
   * Serialize to CBOR bytes (tagged).
   */
  toCborData(): Uint8Array {
    return cborData(this.taggedCbor());
  }

  /**
   * Create from untagged CBOR.
   */
  static fromUntaggedCbor(cborValue: Cbor): ProvenanceMark {
    const arr = expectArray(cborValue);
    if (arr.length !== 2) {
      throw new ProvenanceMarkError(ProvenanceMarkErrorType.CborError, undefined, {
        message: "Invalid provenance mark length",
      });
    }
    const res = resolutionFromCbor(arr[0]);
    const message = expectBytes(arr[1]);
    return ProvenanceMark.fromMessage(res, message);
  }

  /**
   * Create from tagged CBOR.
   */
  static fromTaggedCbor(cborValue: Cbor): ProvenanceMark {
    const cborObj = cborValue as { tag?: number; value?: Cbor };
    if (cborObj.tag !== PROVENANCE_MARK.value) {
      throw new ProvenanceMarkError(ProvenanceMarkErrorType.CborError, undefined, {
        message: `Expected tag ${PROVENANCE_MARK.value}, got ${String(cborObj.tag)}`,
      });
    }
    if (cborObj.value === undefined) {
      throw new ProvenanceMarkError(ProvenanceMarkErrorType.CborError, undefined, {
        message: "Tagged CBOR value is missing",
      });
    }
    return ProvenanceMark.fromUntaggedCbor(cborObj.value);
  }

  /**
   * Create from CBOR bytes.
   */
  static fromCborData(data: Uint8Array): ProvenanceMark {
    const cborValue = decodeCbor(data);
    return ProvenanceMark.fromTaggedCbor(cborValue);
  }

  /**
   * Get the fingerprint (SHA-256 of CBOR data).
   */
  fingerprint(): Uint8Array {
    return sha256(this.toCborData());
  }

  /**
   * Debug string representation.
   */
  toString(): string {
    return `ProvenanceMark(${this.identifier()})`;
  }

  /**
   * Detailed debug representation.
   * Matches Rust format exactly for parity.
   */
  toDebugString(): string {
    // Format date without milliseconds to match Rust format
    const dateStr = this._date.toISOString().replace(".000Z", "Z");
    const components = [
      `key: ${bytesToHex(this._key)}`,
      `hash: ${bytesToHex(this._hash)}`,
      `chainID: ${bytesToHex(this._chainId)}`,
      `seq: ${this._seq}`,
      `date: ${dateStr}`,
    ];

    const info = this.info();
    if (info !== undefined) {
      // Format info as the underlying string value, matching Rust Debug format
      const textValue = info.asText();
      if (textValue !== undefined) {
        components.push(`info: "${textValue}"`);
      } else {
        // For non-text values, use diagnostic format
        components.push(`info: ${info.toDiagnostic()}`);
      }
    }

    return `ProvenanceMark(${components.join(", ")})`;
  }

  /**
   * Check equality with another mark.
   */
  equals(other: ProvenanceMark): boolean {
    return this._res === other._res && arraysEqual(this.message(), other.message());
  }

  /**
   * JSON serialization.
   */
  toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {
      res: this._res,
      key: toBase64(this._key),
      hash: toBase64(this._hash),
      chainID: toBase64(this._chainId),
      seq: this._seq,
      date: this._date.toISOString(),
    };
    if (this._infoBytes.length > 0) {
      result["info_bytes"] = toBase64(this._infoBytes);
    }
    return result;
  }

  /**
   * Create from JSON object.
   */
  static fromJSON(json: Record<string, unknown>): ProvenanceMark {
    const res = json["res"] as ProvenanceMarkResolution;
    const key = fromBase64(json["key"] as string);
    const hash = fromBase64(json["hash"] as string);
    const chainId = fromBase64(json["chainID"] as string);
    const seq = json["seq"] as number;
    const dateStr = json["date"] as string;
    const date = new Date(dateStr);

    const seqBytes = serializeSeq(res, seq);
    const dateBytes = serializeDate(res, date);

    let infoBytes: Uint8Array = new Uint8Array(0);
    if (typeof json["info_bytes"] === "string") {
      infoBytes = fromBase64(json["info_bytes"]);
    }

    return new ProvenanceMark(res, key, hash, chainId, seqBytes, dateBytes, infoBytes, seq, date);
  }

  // ============================================================================
  // Validation (delegate to ValidationReport)
  // ============================================================================

  /**
   * Validate a collection of provenance marks.
   *
   * Matches Rust: `ProvenanceMark::validate()` which delegates to
   * `ValidationReport::validate()`.
   */
  static validate(marks: ProvenanceMark[]): ValidationReport {
    return validateMarks(marks);
  }

  // ============================================================================
  // Envelope Support (EnvelopeEncodable)
  // ============================================================================

  /**
   * Convert this provenance mark to a Gordian Envelope.
   *
   * Creates a leaf envelope containing the tagged CBOR representation.
   * Matches Rust: `Envelope::new(mark.to_cbor())` which creates a CBOR leaf.
   */
  intoEnvelope(): Envelope {
    return Envelope.newLeaf(this.taggedCbor());
  }

  /**
   * Extract a ProvenanceMark from a Gordian Envelope.
   *
   * Matches Rust: `envelope.subject().try_leaf()?.try_into()`
   *
   * @param envelope - The envelope to extract from
   * @returns The extracted provenance mark
   * @throws ProvenanceMarkError if extraction fails
   */
  static fromEnvelope(envelope: Envelope): ProvenanceMark {
    // Extract the CBOR leaf from the envelope subject, matching Rust's try_leaf()
    const leaf = envelope.subject().asLeaf();
    if (leaf !== undefined) {
      return ProvenanceMark.fromTaggedCbor(leaf);
    }

    throw new ProvenanceMarkError(ProvenanceMarkErrorType.CborError, undefined, {
      message: "Could not extract ProvenanceMark from envelope",
    });
  }
}

/**
 * Helper function to compare two Uint8Arrays.
 */
function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
