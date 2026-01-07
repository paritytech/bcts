/// Secret-based envelope locking and unlocking.
///
/// This module provides functionality for encrypting envelope subjects using
/// password-based or key-based derivation methods, allowing envelopes to be
/// locked with secrets and later unlocked.
///
/// The implementation uses `EncryptedKey` from bc-components for key
/// derivation and encryption.

import {
  SymmetricKey as ComponentsSymmetricKey,
  EncryptedKey,
  type KeyDerivationMethod,
} from "@bcts/components";
import { HAS_SECRET } from "@bcts/known-values";
import { Envelope } from "../base/envelope";
import { EnvelopeError } from "../base/error";
import { SymmetricKey } from "./encrypt";

// ============================================================================
// Envelope Prototype Extensions for Secret Locking
// ============================================================================

declare module "../base/envelope" {
  interface Envelope {
    /// Lock the subject of this envelope using a secret.
    ///
    /// Creates a new envelope with the subject encrypted using a symmetric key
    /// that is derived from the provided secret using the specified method.
    /// The encrypted key is stored in a 'hasSecret' assertion.
    ///
    /// @param method - The key derivation method to use
    /// @param secret - The secret (password or key material) to derive from
    /// @returns A new envelope with encrypted subject and hasSecret assertion
    lockSubject(method: KeyDerivationMethod, secret: Uint8Array): Envelope;

    /// Unlock the subject of this envelope using a secret.
    ///
    /// Attempts to decrypt the subject using the provided secret by trying
    /// each 'hasSecret' assertion until one succeeds.
    ///
    /// @param secret - The secret (password or key material) used to lock
    /// @returns A new envelope with decrypted subject
    /// @throws EnvelopeError if no matching secret is found
    unlockSubject(secret: Uint8Array): Envelope;

    /// Check if this envelope is locked with a password-based method.
    ///
    /// Returns true if there is a 'hasSecret' assertion that uses a
    /// password-based key derivation method (PBKDF2, Scrypt, or Argon2id).
    isLockedWithPassword(): boolean;

    /// Check if this envelope is locked with SSH Agent.
    ///
    /// Returns true if there is a 'hasSecret' assertion that uses SSH Agent
    /// key derivation. Note that SSH Agent locking is not yet functional in
    /// TypeScript, but this method is useful for detecting envelopes locked
    /// by other implementations (e.g., Rust).
    isLockedWithSshAgent(): boolean;

    /// Add an additional secret that can unlock this envelope.
    ///
    /// This is useful for adding multiple unlock options (e.g., password
    /// and SSH agent) to the same encrypted content.
    ///
    /// @param method - The key derivation method to use
    /// @param secret - The secret (password or key material) to derive from
    /// @param contentKey - The symmetric key used to encrypt the subject
    /// @returns A new envelope with an additional hasSecret assertion
    addSecret(method: KeyDerivationMethod, secret: Uint8Array, contentKey: SymmetricKey): Envelope;

    /// Lock the entire envelope (wrap and lock subject).
    ///
    /// Convenience method that wraps the envelope first, then locks its
    /// subject.
    ///
    /// @param method - The key derivation method to use
    /// @param secret - The secret (password or key material) to derive from
    /// @returns A new wrapped and locked envelope
    lock(method: KeyDerivationMethod, secret: Uint8Array): Envelope;

    /// Unlock the entire envelope (unlock subject and unwrap).
    ///
    /// Convenience method that unlocks the subject, then unwraps the
    /// envelope.
    ///
    /// @param secret - The secret (password or key material) used to lock
    /// @returns The original unwrapped and unlocked envelope
    unlock(secret: Uint8Array): Envelope;
  }
}

