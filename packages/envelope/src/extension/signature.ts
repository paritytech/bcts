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
import type { EnvelopeEncodableValue } from "../base/envelope-encodable";
import { EnvelopeError } from "../base/error";

/**
 * Re-export signing types from @bcts/components for type compatibility.
 *
 * The @bcts/components signing types are the canonical implementations with:
 * - Multiple signature schemes (Ed25519, Schnorr, ECDSA, SR25519, MLDSA)
 * - Full CBOR support (tagged/untagged)
 * - UR support
 * - SSH format support
 *
 * This re-export ensures type compatibility between @bcts/envelope
 * and @bcts/components when used together.
 */
export {
  Signature,
  SigningPrivateKey,
  SigningPublicKey,
  type Signer,
  type Verifier,
} from "@bcts/components";
import { Signature, type Signer, type Verifier } from "@bcts/components";

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
 * Metadata that can be attached to a signature.
 */
export class SignatureMetadata {
  readonly #assertions: [string, unknown][] = [];

  /**
   * Creates a new SignatureMetadata instance.
   * Use the static `new()` method for fluent API style.
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  /**
   * Creates a new empty SignatureMetadata.
   */
  static new(): SignatureMetadata {
    return new SignatureMetadata();
  }

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
   * Returns all assertions in this metadata.
   */
  assertions(): readonly [string, unknown][] {
    return this.#assertions;
  }
}

// ============================================================================
// Type Declarations for Envelope Signature Extension
// ============================================================================

declare module "../base/envelope" {
  interface Envelope {
    /**
     * Add a signature assertion with optional metadata.
     */
    addSignatureWithMetadata(signer: Signer, metadata?: SignatureMetadata): Envelope;

    /**
     * Add a signature assertion without metadata.
     */
    addSignature(signer: Signer): Envelope;

    /**
     * Add a signature with optional signer options and metadata.
     */
    addSignatureOpt(signer: Signer, options?: unknown, metadata?: SignatureMetadata): Envelope;

    /**
     * Add multiple signatures from an array of signers.
     */
    addSignatures(signers: Signer[]): Envelope;

    /**
     * Check if this envelope has a valid signature from the given verifier.
     */
    hasSignatureFrom(verifier: Verifier): boolean;

    /**
     * Check if this envelope has valid signatures from all given verifiers.
     */
    hasSignaturesFrom(verifiers: Verifier[]): boolean;

    /**
     * Check if this envelope has at least threshold valid signatures from the given verifiers.
     */
    hasSignaturesFromThreshold(verifiers: Verifier[], threshold: number): boolean;

    /**
     * Wrap and sign this envelope (without metadata).
     */
    sign(signer: Signer): Envelope;

    /**
     * Wrap and sign this envelope with optional metadata.
     */
    signWithMetadata(signer: Signer, metadata?: SignatureMetadata): Envelope;

    /**
     * Verify the signature and unwrap the envelope.
     */
    verify(verifier: Verifier): Envelope;

    /**
     * Verify the signature and return the unwrapped envelope with metadata.
     */
    verifyReturningMetadata(verifier: Verifier): { envelope: Envelope; metadata?: SignatureMetadata };

    /**
     * Get all signature assertions from this envelope.
     */
    signatures(): Envelope[];

    /**
     * Verify the signature from a verifier and return this envelope if valid.
     */
    verifySignatureFrom(verifier: Verifier): Envelope;
  }
}

// ============================================================================
// Envelope Extension Methods for Signatures
// ============================================================================

/// Implementation of addSignature() with optional metadata
Envelope.prototype.addSignatureWithMetadata = function (
  this: Envelope,
  signer: Signer,
  metadata?: SignatureMetadata,
): Envelope {
  const digest = this.subject().digest();
  const signature = signer.sign(digest.data());

  // Create the signature envelope
  let signatureEnvelope = Envelope.new(signature);

  // Add verifier info if available
  if ("publicKey" in signer && typeof signer.publicKey === "function") {
    const verifier = (signer.publicKey as () => Verifier)();
    signatureEnvelope = signatureEnvelope.addAssertion(
      VERIFIED_BY,
      verifier as unknown as EnvelopeEncodableValue,
    );
  }

  // Add metadata assertions if provided
  if (metadata !== undefined) {
    for (const [predicate, object] of metadata.assertions()) {
      signatureEnvelope = signatureEnvelope.addAssertion(
        predicate,
        object as EnvelopeEncodableValue,
      );
    }
  }

  return this.addAssertion(SIGNED, signatureEnvelope);
};

/// Implementation of addSignature() without metadata
Envelope.prototype.addSignature = function (this: Envelope, signer: Signer): Envelope {
  return this.addSignatureWithMetadata(signer, undefined);
};

/// Implementation of addSignatureOpt() - with optional signer options
Envelope.prototype.addSignatureOpt = function (
  this: Envelope,
  signer: Signer,
  _options?: unknown,
  metadata?: SignatureMetadata,
): Envelope {
  // For now, options are ignored - full implementation would handle SigningOptions
  return this.addSignatureWithMetadata(signer, metadata);
};

