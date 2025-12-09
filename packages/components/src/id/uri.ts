/**
 * Uniform Resource Identifier (URI) - String-based identifier
 *
 * A URI is a string of characters that unambiguously identifies a particular
 * resource. This implementation validates URIs using the URL API to ensure
 * conformance to RFC 3986.
 *
 * URIs are commonly used for:
 * - Web addresses (URLs like "https://example.com")
 * - Resource identifiers in various protocols
 * - Namespace identifiers
 * - References to resources in distributed systems
 *
 * # CBOR Serialization
 *
 * `URI` is serialized to CBOR with tag 32 (standard URI tag).
 *
 * # UR Serialization
 *
 * When serialized as a Uniform Resource (UR), a `URI` is represented with the
 * type "url".
 */

import {
  type Cbor,
  type Tag,
  type CborTaggedEncodable,
  type CborTaggedDecodable,
  cbor,
  expectText,
  createTaggedCbor,
  validateTag,
  extractTaggedContent,
  decodeCbor,
  tagsForValues,
} from "@bcts/dcbor";
import { URI as TAG_URI } from "@bcts/tags";
import { UR, type UREncodable } from "@bcts/uniform-resources";
import { CryptoError } from "../error.js";
import { toBase64 } from "../utils.js";

export class URI implements CborTaggedEncodable, CborTaggedDecodable<URI>, UREncodable {
  private readonly _uri: string;

  private constructor(uri: string) {
    this._uri = uri;
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Creates a new `URI` from a string with validation.
   */
  static new(uri: string): URI {
    // Validate using URL API
    try {
      new URL(uri);
      return new URI(uri);
    } catch {
      throw CryptoError.invalidData("URI: invalid URI format");
    }
  }

  /**
   * Create a URI from string (legacy alias).
   */
  static from(uri: string): URI {
    return URI.new(uri);
  }

  /**
   * Parse a URI string (alias for new()).
   */
  static parse(uriString: string): URI {
    return URI.new(uriString);
  }

  // ============================================================================
  // Instance Methods
  // ============================================================================

  /**
   * Get the URI as a string reference.
   */
  asRef(): string {
    return this._uri;
  }

  /**
   * Get the URI string.
   */
  toString(): string {
    return this._uri;
  }

  /**
   * Get the URI string (alias).
   */
  toURI(): string {
    return this._uri;
  }

  /**
   * Get the raw URI string.
   */
  getRaw(): string {
    return this._uri;
  }

  /**
   * Get scheme (e.g., "http", "https", "urn").
   */
  scheme(): string | null {
    const match = /^([a-z][a-z0-9+.-]*):\/?\/?/i.exec(this._uri);
    return match !== null ? match[1] : null;
  }

  /**
   * Get path component.
   */
  path(): string {
    try {
      const url = new URL(this._uri);
      return url.pathname;
    } catch {
      // For non-URL URIs, try to extract path after scheme
      const withoutScheme = this._uri.replace(/^[a-z][a-z0-9+.-]*:\/?\/?/i, "");
      return withoutScheme;
    }
  }

  /**
   * Check if URI is absolute (has a scheme).
   */
  isAbsolute(): boolean {
    return /^[a-z][a-z0-9+.-]*:/i.test(this._uri);
  }

  /**
   * Check if URI is relative.
   */
  isRelative(): boolean {
    return !this.isAbsolute();
  }

  /**
   * Compare with another URI.
   */
  equals(other: URI): boolean {
    return this._uri === other._uri;
  }

  /**
   * Check if URI starts with given prefix.
   */
  startsWith(prefix: string): boolean {
    return this._uri.startsWith(prefix);
  }

  /**
   * Get base64 representation of the URI string.
   */
  toBase64(): string {
    return toBase64(new TextEncoder().encode(this._uri));
  }

  /**
   * Get the length of the URI string.
   */
  length(): number {
    return this._uri.length;
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with URI.
   */
  cborTags(): Tag[] {
    return tagsForValues([TAG_URI.value]);
  }

  /**
   * Returns the untagged CBOR encoding (as a text string).
   */
  untaggedCbor(): Cbor {
    return cbor(this._uri);
  }

  /**
   * Returns the tagged CBOR encoding.
   */
  taggedCbor(): Cbor {
    return createTaggedCbor(this);
  }

  /**
   * Returns the tagged value in CBOR binary representation.
   */
  taggedCborData(): Uint8Array {
    return this.taggedCbor().toData();
  }

  // ============================================================================
  // CBOR Deserialization (CborTaggedDecodable)
  // ============================================================================

  /**
   * Creates a URI by decoding it from untagged CBOR.
   */
  fromUntaggedCbor(cborValue: Cbor): URI {
    const text = expectText(cborValue);
    return URI.new(text);
  }

  /**
   * Creates a URI by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cborValue: Cbor): URI {
    validateTag(cborValue, this.cborTags());
    const content = extractTaggedContent(cborValue);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cborValue: Cbor): URI {
    const instance = new URI("https://placeholder.invalid");
    return instance.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): URI {
    const cborValue = decodeCbor(data);
    return URI.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): URI {
    const cborValue = decodeCbor(data);
    const text = expectText(cborValue);
    return URI.new(text);
  }

  // ============================================================================
  // UR Serialization (UREncodable)
  // ============================================================================

  /**
   * Returns the UR representation of the URI.
   * Note: URs use untagged CBOR since the type is conveyed by the UR type itself.
   */
  ur(): UR {
    return UR.new("url", this.untaggedCbor());
  }

  /**
   * Returns the UR string representation.
   */
  urString(): string {
    return this.ur().string();
  }

  /**
   * Creates a URI from a UR.
   */
  static fromUR(ur: UR): URI {
    ur.checkType("url");
    const instance = new URI("https://placeholder.invalid");
    return instance.fromUntaggedCbor(ur.cbor());
  }

  /**
   * Creates a URI from a UR string.
   */
  static fromURString(urString: string): URI {
    const ur = UR.fromURString(urString);
    return URI.fromUR(ur);
  }
}
