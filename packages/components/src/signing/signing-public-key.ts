/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * A public key used for verifying digital signatures.
 *
 * `SigningPublicKey` is a type representing different types of signing public
 * keys. Supports Schnorr, ECDSA, Ed25519, and SR25519.
 *
 * This type implements the `Verifier` interface, allowing it to verify signatures.
 *
 * # CBOR Serialization
 *
 * `SigningPublicKey` is serialized to CBOR with tag 40022.
 *
 * The CBOR encoding (matching Rust bc-components):
 * - Schnorr: `#6.40022(h'<32-byte-x-only-public-key>')` (bare byte string)
 * - ECDSA:   `#6.40022([1, h'<33-byte-compressed-public-key>'])`
 * - Ed25519: `#6.40022([2, h'<32-byte-public-key>'])`
 * - Sr25519: `#6.40022([3, h'<32-byte-public-key>'])`
 *
 * Ported from bc-components-rust/src/signing/signing_public_key.rs
 */

import { ED25519_PUBLIC_KEY_SIZE } from "@bcts/crypto";
import {
  type Cbor,
  type Tag,
  type CborTaggedEncodable,
  type CborTaggedDecodable,
  cbor,
  toByteString,
  expectArray,
  expectBytes,
  expectUnsigned,
  createTaggedCbor,
  validateTag,
  extractTaggedContent,
  decodeCbor,
  tagsForValues,
  isBytes,
  isArray,
  isTagged,
} from "@bcts/dcbor";
import {
  SIGNING_PUBLIC_KEY as TAG_SIGNING_PUBLIC_KEY,
  MLDSA_PUBLIC_KEY as TAG_MLDSA_PUBLIC_KEY,
} from "@bcts/tags";
import { Ed25519PublicKey } from "../ed25519/ed25519-public-key.js";
import { Sr25519PublicKey } from "../sr25519/sr25519-public-key.js";
import { ECPublicKey } from "../ec-key/ec-public-key.js";
import { SchnorrPublicKey } from "../ec-key/schnorr-public-key.js";
import { MLDSAPublicKey } from "../mldsa/mldsa-public-key.js";
import { MLDSALevel } from "../mldsa/mldsa-level.js";
import { SignatureScheme, isMldsaScheme } from "./signature-scheme.js";
import type { Signature } from "./signature.js";
import type { Verifier } from "./signer.js";
import { Reference, type ReferenceProvider } from "../reference.js";
import { Digest } from "../digest.js";
import { UR } from "@bcts/uniform-resources";

/**
 * A public key used for verifying digital signatures.
 *
 * Currently supports:
 * - Schnorr public keys (32 bytes, x-only) - bare byte string in CBOR
 * - ECDSA public keys (33 bytes, compressed) - discriminator 1
 * - Ed25519 public keys (32 bytes) - discriminator 2
 * - Sr25519 public keys (32 bytes) - discriminator 3
 * - MLDSA public keys (post-quantum) - tagged CBOR delegating to MLDSAPublicKey
 */
