/**
 * Placeholder utilities for functionality not yet implemented in underlying packages.
 *
 * This module provides placeholder functions that throw descriptive errors
 * for features that exist in the Rust implementation but haven't been
 * ported to the TypeScript packages yet.
 *
 * See PORTING_STATUS.md for the full list of missing functionality.
 */

/**
 * Throws an error indicating a feature is not yet implemented.
 */
export function notImplemented(feature: string): never {
  throw new Error(`Not implemented: ${feature}. See PORTING_STATUS.md for details.`);
}

// =============================================================================
// Missing UR Support Placeholders
// =============================================================================

/**
 * Placeholder for SymmetricKey.fromURString
 * @bcts/components SymmetricKey doesn't have UR support yet.
 */
export function symmetricKeyFromURString(_urString: string): never {
  notImplemented("SymmetricKey.fromURString - SymmetricKey needs UR support");
}

/**
 * Placeholder for SigningPrivateKey.fromURString
 * @bcts/components SigningPrivateKey doesn't have UR support yet.
 */
export function signingPrivateKeyFromURString(_urString: string): never {
  notImplemented("SigningPrivateKey.fromURString - SigningPrivateKey needs UR support");
}

/**
 * Placeholder for SigningPublicKey.fromURString
 * @bcts/components SigningPublicKey doesn't have UR support yet.
 */
export function signingPublicKeyFromURString(_urString: string): never {
  notImplemented("SigningPublicKey.fromURString - SigningPublicKey needs UR support");
}

/**
 * Placeholder for Signature.fromURString
 * @bcts/components Signature doesn't have UR support yet.
 */
export function signatureFromURString(_urString: string): never {
  notImplemented("Signature.fromURString - Signature needs UR support");
}

// =============================================================================
// Missing Envelope Method Placeholders
// =============================================================================

/**
 * Placeholder for Envelope.addAssertionEnvelopeSalted
 */
export function envelopeAddAssertionEnvelopeSalted(): never {
  notImplemented("Envelope.addAssertionEnvelopeSalted");
}

/**
 * Placeholder for Envelope.isLockedWithPassword
 */
export function envelopeIsLockedWithPassword(): never {
  notImplemented("Envelope.isLockedWithPassword");
}

/**
 * Placeholder for Envelope.unlockSubject
 */
export function envelopeUnlockSubject(): never {
  notImplemented("Envelope.unlockSubject");
}

/**
 * Placeholder for Envelope.isLockedWithSshAgent
 */
export function envelopeIsLockedWithSshAgent(): never {
  notImplemented("Envelope.isLockedWithSshAgent");
}

/**
 * Placeholder for Envelope.addSecret
 */
export function envelopeAddSecret(): never {
  notImplemented("Envelope.addSecret");
}

/**
 * Placeholder for Envelope.shallowDigests
 */
export function envelopeShallowDigests(): never {
  notImplemented("Envelope.shallowDigests");
}

/**
 * Placeholder for Envelope.deepDigests
 */
export function envelopeDeepDigests(): never {
  notImplemented("Envelope.deepDigests");
}

/**
 * Placeholder for Envelope.extractSubject
 */
export function envelopeExtractSubject(): never {
  notImplemented("Envelope.extractSubject");
}

/**
 * Placeholder for Envelope.elideSetWithAction
 */
export function envelopeElideSetWithAction(): never {
  notImplemented("Envelope.elideSetWithAction");
}

/**
 * Placeholder for Envelope.format
 */
export function envelopeFormat(): never {
  notImplemented("Envelope.format");
}

/**
 * Placeholder for Envelope.mermaidFormat
 */
export function envelopeMermaidFormat(): never {
  notImplemented("Envelope.mermaidFormat");
}

/**
 * Placeholder for Envelope.validateAttachment
 */
export function envelopeValidateAttachment(): never {
  notImplemented("Envelope.validateAttachment");
}

// =============================================================================
// Missing Enum Value Placeholders
// =============================================================================

/**
 * Placeholder for KeyDerivationMethod.SSHAgent
 */
export function keyDerivationMethodSSHAgent(): never {
  notImplemented("KeyDerivationMethod.SSHAgent");
}

/**
 * Placeholder for SignatureScheme variants that don't exist
 */
export function signatureSchemeFromString(_scheme: string): never {
  notImplemented(
    "SignatureScheme variants (Schnorr, Ecdsa, SshEd25519, SshDsa, SshEcdsaP256, SshEcdsaP384, MLDSA44, MLDSA65, MLDSA87)",
  );
}

/**
 * Placeholder for EncapsulationScheme variants that don't exist
 */
export function encapsulationSchemeFromString(_scheme: string): never {
  notImplemented("EncapsulationScheme variants (MLKEM512, MLKEM768, MLKEM1024)");
}

// =============================================================================
// Missing Method Placeholders
// =============================================================================

/**
 * Placeholder for SigningPublicKey.toSsh
 */
export function signingPublicKeyToSsh(): never {
  notImplemented("SigningPublicKey.toSsh");
}

/**
 * Placeholder for SignatureScheme.keypair
 */
export function signatureSchemeKeypair(): never {
  notImplemented("SignatureScheme.keypair");
}

/**
 * Placeholder for EncapsulationScheme.keypair
 */
export function encapsulationSchemeKeypair(): never {
  notImplemented("EncapsulationScheme.keypair");
}
