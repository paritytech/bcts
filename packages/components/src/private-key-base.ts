/**
 * PrivateKeyBase - Root cryptographic material for deterministic key derivation
 *
 * PrivateKeyBase is a 32-byte value that serves as the root of cryptographic
 * material from which various keys can be deterministically derived.
 *
 * # CBOR Serialization
 *
 * PrivateKeyBase is serialized with tag 40016:
 * ```
 * #6.40016(h'<32-byte-key-material>')
 * ```
 *
 * # UR Serialization
 *
 * UR type: `crypto-prvkey-base`
 *
 * Ported from bc-components-rust/src/private_key_base.rs
 */

import { SecureRandomNumberGenerator, type RandomNumberGenerator } from "@bcts/rand";
import {
  type Cbor,
  type Tag,
  type CborTaggedEncodable,
  type CborTaggedDecodable,
  toByteString,
  expectBytes,
  createTaggedCbor,
  validateTag,
  extractTaggedContent,
  decodeCbor,
  tagsForValues,
} from "@bcts/dcbor";
import { UR, type UREncodable } from "@bcts/uniform-resources";
import { PRIVATE_KEY_BASE as TAG_PRIVATE_KEY_BASE } from "@bcts/tags";
import { hkdfHmacSha256 } from "@bcts/crypto";

import { X25519PrivateKey } from "./x25519/x25519-private-key.js";
import { Ed25519PrivateKey } from "./ed25519/ed25519-private-key.js";
import { SigningPrivateKey } from "./signing/signing-private-key.js";
import { EncapsulationPrivateKey } from "./encapsulation/encapsulation-private-key.js";
import { bytesToHex } from "./utils.js";
import { PrivateKeys } from "./private-keys.js";
import type { PublicKeys } from "./public-keys.js";

/** Size of PrivateKeyBase key material in bytes */
const PRIVATE_KEY_BASE_SIZE = 32;

/** Key derivation info strings */
const INFO_SIGNING_ED25519 = "signing-ed25519";
const INFO_AGREEMENT_X25519 = "agreement-x25519";

/**
 * PrivateKeyBase - Root cryptographic material for deterministic key derivation.
 *
 * This is the foundation from which signing keys and agreement keys can be
 * deterministically derived using HKDF.
 */