export class SigningPublicKey
  implements Verifier, ReferenceProvider, CborTaggedEncodable, CborTaggedDecodable<SigningPublicKey>
{
  private readonly _type: SignatureScheme;
  private readonly _schnorrKey: SchnorrPublicKey | undefined;
  private readonly _ecdsaKey: ECPublicKey | undefined;
  private readonly _ed25519Key: Ed25519PublicKey | undefined;
  private readonly _sr25519Key: Sr25519PublicKey | undefined;
  private readonly _mldsaKey: MLDSAPublicKey | undefined;

  private constructor(
    type: SignatureScheme,
    schnorrKey?: SchnorrPublicKey,
    ecdsaKey?: ECPublicKey,
    ed25519Key?: Ed25519PublicKey,
    sr25519Key?: Sr25519PublicKey,
    mldsaKey?: MLDSAPublicKey,
  ) {
    this._type = type;
    this._schnorrKey = schnorrKey;
    this._ecdsaKey = ecdsaKey;
    this._ed25519Key = ed25519Key;
    this._sr25519Key = sr25519Key;
    this._mldsaKey = mldsaKey;
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Creates a new signing public key from a Schnorr (x-only) public key.
   *
   * @param key - A SchnorrPublicKey
   * @returns A new signing public key containing the Schnorr key
   */
  static fromSchnorr(key: SchnorrPublicKey): SigningPublicKey {
    return new SigningPublicKey(
      SignatureScheme.Schnorr,
      key,
      undefined,
      undefined,
      undefined,
      undefined,
    );
  }

  /**
   * Creates a new signing public key from an ECDSA (compressed) public key.
   *
   * @param key - An ECPublicKey
   * @returns A new signing public key containing the ECDSA key
   */
  static fromEcdsa(key: ECPublicKey): SigningPublicKey {
    return new SigningPublicKey(
      SignatureScheme.Ecdsa,
      undefined,
      key,
      undefined,
      undefined,
      undefined,
    );
  }

  /**
   * Creates a new signing public key from an Ed25519 public key.
   *
   * @param key - An Ed25519 public key
   * @returns A new signing public key containing the Ed25519 key
   */
  static fromEd25519(key: Ed25519PublicKey): SigningPublicKey {
    return new SigningPublicKey(
      SignatureScheme.Ed25519,
      undefined,
      undefined,
      key,
      undefined,
      undefined,
    );
  }

  /**
   * Creates a new signing public key from an Sr25519 public key.
   *
   * @param key - An Sr25519 public key
   * @returns A new signing public key containing the Sr25519 key
   */
  static fromSr25519(key: Sr25519PublicKey): SigningPublicKey {
    return new SigningPublicKey(
      SignatureScheme.Sr25519,
      undefined,
      undefined,
      undefined,
      key,
      undefined,
    );
  }

  /**
   * Creates a new signing public key from an MLDSAPublicKey.
   *
   * @param key - An MLDSAPublicKey
   * @returns A new signing public key containing the MLDSA key
   */
  static fromMldsa(key: MLDSAPublicKey): SigningPublicKey {
    // Determine the SignatureScheme based on the MLDSA level
    let scheme: SignatureScheme;
    switch (key.level()) {
      case MLDSALevel.MLDSA44:
        scheme = SignatureScheme.MLDSA44;
        break;
      case MLDSALevel.MLDSA65:
        scheme = SignatureScheme.MLDSA65;
        break;
      case MLDSALevel.MLDSA87:
        scheme = SignatureScheme.MLDSA87;
        break;
      default:
        throw new Error(`Unknown MLDSA level: ${key.level()}`);
    }
    return new SigningPublicKey(scheme, undefined, undefined, undefined, undefined, key);
  }

  // ============================================================================
  // Instance Methods
  // ============================================================================

  /**
   * Returns the signature scheme of this key.
   */
  scheme(): SignatureScheme {
    return this._type;
  }

  /**
   * Returns a human-readable string identifying the key type.
   * @returns A string like "Ed25519", "Schnorr", "ECDSA", "Sr25519", "MLDSA-44", etc.
   */
  keyType(): string {
    switch (this._type) {
      case SignatureScheme.Ed25519:
        return "Ed25519";
      case SignatureScheme.Schnorr:
        return "Schnorr";
      case SignatureScheme.Ecdsa:
        return "ECDSA";
      case SignatureScheme.Sr25519:
        return "Sr25519";
      case SignatureScheme.MLDSA44:
        return "MLDSA-44";
      case SignatureScheme.MLDSA65:
        return "MLDSA-65";
      case SignatureScheme.MLDSA87:
        return "MLDSA-87";
      case SignatureScheme.SshEd25519:
        return "SSH-Ed25519";
      case SignatureScheme.SshDsa:
        return "SSH-DSA";
      case SignatureScheme.SshEcdsaP256:
        return "SSH-ECDSA-P256";
      case SignatureScheme.SshEcdsaP384:
        return "SSH-ECDSA-P384";
      default:
        return this._type;
    }
  }

  /**
   * Returns the underlying Schnorr public key if this is a Schnorr key.
   *
   * @returns The SchnorrPublicKey if this is a Schnorr key, null otherwise
   */
  toSchnorr(): SchnorrPublicKey | null {
    if (this._type === SignatureScheme.Schnorr && this._schnorrKey !== undefined) {
      return this._schnorrKey;
    }
    return null;
  }

  /**
   * Returns the underlying ECDSA public key if this is an ECDSA key.
   *
   * @returns The ECPublicKey if this is an ECDSA key, null otherwise
   */
  toEcdsa(): ECPublicKey | null {
    if (this._type === SignatureScheme.Ecdsa && this._ecdsaKey !== undefined) {
      return this._ecdsaKey;
    }
    return null;
  }

  /**
   * Returns the underlying Ed25519 public key if this is an Ed25519 key.
   *
   * @returns The Ed25519 public key if this is an Ed25519 key, null otherwise
   */
  toEd25519(): Ed25519PublicKey | null {
    if (this._type === SignatureScheme.Ed25519 && this._ed25519Key !== undefined) {
      return this._ed25519Key;
    }
    return null;
  }

  /**
   * Returns the underlying Sr25519 public key if this is an Sr25519 key.
   *
   * @returns The Sr25519 public key if this is an Sr25519 key, null otherwise
   */
  toSr25519(): Sr25519PublicKey | null {
    if (this._type === SignatureScheme.Sr25519 && this._sr25519Key !== undefined) {
      return this._sr25519Key;
    }
    return null;
  }

  /**
   * Checks if this is a Schnorr signing key.
   */
  isSchnorr(): boolean {
    return this._type === SignatureScheme.Schnorr;
  }

  /**
   * Checks if this is an ECDSA signing key.
   */
  isEcdsa(): boolean {
    return this._type === SignatureScheme.Ecdsa;
  }

  /**
   * Checks if this is an Ed25519 signing key.
   */
  isEd25519(): boolean {
    return this._type === SignatureScheme.Ed25519;
  }

  /**
   * Checks if this is an Sr25519 signing key.
   */
  isSr25519(): boolean {
    return this._type === SignatureScheme.Sr25519;
  }

  /**
   * Returns the underlying MLDSA public key if this is an MLDSA key.
   *
   * @returns The MLDSAPublicKey if this is an MLDSA key, null otherwise
   */
  toMldsa(): MLDSAPublicKey | null {
    if (isMldsaScheme(this._type) && this._mldsaKey !== undefined) {
      return this._mldsaKey;
    }
    return null;
  }

  /**
   * Checks if this is an MLDSA signing key.
   */
  isMldsa(): boolean {
    return isMldsaScheme(this._type);
  }

  /**
   * Compare with another SigningPublicKey.
   */
  equals(other: SigningPublicKey): boolean {
    if (this._type !== other._type) return false;
    switch (this._type) {
      case SignatureScheme.Schnorr:
        if (this._schnorrKey === undefined || other._schnorrKey === undefined) return false;
        return this._schnorrKey.equals(other._schnorrKey);
      case SignatureScheme.Ecdsa:
        if (this._ecdsaKey === undefined || other._ecdsaKey === undefined) return false;
        return this._ecdsaKey.equals(other._ecdsaKey);
      case SignatureScheme.Ed25519:
        if (this._ed25519Key === undefined || other._ed25519Key === undefined) return false;
        return this._ed25519Key.equals(other._ed25519Key);
      case SignatureScheme.Sr25519:
        if (this._sr25519Key === undefined || other._sr25519Key === undefined) return false;
        return this._sr25519Key.equals(other._sr25519Key);
      case SignatureScheme.MLDSA44:
      case SignatureScheme.MLDSA65:
      case SignatureScheme.MLDSA87:
        if (this._mldsaKey === undefined || other._mldsaKey === undefined) return false;
        return this._mldsaKey.equals(other._mldsaKey);
      case SignatureScheme.SshEd25519:
      case SignatureScheme.SshDsa:
      case SignatureScheme.SshEcdsaP256:
      case SignatureScheme.SshEcdsaP384:
        return false;
    }
  }

  /**
   * Get string representation.
   */
  toString(): string {
    switch (this._type) {
      case SignatureScheme.Schnorr:
        return `SigningPublicKey(${this._type}, ${this._schnorrKey?.toHex().substring(0, 16)}...)`;
      case SignatureScheme.Ecdsa:
        return `SigningPublicKey(${this._type}, ${this._ecdsaKey?.toHex().substring(0, 16)}...)`;
      case SignatureScheme.Ed25519:
        return `SigningPublicKey(${this._type}, ${this._ed25519Key?.toHex().substring(0, 16)}...)`;
      case SignatureScheme.Sr25519:
        return `SigningPublicKey(${this._type}, ${this._sr25519Key?.toHex().substring(0, 16)}...)`;
      case SignatureScheme.MLDSA44:
      case SignatureScheme.MLDSA65:
      case SignatureScheme.MLDSA87:
        return `SigningPublicKey(${this._type}, ${this._mldsaKey?.toString().substring(0, 30)}...)`;
      case SignatureScheme.SshEd25519:
      case SignatureScheme.SshDsa:
      case SignatureScheme.SshEcdsaP256:
      case SignatureScheme.SshEcdsaP384:
        return `SigningPublicKey(${this._type}, SSH scheme not supported)`;
    }
  }

  // ============================================================================
  // ReferenceProvider Interface
  // ============================================================================

  /**
   * Returns a unique reference to this SigningPublicKey instance.
   *
   * The reference is derived from the SHA-256 hash of the tagged CBOR
   * representation, providing a unique, content-addressable identifier.
   */
  reference(): Reference {
    const digest = Digest.fromImage(this.taggedCborData());
    return Reference.from(digest);
  }

  // ============================================================================
  // Verifier Interface
  // ============================================================================

  /**
   * Verifies a signature against a message.
   *
   * @param signature - The signature to verify
   * @param message - The message that was allegedly signed
   * @returns `true` if the signature is valid, `false` otherwise
   */
  verify(signature: Signature, message: Uint8Array): boolean {
    // Check that signature scheme matches
    if (signature.scheme() !== this._type) {
      return false;
    }

    switch (this._type) {
      case SignatureScheme.Schnorr: {
        if (this._schnorrKey === undefined) {
          return false;
        }
        const sigData = signature.toSchnorr();
        if (sigData === null) {
          return false;
        }
        try {
          return this._schnorrKey.schnorrVerify(sigData, message);
        } catch {
          return false;
        }
      }
      case SignatureScheme.Ecdsa: {
        if (this._ecdsaKey === undefined) {
          return false;
        }
        const sigData = signature.toEcdsa();
        if (sigData === null) {
          return false;
        }
        try {
          return this._ecdsaKey.verify(sigData, message);
        } catch {
          return false;
        }
      }
      case SignatureScheme.Ed25519: {
        if (this._ed25519Key === undefined) {
          return false;
        }
        const sigData = signature.toEd25519();
        if (sigData === null) {
          return false;
        }
        try {
          return this._ed25519Key.verify(message, sigData);
        } catch {
          return false;
        }
      }
      case SignatureScheme.Sr25519: {
        if (this._sr25519Key === undefined) {
          return false;
        }
        const sigData = signature.toSr25519();
        if (sigData === null) {
          return false;
        }
        try {
          return this._sr25519Key.verify(sigData, message);
        } catch {
          return false;
        }
      }
      case SignatureScheme.MLDSA44:
      case SignatureScheme.MLDSA65:
      case SignatureScheme.MLDSA87: {
        if (this._mldsaKey === undefined) {
          return false;
        }
        const mldsaSig = signature.toMldsa();
        if (mldsaSig === null) {
          return false;
        }
        try {
          return this._mldsaKey.verify(mldsaSig, message);
        } catch {
          return false;
        }
      }
      case SignatureScheme.SshEd25519:
      case SignatureScheme.SshDsa:
      case SignatureScheme.SshEcdsaP256:
      case SignatureScheme.SshEcdsaP384:
        return false;
    }
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with SigningPublicKey.
   */
  cborTags(): Tag[] {
    return tagsForValues([TAG_SIGNING_PUBLIC_KEY.value]);
  }

  /**
   * Returns the untagged CBOR encoding.
   *
   * Format (matching Rust bc-components):
   * - Schnorr: h'<32-byte-x-only-public-key>' (bare byte string)
   * - ECDSA:   [1, h'<33-byte-compressed-public-key>']
   * - Ed25519: [2, h'<32-byte-public-key>']
   * - Sr25519: [3, h'<32-byte-public-key>']
   */
  untaggedCbor(): Cbor {
    switch (this._type) {
      case SignatureScheme.Schnorr: {
        if (this._schnorrKey === undefined) {
          throw new Error("Schnorr public key is missing");
        }
        // Rust: CBOR::to_byte_string(key.data()) - bare byte string
        return toByteString(this._schnorrKey.toData());
      }
      case SignatureScheme.Ecdsa: {
        if (this._ecdsaKey === undefined) {
          throw new Error("ECDSA public key is missing");
        }
        return cbor([1, toByteString(this._ecdsaKey.toData())]);
      }
      case SignatureScheme.Ed25519: {
        if (this._ed25519Key === undefined) {
          throw new Error("Ed25519 public key is missing");
        }
        return cbor([2, toByteString(this._ed25519Key.toData())]);
      }
      case SignatureScheme.Sr25519: {
        if (this._sr25519Key === undefined) {
          throw new Error("Sr25519 public key is missing");
        }
        return cbor([3, toByteString(this._sr25519Key.toData())]);
      }
      case SignatureScheme.MLDSA44:
      case SignatureScheme.MLDSA65:
      case SignatureScheme.MLDSA87: {
        if (this._mldsaKey === undefined) {
          throw new Error("MLDSA public key is missing");
        }
        // Rust: delegates to MLDSAPublicKey (which produces tagged CBOR)
        return this._mldsaKey.taggedCbor();
      }
      case SignatureScheme.SshEd25519:
      case SignatureScheme.SshDsa:
      case SignatureScheme.SshEcdsaP256:
      case SignatureScheme.SshEcdsaP384:
        throw new Error(`SSH signature scheme ${this._type} is not supported for CBOR encoding`);
    }
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
   * Creates a SigningPublicKey by decoding it from untagged CBOR.
   *
   * Format (matching Rust bc-components):
   * - h'<32-byte-key>' (bare byte string) for Schnorr
   * - [1, h'<33-byte-key>'] for ECDSA
   * - [2, h'<32-byte-key>'] for Ed25519
   * - [3, h'<32-byte-key>'] for Sr25519
   */
  fromUntaggedCbor(cborValue: Cbor): SigningPublicKey {
    // Rust format: Schnorr is a bare byte string
    if (isBytes(cborValue)) {
      const keyData = expectBytes(cborValue);
      return SigningPublicKey.fromSchnorr(SchnorrPublicKey.from(keyData));
    }

    // Array format for ECDSA, Ed25519, Sr25519
    if (isArray(cborValue)) {
      const elements = expectArray(cborValue);

      if (elements.length !== 2) {
        throw new Error("SigningPublicKey array must have 2 elements");
      }

      const discriminator = expectUnsigned(elements[0]);
      const keyData = expectBytes(elements[1]);

      switch (Number(discriminator)) {
        case 1: // ECDSA
          return SigningPublicKey.fromEcdsa(ECPublicKey.from(keyData));
        case 2: // Ed25519
          return SigningPublicKey.fromEd25519(Ed25519PublicKey.from(keyData));
        case 3: // Sr25519
          return SigningPublicKey.fromSr25519(Sr25519PublicKey.from(keyData));
        default:
          throw new Error(`Unknown SigningPublicKey discriminator: ${discriminator}`);
      }
    }

    // Tagged format for MLDSA
    if (isTagged(cborValue)) {
      const tagged = cborValue.asTagged();
      if (tagged?.[0].value === TAG_MLDSA_PUBLIC_KEY.value) {
        const mldsaKey = MLDSAPublicKey.fromTaggedCbor(cborValue);
        return SigningPublicKey.fromMldsa(mldsaKey);
      }
    }

    throw new Error(
      "SigningPublicKey must be a byte string (Schnorr), array (ECDSA/Ed25519/Sr25519), or tagged MLDSA",
    );
  }

  /**
   * Creates a SigningPublicKey by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cborValue: Cbor): SigningPublicKey {
    validateTag(cborValue, this.cborTags());
    const content = extractTaggedContent(cborValue);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cborValue: Cbor): SigningPublicKey {
    // Create a dummy instance for accessing instance methods
    const dummy = new SigningPublicKey(
      SignatureScheme.Ed25519,
      undefined, // schnorrKey
      undefined, // ecdsaKey
      Ed25519PublicKey.from(new Uint8Array(ED25519_PUBLIC_KEY_SIZE)), // ed25519Key
    );
    return dummy.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): SigningPublicKey {
    const cborValue = decodeCbor(data);
    return SigningPublicKey.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): SigningPublicKey {
    const cborValue = decodeCbor(data);
    const dummy = new SigningPublicKey(
      SignatureScheme.Ed25519,
      undefined, // schnorrKey
      undefined, // ecdsaKey
      Ed25519PublicKey.from(new Uint8Array(ED25519_PUBLIC_KEY_SIZE)), // ed25519Key
    );
    return dummy.fromUntaggedCbor(cborValue);
  }

  // ============================================================================
  // UR (Uniform Resource) Serialization
  // ============================================================================

  /**
   * Get the UR type for signing public keys.
   */
  static readonly UR_TYPE = "signing-public-key";

  /**
   * Returns the UR representation of the signing public key.
   */
  ur(): UR {
    return UR.new(SigningPublicKey.UR_TYPE, this.taggedCbor());
  }

  /**
   * Returns the UR string representation of the signing public key.
   */
  urString(): string {
    return this.ur().string();
  }

  /**
   * Creates a SigningPublicKey from a UR.
   */
  static fromUR(ur: UR): SigningPublicKey {
    ur.checkType(SigningPublicKey.UR_TYPE);
    return SigningPublicKey.fromTaggedCbor(ur.cbor());
  }

  /**
   * Creates a SigningPublicKey from a UR string.
   */
  static fromURString(urString: string): SigningPublicKey {
    const ur = UR.fromURString(urString);
    return SigningPublicKey.fromUR(ur);
  }

  /**
   * Alias for fromURString for Rust API compatibility.
   */
  static fromUrString(urString: string): SigningPublicKey {
    return SigningPublicKey.fromURString(urString);
  }

  // ============================================================================
  // SSH Format
  // ============================================================================

  /**
   * Converts the public key to SSH format.
   * Currently only supports Ed25519 keys.
   */
  toSsh(comment?: string): string {
    if (this._type !== SignatureScheme.Ed25519) {
      throw new Error(`SSH export only supports Ed25519 keys, got ${this._type}`);
    }
    if (this._ed25519Key === undefined) {
      throw new Error("Ed25519 key not initialized");
    }

    // SSH format: ssh-ed25519 <base64-encoded-data> [comment]
    // The data is: 4-byte length of "ssh-ed25519" + "ssh-ed25519" + 4-byte length of key + key bytes
    const algorithm = "ssh-ed25519";
    const algorithmBytes = new TextEncoder().encode(algorithm);
    const keyBytes = this._ed25519Key.toData();
    const keyLen = keyBytes.length;

    // Build the blob: [4-byte length][algorithm][4-byte length][key]
    const totalLength = 4 + algorithmBytes.length + 4 + keyLen;
    const blob = new Uint8Array(totalLength);
    let offset = 0;

    // Write algorithm length (big-endian)
    blob[offset++] = (algorithmBytes.length >> 24) & 0xff;
    blob[offset++] = (algorithmBytes.length >> 16) & 0xff;
    blob[offset++] = (algorithmBytes.length >> 8) & 0xff;
    blob[offset++] = algorithmBytes.length & 0xff;

    // Write algorithm
    blob.set(algorithmBytes, offset);
    offset += algorithmBytes.length;

    // Write key length (big-endian)
    blob[offset++] = (keyLen >> 24) & 0xff;
    blob[offset++] = (keyLen >> 16) & 0xff;
    blob[offset++] = (keyLen >> 8) & 0xff;
    blob[offset++] = keyLen & 0xff;

    // Write key
    blob.set(keyBytes, offset);

    // Base64 encode the blob
    let base64 = "";
    const bytes = blob;
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for (let i = 0; i < bytes.length; i += 3) {
      const b0 = bytes[i];
      const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
      const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
      base64 += chars[(b0 >> 2) & 0x3f];
      base64 += chars[((b0 << 4) | (b1 >> 4)) & 0x3f];
      base64 += i + 1 < bytes.length ? chars[((b1 << 2) | (b2 >> 6)) & 0x3f] : "=";
      base64 += i + 2 < bytes.length ? chars[b2 & 0x3f] : "=";
    }

    const result = `${algorithm} ${base64}`;
    return comment !== undefined && comment !== "" ? `${result} ${comment}` : result;
  }
}
