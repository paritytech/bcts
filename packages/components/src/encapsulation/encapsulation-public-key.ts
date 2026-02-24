/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Encapsulation public key for key encapsulation mechanisms
 *
 * This type represents a public key that can be used to encapsulate (encrypt)
 * a shared secret. The recipient can then use their corresponding private key
 * to decapsulate (decrypt) the shared secret.
 *
 * For X25519, encapsulation works by:
 * 1. Generating an ephemeral key pair
 * 2. Performing ECDH with the ephemeral private key and the recipient's public key
 * 3. Returning the shared secret and the ephemeral public key as "ciphertext"
 *
 * For MLKEM, encapsulation uses the ML-KEM algorithm to generate a shared secret
 * and ciphertext.
 *
 * # CBOR Serialization
 *
 * For X25519, the public key is serialized with tag 40011.
 * For MLKEM, the public key is serialized with tag 40101.
 *
 * Ported from bc-components-rust/src/encapsulation/encapsulation_public_key.rs
 */

import {
  type Cbor,
  type Tag,
  type CborTaggedEncodable,
  type CborTaggedDecodable,
  toByteString,
  expectBytes,
  createTaggedCbor,
  extractTaggedContent,
  decodeCbor,
  tagsForValues,
  tagValue,
} from "@bcts/dcbor";
import { UR, type UREncodable } from "@bcts/uniform-resources";
import {
  X25519_PUBLIC_KEY as TAG_X25519_PUBLIC_KEY,
  MLKEM_PUBLIC_KEY as TAG_MLKEM_PUBLIC_KEY,
} from "@bcts/tags";
import { X25519PrivateKey } from "../x25519/x25519-private-key.js";
import { X25519PublicKey } from "../x25519/x25519-public-key.js";
import { type SymmetricKey } from "../symmetric/symmetric-key.js";
import { EncapsulationScheme } from "./encapsulation-scheme.js";
import { EncapsulationCiphertext } from "./encapsulation-ciphertext.js";
import { MLKEMPublicKey } from "../mlkem/mlkem-public-key.js";
import { MLKEMLevel } from "../mlkem/mlkem-level.js";
import { bytesToHex } from "../utils.js";
import { Reference, type ReferenceProvider } from "../reference.js";
import { Digest } from "../digest.js";

/**
 * Convert MLKEMLevel to EncapsulationScheme
 */
function mlkemLevelToScheme(level: MLKEMLevel): EncapsulationScheme {
  switch (level) {
    case MLKEMLevel.MLKEM512:
      return EncapsulationScheme.MLKEM512;
    case MLKEMLevel.MLKEM768:
      return EncapsulationScheme.MLKEM768;
    case MLKEMLevel.MLKEM1024:
      return EncapsulationScheme.MLKEM1024;
  }
}

/**
 * Check if a scheme is an MLKEM scheme
 */
function isMlkemScheme(scheme: EncapsulationScheme): boolean {
  return (
    scheme === EncapsulationScheme.MLKEM512 ||
    scheme === EncapsulationScheme.MLKEM768 ||
    scheme === EncapsulationScheme.MLKEM1024
  );
}

/**
 * Represents a public key for key encapsulation.
 *
 * Use this to encapsulate a shared secret for a recipient.
 */
