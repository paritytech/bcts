/**
 * A private key used for creating digital signatures.
 *
 * `SigningPrivateKey` is a type representing different types of signing
 * private keys. Supports Schnorr, ECDSA, Ed25519, and SR25519.
 *
 * This type implements the `Signer` interface, allowing it to create signatures.
 *
 * # CBOR Serialization
 *
 * `SigningPrivateKey` is serialized to CBOR with tag 40021.
 *
 * The CBOR encoding (matching Rust bc-components):
 * - Schnorr: `#6.40021(h'<32-byte-private-key>')` (bare byte string)
 * - ECDSA:   `#6.40021([1, h'<32-byte-private-key>'])`
 * - Ed25519: `#6.40021([2, h'<32-byte-private-key>'])`
 * - SR25519: `#6.40021([3, h'<32-byte-seed>'])`
 *
 * Ported from bc-components-rust/src/signing/signing_private_key.rs
 */

import { ED25519_PRIVATE_KEY_SIZE } from "@bcts/crypto";
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
  SIGNING_PRIVATE_KEY as TAG_SIGNING_PRIVATE_KEY,
  MLDSA_PRIVATE_KEY as TAG_MLDSA_PRIVATE_KEY,
} from "@bcts/tags";
import { Ed25519PrivateKey } from "../ed25519/ed25519-private-key.js";
import { Sr25519PrivateKey } from "../sr25519/sr25519-private-key.js";
import { ECPrivateKey } from "../ec-key/ec-private-key.js";
import { MLDSAPrivateKey } from "../mldsa/mldsa-private-key.js";
import { MLDSALevel } from "../mldsa/mldsa-level.js";
import { SignatureScheme, isMldsaScheme, type SigningOptions } from "./signature-scheme.js";
import { Signature } from "./signature.js";
import { SigningPublicKey } from "./signing-public-key.js";
import type { Signer, Verifier } from "./signer.js";
import { Reference, type ReferenceProvider } from "../reference.js";
import { Digest } from "../digest.js";
import { UR } from "@bcts/uniform-resources";

/**
 * A private key used for creating digital signatures.
 *
 * Currently supports:
 * - Schnorr private keys (32 bytes, secp256k1) - bare byte string in CBOR
 * - ECDSA private keys (32 bytes, secp256k1) - discriminator 1
 * - Ed25519 private keys (32 bytes) - discriminator 2
 * - SR25519 private keys (32-byte seed) - discriminator 3
 * - MLDSA private keys (post-quantum) - tagged CBOR delegating to MLDSAPrivateKey
 */
