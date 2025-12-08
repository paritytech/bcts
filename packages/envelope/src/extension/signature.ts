/**
 * Signature Extension for Gordian Envelope
 *
 * Provides functionality for digitally signing Envelopes and verifying signatures,
 * with optional metadata support.
 *
 * The signature extension allows:
 * - Signing envelope subjects to validate their authenticity
 * - Adding metadata to signatures (e.g., signer identity, date, purpose)
 * - Verification of signatures, both with and without metadata
 * - Support for multiple signatures on a single envelope
 */

import { secp256k1 } from "@noble/curves/secp256k1.js";
import { Envelope } from "../base/envelope";
import { EnvelopeError } from "../base/error";

/**
 * Known value for the 'signed' predicate.
 * This is the standard predicate used for signature assertions.
 */
export const SIGNED = "signed";

/**
 * Known value for the 'verifiedBy' predicate.
 * Used to indicate verification status.
 */
export const VERIFIED_BY = "verifiedBy";

/**
 * Known value for the 'note' predicate.
 * Used for adding notes/comments to signatures.
 */
export const NOTE = "note";

/**
 * Represents a cryptographic signature.
 */
export class Signature {
  readonly #data: Uint8Array;

  constructor(data: Uint8Array) {
    this.#data = data;
  }

  /**
   * Returns the raw signature bytes.
   */
  data(): Uint8Array {
    return this.#data;
  }