export class EncapsulationPublicKey
  implements
    ReferenceProvider,
    CborTaggedEncodable,
    CborTaggedDecodable<EncapsulationPublicKey>,
    UREncodable
{
  private readonly _scheme: EncapsulationScheme;
  private readonly _x25519PublicKey: X25519PublicKey | undefined;
  private readonly _mlkemPublicKey: MLKEMPublicKey | undefined;

  private constructor(
    scheme: EncapsulationScheme,
    x25519PublicKey?: X25519PublicKey,
    mlkemPublicKey?: MLKEMPublicKey,
  ) {
    this._scheme = scheme;
    this._x25519PublicKey = x25519PublicKey;
    this._mlkemPublicKey = mlkemPublicKey;
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Create an EncapsulationPublicKey from an X25519PublicKey.
   */
  static fromX25519PublicKey(publicKey: X25519PublicKey): EncapsulationPublicKey {
    return new EncapsulationPublicKey(EncapsulationScheme.X25519, publicKey, undefined);
  }

  /**
   * Create an EncapsulationPublicKey from raw X25519 public key bytes.
   */
  static fromX25519Data(data: Uint8Array): EncapsulationPublicKey {
    const publicKey = X25519PublicKey.fromDataRef(data);
    return EncapsulationPublicKey.fromX25519PublicKey(publicKey);
  }

  /**
   * Create an EncapsulationPublicKey from an MLKEMPublicKey.
   */
  static fromMlkem(publicKey: MLKEMPublicKey): EncapsulationPublicKey {
    const scheme = mlkemLevelToScheme(publicKey.level());
    return new EncapsulationPublicKey(scheme, undefined, publicKey);
  }

  /**
   * Create an EncapsulationPublicKey from raw MLKEM public key bytes.
   */
  static fromMlkemData(level: MLKEMLevel, data: Uint8Array): EncapsulationPublicKey {
    const publicKey = MLKEMPublicKey.fromBytes(level, data);
    return EncapsulationPublicKey.fromMlkem(publicKey);
  }

  // ============================================================================
  // Instance Methods
  // ============================================================================

  /**
   * Returns the encapsulation scheme.
   */
  encapsulationScheme(): EncapsulationScheme {
    return this._scheme;
  }

  /**
   * Returns true if this is an X25519 public key.
   */
  isX25519(): boolean {
    return this._scheme === EncapsulationScheme.X25519;
  }

  /**
   * Returns true if this is an MLKEM public key.
   */
  isMlkem(): boolean {
    return isMlkemScheme(this._scheme);
  }

  /**
   * Returns the X25519 public key if this is an X25519 encapsulation key.
   * @throws Error if this is not an X25519 key
   */
  x25519PublicKey(): X25519PublicKey {
    if (this._x25519PublicKey === undefined) {
      throw new Error("Not an X25519 public key");
    }
    return this._x25519PublicKey;
  }

  /**
   * Returns the MLKEM public key if this is an MLKEM encapsulation key.
   * @throws Error if this is not an MLKEM key
   */
  mlkemPublicKey(): MLKEMPublicKey {
    if (this._mlkemPublicKey === undefined) {
      throw new Error("Not an MLKEM public key");
    }
    return this._mlkemPublicKey;
  }

  /**
   * Returns the X25519 public key if available, or null.
   */
  toX25519(): X25519PublicKey | null {
    return this._x25519PublicKey ?? null;
  }

  /**
   * Returns the MLKEM public key if available, or null.
   */
  toMlkem(): MLKEMPublicKey | null {
    return this._mlkemPublicKey ?? null;
  }

  /**
   * Returns the raw public key data.
   */
  data(): Uint8Array {
    if (this._scheme === EncapsulationScheme.X25519) {
      const pk = this._x25519PublicKey;
      if (pk === undefined) throw new Error("X25519 public key not set");
      return pk.data();
    } else if (isMlkemScheme(this._scheme)) {
      const pk = this._mlkemPublicKey;
      if (pk === undefined) throw new Error("MLKEM public key not set");
      return pk.data();
    }
    throw new Error(`Unsupported scheme: ${String(this._scheme)}`);
  }

  /**
   * Returns this object as an EncapsulationPublicKey.
   *
   * This method allows EncapsulationPublicKey to implement the Encrypter interface.
   * Since this class is itself an encapsulation public key, it returns `this`.
   *
   * @returns This encapsulation public key
   */
  encapsulationPublicKey(): EncapsulationPublicKey {
    return this;
  }

  /**
   * Encapsulate a new shared secret for this public key.
   *
   * This generates a random shared secret and encapsulates it so that only
   * the holder of the corresponding private key can recover it.
   *
   * @returns A tuple of [sharedSecret, ciphertext]
   */
  encapsulateNewSharedSecret(): [SymmetricKey, EncapsulationCiphertext] {
    if (this._scheme === EncapsulationScheme.X25519) {
      const pk = this._x25519PublicKey;
      if (pk === undefined) throw new Error("X25519 public key not set");
      // Generate ephemeral key pair
      const [ephemeralPrivate, ephemeralPublic] = X25519PrivateKey.keypair();

      // Perform ECDH to get shared secret
      const sharedSecret = ephemeralPrivate.sharedKeyWith(pk);

      // The "ciphertext" is the ephemeral public key
      const ciphertext = EncapsulationCiphertext.fromX25519PublicKey(ephemeralPublic);

      return [sharedSecret, ciphertext];
    } else if (isMlkemScheme(this._scheme)) {
      const pk = this._mlkemPublicKey;
      if (pk === undefined) throw new Error("MLKEM public key not set");

      // Encapsulate using MLKEM
      const { sharedSecret, ciphertext: mlkemCiphertext } = pk.encapsulate();

      // Wrap in EncapsulationCiphertext
      const ciphertext = EncapsulationCiphertext.fromMlkem(mlkemCiphertext);

      return [sharedSecret, ciphertext];
    }
    throw new Error(`Unsupported scheme: ${String(this._scheme)}`);
  }

  /**
   * Compare with another EncapsulationPublicKey.
   */
  equals(other: EncapsulationPublicKey): boolean {
    if (this._scheme !== other._scheme) return false;
    if (this._scheme === EncapsulationScheme.X25519) {
      const thisPk = this._x25519PublicKey;
      const otherPk = other._x25519PublicKey;
      if (thisPk === undefined || otherPk === undefined) return false;
      return thisPk.equals(otherPk);
    } else if (isMlkemScheme(this._scheme)) {
      const thisPk = this._mlkemPublicKey;
      const otherPk = other._mlkemPublicKey;
      if (thisPk === undefined || otherPk === undefined) return false;
      return thisPk.equals(otherPk);
    }
    return false;
  }

  /**
   * Get string representation.
   */
  toString(): string {
    if (this._scheme === EncapsulationScheme.X25519) {
      return `EncapsulationPublicKey(X25519, ${bytesToHex(this.data()).substring(0, 16)}...)`;
    } else if (isMlkemScheme(this._scheme)) {
      return `EncapsulationPublicKey(${String(this._scheme)}, ${bytesToHex(this.data()).substring(0, 16)}...)`;
    }
    return `EncapsulationPublicKey(${String(this._scheme)})`;
  }

  // ============================================================================
  // ReferenceProvider Interface
  // ============================================================================

  /**
   * Returns a unique reference to this EncapsulationPublicKey instance.
   *
   * The reference is derived from the SHA-256 hash of the tagged CBOR
   * representation, providing a unique, content-addressable identifier.
   */
  reference(): Reference {
    const digest = Digest.fromImage(this.taggedCborData());
    return Reference.from(digest);
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with this public key.
   */
  cborTags(): Tag[] {
    if (this._scheme === EncapsulationScheme.X25519) {
      return tagsForValues([TAG_X25519_PUBLIC_KEY.value]);
    } else if (isMlkemScheme(this._scheme)) {
      return tagsForValues([TAG_MLKEM_PUBLIC_KEY.value]);
    }
    throw new Error(`Unsupported scheme: ${String(this._scheme)}`);
  }

  /**
   * Returns the untagged CBOR encoding.
   */
  untaggedCbor(): Cbor {
    if (this._scheme === EncapsulationScheme.X25519) {
      const pk = this._x25519PublicKey;
      if (pk === undefined) throw new Error("X25519 public key not set");
      return toByteString(pk.data());
    } else if (isMlkemScheme(this._scheme)) {
      const pk = this._mlkemPublicKey;
      if (pk === undefined) throw new Error("MLKEM public key not set");
      return pk.untaggedCbor();
    }
    throw new Error(`Unsupported scheme: ${String(this._scheme)}`);
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
   * Creates an EncapsulationPublicKey by decoding it from untagged CBOR.
   * Note: Without tags, we assume X25519 scheme.
   */
  fromUntaggedCbor(cborValue: Cbor): EncapsulationPublicKey {
    const data = expectBytes(cborValue);
    const publicKey = X25519PublicKey.fromDataRef(data);
    return EncapsulationPublicKey.fromX25519PublicKey(publicKey);
  }

  /**
   * Creates an EncapsulationPublicKey by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cborValue: Cbor): EncapsulationPublicKey {
    const tag = tagValue(cborValue);

    if (tag === TAG_X25519_PUBLIC_KEY.value) {
      const content = extractTaggedContent(cborValue);
      const data = expectBytes(content);
      const publicKey = X25519PublicKey.fromDataRef(data);
      return EncapsulationPublicKey.fromX25519PublicKey(publicKey);
    }

    if (tag === TAG_MLKEM_PUBLIC_KEY.value) {
      const mlkemPublic = MLKEMPublicKey.fromTaggedCbor(cborValue);
      return EncapsulationPublicKey.fromMlkem(mlkemPublic);
    }

    throw new Error(`Unknown public key tag: ${tag}`);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cborValue: Cbor): EncapsulationPublicKey {
    const dummy = EncapsulationPublicKey.fromX25519PublicKey(
      X25519PublicKey.fromData(new Uint8Array(32)),
    );
    return dummy.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): EncapsulationPublicKey {
    const cborValue = decodeCbor(data);
    return EncapsulationPublicKey.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): EncapsulationPublicKey {
    const cborValue = decodeCbor(data);
    const dummy = EncapsulationPublicKey.fromX25519PublicKey(
      X25519PublicKey.fromData(new Uint8Array(32)),
    );
    return dummy.fromUntaggedCbor(cborValue);
  }

  // ============================================================================
  // UR Serialization (UREncodable)
  // ============================================================================

  /**
   * Returns the UR representation.
   */
  ur(): UR {
    if (this._scheme === EncapsulationScheme.X25519) {
      const name = TAG_X25519_PUBLIC_KEY.name;
      if (name === undefined) throw new Error("TAG_X25519_PUBLIC_KEY.name is undefined");
      return UR.new(name, this.untaggedCbor());
    } else if (isMlkemScheme(this._scheme)) {
      const pk = this._mlkemPublicKey;
      if (pk === undefined) throw new Error("MLKEM public key not set");
      return pk.ur();
    }
    throw new Error(`Unsupported scheme: ${String(this._scheme)}`);
  }

  /**
   * Returns the UR string representation.
   */
  urString(): string {
    return this.ur().string();
  }

  /**
   * Creates an EncapsulationPublicKey from a UR.
   */
  static fromUR(ur: UR): EncapsulationPublicKey {
    // Check for known UR types
    if (ur.urTypeStr() === TAG_X25519_PUBLIC_KEY.name) {
      const dummy = EncapsulationPublicKey.fromX25519PublicKey(
        X25519PublicKey.fromData(new Uint8Array(32)),
      );
      return dummy.fromUntaggedCbor(ur.cbor());
    }

    if (ur.urTypeStr() === TAG_MLKEM_PUBLIC_KEY.name) {
      const mlkemPublic = MLKEMPublicKey.fromUR(ur);
      return EncapsulationPublicKey.fromMlkem(mlkemPublic);
    }

    throw new Error(`Unknown UR type for EncapsulationPublicKey: ${ur.urTypeStr()}`);
  }

  /**
   * Creates an EncapsulationPublicKey from a UR string.
   */
  static fromURString(urString: string): EncapsulationPublicKey {
    const ur = UR.fromURString(urString);
    return EncapsulationPublicKey.fromUR(ur);
  }
}
