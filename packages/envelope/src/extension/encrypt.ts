/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Extension for encrypting and decrypting envelopes using symmetric encryption.
 *
 * This module extends Gordian Envelope with functions for symmetric encryption
 * and decryption using the IETF-ChaCha20-Poly1305 construct. It enables
 * privacy-enhancing operations by allowing envelope elements to be encrypted
 * without changing the envelope's digest, similar to elision.
 *
 * The encryption process preserves the envelope's digest tree structure, which
 * means signatures, proofs, and other cryptographic artifacts remain valid
 * even when parts of the envelope are encrypted.
 *
 * Cross-impl AAD parity (BCR-2023-004):
 * the bytes passed to ChaCha20-Poly1305 as Additional Authenticated Data are
 * `digest.taggedCbor().toData()` — i.e. the **CBOR-encoded tagged Digest** of
 * the plaintext envelope, not the raw 32-byte digest. The `EncryptedMessage`
 * stores those AAD bytes verbatim, so the 4th array element of an encrypted
 * envelope's CBOR is the same CBOR-encoded tagged Digest. This matches Rust
 * `bc-components/src/symmetric/symmetric_key.rs::encrypt_with_digest`.
 */

import { Envelope } from "../base/envelope";
import { EnvelopeError } from "../base/error";
import type { Digest } from "../base/digest";
import { cborData, decodeCbor } from "@bcts/dcbor";
import {
  aeadChaCha20Poly1305EncryptWithAad,
  aeadChaCha20Poly1305DecryptWithAad,
  SYMMETRIC_NONCE_SIZE,
} from "@bcts/crypto";
import { SecureRandomNumberGenerator, rngRandomData } from "@bcts/rand";
import { EncryptedMessage, Nonce, AuthenticationTag } from "@bcts/components";
import type { SymmetricKey } from "@bcts/components";

/**
 * Re-export the canonical SymmetricKey and EncryptedMessage from
 * `@bcts/components` so envelope consumers can keep using
 * `import { EncryptedMessage } from "@bcts/envelope"`.
 *
 * The `@bcts/components` `EncryptedMessage` is the canonical implementation
 * with full CBOR support, UR support, and complete factory methods. Using it
 * here removes duplication and guarantees the AAD encoding stays in lockstep
 * with the rest of the suite.
 */
export { SymmetricKey, EncryptedMessage } from "@bcts/components";

/**
 * Builds the AAD bytes for a digest, mirroring Rust
 * `bc-components/src/symmetric/symmetric_key.rs::encrypt_with_digest`:
 * `digest.tagged_cbor().to_cbor_data()`.
 */
function digestAadBytes(digest: Digest): Uint8Array {
  return cborData(digest.taggedCbor());
}

/**
 * Encrypts plaintext with a symmetric key using the digest's CBOR-encoded
 * tagged form as AAD. Returns an {@link EncryptedMessage} whose `aad` field
 * carries the same bytes — so the on-wire CBOR (`[ciphertext, nonce, auth,
 * aadBytes]`) matches Rust byte-for-byte.
 */
function encryptWithDigest(
  key: SymmetricKey,
  plaintext: Uint8Array,
  digest: Digest,
): EncryptedMessage {
  const rng = new SecureRandomNumberGenerator();
  const nonceBytes = rngRandomData(rng, SYMMETRIC_NONCE_SIZE);
  const aad = digestAadBytes(digest);
  const [ciphertext, authTag] = aeadChaCha20Poly1305EncryptWithAad(
    plaintext,
    key.data(),
    nonceBytes,
    aad,
  );
  return EncryptedMessage.new(
    ciphertext,
    aad,
    Nonce.fromDataRef(nonceBytes),
    AuthenticationTag.fromData(authTag),
  );
}

/**
 * Decrypts an {@link EncryptedMessage} using the AAD bytes the message
 * already carries. The AAD must parse as a CBOR-encoded tagged
 * {@link Digest}; the recovered digest is what callers compare against
 * `Envelope::digest()`.
 */
function decryptWithDigest(key: SymmetricKey, message: EncryptedMessage): Uint8Array {
  const digest = message.aadDigest();
  if (digest === null) {
    throw EnvelopeError.general("Missing digest in encrypted message");
  }
  const aad = message.aad();
  try {
    return aeadChaCha20Poly1305DecryptWithAad(
      message.ciphertext(),
      key.data(),
      message.nonce().data(),
      aad,
      message.authenticationTag().data(),
    );
  } catch (_error) {
    throw EnvelopeError.general("Decryption failed: invalid key or corrupted data");
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

    if (subjectDigest === null) {
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
