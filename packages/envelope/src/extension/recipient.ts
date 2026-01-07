import { Envelope } from "../base/envelope";
import { EnvelopeError } from "../base/error";
import { SymmetricKey } from "./encrypt";
import {
  x25519NewPrivateKeyUsing,
  x25519PublicKeyFromPrivateKey,
  x25519SharedKey,
  aeadChaCha20Poly1305EncryptWithAad,
  aeadChaCha20Poly1305DecryptWithAad,
  hkdfHmacSha256,
  X25519_PUBLIC_KEY_SIZE,
  X25519_PRIVATE_KEY_SIZE,
  SYMMETRIC_NONCE_SIZE,
  SYMMETRIC_AUTH_SIZE,
} from "@bcts/crypto";
import { SecureRandomNumberGenerator, rngRandomData, type RandomNumberGenerator } from "@bcts/rand";

/// Extension for public-key encryption to specific recipients.
///
/// This module implements multi-recipient public key encryption using the
/// Gordian Envelope sealed message pattern. Each recipient gets a sealed
/// message containing an encrypted content key, allowing multiple recipients
/// to decrypt the same envelope using their private keys.
///
/// ## How it works:
///
/// 1. A random symmetric content key is generated
/// 2. The envelope's subject is encrypted with the content key
/// 3. The content key is encrypted to each recipient's public key using X25519 key agreement
/// 4. Each encrypted content key is added as a `hasRecipient` assertion
///
/// ## Sealed Box Security:
///
/// Sealed boxes use ephemeral X25519 key pairs. The ephemeral private key
/// is discarded after encryption, ensuring that even the sender cannot
/// decrypt the message later. Recipients must try each sealed message
/// until one decrypts successfully.
///
/// Uses @bcts/crypto functions for X25519 and ChaCha20-Poly1305.
///
/// @example
/// ```typescript
/// // Generate recipient keys
/// const alice = PrivateKeyBase.generate();
/// const bob = PrivateKeyBase.generate();
///
/// // Encrypt to multiple recipients
/// const envelope = Envelope.new("Secret message")
///   .encryptSubjectToRecipients([alice.publicKeys(), bob.publicKeys()]);
///
/// // Alice decrypts
/// const aliceDecrypted = envelope.decryptSubjectToRecipient(alice);
///
/// // Bob decrypts
/// const bobDecrypted = envelope.decryptSubjectToRecipient(bob);
/// ```

/// Predicate constant for recipient assertions
export const HAS_RECIPIENT = "hasRecipient";

/// Represents an X25519 public key for encryption
export class PublicKeyBase {
  readonly #publicKey: Uint8Array;

  constructor(publicKey: Uint8Array) {
    if (publicKey.length !== X25519_PUBLIC_KEY_SIZE) {
      throw new Error(`Public key must be ${X25519_PUBLIC_KEY_SIZE} bytes`);
    }
    this.#publicKey = publicKey;
  }

  /// Returns the raw public key bytes
  data(): Uint8Array {
    return this.#publicKey;
  }

