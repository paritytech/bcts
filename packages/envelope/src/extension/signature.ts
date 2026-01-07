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

import { Envelope } from "../base/envelope";
import { EnvelopeError } from "../base/error";
import {
  ecdsaSign,
  ecdsaVerify,
  ecdsaPublicKeyFromPrivateKey,
  ECDSA_PRIVATE_KEY_SIZE,
  ECDSA_PUBLIC_KEY_SIZE,
  ECDSA_UNCOMPRESSED_PUBLIC_KEY_SIZE,
} from "@bcts/crypto";
import { SecureRandomNumberGenerator, rngRandomData } from "@bcts/rand";

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
 * Uses @bcts/crypto functions.
 */
export class SigningPrivateKey implements Signer {
  readonly #privateKey: Uint8Array;

  constructor(privateKey: Uint8Array) {
    if (privateKey.length !== ECDSA_PRIVATE_KEY_SIZE) {
      throw new Error(`Private key must be ${ECDSA_PRIVATE_KEY_SIZE} bytes`);
    }
    this.#privateKey = privateKey;
  }

  /**
   * Generates a new random private key.
   */
  static generate(): SigningPrivateKey {
    const rng = new SecureRandomNumberGenerator();
    const privateKey = rngRandomData(rng, ECDSA_PRIVATE_KEY_SIZE);
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
    const publicKey = ecdsaPublicKeyFromPrivateKey(this.#privateKey);
    return new SigningPublicKey(publicKey);
  }

  /**
   * Signs data and returns a Signature.
   */
  sign(data: Uint8Array): Signature {
    const signatureBytes = ecdsaSign(this.#privateKey, data);
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
 * Uses @bcts/crypto functions.
 */
export class SigningPublicKey implements Verifier {
  readonly #publicKey: Uint8Array;

  constructor(publicKey: Uint8Array) {
    if (
      publicKey.length !== ECDSA_PUBLIC_KEY_SIZE &&
      publicKey.length !== ECDSA_UNCOMPRESSED_PUBLIC_KEY_SIZE
    ) {
      throw new Error(
        `Public key must be ${ECDSA_PUBLIC_KEY_SIZE} bytes (compressed) or ${ECDSA_UNCOMPRESSED_PUBLIC_KEY_SIZE} bytes (uncompressed)`,
      );
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
      return ecdsaVerify(this.#publicKey, signature.data(), data);
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
  readonly #assertions: [string, unknown][] = [];

  /**
   * Adds an assertion to the metadata.
   */
  withAssertion(predicate: string, object: unknown): SignatureMetadata {
    const metadata = new SignatureMetadata();
    metadata.#assertions.push(...this.#assertions);
    metadata.#assertions.push([predicate, object]);
    return metadata;
  }

  /**
   * Returns all assertions in the metadata.
   */
  assertions(): [string, unknown][] {
    return this.#assertions;
  }

  /**
   * Returns true if this metadata has any assertions.
   */
  hasAssertions(): boolean {
    return this.#assertions.length > 0;
  }
}

// Implementation
// eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
if (Envelope?.prototype) {
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

    if (metadata?.hasAssertions() === true) {
      // Add metadata assertions to the signature
      for (const [predicate, object] of metadata.assertions()) {
        signatureEnvelope = signatureEnvelope.addAssertion(
          predicate,
          object as string | number | boolean,
        );
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
          if (sigData !== undefined) {
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
              if (outerSigData !== undefined) {
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
                  if (innerSigData !== undefined) {
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

  /**
   * Adds multiple signatures with optional metadata.
   */
  Envelope.prototype.addSignaturesWithMetadata = function (
    this: Envelope,
    signersWithMetadata: { signer: Signer; metadata?: SignatureMetadata }[],
  ): Envelope {
    return signersWithMetadata.reduce(
      (envelope, { signer, metadata }) => envelope.addSignatureWithMetadata(signer, metadata),
      this,
    );
  };

  /**
   * Returns whether the envelope's subject has valid signatures from all of the given keys.
   */
  Envelope.prototype.hasSignaturesFrom = function (this: Envelope, verifiers: Verifier[]): boolean {
    return this.hasSignaturesFromThreshold(verifiers, verifiers.length);
  };

  /**
   * Returns whether the envelope's subject has at least `threshold` valid signatures
   * from the given keys.
   *
   * If `threshold` is undefined, all signers must have signed.
   */
  Envelope.prototype.hasSignaturesFromThreshold = function (
    this: Envelope,
    verifiers: Verifier[],
    threshold?: number,
  ): boolean {
    const requiredCount = threshold ?? verifiers.length;
    let count = 0;
    for (const verifier of verifiers) {
      if (this.hasSignatureFrom(verifier)) {
        count++;
        if (count >= requiredCount) {
          return true;
        }
      }
    }
    return false;
  };

  /**
   * Verifies that all given keys have signed this envelope.
   * Throws if not all signatures are valid.
   */
  Envelope.prototype.verifySignaturesFrom = function (
    this: Envelope,
    verifiers: Verifier[],
  ): Envelope {
    return this.verifySignaturesFromThreshold(verifiers, verifiers.length);
  };

  /**
   * Verifies that at least `threshold` of the given keys have signed this envelope.
   * Throws if not enough signatures are valid.
   */
  Envelope.prototype.verifySignaturesFromThreshold = function (
    this: Envelope,
    verifiers: Verifier[],
    threshold?: number,
  ): Envelope {
    if (!this.hasSignaturesFromThreshold(verifiers, threshold)) {
      throw EnvelopeError.unverifiedSignature();
    }
    return this;
  };

  /**
   * Returns whether the envelope's subject has a valid signature from the given key,
   * returning the signature metadata envelope if found.
   */
  Envelope.prototype.hasSignatureFromReturningMetadata = function (
    this: Envelope,
    verifier: Verifier,
  ): Envelope | undefined {
    const subjectDigest = this.subject().digest();
    const signatures = this.signatures();

    for (const sigEnvelope of signatures) {
      const c = sigEnvelope.case();

      if (c.type === "leaf") {
        try {
          const sigData = sigEnvelope.asByteString();
          if (sigData !== undefined) {
            const signature = new Signature(sigData);
            if (verifier.verify(subjectDigest.data(), signature)) {
              return sigEnvelope;
            }
          }
        } catch {
          continue;
        }
      } else if (c.type === "node") {
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
              if (outerSigData !== undefined) {
                const outerSignature = new Signature(outerSigData);
                const nodeSubject = c.subject;
                const nodeSubjectCase = nodeSubject.case();

                if (
                  nodeSubjectCase.type === "wrapped" &&
                  verifier.verify(nodeSubject.digest().data(), outerSignature)
                ) {
                  const wrapped = nodeSubjectCase.envelope;
                  const innerSig = wrapped.subject();
                  const innerSigData = innerSig.asByteString();
                  if (innerSigData !== undefined) {
                    const innerSignature = new Signature(innerSigData);
                    if (verifier.verify(subjectDigest.data(), innerSignature)) {
                      // Return the metadata envelope (the wrapped envelope)
                      return wrapped;
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

    return undefined;
  };

  /**
   * Verifies that the envelope has a valid signature from the given key,
   * returning the signature metadata envelope.
   * Throws if no valid signature is found.
   */
  Envelope.prototype.verifySignatureFromReturningMetadata = function (
    this: Envelope,
    verifier: Verifier,
  ): Envelope {
    const metadata = this.hasSignatureFromReturningMetadata(verifier);
    if (metadata === undefined) {
      throw EnvelopeError.unverifiedSignature();
    }
    return metadata;
  };

  /**
   * Signs the entire envelope (subject and assertions) by wrapping it first.
   * This is a convenience method that wraps the envelope before signing.
   */
  Envelope.prototype.sign = function (this: Envelope, signer: Signer): Envelope {
    return this.wrap().addSignature(signer);
  };

  /**
   * Signs the entire envelope with metadata.
   */
  Envelope.prototype.signWithMetadata = function (
    this: Envelope,
    signer: Signer,
    metadata?: SignatureMetadata,
  ): Envelope {
    return this.wrap().addSignatureWithMetadata(signer, metadata);
  };

  /**
   * Verifies that the envelope has a valid signature and unwraps it.
   * This is a convenience method for envelopes signed with `sign()`.
   */
  Envelope.prototype.verify = function (this: Envelope, verifier: Verifier): Envelope {
    this.verifySignatureFrom(verifier);
    return this.tryUnwrap();
  };

  /**
   * Verifies the envelope's signature and returns both the unwrapped envelope
   * and signature metadata.
   */
  Envelope.prototype.verifyReturningMetadata = function (
    this: Envelope,
    verifier: Verifier,
  ): { envelope: Envelope; metadata: Envelope } {
    const metadata = this.verifySignatureFromReturningMetadata(verifier);
    return { envelope: this.tryUnwrap(), metadata };
  };

  /**
   * Creates a signed assertion envelope.
   *
   * This is a convenience constructor that creates an assertion with the
   * `signed` predicate and a Signature as the object. Optionally adds a
   * note to the assertion.
   *
   * @param signature - The Signature to include in the assertion
   * @param note - Optional note to add to the assertion
   * @returns A new assertion envelope with the signature
   */
  Envelope.prototype.makeSignedAssertion = function (
    this: Envelope,
    signature: Signature,
    note?: string,
  ): Envelope {
    let envelope = Envelope.newAssertion(SIGNED, signature.data());
    if (note !== undefined && note !== "") {
      envelope = envelope.addAssertion(NOTE, note);
    }
    return envelope;
  };

  /**
   * Returns whether the given signature is valid for this envelope's subject.
   *
   * @param signature - The Signature to check
   * @param verifier - The public key to verify against
   * @returns true if the signature is valid, false otherwise
   */
  Envelope.prototype.isVerifiedSignature = function (
    this: Envelope,
    signature: Signature,
    verifier: Verifier,
  ): boolean {
    return verifier.verify(this.digest().data(), signature);
  };

  /**
   * Verifies that the given signature is valid for this envelope's subject.
   * Throws if the signature is not valid.
   *
   * @param signature - The Signature to check
   * @param verifier - The public key to verify against
   * @returns This envelope (for chaining)
   * @throws EnvelopeError.unverifiedSignature if the signature is invalid
   */
  Envelope.prototype.verifySignature = function (
    this: Envelope,
    signature: Signature,
    verifier: Verifier,
  ): Envelope {
    if (!this.isVerifiedSignature(signature, verifier)) {
      throw EnvelopeError.unverifiedSignature();
    }
    return this;
  };
}
