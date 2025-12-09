/**
 * Encapsulation scheme enum for key encapsulation mechanisms
 *
 * This enum represents the available key encapsulation mechanisms (KEMs)
 * for establishing shared secrets between parties.
 *
 * Currently supported:
 * - X25519: Curve25519-based Diffie-Hellman key exchange (default)
 *
 * Future support (post-quantum):
 * - MLKEM512, MLKEM768, MLKEM1024: ML-KEM at various security levels
 *
 * Ported from bc-components-rust/src/encapsulation/encapsulation_scheme.rs
 */

import type { RandomNumberGenerator } from "@blockchain-commons/rand";
import { EncapsulationPrivateKey } from "./encapsulation-private-key.js";
import type { EncapsulationPublicKey } from "./encapsulation-public-key.js";

/**
 * Available key encapsulation schemes.
 */
export enum EncapsulationScheme {
  /**
   * X25519 Diffie-Hellman key exchange (default).
   * Based on Curve25519 as defined in RFC 7748.
   */
  X25519 = "x25519",

  // Future: ML-KEM post-quantum schemes
  // MLKEM512 = "mlkem512",
  // MLKEM768 = "mlkem768",
  // MLKEM1024 = "mlkem1024",
}

/**
 * Returns the default encapsulation scheme (X25519).
 */
export function defaultEncapsulationScheme(): EncapsulationScheme {
  return EncapsulationScheme.X25519;
}

/**
 * Generate a new keypair for the given encapsulation scheme.
 *
 * @param scheme - The encapsulation scheme to use (defaults to X25519)
 * @returns A tuple of [privateKey, publicKey]
 */
export function createEncapsulationKeypair(
  scheme: EncapsulationScheme = EncapsulationScheme.X25519,
): [EncapsulationPrivateKey, EncapsulationPublicKey] {
  switch (scheme) {
    case EncapsulationScheme.X25519:
      return EncapsulationPrivateKey.keypair();
    default:
      throw new Error(`Unsupported encapsulation scheme: ${scheme}`);
  }
}

/**
 * Generate a new keypair for the given encapsulation scheme using a specific RNG.
 *
 * Note: Only X25519 supports deterministic keypair generation.
 *
 * @param rng - The random number generator to use
 * @param scheme - The encapsulation scheme to use (defaults to X25519)
 * @returns A tuple of [privateKey, publicKey]
 */
export function createEncapsulationKeypairUsing(
  rng: RandomNumberGenerator,
  scheme: EncapsulationScheme = EncapsulationScheme.X25519,
): [EncapsulationPrivateKey, EncapsulationPublicKey] {
  switch (scheme) {
    case EncapsulationScheme.X25519:
      return EncapsulationPrivateKey.keypairUsing(rng);
    default:
      throw new Error(`Deterministic keypair generation not supported for scheme: ${scheme}`);
  }
}
