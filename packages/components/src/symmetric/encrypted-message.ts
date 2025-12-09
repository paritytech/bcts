/**
 * Encrypted message with ChaCha20-Poly1305 AEAD
 *
 * A secure encrypted message using IETF ChaCha20-Poly1305 authenticated
 * encryption.
 *
 * `EncryptedMessage` represents data that has been encrypted using a symmetric
 * key with the ChaCha20-Poly1305 AEAD (Authenticated Encryption with
 * Associated Data) construction as specified in [RFC-8439](https://datatracker.ietf.org/doc/html/rfc8439).
 *
 * An `EncryptedMessage` contains:
 * - `ciphertext`: The encrypted data (same length as the original plaintext)
 * - `aad`: Additional Authenticated Data that is not encrypted but is
 *   authenticated (optional)
 * - `nonce`: A 12-byte number used once for this specific encryption operation
 * - `auth`: A 16-byte authentication tag that verifies the integrity of the
 *   message
 *
 * The `aad` field is often used to include the `Digest` of the plaintext,
 * which allows verification of the plaintext after decryption and preserves
 * the unique identity of the data when used with structures like Gordian
 * Envelope.
 *
 * # CBOR Serialization
 *
 * `EncryptedMessage` is serialized to CBOR with tag 40002.
 *
 * CDDL:
 * ```cddl
 * EncryptedMessage =
 *     #6.40002([ ciphertext: bstr, nonce: bstr, auth: bstr, ? aad: bstr ])
 * ```
 *
 * # UR Serialization
 *
 * When serialized as a Uniform Resource (UR), an `EncryptedMessage` is
 * represented with the type "encrypted".
 *
 * Ported from bc-components-rust/src/symmetric/encrypted_message.rs
 */

import {
  type Cbor,
  type Tag,
  type CborTaggedEncodable,
  type CborTaggedDecodable,
  cbor,
  toByteString,
  expectArray,
  expectBytes,
  createTaggedCbor,
  validateTag,
  extractTaggedContent,
  decodeCbor,
  tagsForValues,
} from "@blockchain-commons/dcbor";
import { ENCRYPTED as TAG_ENCRYPTED } from "@blockchain-commons/tags";
import { UR, type UREncodable } from "@blockchain-commons/uniform-resources";
import { Nonce } from "../nonce.js";
import { Digest } from "../digest.js";
import { AuthenticationTag } from "./authentication-tag.js";
import { bytesToHex } from "../utils.js";

export class EncryptedMessage implements CborTaggedEncodable, CborTaggedDecodable<EncryptedMessage>, UREncodable {
  private readonly _ciphertext: Uint8Array;
  private readonly _aad: Uint8Array;
  private readonly _nonce: Nonce;
  private readonly _auth: AuthenticationTag;

