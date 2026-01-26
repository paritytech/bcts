/**
 * FROST cryptographic operations module.
 *
 * This module wraps the @frosts/ed25519 library to provide FROST
 * threshold signature operations for DKG and signing.
 *
 * @module
 */

import {
  Ed25519Sha512,
  Identifier,
  keys,
  serde,
  commitRound1,
  signRound2,
  aggregate,
  type Ed25519SigningNonces,
  type Ed25519SigningCommitments,
  type Ed25519SignatureShare,
  type Ed25519Signature,
  type KeyPackage,
  type PublicKeyPackage,
  type SigningShare,
} from "@frosts/ed25519";

import { type SigningPackage, SigningPackageImpl, type RandomSource } from "@frosts/core";

// Re-export types for convenience
export type {
  Ed25519SigningNonces,
  Ed25519SigningCommitments,
  Ed25519SignatureShare,
  Ed25519Signature,
  KeyPackage,
  PublicKeyPackage,
  RandomSource,
};

export { Ed25519Sha512, Identifier, keys };

// Type aliases for frost-hubert
export type FrostIdentifier = Identifier<typeof Ed25519Sha512>;
export type FrostKeyPackage = KeyPackage<typeof Ed25519Sha512>;
export type FrostPublicKeyPackage = PublicKeyPackage<typeof Ed25519Sha512>;
export type FrostSigningPackage = SigningPackage<typeof Ed25519Sha512>;
export type FrostSigningShare = SigningShare<typeof Ed25519Sha512>;

// DKG round types - use the namespaced types from keys.dkg
export type DkgRound1Package = keys.dkg.round1.Package;
export type DkgRound1SecretPackage = keys.dkg.round1.SecretPackage;
export type DkgRound2Package = keys.dkg.round2.Package;
export type DkgRound2SecretPackage = keys.dkg.round2.SecretPackage;

/**
 * Cryptographically secure random number generator using Web Crypto API.
 */
export class SecureRng implements RandomSource {
  fill(array: Uint8Array): void {
    crypto.getRandomValues(array);
  }
}

/**
 * Create a new secure random number generator.
 */
export function createRng(): RandomSource {
  return new SecureRng();
}

/**
 * Create an identifier from a number (1-indexed participant ID).
 */
export function identifierFromU16(id: number): FrostIdentifier {
  return Identifier.fromU16(Ed25519Sha512, id);
}

/**
 * Serialize an identifier to bytes.
 */
export function serializeIdentifier(id: FrostIdentifier): Uint8Array {
  return id.serialize();
}

/**
 * Deserialize an identifier from bytes.
 */
export function deserializeIdentifier(bytes: Uint8Array): FrostIdentifier {
  return Identifier.deserialize(Ed25519Sha512, bytes);
}

/**
 * Convert an identifier to a hex string for use as a map key.
 */
export function identifierToHex(id: FrostIdentifier): string {
  return bytesToHex(id.serialize());
}

// =============================================================================
// DKG Operations
// =============================================================================

/**
 * Execute DKG round 1 (part1) - Generate commitment and proof of knowledge.
 *
 * @param identifier - This participant's identifier
 * @param maxSigners - Total number of participants
 * @param minSigners - Threshold (minimum signers required)
 * @param rng - Random number generator
 * @returns Tuple of [SecretPackage, Package] where Package is broadcast to all
 */
export function dkgPart1(
  identifier: FrostIdentifier,
  maxSigners: number,
  minSigners: number,
  rng: RandomSource = createRng(),
): [DkgRound1SecretPackage, DkgRound1Package] {
  return keys.dkg.part1(Ed25519Sha512, identifier, maxSigners, minSigners, rng);
}

/**
 * Execute DKG round 2 (part2) - Process round 1 packages and generate shares.
 *
 * @param secretPackage - The secret package from part1
 * @param round1Packages - Map of identifier hex to round1 packages from other participants
 * @returns Tuple of [Round2SecretPackage, Map of round2 packages to send]
 */
export function dkgPart2(
  secretPackage: DkgRound1SecretPackage,
  round1Packages: Map<string, DkgRound1Package>,
): [DkgRound2SecretPackage, Map<string, DkgRound2Package>] {
  return keys.dkg.part2(Ed25519Sha512, secretPackage, round1Packages);
}

/**
 * Execute DKG round 3 (part3/finalize) - Compute final key package.
 *
 * @param round2SecretPackage - The secret package from part2
 * @param round1Packages - Map of identifier hex to round1 packages
 * @param round2Packages - Map of identifier hex to round2 packages received
 * @returns Promise of tuple [KeyPackage, PublicKeyPackage]
 */
