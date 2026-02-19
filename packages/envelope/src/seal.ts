/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

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