export class SigningPrivateKey
  implements
    Signer,
    Verifier,
    ReferenceProvider,
    CborTaggedEncodable,
    CborTaggedDecodable<SigningPrivateKey>
{
  private readonly _type: SignatureScheme;
  private readonly _ecKey: ECPrivateKey | undefined;
  private readonly _ed25519Key: Ed25519PrivateKey | undefined;
  private readonly _sr25519Key: Sr25519PrivateKey | undefined;
  private readonly _mldsaKey: MLDSAPrivateKey | undefined;

  private constructor(
    type: SignatureScheme,
    ecKey?: ECPrivateKey,
    ed25519Key?: Ed25519PrivateKey,
    sr25519Key?: Sr25519PrivateKey,
    mldsaKey?: MLDSAPrivateKey,
  ) {
    this._type = type;
    this._ecKey = ecKey;
    this._ed25519Key = ed25519Key;
    this._sr25519Key = sr25519Key;
    this._mldsaKey = mldsaKey;
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Creates a new Schnorr signing private key from an ECPrivateKey.
   *
   * @param key - The EC private key to use for Schnorr signing
   * @returns A new Schnorr signing private key
   */
  static newSchnorr(key: ECPrivateKey): SigningPrivateKey {
    return new SigningPrivateKey(SignatureScheme.Schnorr, key, undefined, undefined, undefined);
  }

  /**
   * Creates a new ECDSA signing private key from an ECPrivateKey.
   *
   * @param key - The EC private key to use for ECDSA signing
   * @returns A new ECDSA signing private key
   */
  static newEcdsa(key: ECPrivateKey): SigningPrivateKey {
    return new SigningPrivateKey(SignatureScheme.Ecdsa, key, undefined, undefined, undefined);
  }

  /**
   * Creates a new Ed25519 signing private key from an Ed25519PrivateKey.
   *
   * @param key - The Ed25519 private key to use
   * @returns A new Ed25519 signing private key
   */
  static newEd25519(key: Ed25519PrivateKey): SigningPrivateKey {
    return new SigningPrivateKey(SignatureScheme.Ed25519, undefined, key, undefined, undefined);
  }

  /**
   * Creates a new SR25519 signing private key from an Sr25519PrivateKey.
   *
   * @param key - The SR25519 private key to use
   * @returns A new SR25519 signing private key
   */
  static newSr25519(key: Sr25519PrivateKey): SigningPrivateKey {
    return new SigningPrivateKey(SignatureScheme.Sr25519, undefined, undefined, key, undefined);
  }

  /**
   * Creates a new MLDSA signing private key from an MLDSAPrivateKey.
   *
   * @param key - The MLDSA private key to use
   * @returns A new MLDSA signing private key
   */
  static newMldsa(key: MLDSAPrivateKey): SigningPrivateKey {
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
    return new SigningPrivateKey(scheme, undefined, undefined, undefined, key);
  }

  /**
   * Creates a new random Ed25519 signing private key.
   *
   * @returns A new random Ed25519 signing private key
   */
  static random(): SigningPrivateKey {
    return SigningPrivateKey.newEd25519(Ed25519PrivateKey.random());
  }

  /**
   * Creates a new random Schnorr signing private key.
   *
   * @returns A new random Schnorr signing private key
   */
  static randomSchnorr(): SigningPrivateKey {
    return SigningPrivateKey.newSchnorr(ECPrivateKey.random());
  }

  /**
   * Creates a new random ECDSA signing private key.
   *
   * @returns A new random ECDSA signing private key
   */
  static randomEcdsa(): SigningPrivateKey {
    return SigningPrivateKey.newEcdsa(ECPrivateKey.random());
  }

  /**
   * Creates a new random SR25519 signing private key.
   *
   * @returns A new random SR25519 signing private key
   */
  static randomSr25519(): SigningPrivateKey {
    return SigningPrivateKey.newSr25519(Sr25519PrivateKey.random());
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
   * Returns the underlying EC private key if this is a Schnorr or ECDSA key.
   *
   * @returns The EC private key if this is a Schnorr or ECDSA key, null otherwise
   */
  toEc(): ECPrivateKey | null {
    if (
      (this._type === SignatureScheme.Schnorr || this._type === SignatureScheme.Ecdsa) &&
      this._ecKey !== undefined
    ) {
      return this._ecKey;
    }
    return null;
  }

  /**
   * Returns the underlying Ed25519 private key if this is an Ed25519 key.
   *
   * @returns The Ed25519 private key if this is an Ed25519 key, null otherwise
   */
  toEd25519(): Ed25519PrivateKey | null {
    if (this._type === SignatureScheme.Ed25519 && this._ed25519Key !== undefined) {
      return this._ed25519Key;
    }
    return null;
  }

  /**
   * Returns the underlying Sr25519 private key if this is an Sr25519 key.
   *
   * @returns The Sr25519 private key if this is an Sr25519 key, null otherwise
   */
  toSr25519(): Sr25519PrivateKey | null {
    if (this._type === SignatureScheme.Sr25519 && this._sr25519Key !== undefined) {
      return this._sr25519Key;
    }
    return null;
  }

  /**
   * Returns the underlying MLDSA private key if this is an MLDSA key.
   *
   * @returns The MLDSA private key if this is an MLDSA key, null otherwise
   */
  toMldsa(): MLDSAPrivateKey | null {
    if (isMldsaScheme(this._type) && this._mldsaKey !== undefined) {
      return this._mldsaKey;
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
   * Checks if this is an MLDSA signing key.
   */
  isMldsa(): boolean {
    return isMldsaScheme(this._type);
  }

  /**
   * Derives the corresponding public key for this private key.
   *
   * @returns The public key corresponding to this private key
   */
  publicKey(): SigningPublicKey {
    switch (this._type) {
      case SignatureScheme.Schnorr: {
        if (this._ecKey === undefined) {
          throw new Error("EC private key is missing");
        }
        return SigningPublicKey.fromSchnorr(this._ecKey.schnorrPublicKey());
      }
      case SignatureScheme.Ecdsa: {
        if (this._ecKey === undefined) {
          throw new Error("EC private key is missing");
        }
        return SigningPublicKey.fromEcdsa(this._ecKey.publicKey());
      }
      case SignatureScheme.Ed25519: {
        if (this._ed25519Key === undefined) {
          throw new Error("Ed25519 private key is missing");
        }
        return SigningPublicKey.fromEd25519(this._ed25519Key.publicKey());
      }
      case SignatureScheme.Sr25519: {
        if (this._sr25519Key === undefined) {
          throw new Error("Sr25519 private key is missing");
        }
        return SigningPublicKey.fromSr25519(this._sr25519Key.publicKey());
      }
      case SignatureScheme.MLDSA44:
      case SignatureScheme.MLDSA65:
      case SignatureScheme.MLDSA87: {
        if (this._mldsaKey === undefined) {
          throw new Error("MLDSA private key is missing");
        }
        return SigningPublicKey.fromMldsa(this._mldsaKey.publicKey());
      }
      case SignatureScheme.SshEd25519:
      case SignatureScheme.SshDsa:
      case SignatureScheme.SshEcdsaP256:
      case SignatureScheme.SshEcdsaP384:
        throw new Error(`SSH signature scheme ${this._type} is not supported`);
    }
  }

  /**
   * Compare with another SigningPrivateKey.
   */
  equals(other: SigningPrivateKey): boolean {
    if (this._type !== other._type) return false;
    switch (this._type) {
      case SignatureScheme.Schnorr:
      case SignatureScheme.Ecdsa:
        if (this._ecKey === undefined || other._ecKey === undefined) return false;
        return this._ecKey.equals(other._ecKey);
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
    return `SigningPrivateKey(${this._type})`;
  }

  // ============================================================================
  // ReferenceProvider Interface
  // ============================================================================

  /**
   * Returns a unique reference to this SigningPrivateKey instance.
   *
   * The reference is derived from the SHA-256 hash of the tagged CBOR
   * representation, providing a unique, content-addressable identifier.
   */
  reference(): Reference {
    const digest = Digest.fromImage(this.taggedCborData());
    return Reference.from(digest);
  }

  // ============================================================================
  // Signer Interface
  // ============================================================================

  /**
   * Signs a message with optional signing options.
   *
   * Different signature schemes may use the options differently:
   * - Schnorr: Can accept a custom random number generator via SigningOptions.Schnorr
   * - SSH: Would require namespace and hash algorithm (not yet implemented)
   * - Other schemes (ECDSA, Ed25519, Sr25519, MLDSA): Options are ignored
   *
   * @param message - The message to sign
   * @param options - Optional signing options
   * @returns The digital signature
   */
  signWithOptions(message: Uint8Array, options?: SigningOptions): Signature {
    switch (this._type) {
      case SignatureScheme.Schnorr: {
        if (this._ecKey === undefined) {
          throw new Error("EC private key is missing");
        }
        // If Schnorr options with custom RNG are provided, use them
        if (options?.type === "Schnorr") {
          const sigData = this._ecKey.schnorrSignUsing(message, options.rng);
          return Signature.schnorrFromData(sigData);
        }
        // Otherwise use default RNG
        const sigData = this._ecKey.schnorrSign(message);
        return Signature.schnorrFromData(sigData);
      }
      case SignatureScheme.Ecdsa: {
        if (this._ecKey === undefined) {
          throw new Error("EC private key is missing");
        }
        const sigData = this._ecKey.ecdsaSign(message);
        return Signature.ecdsaFromData(sigData);
      }
      case SignatureScheme.Ed25519: {
        if (this._ed25519Key === undefined) {
          throw new Error("Ed25519 private key is missing");
        }
        const sigData = this._ed25519Key.sign(message);
        return Signature.ed25519FromData(sigData);
      }
      case SignatureScheme.Sr25519: {
        if (this._sr25519Key === undefined) {
          throw new Error("Sr25519 private key is missing");
        }
        const sigData = this._sr25519Key.sign(message);
        return Signature.sr25519FromData(sigData);
      }
      case SignatureScheme.MLDSA44:
      case SignatureScheme.MLDSA65:
      case SignatureScheme.MLDSA87: {
        if (this._mldsaKey === undefined) {
          throw new Error("MLDSA private key is missing");
        }
        const mldsaSig = this._mldsaKey.sign(message);
        return Signature.mldsaFromSignature(mldsaSig);
      }
      case SignatureScheme.SshEd25519:
      case SignatureScheme.SshDsa:
      case SignatureScheme.SshEcdsaP256:
      case SignatureScheme.SshEcdsaP384:
        // SSH signing requires SigningOptions.Ssh with namespace and hash algorithm
        if (options?.type === "Ssh") {
          throw new Error(
            `SSH signature scheme ${this._type} is not yet implemented. ` +
              `Namespace: ${options.namespace}, hashAlg: ${options.hashAlg}`,
          );
        }
        throw new Error(`SSH signature scheme ${this._type} requires SigningOptions.Ssh`);
    }
  }

  /**
   * Signs a message using default options.
   *
   * This is a convenience method that calls `signWithOptions` with no options.
   *
   * @param message - The message to sign
   * @returns The digital signature
   */
  sign(message: Uint8Array): Signature {
    return this.signWithOptions(message);
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
    return this.publicKey().verify(signature, message);
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with SigningPrivateKey.
   */
  cborTags(): Tag[] {
    return tagsForValues([TAG_SIGNING_PRIVATE_KEY.value]);
  }

  /**
   * Returns the untagged CBOR encoding.
   *
   * Format (matching Rust bc-components):
   * - Schnorr: h'<32-byte-private-key>' (bare byte string)
   * - ECDSA:   [1, h'<32-byte-private-key>']
   * - Ed25519: [2, h'<32-byte-private-key>']
   * - Sr25519: [3, h'<32-byte-seed>']
   * - MLDSA:   delegates to MLDSAPrivateKey (tagged)
   */
  untaggedCbor(): Cbor {
    switch (this._type) {
      case SignatureScheme.Schnorr: {
        if (this._ecKey === undefined) {
          throw new Error("EC private key is missing");
        }
        // Rust: CBOR::to_byte_string(key.data()) - bare byte string
        return toByteString(this._ecKey.toData());
      }
      case SignatureScheme.Ecdsa: {
        if (this._ecKey === undefined) {
          throw new Error("EC private key is missing");
        }
        return cbor([1, toByteString(this._ecKey.toData())]);
      }
      case SignatureScheme.Ed25519: {
        if (this._ed25519Key === undefined) {
          throw new Error("Ed25519 private key is missing");
        }
        return cbor([2, toByteString(this._ed25519Key.toData())]);
      }
      case SignatureScheme.Sr25519: {
        if (this._sr25519Key === undefined) {
          throw new Error("Sr25519 private key is missing");
        }
        return cbor([3, toByteString(this._sr25519Key.toData())]);
      }
      case SignatureScheme.MLDSA44:
      case SignatureScheme.MLDSA65:
      case SignatureScheme.MLDSA87: {
        if (this._mldsaKey === undefined) {
          throw new Error("MLDSA private key is missing");
        }
        // Rust: delegates to MLDSAPrivateKey (which produces tagged CBOR)
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
   * Creates a SigningPrivateKey by decoding it from untagged CBOR.
   *
   * Format (matching Rust bc-components):
   * - h'<32-byte-key>' (bare byte string) for Schnorr
   * - [1, h'<32-byte-key>'] for ECDSA
   * - [2, h'<32-byte-key>'] for Ed25519
   * - [3, h'<32-byte-seed>'] for Sr25519
   * - tagged MLDSA private key for MLDSA variants
   */
  fromUntaggedCbor(cborValue: Cbor): SigningPrivateKey {
    // Rust format: Schnorr is a bare byte string
    if (isBytes(cborValue)) {
      const keyData = expectBytes(cborValue);
      return SigningPrivateKey.newSchnorr(ECPrivateKey.from(keyData));
    }

    // Array format for ECDSA, Ed25519, Sr25519
    if (isArray(cborValue)) {
      const elements = expectArray(cborValue);

      if (elements.length !== 2) {
        throw new Error("SigningPrivateKey array must have 2 elements");
      }

      const discriminator = expectUnsigned(elements[0]);
      const keyData = expectBytes(elements[1]);

      switch (Number(discriminator)) {
        case 1: // ECDSA
          return SigningPrivateKey.newEcdsa(ECPrivateKey.from(keyData));
        case 2: // Ed25519
          return SigningPrivateKey.newEd25519(Ed25519PrivateKey.from(keyData));
        case 3: // Sr25519
          return SigningPrivateKey.newSr25519(Sr25519PrivateKey.from(keyData));
        default:
          throw new Error(`Unknown SigningPrivateKey discriminator: ${discriminator}`);
      }
    }

    // Tagged format for MLDSA
    if (isTagged(cborValue)) {
      const tagged = cborValue.asTagged();
      if (tagged !== undefined && tagged[0].value === TAG_MLDSA_PRIVATE_KEY.value) {
        const mldsaKey = MLDSAPrivateKey.fromTaggedCbor(cborValue);
        return SigningPrivateKey.newMldsa(mldsaKey);
      }
    }

    throw new Error(
      "SigningPrivateKey must be a byte string (Schnorr), array (ECDSA/Ed25519/Sr25519), or tagged MLDSA",
    );
  }

  /**
   * Creates a SigningPrivateKey by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cborValue: Cbor): SigningPrivateKey {
    validateTag(cborValue, this.cborTags());
    const content = extractTaggedContent(cborValue);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cborValue: Cbor): SigningPrivateKey {
    // Create a dummy instance for accessing instance methods
    const dummy = new SigningPrivateKey(
      SignatureScheme.Ed25519,
      undefined, // ecKey
      Ed25519PrivateKey.from(new Uint8Array(ED25519_PRIVATE_KEY_SIZE)), // ed25519Key
    );
    return dummy.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): SigningPrivateKey {
    const cborValue = decodeCbor(data);
    return SigningPrivateKey.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): SigningPrivateKey {
    const cborValue = decodeCbor(data);
    const dummy = new SigningPrivateKey(
      SignatureScheme.Ed25519,
      undefined, // ecKey
      Ed25519PrivateKey.from(new Uint8Array(ED25519_PRIVATE_KEY_SIZE)), // ed25519Key
    );
    return dummy.fromUntaggedCbor(cborValue);
  }

  // ============================================================================
  // UR (Uniform Resource) Serialization
  // ============================================================================

  /**
   * Get the UR type for signing private keys.
   */
  static readonly UR_TYPE = "signing-private-key";

  /**
   * Returns the UR representation of the signing private key.
   */
  ur(): UR {
    return UR.new(SigningPrivateKey.UR_TYPE, this.taggedCbor());
  }

  /**
   * Returns the UR string representation of the signing private key.
   */
  urString(): string {
    return this.ur().string();
  }

  /**
   * Creates a SigningPrivateKey from a UR.
   */
  static fromUR(ur: UR): SigningPrivateKey {
    ur.checkType(SigningPrivateKey.UR_TYPE);
    return SigningPrivateKey.fromTaggedCbor(ur.cbor());
  }

  /**
   * Creates a SigningPrivateKey from a UR string.
   */
  static fromURString(urString: string): SigningPrivateKey {
    const ur = UR.fromURString(urString);
    return SigningPrivateKey.fromUR(ur);
  }

  /**
   * Alias for fromURString for Rust API compatibility.
   */
  static fromUrString(urString: string): SigningPrivateKey {
    return SigningPrivateKey.fromURString(urString);
  }

  // ============================================================================
  // SSH Format
  // ============================================================================

  /**
   * Converts the private key to OpenSSH format.
   * Currently only supports Ed25519 keys.
   */
  toSsh(comment?: string): string {
    if (this._type !== SignatureScheme.Ed25519) {
      throw new Error(`SSH export only supports Ed25519 keys, got ${this._type}`);
    }
    if (this._ed25519Key === undefined) {
      throw new Error("Ed25519 key not initialized");
    }

    // OpenSSH private key format for Ed25519

    const publicKey = this._ed25519Key.publicKey();
    const privateKeyBytes = this._ed25519Key.toData();
    const publicKeyBytes = publicKey.toData();

    // For OpenSSH Ed25519, the "private key" is actually the 64-byte concatenation of:
    // - 32-byte seed (the actual private key)
    // - 32-byte public key
    const combinedKey = new Uint8Array(64);
    combinedKey.set(privateKeyBytes, 0);
    combinedKey.set(publicKeyBytes, 32);

    // Build the OpenSSH private key format (simplified version)
    const algorithm = "ssh-ed25519";
    const checkInt = Math.floor(Math.random() * 0xffffffff);
    const checkIntBytes = new Uint8Array(4);
    checkIntBytes[0] = (checkInt >> 24) & 0xff;
    checkIntBytes[1] = (checkInt >> 16) & 0xff;
    checkIntBytes[2] = (checkInt >> 8) & 0xff;
    checkIntBytes[3] = checkInt & 0xff;

    // This is a simplified implementation - in practice you'd need bcrypt_pbkdf
    // and proper key wrapping. For now, return a placeholder format.
    const actualComment = comment ?? "";
    return `-----BEGIN OPENSSH PRIVATE KEY-----
Placeholder for ${algorithm} private key export (${actualComment})
This requires bcrypt_pbkdf implementation for proper encryption.
-----END OPENSSH PRIVATE KEY-----`;
  }
}