export class PrivateKeyBase
  implements CborTaggedEncodable, CborTaggedDecodable<PrivateKeyBase>, UREncodable
{
  private readonly _data: Uint8Array;

  private constructor(data: Uint8Array) {
    if (data.length !== PRIVATE_KEY_BASE_SIZE) {
      throw new Error(`PrivateKeyBase must be ${PRIVATE_KEY_BASE_SIZE} bytes, got ${data.length}`);
    }
    this._data = new Uint8Array(data);
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Create a new random PrivateKeyBase.
   */
  static new(): PrivateKeyBase {
    const rng = new SecureRandomNumberGenerator();
    return PrivateKeyBase.newUsing(rng);
  }

  /**
   * Create a new random PrivateKeyBase using the provided RNG.
   */
  static newUsing(rng: RandomNumberGenerator): PrivateKeyBase {
    const data = rng.randomData(PRIVATE_KEY_BASE_SIZE);
    return new PrivateKeyBase(data);
  }

  /**
   * Create a PrivateKeyBase from raw bytes.
   *
   * @param data - 32 bytes of key material
   */
  static fromData(data: Uint8Array): PrivateKeyBase {
    return new PrivateKeyBase(data);
  }

  // ============================================================================
  // Instance Methods
  // ============================================================================

  /**
   * Returns the raw key material.
   */
  asBytes(): Uint8Array {
    return this._data;
  }

  /**
   * Returns a copy of the raw key material.
   */
  data(): Uint8Array {
    return new Uint8Array(this._data);
  }

  // ============================================================================
  // Key Derivation Methods
  // ============================================================================

  /**
   * Derive an Ed25519 signing private key.
   *
   * Uses HKDF with info string "signing-ed25519".
   */
  ed25519SigningPrivateKey(): SigningPrivateKey {
    const derivedKey = this._deriveKey(INFO_SIGNING_ED25519);
    const ed25519Key = Ed25519PrivateKey.from(derivedKey);
    return SigningPrivateKey.newEd25519(ed25519Key);
  }

  /**
   * Derive an X25519 agreement private key.
   *
   * Uses HKDF with info string "agreement-x25519".
   */
  x25519PrivateKey(): X25519PrivateKey {
    const derivedKey = this._deriveKey(INFO_AGREEMENT_X25519);
    return X25519PrivateKey.fromData(derivedKey);
  }

  /**
   * Get EncapsulationPrivateKey for decryption.
   *
   * Returns the derived X25519 private key wrapped as EncapsulationPrivateKey.
   */
  encapsulationPrivateKey(): EncapsulationPrivateKey {
    return EncapsulationPrivateKey.fromX25519PrivateKey(this.x25519PrivateKey());
  }

  /**
   * Derive a PrivateKeys container with Ed25519 signing and X25519 agreement keys.
   *
   * @returns PrivateKeys containing the derived signing and encapsulation keys
   */
  ed25519PrivateKeys(): PrivateKeys {
    return PrivateKeys.withKeys(this.ed25519SigningPrivateKey(), this.encapsulationPrivateKey());
  }

  /**
   * Derive a PublicKeys container from the derived keys.
   *
   * @returns PublicKeys containing the derived public keys
   */
  ed25519PublicKeys(): PublicKeys {
    const privateKeys = this.ed25519PrivateKeys();
    return privateKeys.publicKeys();
  }

  /**
   * Internal key derivation using HKDF-SHA256.
   * Uses the info string as salt for domain separation.
   */
  private _deriveKey(info: string): Uint8Array {
    // Use info as salt for domain separation (crypto package's HKDF doesn't have info param)
    const salt = new TextEncoder().encode(info);
    return hkdfHmacSha256(this._data, salt, 32);
  }

  // ============================================================================
  // Equality and String Representation
  // ============================================================================

  /**
   * Compare with another PrivateKeyBase.
   */
  equals(other: PrivateKeyBase): boolean {
    if (this._data.length !== other._data.length) return false;
    for (let i = 0; i < this._data.length; i++) {
      if (this._data[i] !== other._data[i]) return false;
    }
    return true;
  }

  /**
   * Get string representation (truncated for security).
   */
  toString(): string {
    const hex = bytesToHex(this._data);
    return `PrivateKeyBase(${hex.substring(0, 8)}...)`;
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with PrivateKeyBase.
   */
  cborTags(): Tag[] {
    return tagsForValues([TAG_PRIVATE_KEY_BASE.value]);
  }

  /**
   * Returns the untagged CBOR encoding.
   */
  untaggedCbor(): Cbor {
    return toByteString(this._data);
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
   * Creates a PrivateKeyBase by decoding it from untagged CBOR.
   */
  fromUntaggedCbor(cborValue: Cbor): PrivateKeyBase {
    const data = expectBytes(cborValue);
    return PrivateKeyBase.fromData(data);
  }

  /**
   * Creates a PrivateKeyBase by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cborValue: Cbor): PrivateKeyBase {
    validateTag(cborValue, this.cborTags());
    const content = extractTaggedContent(cborValue);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cborValue: Cbor): PrivateKeyBase {
    const dummy = new PrivateKeyBase(new Uint8Array(PRIVATE_KEY_BASE_SIZE));
    return dummy.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): PrivateKeyBase {
    const cborValue = decodeCbor(data);
    return PrivateKeyBase.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): PrivateKeyBase {
    const cborValue = decodeCbor(data);
    const dummy = new PrivateKeyBase(new Uint8Array(PRIVATE_KEY_BASE_SIZE));
    return dummy.fromUntaggedCbor(cborValue);
  }

  // ============================================================================
  // UR Serialization (UREncodable)
  // ============================================================================

  /**
   * Returns the UR representation.
   */
  ur(): UR {
    const name = TAG_PRIVATE_KEY_BASE.name;
    if (name === undefined) {
      throw new Error("PRIVATE_KEY_BASE tag name is undefined");
    }
    return UR.new(name, this.untaggedCbor());
  }

  /**
   * Returns the UR string representation.
   */
  urString(): string {
    return this.ur().string();
  }

  /**
   * Creates a PrivateKeyBase from a UR.
   */
  static fromUR(ur: UR): PrivateKeyBase {
    if (ur.urTypeStr() !== TAG_PRIVATE_KEY_BASE.name) {
      throw new Error(`Expected UR type ${TAG_PRIVATE_KEY_BASE.name}, got ${ur.urTypeStr()}`);
    }
    const dummy = new PrivateKeyBase(new Uint8Array(PRIVATE_KEY_BASE_SIZE));
    return dummy.fromUntaggedCbor(ur.cbor());
  }

  /**
   * Creates a PrivateKeyBase from a UR string.
   */
  static fromURString(urString: string): PrivateKeyBase {
    const ur = UR.fromURString(urString);
    return PrivateKeyBase.fromUR(ur);
  }
}
