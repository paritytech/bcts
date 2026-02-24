/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Public key encryption extension for Gordian Envelope.
 *
 * This module implements public key encryption for Gordian Envelope, allowing
 * encrypted content to be selectively shared with one or more recipients. Each
 * recipient needs their own public/private key pair, and only recipients with
 * the corresponding private key can decrypt the envelope's content.
 *
 * The recipient extension builds on the basic envelope encryption capabilities
 * by adding:
 *
 * - **Multiple Recipients** - A single envelope can be encrypted to multiple
 *   recipients
 * - **Content Key Distribution** - Uses public key cryptography to securely
 *   distribute the symmetric key that encrypts the actual content
 * - **Privacy** - Recipients can decrypt the envelope independently without
 *   revealing their identity or access to other recipients
 *
 * ## How It Works
 *
 * The envelope's subject is encrypted using a random symmetric key (the
 * "content key"), and then this content key is encrypted to each recipient's
 * public key using a `SealedMessage`. Each encrypted content key is attached
 * to the envelope with a `hasRecipient` assertion.
 *
 * When recipients want to decrypt the envelope, they use their private key to
 * decrypt the content key from the appropriate `SealedMessage`, and then use
 * that content key to decrypt the envelope's subject.
 *
 * Ported from bc-envelope-rust/src/extension/recipient.rs
 */

import { Envelope } from "../base/envelope";
import { EnvelopeError } from "../base/error";
import { SymmetricKey } from "./encrypt";
import {
  type Encrypter,
  type Decrypter,
  type Nonce,
  SealedMessage as ComponentsSealedMessage,
  isEncrypter,
} from "@bcts/components";
import { HAS_RECIPIENT as HAS_RECIPIENT_KV } from "@bcts/known-values";

/**
 * Predicate constant for recipient assertions.
 * This is the known value 'hasRecipient' used to identify recipient assertions.
 */
export const HAS_RECIPIENT = HAS_RECIPIENT_KV;

/**
 * Re-export the SealedMessage from @bcts/components for compatibility.
 * This is the proper implementation that supports both X25519 and MLKEM.
 */
export { SealedMessage as ComponentsSealedMessage } from "@bcts/components";

/**
 * Re-export Encrypter and Decrypter types for convenience.
 */
export type { Encrypter, Decrypter } from "@bcts/components";

/**
 * Legacy PublicKeyBase class for backwards compatibility.
 * New code should use Encrypter interface directly.
 *
 * @deprecated Use Encrypter interface from @bcts/components instead
 */
export { EncapsulationPublicKey as PublicKeyBase } from "@bcts/components";

/**
 * Legacy PrivateKeyBase class for backwards compatibility.
 * New code should use Decrypter interface or PrivateKeys from @bcts/components instead.
 *
 * Note: This now exports PrivateKeys (which includes both signing and encapsulation keys)
 * instead of just EncapsulationPrivateKey to match the expected API with .publicKeys() method.
 *
 * @deprecated Use Decrypter interface or PrivateKeys from @bcts/components instead
 */
export { PrivateKeys as PrivateKeyBase } from "@bcts/components";

/**
 * SealedMessage wrapping the sealed content key for a recipient.
 * This is the proper implementation from @bcts/components that supports
 * both X25519 and MLKEM encryption schemes.
 */
export class SealedMessage {
  private readonly _inner: ComponentsSealedMessage;

  constructor(sealedMessage: ComponentsSealedMessage) {
    this._inner = sealedMessage;
  }

  /**
   * Creates a sealed message by encrypting a symmetric key to a recipient.
   * Uses the Encrypter interface which supports both X25519 and MLKEM.
   *
   * @param contentKey - The symmetric key to encrypt
   * @param recipient - The recipient's public key (implements Encrypter)
   * @param testNonce - Optional nonce for deterministic testing
   * @returns A sealed message containing the encrypted content key
   */
  static seal(contentKey: SymmetricKey, recipient: Encrypter, testNonce?: Nonce): SealedMessage {
    // Get the encapsulation public key from the Encrypter
    const encapsulationPublicKey = recipient.encapsulationPublicKey();

    // Use the SealedMessage.newOpt from components which properly handles
    // both X25519 and MLKEM encapsulation
    const inner = ComponentsSealedMessage.newOpt(
      contentKey.data(),
      encapsulationPublicKey,
      new Uint8Array(0), // No AAD
      testNonce,
    );

    return new SealedMessage(inner);
  }