  private constructor(
    ciphertext: Uint8Array,
    aad: Uint8Array,
    nonce: Nonce,
    auth: AuthenticationTag,
  ) {
    this._ciphertext = new Uint8Array(ciphertext);
    this._aad = new Uint8Array(aad);
    this._nonce = nonce;
    this._auth = auth;
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Restores an EncryptedMessage from its components.
   */
  static new(
    ciphertext: Uint8Array,
    aad: Uint8Array,
    nonce: Nonce,
    auth: Uint8Array | AuthenticationTag,
  ): EncryptedMessage {
    const authTag = auth instanceof AuthenticationTag
      ? auth
      : AuthenticationTag.fromData(auth);
    return new EncryptedMessage(ciphertext, aad, nonce, authTag);
  }

  /**
   * Create an EncryptedMessage from components (legacy alias).
   */
  static from(
    nonce: Nonce,
    ciphertext: Uint8Array,
    tag: AuthenticationTag,
    aad?: Uint8Array,
  ): EncryptedMessage {
    return new EncryptedMessage(ciphertext, aad ?? new Uint8Array(0), nonce, tag);
  }

  // ============================================================================
  // Instance Methods
  // ============================================================================

  /**
   * Returns a reference to the ciphertext data.
   */
  ciphertext(): Uint8Array {
    return this._ciphertext;
  }

  /**
   * Returns a reference to the additional authenticated data (AAD).
   */
  aad(): Uint8Array {
    return this._aad;
  }

  /**
   * Returns a reference to the nonce value used for encryption.
   */
  nonce(): Nonce {
    return this._nonce;
  }

  /**
   * Returns a reference to the authentication tag value used for encryption.
   */
  authenticationTag(): AuthenticationTag {
    return this._auth;
  }

  /**
   * Returns a CBOR representation in the AAD field, if it exists.
   */
  aadCbor(): Cbor | null {
    if (this._aad.length === 0) {
      return null;
    }
    try {
      return decodeCbor(this._aad);
    } catch {
      return null;
    }
  }

  /**
   * Returns a Digest instance if the AAD data can be parsed as CBOR.
   */
  aadDigest(): Digest | null {
    const aadCbor = this.aadCbor();
    if (!aadCbor) {
      return null;
    }
    try {
      return Digest.fromTaggedCbor(aadCbor);
    } catch {
      return null;
    }
  }

  /**
   * Returns true if the AAD data can be parsed as a Digest.
   */
  hasDigest(): boolean {
    return this.aadDigest() !== null;
  }

  /**
   * Compare with another EncryptedMessage.
   */
  equals(other: EncryptedMessage): boolean {
    if (this._ciphertext.length !== other._ciphertext.length) return false;
    for (let i = 0; i < this._ciphertext.length; i++) {
      if (this._ciphertext[i] !== other._ciphertext[i]) return false;
    }
    if (this._aad.length !== other._aad.length) return false;
    for (let i = 0; i < this._aad.length; i++) {
      if (this._aad[i] !== other._aad[i]) return false;
    }
    return this._nonce.equals(other._nonce) && this._auth.equals(other._auth);
  }

  /**
   * Get string representation.
   */
  toString(): string {
    return `EncryptedMessage(ciphertext: ${bytesToHex(this._ciphertext).substring(0, 16)}..., nonce: ${this._nonce.toHex()}, auth: ${this._auth.toHex()})`;
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with EncryptedMessage.
   */
  cborTags(): Tag[] {
    return tagsForValues([TAG_ENCRYPTED.value]);
  }

  /**
   * Returns the untagged CBOR encoding (as an array).
   * Array format: [ciphertext, nonce, auth, ?aad]
   */
  untaggedCbor(): Cbor {
    const elements: Cbor[] = [
      toByteString(this._ciphertext),
      toByteString(this._nonce.data()),
      toByteString(this._auth.data()),
    ];

    if (this._aad.length > 0) {
      elements.push(toByteString(this._aad));
    }

    return cbor(elements);
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
   * Creates an EncryptedMessage by decoding it from untagged CBOR.
   */
  fromUntaggedCbor(cborValue: Cbor): EncryptedMessage {
    const elements = expectArray(cborValue);

    if (elements.length < 3) {
      throw new Error("EncryptedMessage must have at least 3 elements");
    }

    const ciphertext = expectBytes(elements[0]);
    const nonceData = expectBytes(elements[1]);
    const nonce = Nonce.fromDataRef(nonceData);
    const authData = expectBytes(elements[2]);
    const auth = AuthenticationTag.fromDataRef(authData);
    const aad = elements.length > 3 ? expectBytes(elements[3]) : new Uint8Array(0);

    return EncryptedMessage.new(ciphertext, aad, nonce, auth);
  }

  /**
   * Creates an EncryptedMessage by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cborValue: Cbor): EncryptedMessage {
    validateTag(cborValue, this.cborTags());
    const content = extractTaggedContent(cborValue);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cborValue: Cbor): EncryptedMessage {
    // Create a dummy instance for accessing instance methods
    const dummy = new EncryptedMessage(
      new Uint8Array(0),
      new Uint8Array(0),
      Nonce.new(),
      AuthenticationTag.fromData(new Uint8Array(16)),
    );
    return dummy.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): EncryptedMessage {
    const cborValue = decodeCbor(data);
    return EncryptedMessage.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): EncryptedMessage {
    const cborValue = decodeCbor(data);
    const dummy = new EncryptedMessage(
      new Uint8Array(0),
      new Uint8Array(0),
      Nonce.new(),
      AuthenticationTag.fromData(new Uint8Array(16)),
    );
    return dummy.fromUntaggedCbor(cborValue);
  }

  // ============================================================================
  // UR Serialization (UREncodable)
  // ============================================================================

  /**
   * Returns the UR representation of the EncryptedMessage.
   * Note: URs use untagged CBOR since the type is conveyed by the UR type itself.
   */
  ur(): UR {
    return UR.new("encrypted", this.untaggedCbor());
  }

  /**
   * Returns the UR string representation.
   */
  urString(): string {
    return this.ur().string();
  }

  /**
   * Creates an EncryptedMessage from a UR.
   */
  static fromUR(ur: UR): EncryptedMessage {
    ur.checkType("encrypted");
    const dummy = new EncryptedMessage(
      new Uint8Array(0),
      new Uint8Array(0),
      Nonce.new(),
      AuthenticationTag.fromData(new Uint8Array(16)),
    );
    return dummy.fromUntaggedCbor(ur.cbor());
  }

  /**
   * Creates an EncryptedMessage from a UR string.
   */
  static fromURString(urString: string): EncryptedMessage {
    const ur = UR.fromURString(urString);
    return EncryptedMessage.fromUR(ur);
  }
}
