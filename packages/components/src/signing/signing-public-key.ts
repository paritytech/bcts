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
  toTaggedValue,
  expectArray,
  expectBytes,
  expectText,
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
  SSH_TEXT_PUBLIC_KEY as TAG_SSH_TEXT_PUBLIC_KEY,
} from "@bcts/tags";
import { Ed25519PublicKey } from "../ed25519/ed25519-public-key.js";
import { Sr25519PublicKey } from "../sr25519/sr25519-public-key.js";
import { ECPublicKey } from "../ec-key/ec-public-key.js";
import { SchnorrPublicKey } from "../ec-key/schnorr-public-key.js";
import { MLDSAPublicKey } from "../mldsa/mldsa-public-key.js";
import { MLDSALevel } from "../mldsa/mldsa-level.js";
import { SSHPublicKey } from "../ssh/ssh-public-key.js";
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
  private readonly _sshKey: SSHPublicKey | undefined;

  private constructor(
    type: SignatureScheme,
    schnorrKey?: SchnorrPublicKey,
    ecdsaKey?: ECPublicKey,
    ed25519Key?: Ed25519PublicKey,
    sr25519Key?: Sr25519PublicKey,
    mldsaKey?: MLDSAPublicKey,
    sshKey?: SSHPublicKey,
  ) {
    this._type = type;
    this._schnorrKey = schnorrKey;
    this._ecdsaKey = ecdsaKey;
    this._ed25519Key = ed25519Key;
    this._sr25519Key = sr25519Key;
    this._mldsaKey = mldsaKey;
    this._sshKey = sshKey;
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

  /**
   * Creates a new signing public key from an SSHPublicKey.
   *
   * Mirrors Rust `SigningPublicKey::from_ssh`
   * (`bc-components-rust/src/signing/signing_public_key.rs:214`).
   *
   * @param key - An SSHPublicKey
   * @returns A new signing public key wrapping the SSH public key
   */
  static fromSsh(key: SSHPublicKey): SigningPublicKey {
    let scheme: SignatureScheme;
    switch (key.data.kind) {
      case "ed25519":
        scheme = SignatureScheme.SshEd25519;
        break;
      case "dsa":
        scheme = SignatureScheme.SshDsa;
        break;
      case "ecdsa":
        switch (key.data.curve) {
          case "nistp256":
            scheme = SignatureScheme.SshEcdsaP256;
            break;
          case "nistp384":
            scheme = SignatureScheme.SshEcdsaP384;
            break;
        }
        break;
    }
    return new SigningPublicKey(scheme, undefined, undefined, undefined, undefined, undefined, key);
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
   * Returns the underlying SSH public key if this is an SSH key.
   *
   * Mirrors Rust `SigningPublicKey::to_ssh`
   * (`bc-components-rust/src/signing/signing_public_key.rs:272`).
   *
   * @returns The SSHPublicKey if this is an SSH key, null otherwise
   */
  toSsh(): SSHPublicKey | null {
    return this._sshKey ?? null;
  }

  /**
   * Checks if this is an SSH signing key.
   */
  isSsh(): boolean {
    return this._sshKey !== undefined;
  }

  /**
   * Returns a copy of this SSH public key with its comment replaced.
   * Throws if this is not an SSH key — mirrors Rust's `set_comment`
   * which is only callable on `SigningPublicKey::SSH` variants.
   */
  withSshComment(comment: string): SigningPublicKey {
    if (this._sshKey === undefined) {
      throw new Error(`SigningPublicKey.withSshComment: not an SSH key (scheme: ${this._type})`);
    }
    return SigningPublicKey.fromSsh(this._sshKey.withComment(comment));
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
      case SignatureScheme.SshEcdsaP384: {
        if (this._sshKey === undefined || other._sshKey === undefined) return false;
        return this._sshKey.equals(other._sshKey);
      }
    }
  }

  /**
   * Get string representation.
   *
   * Mirrors Rust `Display for SigningPublicKey`
   * (`bc-components-rust/src/signing/signing_public_key.rs:573-606`):
   *   `SigningPublicKey(<ref_hex_short>, <inner_key_display>)`
   * The reference is computed from the tagged-CBOR form.
   */
  toString(): string {
    const refShort = this.reference().shortReference("hex");
    let innerDisplay: string;
    switch (this._type) {
      case SignatureScheme.Schnorr:
        innerDisplay = this._schnorrKey?.toString() ?? String(this._type);
        break;
      case SignatureScheme.Ecdsa:
        innerDisplay = this._ecdsaKey?.toString() ?? String(this._type);
        break;
      case SignatureScheme.Ed25519:
        innerDisplay = this._ed25519Key?.toString() ?? String(this._type);
        break;
      case SignatureScheme.Sr25519:
        innerDisplay = this._sr25519Key?.toString() ?? String(this._type);
        break;
      case SignatureScheme.MLDSA44:
      case SignatureScheme.MLDSA65:
      case SignatureScheme.MLDSA87:
        innerDisplay = this._mldsaKey?.toString() ?? String(this._type);
        break;
      case SignatureScheme.SshEd25519:
      case SignatureScheme.SshDsa:
      case SignatureScheme.SshEcdsaP256:
      case SignatureScheme.SshEcdsaP384:
        // Mirror Rust `SigningPublicKey::SSH(key) => format!("SSHPublicKey({})", key.ref_hex_short())`
        // (`signing_public_key.rs:592-594`).
        innerDisplay = this._sshKey?.toString() ?? `SSHPublicKey(${refShort})`;
        break;
    }
    return `SigningPublicKey(${refShort}, ${innerDisplay})`;
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
      case SignatureScheme.SshEcdsaP384: {
        if (this._sshKey === undefined) return false;
        const sshSig = signature.toSsh();
        if (sshSig === null) return false;
        // Mirror Rust `SigningPublicKey::SSH(key) => key.verify(sig.namespace(), msg, sig).is_ok()`
        // (`signing_public_key.rs:362-364`).
        try {
          return this._sshKey.verifySshSignature(sshSig.namespace, message, sshSig);
        } catch {
          return false;
        }
      }
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
      case SignatureScheme.SshEcdsaP384: {
        if (this._sshKey === undefined) {
          throw new Error("SSH public key is missing");
        }
        // Mirror Rust `SigningPublicKey::SSH(key) => to_tagged_value(TAG_SSH_TEXT_PUBLIC_KEY, openssh)`
        // (`signing_public_key.rs:441-443`).
        return toTaggedValue(TAG_SSH_TEXT_PUBLIC_KEY, this._sshKey.toOpenssh());
      }
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

    // Tagged format for MLDSA / SSH
    if (isTagged(cborValue)) {
      const tagged = cborValue.asTagged();
      if (tagged?.[0].value === TAG_MLDSA_PUBLIC_KEY.value) {
        const mldsaKey = MLDSAPublicKey.fromTaggedCbor(cborValue);
        return SigningPublicKey.fromMldsa(mldsaKey);
      }
      if (tagged?.[0].value === TAG_SSH_TEXT_PUBLIC_KEY.value) {
        const text = expectText(tagged[1]);
        const sshKey = SSHPublicKey.fromOpenssh(text);
        return SigningPublicKey.fromSsh(sshKey);
      }
    }

    throw new Error(
      "SigningPublicKey must be a byte string (Schnorr), array (ECDSA/Ed25519/Sr25519), tagged MLDSA, or tagged SSH",
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
   * Returns the OpenSSH single-line public-key text for an SSH public key.
   *
   * Only valid when this `SigningPublicKey` wraps an `SSHPublicKey`
   * (i.e. one of the four `SignatureScheme.SshXxx` variants). Mirrors
   * Rust's `SigningPublicKey::SSH(key) => key.to_openssh()` usage at
   * `signing_public_key.rs:442`.
   */
  toSshOpenssh(): string {
    if (this._sshKey === undefined) {
      throw new Error(`SigningPublicKey is not an SSH key (scheme: ${this._type})`);
    }
    return this._sshKey.toOpenssh();
  }
}
