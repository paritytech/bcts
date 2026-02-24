/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Encrypter and Decrypter interfaces for public key encryption/decryption.
 *
 * Ported from bc-components-rust/src/encrypter.rs
 *
 * The `Encrypter` interface defines an interface for encapsulating a shared secret
 * using a public key. This is a key part of hybrid encryption schemes, where a
 * shared symmetric key is encapsulated with a public key, and the recipient
 * uses their private key to recover the symmetric key.
 *
 * The `Decrypter` interface defines an interface for decapsulating (recovering) a
 * shared secret using a private key. This is the counterpart to the
 * `Encrypter` interface and is used by the recipient of encapsulated messages.
 */

import type { EncapsulationCiphertext } from "./encapsulation/encapsulation-ciphertext.js";
import type { EncapsulationPrivateKey } from "./encapsulation/encapsulation-private-key.js";
import type { EncapsulationPublicKey } from "./encapsulation/encapsulation-public-key.js";
import type { SymmetricKey } from "./symmetric/symmetric-key.js";

/**
 * A trait for types that can encapsulate shared secrets for public key encryption.
 *
 * The `Encrypter` interface defines an interface for encapsulating a shared secret
 * using a public key. This is a key part of hybrid encryption schemes, where a
 * shared symmetric key is encapsulated with a public key, and the recipient
 * uses their private key to recover the symmetric key.
 *
 * Types implementing this interface provide the ability to:
 * 1. Access their encapsulation public key
 * 2. Generate and encapsulate new shared secrets
 *
 * This interface is typically implemented by:
 * - Encapsulation public keys
 * - Higher-level types that contain or can generate encapsulation public keys
 *
 * @example
 * ```typescript
 * import { EncapsulationScheme, createEncapsulationKeypair } from '@bcts/components';
 *
 * // Generate a recipient keypair
 * const [recipientPrivateKey, recipientPublicKey] = createEncapsulationKeypair(EncapsulationScheme.X25519);
 *
 * // Encapsulate a new shared secret
 * const [sharedSecret, ciphertext] = recipientPublicKey.encapsulateNewSharedSecret();
 * ```
 */
export interface Encrypter {
  /**
   * Returns the encapsulation public key for this encrypter.
   *
   * @returns The encapsulation public key that should be used for encapsulation.
   */
  encapsulationPublicKey(): EncapsulationPublicKey;

  /**
   * Encapsulates a new shared secret for the recipient.
   *
   * This method generates a new shared secret and encapsulates it using
   * the encapsulation public key from this encrypter.
   *
   * @returns A tuple containing:
   * - The generated shared secret as a `SymmetricKey`
   * - The encapsulation ciphertext that can be sent to the recipient
   */
  encapsulateNewSharedSecret(): [SymmetricKey, EncapsulationCiphertext];
}

/**
 * A trait for types that can decapsulate shared secrets for public key decryption.
 *
 * The `Decrypter` interface defines an interface for decapsulating (recovering) a
 * shared secret using a private key. This is the counterpart to the
 * `Encrypter` interface and is used by the recipient of encapsulated messages.
 *
 * Types implementing this interface provide the ability to:
 * 1. Access their encapsulation private key
 * 2. Decapsulate shared secrets from ciphertexts
 *
 * This interface is typically implemented by:
 * - Encapsulation private keys
 * - Higher-level types that contain or can access encapsulation private keys
 *
 * @example
 * ```typescript
 * import { EncapsulationScheme, createEncapsulationKeypair } from '@bcts/components';
 *
 * // Generate a keypair
 * const [privateKey, publicKey] = createEncapsulationKeypair(EncapsulationScheme.X25519);
 *
 * // Encapsulate a new shared secret
 * const [originalSecret, ciphertext] = publicKey.encapsulateNewSharedSecret();
 *
 * // Decapsulate the shared secret
 * const recoveredSecret = privateKey.decapsulateSharedSecret(ciphertext);
 *
 * // The original and recovered secrets should match
 * ```
 */
export interface Decrypter {
  /**
   * Returns the encapsulation private key for this decrypter.
   *
   * @returns The encapsulation private key that should be used for decapsulation.
   */
  encapsulationPrivateKey(): EncapsulationPrivateKey;

  /**
   * Decapsulates a shared secret from a ciphertext.
   *
   * This method recovers the shared secret that was encapsulated in the
   * given ciphertext, using the private key from this decrypter.
   *
   * @param ciphertext - The encapsulation ciphertext containing the encapsulated shared secret
   * @returns The decapsulated `SymmetricKey`
   * @throws Error if the ciphertext type doesn't match the private key type or if decapsulation fails
   */
  decapsulateSharedSecret(ciphertext: EncapsulationCiphertext): SymmetricKey;
}

/**
 * Type guard to check if an object implements the Encrypter interface.
 */
export function isEncrypter(obj: unknown): obj is Encrypter {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "encapsulationPublicKey" in obj &&
    typeof (obj as Encrypter).encapsulationPublicKey === "function" &&
    "encapsulateNewSharedSecret" in obj &&
    typeof (obj as Encrypter).encapsulateNewSharedSecret === "function"
  );
}

/**
 * Type guard to check if an object implements the Decrypter interface.
 */
export function isDecrypter(obj: unknown): obj is Decrypter {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "encapsulationPrivateKey" in obj &&
    typeof (obj as Decrypter).encapsulationPrivateKey === "function" &&
    "decapsulateSharedSecret" in obj &&
    typeof (obj as Decrypter).decapsulateSharedSecret === "function"
  );
}