/// Implementation of lockSubject
Envelope.prototype.lockSubject = function (
  this: Envelope,
  method: KeyDerivationMethod,
  secret: Uint8Array,
): Envelope {
  // Generate a new content key using local SymmetricKey
  const contentKey = SymmetricKey.new();

  // Convert to components SymmetricKey for EncryptedKey.lock
  const componentsKey = ComponentsSymmetricKey.fromData(contentKey.data());

  // Lock the content key using the specified derivation method
  const encryptedKey = EncryptedKey.lock(method, secret, componentsKey);

  // Encrypt the subject and add the hasSecret assertion
  const encrypted = this.encryptSubject(contentKey);
  return encrypted.addAssertion(HAS_SECRET, encryptedKey);
};

/// Implementation of unlockSubject
Envelope.prototype.unlockSubject = function (this: Envelope, secret: Uint8Array): Envelope {
  // Find all hasSecret assertions
  const assertions = this.assertionsWithPredicate(HAS_SECRET);

  // Try each one until we find one that unlocks
  for (const assertion of assertions) {
    const obj = assertion.asObject();
    if (obj === undefined) continue;

    // Skip obscured (elided/encrypted/compressed) assertions
    if (obj.isObscured()) continue;

    try {
      // Try to extract the EncryptedKey
      const encryptedKey = obj.extractSubject((cbor) => EncryptedKey.fromTaggedCbor(cbor));

      // Try to unlock with the provided secret (returns ComponentsSymmetricKey)
      const componentsKey = encryptedKey.unlock(secret);

      // Convert to local SymmetricKey for decryptSubject
      const contentKey = SymmetricKey.from(componentsKey.data());

      // If successful, decrypt the subject
      return this.decryptSubject(contentKey);
    } catch {
      // This assertion didn't work, try the next one
      continue;
    }
  }

  // No matching secret found
  throw EnvelopeError.unknownSecret();
};

/// Implementation of isLockedWithPassword
Envelope.prototype.isLockedWithPassword = function (this: Envelope): boolean {
  const assertions = this.assertionsWithPredicate(HAS_SECRET);

  for (const assertion of assertions) {
    const obj = assertion.asObject();
    if (obj === undefined) continue;

    try {
      const encryptedKey = obj.extractSubject((cbor) => EncryptedKey.fromTaggedCbor(cbor));
      if (encryptedKey.isPasswordBased()) {
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
};

/// Implementation of isLockedWithSshAgent
Envelope.prototype.isLockedWithSshAgent = function (this: Envelope): boolean {
  const assertions = this.assertionsWithPredicate(HAS_SECRET);

  for (const assertion of assertions) {
    const obj = assertion.asObject();
    if (obj === undefined) continue;

    try {
      const encryptedKey = obj.extractSubject((cbor) => EncryptedKey.fromTaggedCbor(cbor));
      if (encryptedKey.isSshAgent()) {
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
};

/// Implementation of addSecret
Envelope.prototype.addSecret = function (
  this: Envelope,
  method: KeyDerivationMethod,
  secret: Uint8Array,
  contentKey: SymmetricKey,
): Envelope {
  // Convert to components SymmetricKey for EncryptedKey.lock
  const componentsKey = ComponentsSymmetricKey.fromData(contentKey.data());

  // Lock the content key using the specified derivation method
  const encryptedKey = EncryptedKey.lock(method, secret, componentsKey);

  // Add a hasSecret assertion with the EncryptedKey
  return this.addAssertion(HAS_SECRET, encryptedKey);
};

/// Implementation of lock
Envelope.prototype.lock = function (
  this: Envelope,
  method: KeyDerivationMethod,
  secret: Uint8Array,
): Envelope {
  return this.wrap().lockSubject(method, secret);
};

/// Implementation of unlock
Envelope.prototype.unlock = function (this: Envelope, secret: Uint8Array): Envelope {
  return this.unlockSubject(secret).tryUnwrap();
};

// ============================================================================
// Module Registration
// ============================================================================

/// Register the secret extension
export const registerSecretExtension = (): void => {
  // Extension methods are already added to prototype above
};
