import { Envelope } from "../base/envelope";
import { EnvelopeError } from "../base/error";
import { type Digest } from "../base/digest";
import sodium from "libsodium-wrappers";
import { cborData, decodeCbor } from "@blockchain-commons/dcbor";

/// Extension for encrypting and decrypting envelopes using symmetric encryption.
///
/// This module extends Gordian Envelope with functions for symmetric encryption
/// and decryption using the IETF-ChaCha20-Poly1305 construct (libsodium). It enables
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

/// Represents a symmetric encryption key (256-bit)
export class SymmetricKey {
  readonly #key: Uint8Array;

  constructor(key: Uint8Array) {
    if (key.length !== 32) {
      throw new Error("Symmetric key must be 32 bytes");
    }
    this.#key = key;
  }

  /// Generates a new random symmetric key
  static async generate(): Promise<SymmetricKey> {
    await sodium.ready;
    const key = sodium.randombytes_buf(32);
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
  async encrypt(plaintext: Uint8Array, digest: Digest): Promise<EncryptedMessage> {
    await sodium.ready;

    // Generate a random nonce (24 bytes for XChaCha20-Poly1305)
    const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);

    // Use digest as additional authenticated data (AAD)
    const aad = digest.data();

    // Encrypt using XChaCha20-Poly1305
    const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      plaintext,
      aad,
      null, // no secret nonce
      nonce,
      this.#key,
    );

    return new EncryptedMessage(ciphertext, nonce, digest);
  }

  /// Decrypts an encrypted message
  async decrypt(message: EncryptedMessage): Promise<Uint8Array> {
    await sodium.ready;

    const digest = message.aadDigest();
    if (digest === undefined) {
      throw EnvelopeError.general("Missing digest in encrypted message");
    }

    const aad = digest.data();

    try {
      const plaintext = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null, // no secret nonce
        message.ciphertext(),
        aad,
        message.nonce(),
        this.#key,
      );

      return plaintext;
    } catch (_error) {
      throw EnvelopeError.general("Decryption failed: invalid key or corrupted data");
    }
  }
}

/// Represents an encrypted message with nonce and optional AAD digest
export class EncryptedMessage {
  readonly #ciphertext: Uint8Array;
  readonly #nonce: Uint8Array;
  readonly #aadDigest?: Digest;

  constructor(ciphertext: Uint8Array, nonce: Uint8Array, aadDigest?: Digest) {
    this.#ciphertext = ciphertext;
    this.#nonce = nonce;
    this.#aadDigest = aadDigest;
  }

  /// Returns the ciphertext
  ciphertext(): Uint8Array {
    return this.#ciphertext;
  }

  /// Returns the nonce
  nonce(): Uint8Array {
    return this.#nonce;
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
    /// The encryption uses XChaCha20-Poly1305 and preserves the envelope's
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
    /// const key = await SymmetricKey.generate();
    /// const encrypted = await envelope.encryptSubject(key);
    /// console.log(encrypted.subject().isEncrypted()); // true
    /// ```
    encryptSubject(key: SymmetricKey): Promise<Envelope>;

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
    /// const decrypted = await encrypted.decryptSubject(key);
    /// console.log(decrypted.asText()); // "Secret data"
    /// ```
    decryptSubject(key: SymmetricKey): Promise<Envelope>;

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
    /// const key = await SymmetricKey.generate();
    /// const encrypted = await envelope.encrypt(key);
    /// ```
    encrypt(key: SymmetricKey): Promise<Envelope>;

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
    /// const decrypted = await encrypted.decrypt(key);
    /// console.log(envelope.digest().equals(decrypted.digest())); // true
    /// ```
    decrypt(key: SymmetricKey): Promise<Envelope>;

    /// Checks if this envelope is encrypted
    isEncrypted(): boolean;
  }
}

/// Implementation of encryptSubject()
Envelope.prototype.encryptSubject = async function (
  this: Envelope,
  key: SymmetricKey,
): Promise<Envelope> {
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
    const encryptedMessage = await key.encrypt(encodedCbor, subjectDigest);

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

  const encryptedMessage = await key.encrypt(encodedCbor, digest);

  return Envelope.fromCase({
    type: "encrypted",
    message: encryptedMessage,
  });
};

/// Implementation of decryptSubject()
Envelope.prototype.decryptSubject = async function (
  this: Envelope,
  key: SymmetricKey,
): Promise<Envelope> {
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
  const decryptedData = await key.decrypt(message);

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
Envelope.prototype.encrypt = async function (this: Envelope, key: SymmetricKey): Promise<Envelope> {
  return this.wrap().encryptSubject(key);
};

/// Implementation of decrypt() - convenience method
Envelope.prototype.decrypt = async function (this: Envelope, key: SymmetricKey): Promise<Envelope> {
  const decrypted = await this.decryptSubject(key);
  return decrypted.unwrap();
};

/// Implementation of isEncrypted()
Envelope.prototype.isEncrypted = function (this: Envelope): boolean {
  return this.case().type === "encrypted";
};
