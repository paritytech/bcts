/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

import { Envelope } from "../base/envelope";
import { EnvelopeError } from "../base/error";
import { type Digest } from "../base/digest";
import { cborData, decodeCbor } from "@bcts/dcbor";
import {
  aeadChaCha20Poly1305EncryptWithAad,
  aeadChaCha20Poly1305DecryptWithAad,
  SYMMETRIC_NONCE_SIZE,
} from "@bcts/crypto";
import { SecureRandomNumberGenerator, rngRandomData } from "@bcts/rand";

/**
 * Re-export SymmetricKey from @bcts/components for type compatibility.
 *
 * The @bcts/components SymmetricKey class is the canonical implementation with:
 * - Full CBOR support (tagged/untagged)
 * - UR support
 * - Complete factory methods
 *
 * This re-export ensures type compatibility between @bcts/envelope
 * and @bcts/components when used together.
 */
export { SymmetricKey } from "@bcts/components";
import type { SymmetricKey } from "@bcts/components";

/// Extension for encrypting and decrypting envelopes using symmetric encryption.
///
/// This module extends Gordian Envelope with functions for symmetric encryption
/// and decryption using the IETF-ChaCha20-Poly1305 construct. It enables
/// privacy-enhancing operations by allowing envelope elements to be encrypted
/// without changing the envelope's digest, similar to elision.
///
/// The encryption process preserves the envelope's digest tree structure, which
/// means signatures, proofs, and other cryptographic artifacts remain valid
/// even when parts of the envelope are encrypted.

/**
 * Encrypts plaintext with a symmetric key using the given digest as AAD.
 * This is an envelope-specific helper function that returns an envelope EncryptedMessage.
 */
function encryptWithDigest(
  key: SymmetricKey,
  plaintext: Uint8Array,
  digest: Digest,
): EncryptedMessage {
  const rng = new SecureRandomNumberGenerator();
  const nonce = rngRandomData(rng, SYMMETRIC_NONCE_SIZE);
  const aad = digest.data();
  const [ciphertext, authTag] = aeadChaCha20Poly1305EncryptWithAad(
    plaintext,
    key.data(),
    nonce,
    aad,
  );
  return new EncryptedMessage(ciphertext, nonce, authTag, digest);
}

/**
 * Decrypts an envelope EncryptedMessage with a symmetric key.
 * This is an envelope-specific helper function.
 */
function decryptWithDigest(key: SymmetricKey, message: EncryptedMessage): Uint8Array {
  const digest = message.aadDigest();
  if (digest === undefined) {
    throw EnvelopeError.general("Missing digest in encrypted message");
  }
  const aad = digest.data();
  try {
    return aeadChaCha20Poly1305DecryptWithAad(
      message.ciphertext(),
      key.data(),
      message.nonce(),
      aad,
      message.authTag(),
    );
  } catch (_error) {
    throw EnvelopeError.general("Decryption failed: invalid key or corrupted data");
  }
}

/// Represents an encrypted message with nonce, auth tag, and optional AAD digest
/// Matches bc-components-rust/src/symmetric/encrypted_message.rs
export class EncryptedMessage {
  private readonly _ciphertext: Uint8Array;
  private readonly _nonce: Uint8Array;
  private readonly _authTag: Uint8Array;
  private readonly _aadDigest?: Digest;

  constructor(ciphertext: Uint8Array, nonce: Uint8Array, authTag: Uint8Array, aadDigest?: Digest) {
    this._ciphertext = ciphertext;
    this._nonce = nonce;
    this._authTag = authTag;
    if (aadDigest !== undefined) {
      this._aadDigest = aadDigest;
    }
  }

  /// Returns the ciphertext
  ciphertext(): Uint8Array {
    return this._ciphertext;
  }

  /// Returns the nonce
  nonce(): Uint8Array {
    return this._nonce;
  }

  /// Returns the authentication tag
  authTag(): Uint8Array {
    return this._authTag;
  }

  /// Returns the optional AAD digest
  aadDigest(): Digest | undefined {
    return this._aadDigest;
  }

  /// Returns the digest of this encrypted message (the AAD digest)
  digest(): Digest {
    if (this._aadDigest === undefined) {
      throw new Error("Encrypted message missing AAD digest");
    }
    return this._aadDigest;
  }
}

