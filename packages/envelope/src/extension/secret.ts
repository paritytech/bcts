/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

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