export async function dkgPart3(
  round2SecretPackage: DkgRound2SecretPackage,
  round1Packages: Map<string, DkgRound1Package>,
  round2Packages: Map<string, DkgRound2Package>,
): Promise<[FrostKeyPackage, FrostPublicKeyPackage]> {
  return keys.dkg.part3(Ed25519Sha512, round2SecretPackage, round1Packages, round2Packages);
}

// =============================================================================
// Signing Operations
// =============================================================================

/**
 * Execute signing round 1 - Generate nonces and commitments.
 *
 * @param keyPackage - The participant's key package from DKG
 * @param rng - Random number generator
 * @returns Tuple of [SigningNonces, SigningCommitments]
 */
export function signingRound1(
  keyPackage: FrostKeyPackage,
  rng: RandomSource = createRng(),
): [Ed25519SigningNonces, Ed25519SigningCommitments] {
  return commitRound1(keyPackage.signingShare, rng);
}

/**
 * Create a signing package from commitments and message.
 *
 * @param commitments - Map of identifier to signing commitments
 * @param message - The message to sign
 * @returns SigningPackage for round 2
 */
export function createSigningPackage(
  commitments: Map<FrostIdentifier, Ed25519SigningCommitments>,
  message: Uint8Array,
): FrostSigningPackage {
  return new SigningPackageImpl(Ed25519Sha512, commitments, message);
}

/**
 * Execute signing round 2 - Generate signature share.
 *
 * @param signingPackage - The signing package with all commitments
 * @param nonces - This participant's nonces from round 1
 * @param keyPackage - This participant's key package
 * @returns Signature share
 */
export function signingRound2(
  signingPackage: FrostSigningPackage,
  nonces: Ed25519SigningNonces,
  keyPackage: FrostKeyPackage,
): Ed25519SignatureShare {
  return signRound2(signingPackage, nonces, keyPackage);
}

/**
 * Aggregate signature shares into a final signature.
 *
 * @param signingPackage - The signing package used for round 2
 * @param signatureShares - Map of identifier to signature shares
 * @param publicKeyPackage - The group's public key package
 * @returns The aggregated signature
 */
export function aggregateSignatures(
  signingPackage: FrostSigningPackage,
  signatureShares: Map<FrostIdentifier, Ed25519SignatureShare>,
  publicKeyPackage: FrostPublicKeyPackage,
): Ed25519Signature {
  return aggregate(signingPackage, signatureShares, publicKeyPackage);
}

// =============================================================================
// Serialization Helpers - Using @frosts/ed25519 serde module
// =============================================================================

/**
 * Serialize a DKG round 1 package to JSON-compatible format.
 */
export function serializeDkgRound1Package(pkg: DkgRound1Package): SerializedDkgRound1Package {
  const json = serde.round1PackageToJson(pkg);
  return {
    commitment: {
      coefficients: json.commitment,
    },
    proofOfKnowledge: json.proof_of_knowledge,
  };
}

/**
 * Deserialize a DKG round 1 package from JSON format.
 */
export function deserializeDkgRound1Package(data: SerializedDkgRound1Package): DkgRound1Package {
  const json = {
    header: serde.DEFAULT_HEADER,
    commitment: data.commitment.coefficients,
    proof_of_knowledge: data.proofOfKnowledge,
  };
  return serde.round1PackageFromJson(json);
}

/**
 * Serialize a DKG round 2 package to JSON-compatible format.
 */
export function serializeDkgRound2Package(pkg: DkgRound2Package): SerializedDkgRound2Package {
  const json = serde.round2PackageToJson(pkg);
  return {
    signingShare: json.signing_share,
  };
}

/**
 * Deserialize a DKG round 2 package from JSON format.
 */
export function deserializeDkgRound2Package(data: SerializedDkgRound2Package): DkgRound2Package {
  const json = {
    header: serde.DEFAULT_HEADER,
    signing_share: data.signingShare,
  };
  return serde.round2PackageFromJson(json);
}

/**
 * Serialize a key package to JSON-compatible format.
 */
export function serializeKeyPackage(keyPackage: FrostKeyPackage): SerializedKeyPackage {
  const json = serde.keyPackageToJson(keyPackage);
  return {
    identifier: json.identifier,
    signingShare: json.signing_share,
    verifyingShare: json.verifying_share,
    verifyingKey: json.verifying_key,
    minSigners: json.min_signers,
  };
}

/**
 * Deserialize a key package from JSON format.
 */