/// Register encryption extension methods on Envelope prototype
/// This function is exported and called during module initialization
/// to ensure Envelope is fully defined before attaching methods.
export function registerEncryptExtension(): void {
  if (Envelope?.prototype === undefined) {
    return;
  }

  // Skip if already registered
  if (typeof Envelope.prototype.encryptSubject === "function") {
    return;
  }

  Envelope.prototype.encryptSubject = function (this: Envelope, key: SymmetricKey): Envelope {
    const c = this.case();

    // Can't encrypt if already encrypted or elided
    if (c.type === "encrypted") {
      throw EnvelopeError.general("Envelope is already encrypted");
    }
    if (c.type === "elided") {
      throw EnvelopeError.general("Cannot encrypt elided envelope");
    }

    // For node case, encrypt just the subject
    if (c.type === "node") {
      if (c.subject.isEncrypted()) {
        throw EnvelopeError.general("Subject is already encrypted");
      }

      // Get the subject's CBOR data
      const subjectCbor = c.subject.taggedCbor();
      const encodedCbor = cborData(subjectCbor);
      const subjectDigest = c.subject.digest();

      // Encrypt the subject
      const encryptedMessage = encryptWithDigest(key, encodedCbor, subjectDigest);

      // Create encrypted envelope
      const encryptedSubject = Envelope.fromCase({
        type: "encrypted",
        message: encryptedMessage,
      });

      // Rebuild the node with encrypted subject and same assertions
      return Envelope.newWithAssertions(encryptedSubject, c.assertions);
    }

    // For other cases, encrypt the entire envelope
    const cbor = this.taggedCbor();
    const encodedCbor = cborData(cbor);
    const digest = this.digest();

    const encryptedMessage = encryptWithDigest(key, encodedCbor, digest);

    return Envelope.fromCase({
      type: "encrypted",
      message: encryptedMessage,
    });
  };

  /// Implementation of decryptSubject()
  Envelope.prototype.decryptSubject = function (this: Envelope, key: SymmetricKey): Envelope {
    const subjectCase = this.subject().case();

    if (subjectCase.type !== "encrypted") {
      throw EnvelopeError.general("Subject is not encrypted");
    }

    const message = subjectCase.message;
    const subjectDigest = message.aadDigest();

    if (subjectDigest === undefined) {
      throw EnvelopeError.general("Missing digest in encrypted message");
    }

    // Decrypt the subject
    const decryptedData = decryptWithDigest(key, message);

    // Parse back to envelope
    const cbor = decodeCbor(decryptedData);
    const resultSubject = Envelope.fromTaggedCbor(cbor);

    // Verify digest
    if (!resultSubject.digest().equals(subjectDigest)) {
      throw EnvelopeError.general("Invalid digest after decryption");
    }

    const c = this.case();

    // If this is a node, rebuild with decrypted subject
    if (c.type === "node") {
      const result = Envelope.newWithAssertions(resultSubject, c.assertions);
      if (!result.digest().equals(c.digest)) {
        throw EnvelopeError.general("Invalid envelope digest after decryption");
      }
      return result;
    }

    // Otherwise just return the decrypted subject
    return resultSubject;
  };

  /// Implementation of encrypt() - convenience method
  Envelope.prototype.encrypt = function (this: Envelope, key: SymmetricKey): Envelope {
    return this.wrap().encryptSubject(key);
  };

  /// Implementation of decrypt() - convenience method
  Envelope.prototype.decrypt = function (this: Envelope, key: SymmetricKey): Envelope {
    const decrypted = this.decryptSubject(key);
    return decrypted.unwrap();
  };

  /// Implementation of isEncrypted()
  Envelope.prototype.isEncrypted = function (this: Envelope): boolean {
    return this.case().type === "encrypted";
  };
}

/// Encrypts an entire envelope as a unit, matching Rust's
/// ObscureAction::Encrypt behavior in elide_set_with_action.
/// Unlike encryptSubject which only encrypts a node's subject,
/// this encrypts the entire envelope's tagged CBOR.
export function encryptWholeEnvelope(envelope: Envelope, key: SymmetricKey): Envelope {
  const c = envelope.case();
  if (c.type === "encrypted") {
    throw EnvelopeError.general("Envelope is already encrypted");
  }
  if (c.type === "elided") {
    throw EnvelopeError.general("Cannot encrypt elided envelope");
  }
  const cbor = envelope.taggedCbor();
  const encodedCbor = cborData(cbor);
  const digest = envelope.digest();
  const encryptedMessage = encryptWithDigest(key, encodedCbor, digest);
  return Envelope.fromCase({ type: "encrypted", message: encryptedMessage });
}

// Registration is handled by the main index.ts to avoid circular dependency issues.
// The registerEncryptExtension() function is called explicitly after all modules are loaded.
