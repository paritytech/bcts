import { Envelope } from "../base/envelope";
import { EnvelopeError } from "../base/error";
import { type Digest } from "../base/digest";
import { cborData, decodeCbor } from "@bcts/dcbor";
import {
  aeadChaCha20Poly1305EncryptWithAad,
  aeadChaCha20Poly1305DecryptWithAad,
  SYMMETRIC_KEY_SIZE,
  SYMMETRIC_NONCE_SIZE,
} from "@bcts/crypto";
import { SecureRandomNumberGenerator, rngRandomData, type RandomNumberGenerator } from "@bcts/rand";

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
///
/// @example
/// ```typescript
/// // Create an envelope
/// const envelope = Envelope.new("Hello world");
///
/// // Generate a symmetric key for encryption
/// const key = SymmetricKey.generate();
///
/// // Encrypt the envelope's subject
/// const encrypted = envelope.encryptSubject(key);
///
/// // The encrypted envelope has the same digest as the original
/// console.log(envelope.digest().equals(encrypted.digest())); // true
///
/// // The subject is now encrypted
/// console.log(encrypted.subject().isEncrypted()); // true
///
/// // Decrypt the envelope
/// const decrypted = encrypted.decryptSubject(key);
///
/// // The decrypted envelope is equivalent to the original
/// console.log(envelope.digest().equals(decrypted.digest())); // true
/// ```

/// Helper function to create a secure RNG
function createSecureRng(): RandomNumberGenerator {
  return new SecureRandomNumberGenerator();
}

/// Represents a symmetric encryption key (256-bit)
/// Matches bc-components-rust/src/symmetric/symmetric_key.rs
export class SymmetricKey {
  readonly #key: Uint8Array;

  constructor(key: Uint8Array) {
    if (key.length !== SYMMETRIC_KEY_SIZE) {
      throw new Error(`Symmetric key must be ${SYMMETRIC_KEY_SIZE} bytes`);
    }
    this.#key = key;
  }

  /// Generates a new random symmetric key
  static generate(): SymmetricKey {
    const rng = createSecureRng();
    const key = rngRandomData(rng, SYMMETRIC_KEY_SIZE);
    return new SymmetricKey(key);
  }

  /// Creates a symmetric key from existing bytes
  static from(key: Uint8Array): SymmetricKey {
    return new SymmetricKey(key);
  }

  /// Returns the raw key bytes
  data(): Uint8Array {
    return this.#key;
  }

  /// Encrypts data with associated digest (AAD)
  /// Uses IETF ChaCha20-Poly1305 with 12-byte nonce
  encrypt(plaintext: Uint8Array, digest: Digest): EncryptedMessage {
    const rng = createSecureRng();

    // Generate a random nonce (12 bytes for IETF ChaCha20-Poly1305)
    const nonce = rngRandomData(rng, SYMMETRIC_NONCE_SIZE);

    // Use digest as additional authenticated data (AAD)
    const aad = digest.data();

    // Encrypt using IETF ChaCha20-Poly1305
    const [ciphertext, authTag] = aeadChaCha20Poly1305EncryptWithAad(
      plaintext,
      this.#key,
      nonce,
      aad,
    );

    return new EncryptedMessage(ciphertext, nonce, authTag, digest);
  }

  /// Decrypts an encrypted message
  decrypt(message: EncryptedMessage): Uint8Array {
    const digest = message.aadDigest();
    if (digest === undefined) {
      throw EnvelopeError.general("Missing digest in encrypted message");
    }

    const aad = digest.data();

    try {
      const plaintext = aeadChaCha20Poly1305DecryptWithAad(
        message.ciphertext(),
        this.#key,
        message.nonce(),
        aad,
        message.authTag(),
      );

      return plaintext;
    } catch (_error) {
      throw EnvelopeError.general("Decryption failed: invalid key or corrupted data");
    }
  }
}

/// Represents an encrypted message with nonce, auth tag, and optional AAD digest
/// Matches bc-components-rust/src/symmetric/encrypted_message.rs
export class EncryptedMessage {
  readonly #ciphertext: Uint8Array;
  readonly #nonce: Uint8Array;
  readonly #authTag: Uint8Array;
  readonly #aadDigest?: Digest;

