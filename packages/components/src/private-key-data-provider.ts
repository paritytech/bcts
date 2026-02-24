/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * A trait for types that can provide unique data for cryptographic key derivation.
 *
 * Ported from bc-components-rust/src/private_key_data_provider.rs
 *
 * Types implementing `PrivateKeyDataProvider` can be used as seed material for
 * cryptographic key derivation. The provided data should be sufficiently
 * random and unpredictable to ensure the security of the derived keys.
 *
 * This trait is particularly useful for:
 * - Deterministic key generation systems
 * - Key recovery mechanisms
 * - Key derivation hierarchies
 * - Hierarchical deterministic wallet implementations
 *
 * # Security Considerations
 *
 * Implementers of this trait should ensure that:
 * - The data they provide has sufficient entropy
 * - The data is properly protected in memory
 * - Any serialization or storage is done securely
 * - Appropriate zeroization occurs when data is no longer needed
 */

/**
 * Interface for types that can provide unique data for cryptographic key derivation.
 *
 * The provided data should be sufficiently random and have enough entropy
 * to serve as the basis for secure cryptographic key derivation.
 */
export interface PrivateKeyDataProvider {
  /**
   * Returns unique data from which cryptographic keys can be derived.
   *
   * The returned data should be sufficiently random and have enough entropy
   * to serve as the basis for secure cryptographic key derivation.
   *
   * @returns A Uint8Array containing the private key data.
   */
  privateKeyData(): Uint8Array;
}

/**
 * Type guard to check if an object implements PrivateKeyDataProvider
 */
export function isPrivateKeyDataProvider(obj: unknown): obj is PrivateKeyDataProvider {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "privateKeyData" in obj &&
    typeof (obj as PrivateKeyDataProvider).privateKeyData === "function"
  );
}
