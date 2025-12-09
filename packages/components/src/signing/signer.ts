/**
 * Signer and Verifier interfaces for digital signatures.
 *
 * The `Signer` trait provides methods for signing messages with various
 * cryptographic signature schemes. The `Verifier` trait provides a method
 * to verify that a signature was created by a corresponding signer for a
 * specific message.
 *
 * Ported from bc-components-rust/src/signing/signer.rs
 */

import type { Signature } from "./signature.js";

/**
 * A trait for types capable of creating digital signatures.
 *
 * The `Signer` interface provides methods for signing messages with various
 * cryptographic signature schemes. Implementations of this interface can sign
 * messages using different algorithms according to the specific signer type.
 */
export interface Signer {
  /**
   * Signs a message using default options.
   *
   * @param message - The message to sign
   * @returns The digital signature
   * @throws If signing fails
   */
  sign(message: Uint8Array): Signature;
}

/**
 * A trait for types capable of verifying digital signatures.
 *
 * The `Verifier` interface provides a method to verify that a signature was
 * created by a corresponding signer for a specific message.
 */
export interface Verifier {
  /**
   * Verifies a signature against a message.
   *
   * @param signature - The signature to verify
   * @param message - The message that was allegedly signed
   * @returns `true` if the signature is valid for the message, `false` otherwise
   */
  verify(signature: Signature, message: Uint8Array): boolean;
}
