/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Base traits for elliptic curve keys
 *
 * This module defines the base interfaces for all elliptic curve keys,
 * matching the Rust trait hierarchy:
 * - `ECKeyBase` - Base trait for all EC keys (data, hex, fromHex, fromDataRef)
 * - `ECKey` - Keys that can derive a public key (publicKey)
 * - `ECPublicKeyBase` - Public keys that can provide uncompressed form
 *
 * Ported from bc-components-rust/src/ec_key/ec_key_base.rs
 * and bc-components-rust/src/ec_key/ec_public_key_base.rs
 */

import type { ECPublicKey } from "./ec-public-key.js";
import type { ECUncompressedPublicKey } from "./ec-uncompressed-public-key.js";

/**
 * A base interface for all elliptic curve keys.
 *
 * This interface defines common functionality for all elliptic curve keys,
 * including both private and public keys. It provides methods for key
 * construction from binary data and hexadecimal strings, as well as conversion
 * to hexadecimal format.
 *
 * All EC key types have a fixed size depending on their specific type:
 * - EC private keys: 32 bytes
 * - EC compressed public keys: 33 bytes
 * - EC uncompressed public keys: 65 bytes
 * - Schnorr public keys: 32 bytes
 */
export interface ECKeyBase {
  /**
   * Returns the key's binary data.
   */
  data(): Uint8Array;

  /**
   * Returns the key as a hexadecimal string.
   */
  hex(): string;
}

/**
 * Type guard to check if an object implements ECKeyBase.
 */
export function isECKeyBase(obj: unknown): obj is ECKeyBase {
  if (obj === null || typeof obj !== "object") return false;
  const candidate = obj as ECKeyBase;
  return typeof candidate.data === "function" && typeof candidate.hex === "function";
}

/**
 * An interface for elliptic curve keys that can derive a public key.
 *
 * This interface extends `ECKeyBase` to provide a method for deriving
 * the corresponding compressed public key. It is implemented by both
 * private keys (where it generates the public key) and public keys
 * (where it may return self or convert between formats).
 */
export interface ECKey extends ECKeyBase {
  /**
   * Returns the compressed public key corresponding to this key.
   */
  publicKey(): ECPublicKey;
}

/**
 * Type guard to check if an object implements ECKey.
 */
export function isECKey(obj: unknown): obj is ECKey {
  if (!isECKeyBase(obj)) return false;
  const candidate = obj as ECKey;
  return typeof candidate.publicKey === "function";
}

/**
 * An interface for elliptic curve public keys that can provide their
 * uncompressed form.
 *
 * This interface extends `ECKey` to provide a method for obtaining the
 * uncompressed representation of a public key. Elliptic curve public keys can
 * be represented in both compressed (33 bytes) and uncompressed (65 bytes)
 * formats:
 *
 * - Compressed format: Uses a single byte prefix (0x02 or 0x03) followed by
 *   the x-coordinate (32 bytes), with the prefix indicating the parity of the
 *   y-coordinate.
 *
 * - Uncompressed format: Uses a byte prefix (0x04) followed by both x and y
 *   coordinates (32 bytes each), for a total of 65 bytes.
 *
 * The compressed format is more space-efficient and is recommended for most
 * applications, but some legacy systems require the uncompressed format.
 */
export interface ECPublicKeyBase extends ECKey {
  /**
   * Returns the uncompressed public key representation.
   */
  uncompressedPublicKey(): ECUncompressedPublicKey;
}

/**
 * Type guard to check if an object implements ECPublicKeyBase.
 */
export function isECPublicKeyBase(obj: unknown): obj is ECPublicKeyBase {
  if (!isECKey(obj)) return false;
  const candidate = obj as ECPublicKeyBase;
  return typeof candidate.uncompressedPublicKey === "function";
}