  /// Returns the public key as a hex string
  hex(): string {
    return Array.from(this.#publicKey)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /// Creates a public key from hex string
  static fromHex(hex: string): PublicKeyBase {
    if (hex.length !== 64) {
      throw new Error("Hex string must be 64 characters (32 bytes)");
    }
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return new PublicKeyBase(bytes);
  }
}

/// Represents an X25519 private key for decryption
export class PrivateKeyBase {
  readonly #privateKey: Uint8Array;
  readonly #publicKey: PublicKeyBase;

  private constructor(privateKey: Uint8Array, publicKey: Uint8Array) {
    this.#privateKey = privateKey;
    this.#publicKey = new PublicKeyBase(publicKey);
  }

  /// Generates a new random X25519 key pair
  static generate(): PrivateKeyBase {
    const rng = new SecureRandomNumberGenerator();
    return PrivateKeyBase.generateUsing(rng);
  }

  /// Generates a new X25519 key pair using the provided RNG
  static generateUsing(rng: RandomNumberGenerator): PrivateKeyBase {
    const privateKey = x25519NewPrivateKeyUsing(rng);
    const publicKey = x25519PublicKeyFromPrivateKey(privateKey);
    return new PrivateKeyBase(privateKey, publicKey);
  }

  /// Creates a private key from existing bytes
  static fromBytes(privateKey: Uint8Array, publicKey: Uint8Array): PrivateKeyBase {
    if (privateKey.length !== X25519_PRIVATE_KEY_SIZE) {
      throw new Error(`Private key must be ${X25519_PRIVATE_KEY_SIZE} bytes`);
    }
    if (publicKey.length !== X25519_PUBLIC_KEY_SIZE) {
      throw new Error(`Public key must be ${X25519_PUBLIC_KEY_SIZE} bytes`);
    }
    return new PrivateKeyBase(privateKey, publicKey);
  }

  /// Creates a private key from hex strings
  static fromHex(privateHex: string, publicHex: string): PrivateKeyBase {
    const privateBytes = new Uint8Array(32);
    const publicBytes = new Uint8Array(32);

    for (let i = 0; i < 32; i++) {
      privateBytes[i] = parseInt(privateHex.substr(i * 2, 2), 16);
      publicBytes[i] = parseInt(publicHex.substr(i * 2, 2), 16);
    }

    return new PrivateKeyBase(privateBytes, publicBytes);
  }

  /// Returns the public key
  publicKeys(): PublicKeyBase {
    return this.#publicKey;
  }

  /// Returns the raw private key bytes
  data(): Uint8Array {
    return this.#privateKey;
  }

  /// Returns the private key as hex string
  hex(): string {
    return Array.from(this.#privateKey)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /// Decrypts a sealed message to get the content key
  unseal(sealedMessage: SealedMessage): SymmetricKey {
    try {
      const decrypted = sealedMessage.decrypt(this.#privateKey, this.#publicKey.data());
      return SymmetricKey.from(decrypted);
    } catch (_error) {
      throw EnvelopeError.general("Failed to unseal message: not a recipient");
    }
  }
}

/// Represents a sealed message - encrypted content key for a recipient
/// Uses X25519 key agreement + ChaCha20-Poly1305 AEAD
///
/// Format: ephemeral_public_key (32 bytes) || nonce (12 bytes) || ciphertext || auth_tag (16 bytes)
export class SealedMessage {
  readonly #data: Uint8Array;

  constructor(data: Uint8Array) {
    this.#data = data;
  }

  /// Creates a sealed message by encrypting a symmetric key to a recipient's public key
  /// Uses X25519 ECDH for key agreement and ChaCha20-Poly1305 for encryption
  static seal(contentKey: SymmetricKey, recipientPublicKey: PublicKeyBase): SealedMessage {
    const rng = new SecureRandomNumberGenerator();

    // Generate ephemeral key pair
    const ephemeralPrivate = x25519NewPrivateKeyUsing(rng);
    const ephemeralPublic = x25519PublicKeyFromPrivateKey(ephemeralPrivate);

    // Compute shared secret using X25519 ECDH
    const sharedSecret = x25519SharedKey(ephemeralPrivate, recipientPublicKey.data());

    // Derive encryption key from shared secret using HKDF
    const salt = new TextEncoder().encode("sealed_message");
    const encryptionKey = hkdfHmacSha256(sharedSecret, salt, 32);

    // Generate random nonce
    const nonce = rngRandomData(rng, SYMMETRIC_NONCE_SIZE);

    // Encrypt content key using ChaCha20-Poly1305
    const plaintext = contentKey.data();
    const [ciphertext, authTag] = aeadChaCha20Poly1305EncryptWithAad(
      plaintext,
      encryptionKey,
      nonce,
      new Uint8Array(0), // No AAD for sealed box
    );

    // Format: ephemeral_public_key || nonce || ciphertext || auth_tag
    const totalLength = ephemeralPublic.length + nonce.length + ciphertext.length + authTag.length;
    const sealed = new Uint8Array(totalLength);
    let offset = 0;

    sealed.set(ephemeralPublic, offset);
    offset += ephemeralPublic.length;

    sealed.set(nonce, offset);
    offset += nonce.length;

    sealed.set(ciphertext, offset);
    offset += ciphertext.length;

    sealed.set(authTag, offset);

    return new SealedMessage(sealed);
  }

  /// Decrypts this sealed message using recipient's private key
  decrypt(recipientPrivate: Uint8Array, _recipientPublic: Uint8Array): Uint8Array {
    // Parse sealed message format: ephemeral_public_key || nonce || ciphertext || auth_tag
    const minLength = X25519_PUBLIC_KEY_SIZE + SYMMETRIC_NONCE_SIZE + SYMMETRIC_AUTH_SIZE;
    if (this.#data.length < minLength) {
      throw new Error("Sealed message too short");
    }

    let offset = 0;

    // Extract ephemeral public key
    const ephemeralPublic = this.#data.slice(offset, offset + X25519_PUBLIC_KEY_SIZE);
    offset += X25519_PUBLIC_KEY_SIZE;

    // Extract nonce
    const nonce = this.#data.slice(offset, offset + SYMMETRIC_NONCE_SIZE);
    offset += SYMMETRIC_NONCE_SIZE;

    // Extract ciphertext and auth tag
    const ciphertextAndTag = this.#data.slice(offset);
    const ciphertext = ciphertextAndTag.slice(0, -SYMMETRIC_AUTH_SIZE);
    const authTag = ciphertextAndTag.slice(-SYMMETRIC_AUTH_SIZE);

    // Compute shared secret using X25519 ECDH
    const sharedSecret = x25519SharedKey(recipientPrivate, ephemeralPublic);

    // Derive decryption key from shared secret using HKDF
    const salt = new TextEncoder().encode("sealed_message");
    const decryptionKey = hkdfHmacSha256(sharedSecret, salt, 32);

    // Decrypt using ChaCha20-Poly1305
    const plaintext = aeadChaCha20Poly1305DecryptWithAad(
      ciphertext,
      decryptionKey,
      nonce,
      new Uint8Array(0), // No AAD for sealed box
      authTag,
    );

    return plaintext;
  }

  /// Returns the raw sealed message bytes
  data(): Uint8Array {
    return this.#data;
  }

  /// Returns the sealed message as hex string
  hex(): string {
    return Array.from(this.#data)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /// Creates a sealed message from hex string
  static fromHex(hex: string): SealedMessage {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return new SealedMessage(bytes);
  }
}

/// Implementation of encryptSubjectToRecipient()
// eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
if (Envelope?.prototype) {
  Envelope.prototype.encryptSubjectToRecipient = function (
    this: Envelope,
    recipientPublicKey: PublicKeyBase,
  ): Envelope {
    // Generate a random content key
    const contentKey = SymmetricKey.new();

    // Encrypt the subject with the content key
    const encrypted = this.encryptSubject(contentKey);

    // Add the recipient
    return encrypted.addRecipient(recipientPublicKey, contentKey);
  };

  /// Implementation of encryptSubjectToRecipients()
  Envelope.prototype.encryptSubjectToRecipients = function (
    this: Envelope,
    recipients: PublicKeyBase[],
  ): Envelope {
    if (recipients.length === 0) {
      throw EnvelopeError.general("Must provide at least one recipient");
    }

    // Generate a random content key
    const contentKey = SymmetricKey.new();

    // Encrypt the subject with the content key
    let result = this.encryptSubject(contentKey);

    // Add each recipient
    for (const recipient of recipients) {
      result = result.addRecipient(recipient, contentKey);
    }

    return result;
  };

  /// Implementation of addRecipient()
  Envelope.prototype.addRecipient = function (
    this: Envelope,
    recipientPublicKey: PublicKeyBase,
    contentKey: SymmetricKey,
  ): Envelope {
    // Create a sealed message with the content key
    const sealedMessage = SealedMessage.seal(contentKey, recipientPublicKey);

    // Store the sealed message as bytes in the assertion
    return this.addAssertion(HAS_RECIPIENT, sealedMessage.data());
  };

  /// Implementation of decryptSubjectToRecipient()
  Envelope.prototype.decryptSubjectToRecipient = function (
    this: Envelope,
    recipientPrivateKey: PrivateKeyBase,
  ): Envelope {
    // Check that the subject is encrypted
    const subjectCase = this.subject().case();
    if (subjectCase.type !== "encrypted") {
      throw EnvelopeError.general("Subject is not encrypted");
    }

    // Get all recipient assertions
    const recipientAssertions = this.assertions().filter((assertion) => {
      try {
        const predicate = assertion.subject().asPredicate();
        if (predicate === undefined) return false;
        return predicate.asText() === HAS_RECIPIENT;
      } catch {
        return false;
      }
    });

    if (recipientAssertions.length === 0) {
      throw EnvelopeError.general("No recipients found");
    }

    // Try each recipient assertion until one unseals successfully
    let contentKey: SymmetricKey | null = null;

    for (const assertion of recipientAssertions) {
      try {
        const obj = assertion.subject().asObject();
        if (obj === undefined) continue;
        const sealedData = obj.asByteString();
        if (sealedData === undefined) continue;
        const sealedMessage = new SealedMessage(sealedData);

        // Try to unseal with our private key
        contentKey = recipientPrivateKey.unseal(sealedMessage);
        break; // Success!
      } catch {
        // Not for us, try next one
        continue;
      }
    }

    if (contentKey === null) {
      throw EnvelopeError.general("Not a valid recipient");
    }

    // Decrypt the subject using the content key
    return this.decryptSubject(contentKey);
  };

  /// Implementation of decryptToRecipient()
  Envelope.prototype.decryptToRecipient = function (
    this: Envelope,
    recipientPrivateKey: PrivateKeyBase,
  ): Envelope {
    const decrypted = this.decryptSubjectToRecipient(recipientPrivateKey);
    return decrypted.unwrap();
  };

  /// Implementation of encryptToRecipients()
  Envelope.prototype.encryptToRecipients = function (
    this: Envelope,
    recipients: PublicKeyBase[],
  ): Envelope {
    return this.wrap().encryptSubjectToRecipients(recipients);
  };

  /// Implementation of recipients()
  Envelope.prototype.recipients = function (this: Envelope): SealedMessage[] {
    const recipientAssertions = this.assertions().filter((assertion) => {
      try {
        const predicate = assertion.subject().asPredicate();
        if (predicate === undefined) return false;
        return predicate.asText() === HAS_RECIPIENT;
      } catch {
        return false;
      }
    });

    return recipientAssertions.map((assertion) => {
      const obj = assertion.subject().asObject();
      if (obj === undefined) {
        throw EnvelopeError.general("Invalid recipient assertion");
      }
      const sealedData = obj.asByteString();
      if (sealedData === undefined) {
        throw EnvelopeError.general("Invalid recipient data");
      }
      return new SealedMessage(sealedData);
    });
  };
}

// Import side-effect to register prototype extensions
export {};
