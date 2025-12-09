import { Envelope } from "../base/envelope";
import { EnvelopeError } from "../base/error";
import { SymmetricKey } from "./encrypt";
import sodium from "libsodium-wrappers";

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
/// 3. The content key is encrypted to each recipient's public key using libsodium sealed boxes
/// 4. Each encrypted content key is added as a `hasRecipient` assertion
///
/// ## Sealed Box Security:
///
/// Sealed boxes use ephemeral X25519 key pairs. The ephemeral private key
/// is discarded after encryption, ensuring that even the sender cannot
/// decrypt the message later. Recipients must try each sealed message
/// until one decrypts successfully.
///
/// @example
/// ```typescript
/// // Generate recipient keys
/// const alice = await PrivateKeyBase.generate();
/// const bob = await PrivateKeyBase.generate();
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
    if (publicKey.length !== 32) {
      throw new Error("Public key must be 32 bytes");
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
  static async generate(): Promise<PrivateKeyBase> {
    await sodium.ready;
    const keyPair = sodium.crypto_box_keypair();
    return new PrivateKeyBase(keyPair.privateKey, keyPair.publicKey);
  }

  /// Creates a private key from existing bytes
  static fromBytes(privateKey: Uint8Array, publicKey: Uint8Array): PrivateKeyBase {
    if (privateKey.length !== 32) {
      throw new Error("Private key must be 32 bytes");
    }
    if (publicKey.length !== 32) {
      throw new Error("Public key must be 32 bytes");
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
  async unseal(sealedMessage: SealedMessage): Promise<SymmetricKey> {
    await sodium.ready;

    try {
      const decrypted = sodium.crypto_box_seal_open(
        sealedMessage.data(),
        this.#publicKey.data(),
        this.#privateKey,
      );

      return SymmetricKey.from(decrypted);
    } catch (_error) {
      throw EnvelopeError.general("Failed to unseal message: not a recipient");
    }
  }
}

/// Represents a sealed message - encrypted content key for a recipient
/// Uses libsodium's sealed box construction with ephemeral X25519 keys
export class SealedMessage {
  readonly #data: Uint8Array;

  constructor(data: Uint8Array) {
    this.#data = data;
  }

  /// Creates a sealed message by encrypting a symmetric key to a recipient's public key
  static async seal(
    contentKey: SymmetricKey,
    recipientPublicKey: PublicKeyBase,
  ): Promise<SealedMessage> {
    await sodium.ready;

    // Use libsodium's sealed box to encrypt the content key
    // This creates an ephemeral key pair internally and discards the private key
    const sealed = sodium.crypto_box_seal(contentKey.data(), recipientPublicKey.data());

    return new SealedMessage(sealed);
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

declare module "../base/envelope" {
  interface Envelope {
    /// Encrypts the envelope's subject to a single recipient.
    ///
    /// Generates a random content key, encrypts the subject with it,
    /// and adds a sealed message containing the content key encrypted
    /// to the recipient's public key.
    ///
    /// @param recipientPublicKey - The recipient's public key
    /// @returns A new envelope with encrypted subject and recipient assertion
    ///
    /// @example
    /// ```typescript
    /// const bob = await PrivateKeyBase.generate();
    /// const encrypted = await envelope.encryptSubjectToRecipient(bob.publicKeys());
    /// ```
    encryptSubjectToRecipient(recipientPublicKey: PublicKeyBase): Promise<Envelope>;

    /// Encrypts the envelope's subject to multiple recipients.
    ///
    /// Each recipient gets their own sealed message containing the same
    /// content key encrypted to their public key. Recipients must try
    /// each sealed message until one decrypts successfully.
    ///
    /// @param recipients - Array of recipient public keys
    /// @returns A new envelope with encrypted subject and multiple recipient assertions
    ///
    /// @example
    /// ```typescript
    /// const encrypted = await envelope.encryptSubjectToRecipients([
    ///   alice.publicKeys(),
    ///   bob.publicKeys(),
    ///   charlie.publicKeys()
    /// ]);
    /// ```
    encryptSubjectToRecipients(recipients: PublicKeyBase[]): Promise<Envelope>;

    /// Adds a recipient to an already encrypted envelope.
    ///
    /// The envelope must already be encrypted with a content key.
    /// This method adds another recipient who can decrypt using the
    /// same content key.
    ///
    /// @param recipientPublicKey - The new recipient's public key
    /// @param contentKey - The symmetric key used to encrypt the subject
    /// @returns A new envelope with an additional recipient assertion
    ///
    /// @example
    /// ```typescript
    /// const dave = await PrivateKeyBase.generate();
    /// const withDave = await encrypted.addRecipient(dave.publicKeys(), contentKey);
    /// ```
    addRecipient(recipientPublicKey: PublicKeyBase, contentKey: SymmetricKey): Promise<Envelope>;

    /// Decrypts an envelope's subject using a recipient's private key.
    ///
    /// Tries each `hasRecipient` assertion until one unseals successfully,
    /// then uses the recovered content key to decrypt the subject.
    ///
    /// @param recipientPrivateKey - The recipient's private key
    /// @returns A new envelope with decrypted subject
    /// @throws {EnvelopeError} If not a valid recipient or subject not encrypted
    ///
    /// @example
    /// ```typescript
    /// const decrypted = await encrypted.decryptSubjectToRecipient(bob);
    /// ```
    decryptSubjectToRecipient(recipientPrivateKey: PrivateKeyBase): Promise<Envelope>;

    /// Convenience method to decrypt and unwrap an envelope.
    ///
    /// Useful when the entire envelope was wrapped and encrypted.
    /// Decrypts the subject and then unwraps it.
    ///
    /// @param recipientPrivateKey - The recipient's private key
    /// @returns The original decrypted and unwrapped envelope
    /// @throws {EnvelopeError} If not a valid recipient, subject not encrypted, or cannot unwrap
    ///
    /// @example
    /// ```typescript
    /// const original = await wrappedEncrypted.decryptToRecipient(alice);
    /// ```
    decryptToRecipient(recipientPrivateKey: PrivateKeyBase): Promise<Envelope>;

    /// Convenience method to encrypt an entire envelope to recipients.
    ///
    /// Wraps the envelope first, then encrypts it to the recipients.
    /// This encrypts both the subject and all assertions.
    ///
    /// @param recipients - Array of recipient public keys
    /// @returns A new encrypted envelope
    ///
    /// @example
    /// ```typescript
    /// const encrypted = await envelope.encryptToRecipients([
    ///   alice.publicKeys(),
    ///   bob.publicKeys()
    /// ]);
    /// ```
    encryptToRecipients(recipients: PublicKeyBase[]): Promise<Envelope>;

    /// Returns all sealed messages (recipient assertions) in the envelope.
    ///
    /// Each sealed message represents one recipient who can decrypt
    /// the envelope's subject.
    ///
    /// @returns Array of sealed messages
    ///
    /// @example
    /// ```typescript
    /// const recipients = envelope.recipients();
    /// console.log(`Envelope has ${recipients.length} recipients`);
    /// ```
    recipients(): SealedMessage[];
  }
}

/// Implementation of encryptSubjectToRecipient()
Envelope.prototype.encryptSubjectToRecipient = async function (
  this: Envelope,
  recipientPublicKey: PublicKeyBase,
): Promise<Envelope> {
  // Generate a random content key
  const contentKey = await SymmetricKey.generate();

  // Encrypt the subject with the content key
  const encrypted = await this.encryptSubject(contentKey);

  // Add the recipient
  return encrypted.addRecipient(recipientPublicKey, contentKey);
};

/// Implementation of encryptSubjectToRecipients()
Envelope.prototype.encryptSubjectToRecipients = async function (
  this: Envelope,
  recipients: PublicKeyBase[],
): Promise<Envelope> {
  if (recipients.length === 0) {
    throw EnvelopeError.general("Must provide at least one recipient");
  }

  // Generate a random content key
  const contentKey = await SymmetricKey.generate();

  // Encrypt the subject with the content key
  let result = await this.encryptSubject(contentKey);

  // Add each recipient
  for (const recipient of recipients) {
    result = await result.addRecipient(recipient, contentKey);
  }

  return result;
};

/// Implementation of addRecipient()
Envelope.prototype.addRecipient = async function (
  this: Envelope,
  recipientPublicKey: PublicKeyBase,
  contentKey: SymmetricKey,
): Promise<Envelope> {
  // Create a sealed message with the content key
  const sealedMessage = await SealedMessage.seal(contentKey, recipientPublicKey);

  // Store the sealed message as bytes in the assertion
  return this.addAssertion(HAS_RECIPIENT, sealedMessage.data());
};

/// Implementation of decryptSubjectToRecipient()
Envelope.prototype.decryptSubjectToRecipient = async function (
  this: Envelope,
  recipientPrivateKey: PrivateKeyBase,
): Promise<Envelope> {
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
      contentKey = await recipientPrivateKey.unseal(sealedMessage);
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
Envelope.prototype.decryptToRecipient = async function (
  this: Envelope,
  recipientPrivateKey: PrivateKeyBase,
): Promise<Envelope> {
  const decrypted = await this.decryptSubjectToRecipient(recipientPrivateKey);
  return decrypted.unwrap();
};

/// Implementation of encryptToRecipients()
Envelope.prototype.encryptToRecipients = async function (
  this: Envelope,
  recipients: PublicKeyBase[],
): Promise<Envelope> {
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

// Import side-effect to register prototype extensions
export {};