  constructor(ciphertext: Uint8Array, nonce: Uint8Array, authTag: Uint8Array, aadDigest?: Digest) {
    this.#ciphertext = ciphertext;
    this.#nonce = nonce;
    this.#authTag = authTag;
    if (aadDigest !== undefined) {
      this.#aadDigest = aadDigest;
    }
  }

  /// Returns the ciphertext
  ciphertext(): Uint8Array {
    return this.#ciphertext;
  }

  /// Returns the nonce
  nonce(): Uint8Array {
    return this.#nonce;
  }

  /// Returns the authentication tag
  authTag(): Uint8Array {
    return this.#authTag;
  }

  /// Returns the optional AAD digest
  aadDigest(): Digest | undefined {
    return this.#aadDigest;
  }

  /// Returns the digest of this encrypted message (the AAD digest)
  digest(): Digest {
    if (this.#aadDigest === undefined) {
      throw new Error("Encrypted message missing AAD digest");
    }
    return this.#aadDigest;
  }
}

declare module "../base/envelope" {
  interface Envelope {
    /// Returns a new envelope with its subject encrypted.
    ///
    /// Encrypts only the subject of the envelope, leaving assertions
    /// unencrypted. To encrypt an entire envelope including its assertions,
    /// it must first be wrapped using the `wrap()` method, or you
    /// can use the `encrypt()` convenience method.
    ///
    /// The encryption uses IETF ChaCha20-Poly1305 and preserves the envelope's
    /// digest, allowing for features like selective disclosure and
    /// signature verification to work even on encrypted envelopes.
    ///
    /// @param key - The SymmetricKey to use for encryption
    /// @returns A new envelope with its subject encrypted
    /// @throws {EnvelopeError} If the envelope is already encrypted or elided
    ///
    /// @example
    /// ```typescript
    /// const envelope = Envelope.new("Secret data");
    /// const key = SymmetricKey.generate();
    /// const encrypted = envelope.encryptSubject(key);
    /// console.log(encrypted.subject().isEncrypted()); // true
    /// ```
    encryptSubject(key: SymmetricKey): Envelope;

    /// Returns a new envelope with its subject decrypted.
    ///
    /// Decrypts the subject of an envelope that was previously encrypted using
    /// `encryptSubject()`. The symmetric key used must be the same one
    /// used for encryption.
    ///
    /// @param key - The SymmetricKey to use for decryption
    /// @returns A new envelope with its subject decrypted
    /// @throws {EnvelopeError} If the envelope's subject is not encrypted, key is incorrect, or digest mismatch
    ///
    /// @example
    /// ```typescript
    /// const decrypted = encrypted.decryptSubject(key);
    /// console.log(decrypted.asText()); // "Secret data"
    /// ```
    decryptSubject(key: SymmetricKey): Envelope;

    /// Convenience method to encrypt an entire envelope including its assertions.
    ///
    /// This method wraps the envelope and then encrypts its subject, which has
    /// the effect of encrypting the entire original envelope including all
    /// its assertions.
    ///
    /// @param key - The SymmetricKey to use for encryption
    /// @returns A new envelope with the entire original envelope encrypted
    ///
    /// @example
    /// ```typescript
    /// const envelope = Envelope.new("Alice").addAssertion("knows", "Bob");
    /// const key = SymmetricKey.generate();
    /// const encrypted = envelope.encrypt(key);
    /// ```
    encrypt(key: SymmetricKey): Envelope;

    /// Convenience method to decrypt an entire envelope that was encrypted
    /// using the `encrypt()` method.
    ///
    /// This method decrypts the subject and then unwraps the resulting
    /// envelope, returning the original envelope with all its assertions.
    ///
    /// @param key - The SymmetricKey to use for decryption
    /// @returns The original decrypted envelope
    /// @throws {EnvelopeError} If envelope is not encrypted, key is incorrect, digest mismatch, or cannot unwrap
    ///
    /// @example
    /// ```typescript
    /// const decrypted = encrypted.decrypt(key);
    /// console.log(envelope.digest().equals(decrypted.digest())); // true
    /// ```
    decrypt(key: SymmetricKey): Envelope;

    /// Checks if this envelope is encrypted
    isEncrypted(): boolean;
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
      const encryptedMessage = key.encrypt(encodedCbor, subjectDigest);

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

    const encryptedMessage = key.encrypt(encodedCbor, digest);

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
    const decryptedData = key.decrypt(message);

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

// Auto-register on module load - will be called again from index.ts
// to ensure proper ordering after all modules are loaded
registerEncryptExtension();
