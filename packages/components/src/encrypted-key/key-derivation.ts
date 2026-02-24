/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Key derivation interface
 *
 * Defines the common interface for all key derivation implementations.
 *
 * Ported from bc-components-rust/src/encrypted_key/key_derivation.rs
 */

import type { Cbor } from "@bcts/dcbor";
import type { SymmetricKey } from "../symmetric/symmetric-key.js";
import type { EncryptedMessage } from "../symmetric/encrypted-message.js";

/**
 * Interface for key derivation implementations.
 *
 * All key derivation methods must implement this interface to provide
 * lock (encrypt) and unlock (decrypt) operations.
 */
export interface KeyDerivation {
  /**
   * Returns the method index for CBOR encoding.
   */
  index(): number;

  /**
   * Lock (encrypt) a content key using the derived key.
   *
   * @param contentKey - The symmetric key to encrypt
   * @param secret - The secret (password or key material) to derive from
   * @returns The encrypted message containing the locked key
   */
  lock(contentKey: SymmetricKey, secret: Uint8Array): EncryptedMessage;

  /**
   * Unlock (decrypt) a content key using the derived key.
   *
   * @param encryptedMessage - The encrypted message containing the locked key
   * @param secret - The secret (password or key material) to derive from
   * @returns The decrypted symmetric key
   */
  unlock(encryptedMessage: EncryptedMessage, secret: Uint8Array): SymmetricKey;

  /**
   * Convert to CBOR representation.
   */
  toCbor(): Cbor;

  /**
   * Convert to CBOR binary data.
   */
  toCborData(): Uint8Array;

  /**
   * Get string representation.
   */
  toString(): string;
}
