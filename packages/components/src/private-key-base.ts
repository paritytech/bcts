/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
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
import { ECPrivateKey } from "./ec-key/ec-private-key.js";
import { SigningPrivateKey } from "./signing/signing-private-key.js";
import { EncapsulationPrivateKey } from "./encapsulation/encapsulation-private-key.js";
import { bytesToHex } from "./utils.js";
import { PrivateKeys } from "./private-keys.js";
import type { PublicKeys } from "./public-keys.js";
import { HKDFRng } from "./hkdf-rng.js";
import { SSHPrivateKey, type SshPrivateKeyData } from "./ssh/ssh-private-key.js";
import {
  sshAlgorithmName,
  sshEcdsaPointLen,
  sshEcdsaScalarLen,
  type SshAlgorithm,
} from "./ssh/ssh-algorithm.js";
import { ed25519 } from "@noble/curves/ed25519.js";
import { p256, p384 } from "@noble/curves/nist.js";

/** Default size of PrivateKeyBase key material in bytes (used for random generation) */
const PRIVATE_KEY_BASE_DEFAULT_SIZE = 32;

/** Key derivation salt string - must match Rust's bc-crypto derive functions */
const SALT_SIGNING = "signing";

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
    if (data.length === 0) {
      throw new Error("PrivateKeyBase must have non-zero length");
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
    const data = rng.randomData(PRIVATE_KEY_BASE_DEFAULT_SIZE);
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
   * Uses HKDF with salt "signing", matching Rust's derive_signing_private_key().
   */
  ed25519SigningPrivateKey(): SigningPrivateKey {
    const derivedKey = this._deriveKey(SALT_SIGNING);
    const ed25519Key = Ed25519PrivateKey.from(derivedKey);
    return SigningPrivateKey.newEd25519(ed25519Key);
  }

  /**
   * Derive an X25519 agreement private key.
   *
   * Uses HKDF with salt "agreement", matching Rust's derive_agreement_private_key().
   */
  x25519PrivateKey(): X25519PrivateKey {
    return X25519PrivateKey.deriveFromKeyMaterial(this._data);
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
   * Derive a Schnorr signing private key.
   *
   * Uses ECPrivateKey.deriveFromKeyMaterial() matching Rust's
   * PrivateKeyBase::schnorr_signing_private_key().
   */
  schnorrSigningPrivateKey(): SigningPrivateKey {
    const ecKey = ECPrivateKey.deriveFromKeyMaterial(this._data);
    return SigningPrivateKey.newSchnorr(ecKey);
  }

  /**
   * Derive a PrivateKeys container with Schnorr signing and X25519 agreement keys.
   *
   * Matches Rust's PrivateKeyBase::schnorr_private_keys().
   */
  schnorrPrivateKeys(): PrivateKeys {
    return PrivateKeys.withKeys(this.schnorrSigningPrivateKey(), this.encapsulationPrivateKey());
  }

  /**
   * Derive a PublicKeys container from Schnorr derived keys.
   */
  schnorrPublicKeys(): PublicKeys {
    return this.schnorrPrivateKeys().publicKeys();
  }

  /**
   * Derive an ECDSA signing private key.
   *
   * Uses ECPrivateKey.deriveFromKeyMaterial() matching Rust's
   * PrivateKeyBase::ecdsa_signing_private_key().
   */
  ecdsaSigningPrivateKey(): SigningPrivateKey {
    const ecKey = ECPrivateKey.deriveFromKeyMaterial(this._data);
    return SigningPrivateKey.newEcdsa(ecKey);
  }

  /**
   * Derive a PrivateKeys container with ECDSA signing and X25519 agreement keys.
   *
   * Matches Rust's PrivateKeyBase::ecdsa_private_keys().
   */
  ecdsaPrivateKeys(): PrivateKeys {
    return PrivateKeys.withKeys(this.ecdsaSigningPrivateKey(), this.encapsulationPrivateKey());
  }

  /**
   * Derive a PublicKeys container from ECDSA derived keys.
   */
  ecdsaPublicKeys(): PublicKeys {
    return this.ecdsaPrivateKeys().publicKeys();
  }

  /**
   * Derive an SSH `SigningPrivateKey` from this `PrivateKeyBase`.
   *
   * Mirrors Rust `PrivateKeyBase::ssh_signing_private_key`
   * (`bc-components-rust/src/private_key_base.rs:179-207`):
   * builds an `HKDFRng` seeded by `this._data` with salt
   * `sshAlgorithmName(algorithm)`, then dispatches to the matching
   * `*Keypair::random` constructor.
   *
   * Supported algorithms (matching the four `SignatureScheme.SshXxx`
   * variants Rust ships in `signature_scheme.rs`):
   *   - Ed25519 (`ssh-ed25519`)
   *   - DSA (`ssh-dss`) — **throws**: byte-deterministic DSA-1024 prime
   *     generation requires porting the upstream `dsa` crate's
   *     FIPS 186-4 prime search, which is not yet implemented in TS.
   *   - ECDSA P-256 (`ecdsa-sha2-nistp256`)
   *   - ECDSA P-384 (`ecdsa-sha2-nistp384`)
   *
   * @param algorithm - The SSH key algorithm to derive
   * @param comment   - Optional comment carried through the OpenSSH PEM
   */
  sshSigningPrivateKey(algorithm: SshAlgorithm, comment = ""): SigningPrivateKey {
    const rng = HKDFRng.new(this._data, sshAlgorithmName(algorithm));
    let data: SshPrivateKeyData;
    switch (algorithm.kind) {
      case "ed25519": {
        // Mirror `ssh-key` 0.6.7 `Ed25519PrivateKey::random`:
        // `rng.fill_bytes(&mut [0u8; 32])`. The 32 bytes are the seed.
        const seed = rng.randomData(32);
        const pubBytes = ed25519.getPublicKey(seed);
        data = { kind: "ed25519", seed, pubBytes: new Uint8Array(pubBytes) };
        break;
      }
      case "ecdsa": {
        const scalarLen = sshEcdsaScalarLen(algorithm.curve);
        const pointLen = sshEcdsaPointLen(algorithm.curve);
        const curve = algorithm.curve === "nistp256" ? p256 : p384;
        // Mirror `p{256,384}::SecretKey::random` rejection sampling:
        // read `scalarLen` bytes; if the big-endian scalar is zero or
        // ≥ n, retry. We delegate the bounds check to noble's
        // `utils.isValidSecretKey` which performs exactly the same
        // `0 < scalar < n` predicate as Rust.
        let scalar: Uint8Array;
        for (;;) {
          const bytes = rng.randomData(scalarLen);
          if (curve.utils.isValidSecretKey(bytes)) {
            scalar = bytes;
            break;
          }
        }
        const point = curve.getPublicKey(scalar, false);
        if (point.length !== pointLen || point[0] !== 0x04) {
          throw new Error(
            `sshSigningPrivateKey ecdsa-${algorithm.curve}: noble returned non-uncompressed point`,
          );
        }
        data = {
          kind: "ecdsa",
          curve: algorithm.curve,
          point: new Uint8Array(point),
          scalar,
        };
        break;
      }
      case "dsa":
        throw new Error(
          "SSH DSA key generation is not yet implemented in TS. Rust's " +
            "`bc-components-rust` ships byte-deterministic DSA-1024 keygen " +
            "via the `dsa` crate's FIPS 186-4 prime search, which has not " +
            "been ported. See SSH_V2_PLAN.md A.1 for status. Sign/verify " +
            "and PEM round-trip work for DSA keys parsed from existing " +
            "Rust-generated PEM input.",
        );
    }
    const checkint = sshCheckintFromPrivateBytes(data);
    const sshKey = SSHPrivateKey.fromParts(data, comment, checkint);
    return SigningPrivateKey.fromSsh(sshKey);
  }

  /**
   * Derive a `PrivateKeys` container with an SSH signing key and an X25519
   * agreement key. Mirrors Rust `PrivateKeyBase::ssh_private_keys`
   * (`bc-components-rust/src/private_key_base.rs:273-283`).
   */
  sshPrivateKeys(algorithm: SshAlgorithm, comment = ""): PrivateKeys {
    return PrivateKeys.withKeys(
      this.sshSigningPrivateKey(algorithm, comment),
      this.encapsulationPrivateKey(),
    );
  }

  /**
   * Derive a `PublicKeys` container from `sshPrivateKeys`. Mirrors Rust
   * `PrivateKeyBase::ssh_public_keys`
   * (`bc-components-rust/src/private_key_base.rs:289-300`).
   */
  sshPublicKeys(algorithm: SshAlgorithm, comment = ""): PublicKeys {
    return this.sshPrivateKeys(algorithm, comment).publicKeys();
  }

  /**
   * Internal key derivation using HKDF-SHA256.
   * Matches Rust's hkdf_hmac_sha256(key_material, salt, key_len) with empty info.
   */
  private _deriveKey(salt: string): Uint8Array {
    return hkdfHmacSha256(this._data, new TextEncoder().encode(salt), 32);
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
    const dummy = new PrivateKeyBase(new Uint8Array(PRIVATE_KEY_BASE_DEFAULT_SIZE));
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
    const dummy = new PrivateKeyBase(new Uint8Array(PRIVATE_KEY_BASE_DEFAULT_SIZE));
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
    const dummy = new PrivateKeyBase(new Uint8Array(PRIVATE_KEY_BASE_DEFAULT_SIZE));
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

/**
 * Mirror of `ssh-key` 0.6.7 `KeypairData::checkint`
 * (`ssh-key/src/private/keypair.rs:215-241`): XOR successive 4-byte
 * big-endian chunks of the algorithm-specific private bytes.
 *
 *   - Ed25519 → seed (32 bytes)
 *   - ECDSA   → canonical scalar (32 / 48 bytes)
 *   - DSA     → secret exponent x bytes
 *
 * The `chunks_exact(4)` rule discards any trailing bytes whose count
 * is not a multiple of 4 — match it here.
 */
function sshCheckintFromPrivateBytes(data: SshPrivateKeyData): number {
  let bytes: Uint8Array;
  switch (data.kind) {
    case "ed25519":
      bytes = data.seed;
      break;
    case "ecdsa":
      bytes = data.scalar;
      break;
    case "dsa":
      bytes = data.x;
      break;
  }
  let n = 0;
  const fullChunks = Math.floor(bytes.length / 4);
  for (let i = 0; i < fullChunks; i++) {
    const off = i * 4;
    const chunk =
      ((bytes[off] << 24) | (bytes[off + 1] << 16) | (bytes[off + 2] << 8) | bytes[off + 3]) >>> 0;
    n = (n ^ chunk) >>> 0;
  }
  return n;
}