  /**
   * Returns the hex-encoded signature.
   */
  hex(): string {
    return Array.from(this.#data)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /**
   * Creates a Signature from hex string.
   */
  static fromHex(hex: string): Signature {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return new Signature(bytes);
  }
}

/**
 * Interface for types that can sign data.
 */
export interface Signer {
  /**
   * Signs the provided data and returns a Signature.
   */
  sign(data: Uint8Array): Signature;
}

/**
 * Interface for types that can verify signatures.
 */
export interface Verifier {
  /**
   * Verifies a signature against the provided data.
   * Returns true if the signature is valid.
   */
  verify(data: Uint8Array, signature: Signature): boolean;
}

/**
 * ECDSA signing key using secp256k1 curve.
 */
export class SigningPrivateKey implements Signer {
  readonly #privateKey: Uint8Array;

  constructor(privateKey: Uint8Array) {
    if (privateKey.length !== 32) {
      throw new Error("Private key must be 32 bytes");
    }
    this.#privateKey = privateKey;
  }

  /**
   * Generates a new random private key.
   */
  static generate(): SigningPrivateKey {
    const privateKey: Uint8Array = secp256k1.utils.randomPrivateKey();
    return new SigningPrivateKey(privateKey);
  }

  /**
   * Creates a private key from hex string.
   */
  static fromHex(hex: string): SigningPrivateKey {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return new SigningPrivateKey(bytes);
  }

  /**
   * Returns the corresponding public key.
   */
  publicKey(): SigningPublicKey {
    const publicKey = secp256k1.getPublicKey(this.#privateKey, true); // compressed
    return new SigningPublicKey(publicKey);
  }

  /**
   * Signs data and returns a Signature.
   */
  sign(data: Uint8Array): Signature {
    const signature = secp256k1.sign(data, this.#privateKey);
    const signatureBytes: Uint8Array = signature.toCompactRawBytes();
    return new Signature(signatureBytes);
  }

  /**
   * Returns the raw private key bytes.
   */
  data(): Uint8Array {
    return this.#privateKey;
  }
}

/**
 * ECDSA public key for signature verification using secp256k1 curve.
 */
export class SigningPublicKey implements Verifier {
  readonly #publicKey: Uint8Array;

  constructor(publicKey: Uint8Array) {
    if (publicKey.length !== 33 && publicKey.length !== 65) {
      throw new Error("Public key must be 33 bytes (compressed) or 65 bytes (uncompressed)");
    }
    this.#publicKey = publicKey;
  }

  /**
   * Creates a public key from hex string.
   */
  static fromHex(hex: string): SigningPublicKey {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return new SigningPublicKey(bytes);
  }

  /**
   * Verifies a signature against the provided data.
   */
  verify(data: Uint8Array, signature: Signature): boolean {
    try {
      const sig = secp256k1.Signature.fromCompact(signature.data());
      return secp256k1.verify(
        sig,
        data,
        this.#publicKey,
      );
    } catch {
      return false;
    }
  }

  /**
   * Returns the raw public key bytes.
   */
  data(): Uint8Array {
    return this.#publicKey;
  }

  /**
   * Returns the hex-encoded public key.
   */
  hex(): string {
    return Array.from(this.#publicKey)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}

/**
 * Metadata that can be attached to a signature.
 */
export class SignatureMetadata {
  readonly #assertions: [string, any][] = [];

  /**
   * Adds an assertion to the metadata.
   */
  withAssertion(predicate: string, object: any): SignatureMetadata {
    const metadata = new SignatureMetadata();
    metadata.#assertions.push(...this.#assertions);
    metadata.#assertions.push([predicate, object]);
    return metadata;
  }

  /**
   * Returns all assertions in the metadata.
   */
  assertions(): [string, any][] {
    return this.#assertions;
  }

  /**
   * Returns true if this metadata has any assertions.
   */
  hasAssertions(): boolean {
    return this.#assertions.length > 0;
  }
}

/**
 * Support for signing envelopes and verifying signatures.
 */
declare module "../base/envelope" {
  interface Envelope {
    /**
     * Creates a signature for the envelope's subject and returns a new
     * envelope with a 'signed': Signature assertion.
     *
     * @param signer - The signing key
     * @returns The signed envelope
     *
     * @example
     * ```typescript
     * const privateKey = SigningPrivateKey.generate();
     * const envelope = Envelope.new("Hello, world!");
     * const signed = envelope.addSignature(privateKey);
     * ```
     */
    addSignature(signer: Signer): Envelope;

    /**
     * Creates a signature for the envelope's subject with optional metadata.
     *
     * @param signer - The signing key
     * @param metadata - Optional metadata to attach to the signature
     * @returns The signed envelope
     */
    addSignatureWithMetadata(signer: Signer, metadata?: SignatureMetadata): Envelope;

    /**
     * Creates multiple signatures for the envelope's subject.
     *
     * @param signers - Array of signing keys
     * @returns The envelope with multiple signatures
     */
    addSignatures(signers: Signer[]): Envelope;

    /**
     * Returns whether this envelope has a valid signature from the given verifier.
     *
     * @param verifier - The public key to verify against
     * @returns True if a valid signature from this verifier exists
     */
    hasSignatureFrom(verifier: Verifier): boolean;

    /**
     * Verifies that this envelope has a valid signature from the given verifier
     * and returns the envelope.
     *
     * @param verifier - The public key to verify against
     * @returns The verified envelope
     * @throws {EnvelopeError} If no valid signature is found
     */
    verifySignatureFrom(verifier: Verifier): Envelope;

    /**
     * Returns all signature assertions in this envelope.
     *
     * @returns Array of signature envelopes
     */
    signatures(): Envelope[];
  }
}

// Implementation

Envelope.prototype.addSignature = function (this: Envelope, signer: Signer): Envelope {
  return this.addSignatureWithMetadata(signer, undefined);
};

Envelope.prototype.addSignatureWithMetadata = function (
  this: Envelope,
  signer: Signer,
  metadata?: SignatureMetadata,
): Envelope {
  const digest = this.subject().digest();
  const signature = signer.sign(digest.data());
  let signatureEnvelope = Envelope.new(signature.data());

  if (metadata?.hasAssertions()) {
    // Add metadata assertions to the signature
    for (const [predicate, object] of metadata.assertions()) {
      signatureEnvelope = signatureEnvelope.addAssertion(predicate, object);
    }

    // Wrap the signature with metadata
    signatureEnvelope = signatureEnvelope.wrap();

    // Sign the wrapped envelope
    const outerSignature = signer.sign(signatureEnvelope.digest().data());
    signatureEnvelope = signatureEnvelope.addAssertion(SIGNED, outerSignature.data());
  }

  return this.addAssertion(SIGNED, signatureEnvelope);
};

Envelope.prototype.addSignatures = function (this: Envelope, signers: Signer[]): Envelope {
  return signers.reduce((envelope, signer) => envelope.addSignature(signer), this);
};

Envelope.prototype.hasSignatureFrom = function (this: Envelope, verifier: Verifier): boolean {
  const subjectDigest = this.subject().digest();
  const signatures = this.signatures();

  for (const sigEnvelope of signatures) {
    const c = sigEnvelope.case();

    if (c.type === "leaf") {
      // Simple signature - verify directly
      try {
        const sigData = sigEnvelope.asByteString();
        if (sigData) {
          const signature = new Signature(sigData);
          if (verifier.verify(subjectDigest.data(), signature)) {
            return true;
          }
        }
      } catch {
        continue;
      }
    } else if (c.type === "node") {
      // Signature with metadata - it's a node with 'signed' assertion
      // The structure is: { wrapped_signature [signed: outer_signature] }
      // Check if this node has a 'signed' assertion
      const outerSigs = sigEnvelope.assertions().filter((a) => {
        const aC = a.case();
        if (aC.type === "assertion") {
          const pred = aC.assertion.predicate();
          try {
            return pred.asText() === SIGNED;
          } catch {
            return false;
          }
        }
        return false;
      });

      for (const outerSig of outerSigs) {
        const outerSigCase = outerSig.case();
        if (outerSigCase.type === "assertion") {
          const outerSigObj = outerSigCase.assertion.object();
          try {
            const outerSigData = outerSigObj.asByteString();
            if (outerSigData) {
              const outerSignature = new Signature(outerSigData);

              // The subject of this node should be a wrapped envelope
              const nodeSubject = c.subject;
              const nodeSubjectCase = nodeSubject.case();

              // Verify outer signature against the wrapped envelope
              if (
                nodeSubjectCase.type === "wrapped" &&
                verifier.verify(nodeSubject.digest().data(), outerSignature)
              ) {
                // Now verify inner signature
                const wrapped = nodeSubjectCase.envelope;
                const innerSig = wrapped.subject();
                const innerSigData = innerSig.asByteString();
                if (innerSigData) {
                  const innerSignature = new Signature(innerSigData);
                  if (verifier.verify(subjectDigest.data(), innerSignature)) {
                    return true;
                  }
                }
              }
            }
          } catch {
            continue;
          }
        }
      }
    }
  }

  return false;
};

Envelope.prototype.verifySignatureFrom = function (this: Envelope, verifier: Verifier): Envelope {
  if (this.hasSignatureFrom(verifier)) {
    return this;
  }
  throw EnvelopeError.general("No valid signature found from the given verifier");
};

Envelope.prototype.signatures = function (this: Envelope): Envelope[] {
  const assertions = this.assertions();
  return assertions
    .filter((a) => {
      const c = a.case();
      if (c.type === "assertion") {
        const pred = c.assertion.predicate();
        try {
          return pred.asText() === SIGNED;
        } catch {
          return false;
        }
      }
      return false;
    })
    .map((a) => {
      const c = a.case();
      if (c.type === "assertion") {
        return c.assertion.object();
      }
      throw EnvelopeError.general("Invalid signature assertion");
    });
};