/// Implementation of addSignatures() - add multiple signatures
Envelope.prototype.addSignatures = function (this: Envelope, signers: Signer[]): Envelope {
  return signers.reduce<Envelope>((envelope, signer) => envelope.addSignature(signer), this);
};

/// Implementation of addSignaturesWithMetadata()
Envelope.prototype.addSignaturesWithMetadata = function (
  this: Envelope,
  signersWithMetadata: { signer: Signer; metadata?: SignatureMetadata }[],
): Envelope {
  return signersWithMetadata.reduce<Envelope>(
    (envelope, { signer, metadata }) => envelope.addSignatureWithMetadata(signer, metadata),
    this,
  );
};

/// Implementation of hasSignatureFrom() - check if signed by specific verifier
Envelope.prototype.hasSignatureFrom = function (this: Envelope, verifier: Verifier): boolean {
  const signedAssertions = this.assertionsWithPredicate(SIGNED);

  for (const assertion of signedAssertions) {
    try {
      const signatureEnvelope = assertion.tryObject();
      const signatureCbor = signatureEnvelope.tryLeaf();

      // Decode the signature from tagged CBOR
      const signature = Signature.fromTaggedCbor(signatureCbor);

      // Get the digest that was signed
      const digest = this.subject().digest();

      // Check if this signature is valid for the verifier
      if (verifier.verify(signature, digest.data())) {
        return true;
      }
    } catch {
      // Not a valid signature assertion, continue
      continue;
    }
  }

  return false;
};

/// Implementation of hasSignaturesFrom() - check if signed by all verifiers
Envelope.prototype.hasSignaturesFrom = function (this: Envelope, verifiers: Verifier[]): boolean {
  return verifiers.every((verifier) => this.hasSignatureFrom(verifier));
};

/// Implementation of hasSignaturesFromThreshold()
Envelope.prototype.hasSignaturesFromThreshold = function (
  this: Envelope,
  verifiers: Verifier[],
  threshold: number,
): boolean {
  let count = 0;
  for (const verifier of verifiers) {
    if (this.hasSignatureFrom(verifier)) {
      count++;
      if (count >= threshold) {
        return true;
      }
    }
  }
  return false;
};

/// Implementation of sign() - wrap and sign without metadata
Envelope.prototype.sign = function (this: Envelope, signer: Signer): Envelope {
  return this.wrap().addSignature(signer);
};

/// Implementation of signWithMetadata() - wrap and sign with metadata
Envelope.prototype.signWithMetadata = function (
  this: Envelope,
  signer: Signer,
  metadata?: SignatureMetadata,
): Envelope {
  return this.wrap().addSignatureWithMetadata(signer, metadata);
};

/// Implementation of verify() - verify signature and unwrap
Envelope.prototype.verify = function (this: Envelope, verifier: Verifier): Envelope {
  if (!this.hasSignatureFrom(verifier)) {
    throw EnvelopeError.general("Signature verification failed");
  }
  return this.unwrap();
};

/// Implementation of verifyReturningMetadata()
Envelope.prototype.verifyReturningMetadata = function (
  this: Envelope,
  verifier: Verifier,
): { envelope: Envelope; metadata?: SignatureMetadata } {
  const signedAssertions = this.assertionsWithPredicate(SIGNED);

  for (const assertion of signedAssertions) {
    try {
      const signatureEnvelope = assertion.tryObject();
      const signatureCbor = signatureEnvelope.tryLeaf();
      const signature = Signature.fromTaggedCbor(signatureCbor);
      const digest = this.subject().digest();

      if (verifier.verify(signature, digest.data())) {
        // Extract metadata from the signature envelope
        const metadata = new (SignatureMetadata as unknown as new () => SignatureMetadata)();
        for (const metaAssertion of signatureEnvelope.assertions()) {
          try {
            const pred = metaAssertion.tryPredicate();
            const obj = metaAssertion.tryObject();
            const predValue = pred.tryLeaf() as unknown as string;
            const objValue = obj.tryLeaf();
            if (predValue !== VERIFIED_BY) {
              (
                metadata as unknown as {
                  withAssertion: (p: string, o: unknown) => SignatureMetadata;
                }
              ).withAssertion(predValue, objValue);
            }
          } catch {
            // Skip non-leaf assertions
          }
        }

        return {
          envelope: this.unwrap(),
          metadata: metadata,
        };
      }
    } catch {
      continue;
    }
  }

  throw EnvelopeError.general("Signature verification failed");
};

/// Implementation of signatures() - get all signature assertions
Envelope.prototype.signatures = function (this: Envelope): Envelope[] {
  const signedAssertions = this.assertionsWithPredicate(SIGNED);
  return signedAssertions.map((assertion) => assertion.tryObject());
};

/// Implementation of verifySignatureFrom() - verify and return this envelope
Envelope.prototype.verifySignatureFrom = function (this: Envelope, verifier: Verifier): Envelope {
  if (!this.hasSignatureFrom(verifier)) {
    throw EnvelopeError.general("Signature verification failed");
  }
  return this;
};
