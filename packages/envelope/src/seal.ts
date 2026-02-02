/// Envelope Sealing and Unsealing
///
/// This module provides convenience functions for combining signing and
/// encryption operations in a single step, creating secure, authenticated
/// envelopes.
///
/// ## Sealing
///
/// Sealing an envelope:
/// 1. Signs the envelope with the sender's private key
/// 2. Encrypts the signed envelope to the recipient's public key
///
/// This creates a secure container where:
/// - The recipient can verify who sent the envelope (authentication)
/// - Only the intended recipient can decrypt the content (confidentiality)
/// - The signature ensures the content hasn't been modified (integrity)
///
/// ## Unsealing
///
/// Unsealing performs these operations in reverse:
/// 1. Decrypts the envelope using the recipient's private key
/// 2. Verifies the signature using the sender's public key

import { Envelope } from "./base/envelope";
import type { Signer, Verifier } from "./extension/signature";
import type { Encrypter, Decrypter } from "@bcts/components";

// ============================================================================
// Envelope Prototype Extensions for Sealing
// ============================================================================

declare module "@bcts/envelope" {
  interface Envelope {
    /// Encrypt this envelope to a single recipient.
    ///
    /// Convenience method that wraps the envelope first, then encrypts
    /// to a single recipient. Supports both X25519 and MLKEM encryption.
    ///
    /// @param recipient - The recipient (implements Encrypter interface)
    /// @returns A new wrapped and encrypted envelope
    encryptToRecipient(recipient: Encrypter): Envelope;

    /// Seal this envelope by signing with sender's key and encrypting to
    /// recipient.
    ///
    /// This is a convenience method that combines signing and encryption in
    /// one step. Supports both classical and post-quantum cryptography.
    ///
    /// @param sender - The private key used to sign the envelope
    /// @param recipient - The recipient (implements Encrypter interface)
    /// @returns A new envelope that has been signed and encrypted
    seal(sender: Signer, recipient: Encrypter): Envelope;

    /// Unseal this envelope by decrypting with recipient's key and verifying
    /// signature.
    ///
    /// This is a convenience method that combines decryption and signature
    /// verification in one step.
    ///
    /// @param senderPublicKey - The public key used to verify the signature
    /// @param recipient - The recipient's private key (implements Decrypter interface)
    /// @returns The unsealed envelope if successful
    /// @throws EnvelopeError if decryption or verification fails
    unseal(senderPublicKey: Verifier, recipient: Decrypter): Envelope;
  }
}

/// Implementation of encryptToRecipient
Envelope.prototype.encryptToRecipient = function (this: Envelope, recipient: Encrypter): Envelope {
  return this.wrap().encryptSubjectToRecipient(recipient);
};

/// Implementation of seal
Envelope.prototype.seal = function (
  this: Envelope,
  sender: Signer,
  recipient: Encrypter,
): Envelope {
  return this.addSignature(sender).encryptToRecipient(recipient);
};

/// Implementation of unseal
Envelope.prototype.unseal = function (
  this: Envelope,
  senderPublicKey: Verifier,
  recipient: Decrypter,
): Envelope {
  return this.decryptToRecipient(recipient).verifySignatureFrom(senderPublicKey);
};

// ============================================================================
// Module Registration
// ============================================================================

/// Register the seal extension
export const registerSealExtension = (): void => {
  // Extension methods are already added to prototype above
};