export function deserializeKeyPackage(data: SerializedKeyPackage): FrostKeyPackage {
  const json = {
    header: serde.DEFAULT_HEADER,
    identifier: data.identifier,
    signing_share: data.signingShare,
    verifying_share: data.verifyingShare,
    verifying_key: data.verifyingKey,
    min_signers: data.minSigners,
  };
  return serde.keyPackageFromJson(json);
}

/**
 * Serialize a public key package to JSON-compatible format.
 */
export function serializePublicKeyPackage(pkg: FrostPublicKeyPackage): SerializedPublicKeyPackage {
  const json = serde.publicKeyPackageToJson(pkg);
  return {
    verifyingKey: json.verifying_key,
    verifyingShares: json.verifying_shares,
    minSigners: json.min_signers,
  };
}

/**
 * Deserialize a public key package from JSON format.
 */
export function deserializePublicKeyPackage(
  data: SerializedPublicKeyPackage,
): FrostPublicKeyPackage {
  const json = {
    header: serde.DEFAULT_HEADER,
    verifying_key: data.verifyingKey,
    verifying_shares: data.verifyingShares,
    min_signers: data.minSigners,
  };
  return serde.publicKeyPackageFromJson(json);
}

/**
 * Serialize signing nonces to JSON-compatible format.
 */
export function serializeSigningNonces(nonces: Ed25519SigningNonces): SerializedSigningNonces {
  // Access the internal properties of the nonces
  return {
    hiding: bytesToHex(nonces.hiding.serialize()),
    binding: bytesToHex(nonces.binding.serialize()),
    commitments: {
      hiding: bytesToHex(nonces.commitments.hiding.serialize()),
      binding: bytesToHex(nonces.commitments.binding.serialize()),
    },
  };
}

/**
 * Serialize signing commitments to JSON-compatible format.
 */
export function serializeSigningCommitments(
  commitments: Ed25519SigningCommitments,
): SerializedSigningCommitments {
  const json = serde.signingCommitmentsToJson(commitments);
  return {
    hiding: json.hiding,
    binding: json.binding,
  };
}

/**
 * Deserialize signing commitments from JSON format.
 */
export function deserializeSigningCommitments(
  data: SerializedSigningCommitments,
): Ed25519SigningCommitments {
  const json = {
    header: serde.DEFAULT_HEADER,
    hiding: data.hiding,
    binding: data.binding,
  };
  return serde.signingCommitmentsFromJson(json);
}

/**
 * Serialize a signature share to hex string.
 */
export function serializeSignatureShare(share: Ed25519SignatureShare): string {
  const json = serde.signatureShareToJson(share);
  return json.share;
}

/**
 * Deserialize a signature share from hex string.
 */
export function deserializeSignatureShare(hex: string): Ed25519SignatureShare {
  const json = {
    header: serde.DEFAULT_HEADER,
    share: hex,
  };
  return serde.signatureShareFromJson(json);
}

/**
 * Serialize a signature to bytes.
 */
export function serializeSignature(sig: Ed25519Signature): Uint8Array {
  return sig.serialize();
}

/**
 * Serialize a signature to hex string.
 */
export function serializeSignatureHex(sig: Ed25519Signature): string {
  return bytesToHex(sig.serialize());
}

// =============================================================================
// Serialized Type Definitions
// =============================================================================

export interface SerializedDkgRound1Package {
  commitment: {
    coefficients: string[]; // hex-encoded coefficient commitments
  };
  proofOfKnowledge: string; // hex-encoded proof of knowledge
}

export interface SerializedDkgRound2Package {
  signingShare: string; // hex-encoded signing share
}

export interface SerializedKeyPackage {
  identifier: string;
  signingShare: string;
  verifyingShare: string;
  verifyingKey: string;
  minSigners: number;
}

export interface SerializedPublicKeyPackage {
  verifyingKey: string;
  verifyingShares: Record<string, string>; // identifier hex -> verifying share hex
  minSigners?: number;
}

export interface SerializedSigningNonces {
  hiding: string;
  binding: string;
  commitments: {
    hiding: string;
    binding: string;
  };
}

export interface SerializedSigningCommitments {
  hiding: string;
  binding: string;
}

// =============================================================================
// Utility Functions - Re-export from serde
// =============================================================================

/**
 * Convert bytes to hex string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  return serde.bytesToHex(bytes);
}

/**
 * Convert hex string to bytes.
 */
export function hexToBytes(hex: string): Uint8Array {
  return serde.hexToBytes(hex);
}