  /**
   * Decrypts this sealed message using recipient's private key.
   *
   * @param recipient - The recipient's private key (implements Decrypter)
   * @returns The decrypted content key data
   */
  decrypt(recipient: Decrypter): Uint8Array {
    const encapsulationPrivateKey = recipient.encapsulationPrivateKey();
    return this._inner.decrypt(encapsulationPrivateKey);
  }

  /**
   * Returns the underlying SealedMessage from components.
   */
  inner(): ComponentsSealedMessage {
    return this._inner;
  }

  /**
   * Returns the CBOR-encoded data of this sealed message.
   */
  data(): Uint8Array {
    return this._inner.taggedCborData();
  }

  /**
   * Creates a SealedMessage from CBOR-encoded data.
   */
  static fromData(data: Uint8Array): SealedMessage {
    const inner = ComponentsSealedMessage.fromTaggedCborData(data);
    return new SealedMessage(inner);
  }
}

// ============================================================================
// Envelope Extension Methods
// ============================================================================

// eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
if (Envelope?.prototype) {
  /**
   * Adds a recipient assertion to this envelope.
   *
   * This method adds a `hasRecipient` assertion containing a `SealedMessage`
   * that holds the content key encrypted to the recipient's public key.
   *
   * @param recipient - The recipient's public key (implements Encrypter)
   * @param contentKey - The symmetric key used to encrypt the envelope's subject
   * @param testNonce - Optional nonce for deterministic testing
   * @returns A new envelope with the recipient assertion added
   */
  Envelope.prototype.addRecipient = function (
    this: Envelope,
    recipient: Encrypter,
    contentKey: SymmetricKey,
    testNonce?: Nonce,
  ): Envelope {
    const sealedMessage = SealedMessage.seal(contentKey, recipient, testNonce);
    // Store the sealed message as CBOR data in the assertion
    return this.addAssertion(HAS_RECIPIENT, sealedMessage.inner());
  };

  /**
   * Encrypts the envelope's subject and adds a recipient assertion.
   *
   * This is a convenience method that:
   * 1. Generates a random content key
   * 2. Encrypts the subject with the content key
   * 3. Adds a recipient assertion with the sealed content key
   *
   * @param recipient - The recipient's public key (implements Encrypter)
   * @returns A new envelope with encrypted subject and recipient assertion
   */
  Envelope.prototype.encryptSubjectToRecipient = function (
    this: Envelope,
    recipient: Encrypter,
  ): Envelope {
    // Validate that recipient implements Encrypter
    if (!isEncrypter(recipient)) {
      throw EnvelopeError.general(
        "Recipient must implement Encrypter interface. " +
          "Use PublicKeys or EncapsulationPublicKey from @bcts/components.",
      );
    }

    // Generate a random content key
    const contentKey = SymmetricKey.new();

    // Encrypt the subject with the content key
    const encrypted = this.encryptSubject(contentKey);

    // Add the recipient
    return encrypted.addRecipient(recipient, contentKey);
  };

  /**
   * Encrypts the envelope's subject and adds recipient assertions for multiple recipients.
   *
   * @param recipients - Array of recipient public keys (each implements Encrypter)
   * @returns A new envelope with encrypted subject and recipient assertions
   */
  Envelope.prototype.encryptSubjectToRecipients = function (
    this: Envelope,
    recipients: Encrypter[],
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
      if (!isEncrypter(recipient)) {
        throw EnvelopeError.general(
          "All recipients must implement Encrypter interface. " +
            "Use PublicKeys or EncapsulationPublicKey from @bcts/components.",
        );
      }
      result = result.addRecipient(recipient, contentKey);
    }

    return result;
  };

  /**
   * Returns all SealedMessages from the envelope's `hasRecipient` assertions.
   *
   * @returns Array of SealedMessage objects
   */
  Envelope.prototype.recipients = function (this: Envelope): SealedMessage[] {
    const recipientAssertions = this.assertions().filter((assertion) => {
      try {
        const predicate = assertion.subject().asPredicate();
        if (predicate === undefined) return false;
        // Check if it's the hasRecipient known value
        const knownValue = predicate.asKnownValue();
        if (knownValue !== undefined) {
          return knownValue.equals(HAS_RECIPIENT);
        }
        // Also check string form for backwards compatibility
        const text = predicate.asText();
        return text === "hasRecipient";
      } catch {
        return false;
      }
    });

    return recipientAssertions.map((assertion) => {
      // Get the object from the assertion case
      const assertionCase = assertion.case();
      if (assertionCase.type !== "assertion") {
        throw EnvelopeError.general("Invalid recipient assertion structure");
      }

      const obj = assertionCase.assertion.object();

      // Try to decode as SealedMessage from components
      try {
        // The object should be a leaf envelope containing a SealedMessage
        // Get the underlying CBOR from the leaf envelope
        const leafCbor = obj.asLeaf();
        if (leafCbor !== undefined) {
          // Convert the CBOR to bytes and decode as SealedMessage
          const cborData = leafCbor.toData();
          const inner = ComponentsSealedMessage.fromTaggedCborData(cborData);
          return new SealedMessage(inner);
        }

        // Try extracting from the full envelope CBOR as fallback
        const cborData = obj.taggedCborData();
        const inner = ComponentsSealedMessage.fromTaggedCborData(cborData);
        return new SealedMessage(inner);
      } catch {
        // Try legacy format: raw bytes
        try {
          const sealedData = obj.asByteString();
          if (sealedData !== undefined) {
            return SealedMessage.fromData(sealedData);
          }
        } catch {
          // Fall through to error
        }
        throw EnvelopeError.general("Invalid recipient sealed message format");
      }
    });
  };

  /**
   * Decrypts the envelope's subject using the recipient's private key.
   *
   * This method:
   * 1. Finds all `hasRecipient` assertions
   * 2. Tries to decrypt each sealed message until one succeeds
   * 3. Uses the recovered content key to decrypt the subject
   *
   * @param recipient - The recipient's private key (implements Decrypter)
   * @returns A new envelope with decrypted subject
   */
  Envelope.prototype.decryptSubjectToRecipient = function (
    this: Envelope,
    recipient: Decrypter,
  ): Envelope {
    // Check that the subject is encrypted
    const subjectCase = this.subject().case();
    if (subjectCase.type !== "encrypted") {
      throw EnvelopeError.general("Subject is not encrypted");
    }

    // Get all sealed messages from recipient assertions
    const sealedMessages = this.recipients();

    if (sealedMessages.length === 0) {
      throw EnvelopeError.general("No recipients found");
    }

    // Try each sealed message until one decrypts successfully
    let contentKeyData: Uint8Array | null = null;

    for (const sealedMessage of sealedMessages) {
      try {
        contentKeyData = sealedMessage.decrypt(recipient);
        break; // Success!
      } catch {
        // Not for us, try next one
        continue;
      }
    }

    if (contentKeyData === null) {
      throw EnvelopeError.general("Not a valid recipient");
    }

    // Create SymmetricKey from the decrypted content key
    const contentKey = SymmetricKey.from(contentKeyData);

    // Decrypt the subject using the content key
    return this.decryptSubject(contentKey);
  };

  /**
   * Decrypts an envelope that was encrypted to a recipient and unwraps it.
   *
   * This is a convenience method that:
   * 1. Decrypts the subject using the recipient's private key
   * 2. Unwraps the resulting envelope
   *
   * @param recipient - The recipient's private key (implements Decrypter)
   * @returns The unwrapped, decrypted envelope
   */
  Envelope.prototype.decryptToRecipient = function (
    this: Envelope,
    recipient: Decrypter,
  ): Envelope {
    const decrypted = this.decryptSubjectToRecipient(recipient);
    return decrypted.unwrap();
  };

  /**
   * Wraps and encrypts an envelope to multiple recipients.
   *
   * @param recipients - Array of recipient public keys (each implements Encrypter)
   * @returns A wrapped and encrypted envelope
   */
  Envelope.prototype.encryptToRecipients = function (
    this: Envelope,
    recipients: Encrypter[],
  ): Envelope {
    return this.wrap().encryptSubjectToRecipients(recipients);
  };
}

// Import side-effect to register prototype extensions
export {};
