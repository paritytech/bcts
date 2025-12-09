/**
 * Encapsulation module - Key Encapsulation Mechanisms (KEM)
 *
 * This module provides types and operations for key encapsulation,
 * which enables secure key exchange between parties.
 *
 * Key Encapsulation Mechanisms (KEMs) work differently from traditional
 * Diffie-Hellman: instead of both parties contributing to the shared
 * secret, the sender generates a random shared secret and "encapsulates"
 * it using the recipient's public key. Only the recipient can "decapsulate"
 * the shared secret using their private key.
 *
 * Currently supported schemes:
 * - X25519: Curve25519-based ECDH (actually DH-based, but presented as KEM)
 *
 * The main components are:
 * - `EncapsulationScheme`: Enum of supported schemes
 * - `EncapsulationPrivateKey`: Private key for decapsulation
 * - `EncapsulationPublicKey`: Public key for encapsulation
 * - `EncapsulationCiphertext`: The encapsulated shared secret
 * - `SealedMessage`: Complete anonymous authenticated encryption
 *
 * Ported from bc-components-rust/src/encapsulation/mod.rs
 */

export {
  EncapsulationScheme,
  defaultEncapsulationScheme,
  createEncapsulationKeypair,
  createEncapsulationKeypairUsing,
} from "./encapsulation-scheme.js";
export { EncapsulationPrivateKey } from "./encapsulation-private-key.js";
export { EncapsulationPublicKey } from "./encapsulation-public-key.js";
export { EncapsulationCiphertext } from "./encapsulation-ciphertext.js";
export { SealedMessage } from "./sealed-message.js";
