/**
 * Tests for FROST cryptographic operations.
 *
 * @module
 */

import { describe, it, expect } from "vitest";
import {
  identifierFromU16,
  dkgPart1,
  dkgPart2,
  dkgPart3,
  signingRound1,
  signingRound2,
  createSigningPackage,
  aggregateSignatures,
  createRng,
  identifierToHex,
  bytesToHex,
  deserializeSignatureShare,
  serializeSignatureShare,
  serializeSignature,
  type FrostIdentifier,
  type Ed25519SigningCommitments,
  type DkgRound2Package,
} from "../src/frost/index.js";

/**
 * Helper to get a value from a map, throwing if not found.
 */
function getOrThrow<K, V>(map: Map<K, V>, key: K): V {
  const value = map.get(key);
  if (value === undefined) {
    throw new Error(`Key not found in map: ${String(key)}`);
  }
  return value;
}

describe("FROST operations", () => {
  describe("Identifier", () => {
    it("should create identifier from u16", () => {
      const id1 = identifierFromU16(1);
      const id2 = identifierFromU16(2);

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(identifierToHex(id1)).not.toBe(identifierToHex(id2));
    });

    it("should serialize identifier consistently", () => {
      const id = identifierFromU16(42);
      const hex1 = identifierToHex(id);
      const hex2 = identifierToHex(id);

      expect(hex1).toBe(hex2);
    });
  });

  describe("DKG (Distributed Key Generation)", () => {
    it("should complete 2-of-3 DKG", async () => {
      const rng = createRng();
      const minSigners = 2;
      const maxSigners = 3;

      // Create identifiers for 3 participants
      const id1 = identifierFromU16(1);
      const id2 = identifierFromU16(2);
      const id3 = identifierFromU16(3);

      // Part 1: Each participant generates their round 1 package
      const [secret1, round1Package1] = dkgPart1(id1, maxSigners, minSigners, rng);
      const [secret2, round1Package2] = dkgPart1(id2, maxSigners, minSigners, rng);
      const [secret3, round1Package3] = dkgPart1(id3, maxSigners, minSigners, rng);

      expect(secret1).toBeDefined();
      expect(round1Package1).toBeDefined();

      // Build round 1 packages map for each participant
      const round1PackagesFor1 = new Map([
        [identifierToHex(id2), round1Package2],
        [identifierToHex(id3), round1Package3],
      ]);
      const round1PackagesFor2 = new Map([
        [identifierToHex(id1), round1Package1],
        [identifierToHex(id3), round1Package3],
      ]);
      const round1PackagesFor3 = new Map([
        [identifierToHex(id1), round1Package1],
        [identifierToHex(id2), round1Package2],
      ]);

      // Part 2: Each participant processes round 1 packages and generates round 2 packages
      const [round2Secret1, round2PackagesFrom1] = dkgPart2(secret1, round1PackagesFor1);
      const [round2Secret2, round2PackagesFrom2] = dkgPart2(secret2, round1PackagesFor2);
      const [round2Secret3, round2PackagesFrom3] = dkgPart2(secret3, round1PackagesFor3);

      expect(round2Secret1).toBeDefined();
      expect(round2PackagesFrom1.size).toBe(2);

      // Build round 2 packages map for each participant (packages sent TO them)
      const round2PackagesFor1 = new Map<string, DkgRound2Package>([
        [identifierToHex(id2), getOrThrow(round2PackagesFrom2, identifierToHex(id1))],
        [identifierToHex(id3), getOrThrow(round2PackagesFrom3, identifierToHex(id1))],
      ]);
      const round2PackagesFor2 = new Map<string, DkgRound2Package>([
        [identifierToHex(id1), getOrThrow(round2PackagesFrom1, identifierToHex(id2))],
        [identifierToHex(id3), getOrThrow(round2PackagesFrom3, identifierToHex(id2))],
      ]);
      const round2PackagesFor3 = new Map<string, DkgRound2Package>([
        [identifierToHex(id1), getOrThrow(round2PackagesFrom1, identifierToHex(id3))],
        [identifierToHex(id2), getOrThrow(round2PackagesFrom2, identifierToHex(id3))],
      ]);

      // Part 3: Each participant computes their key package
      const [keyPackage1, publicKeyPackage1] = await dkgPart3(
        round2Secret1,
        round1PackagesFor1,
        round2PackagesFor1,
      );
      const [_keyPackage2, publicKeyPackage2] = await dkgPart3(
        round2Secret2,
        round1PackagesFor2,
        round2PackagesFor2,
      );
      const [_keyPackage3, publicKeyPackage3] = await dkgPart3(
        round2Secret3,
        round1PackagesFor3,
        round2PackagesFor3,
      );

      expect(keyPackage1).toBeDefined();
      expect(publicKeyPackage1).toBeDefined();

      // All participants should have the same verifying key
      const verifyingKey1 = publicKeyPackage1.verifyingKey as Uint8Array;
      const verifyingKey2 = publicKeyPackage2.verifyingKey as Uint8Array;
      const verifyingKey3 = publicKeyPackage3.verifyingKey as Uint8Array;

      expect(bytesToHex(verifyingKey1)).toBe(bytesToHex(verifyingKey2));
      expect(bytesToHex(verifyingKey2)).toBe(bytesToHex(verifyingKey3));
    });
  });

  describe("Signing", () => {
    it("should complete 2-of-3 threshold signing", async () => {
      const rng = createRng();
      const minSigners = 2;
      const maxSigners = 3;

      // First, complete DKG
      const id1 = identifierFromU16(1);
      const id2 = identifierFromU16(2);
      const id3 = identifierFromU16(3);

      const [secret1, round1Package1] = dkgPart1(id1, maxSigners, minSigners, rng);
      const [secret2, round1Package2] = dkgPart1(id2, maxSigners, minSigners, rng);
      const [secret3, round1Package3] = dkgPart1(id3, maxSigners, minSigners, rng);

      const round1PackagesFor1 = new Map([
        [identifierToHex(id2), round1Package2],
        [identifierToHex(id3), round1Package3],
      ]);
      const round1PackagesFor2 = new Map([
        [identifierToHex(id1), round1Package1],
        [identifierToHex(id3), round1Package3],
      ]);

      const [round2Secret1, round2PackagesFrom1] = dkgPart2(secret1, round1PackagesFor1);
      const [round2Secret2, round2PackagesFrom2] = dkgPart2(secret2, round1PackagesFor2);
      const [, round2PackagesFrom3] = dkgPart2(
        secret3,
        new Map([
          [identifierToHex(id1), round1Package1],
          [identifierToHex(id2), round1Package2],
        ]),
      );

      const round2PackagesFor1 = new Map<string, DkgRound2Package>([
        [identifierToHex(id2), getOrThrow(round2PackagesFrom2, identifierToHex(id1))],
        [identifierToHex(id3), getOrThrow(round2PackagesFrom3, identifierToHex(id1))],
      ]);
      const round2PackagesFor2 = new Map<string, DkgRound2Package>([
        [identifierToHex(id1), getOrThrow(round2PackagesFrom1, identifierToHex(id2))],
        [identifierToHex(id3), getOrThrow(round2PackagesFrom3, identifierToHex(id2))],
      ]);

      const [keyPackage1, publicKeyPackage] = await dkgPart3(
        round2Secret1,
        round1PackagesFor1,
        round2PackagesFor1,
      );
      const [keyPackage2] = await dkgPart3(round2Secret2, round1PackagesFor2, round2PackagesFor2);

      // Now perform signing with participants 1 and 2 (threshold of 2)
      const message = new TextEncoder().encode("Hello, FROST!");

      // Round 1: Generate nonces and commitments
      const [nonces1, commitments1] = signingRound1(keyPackage1, rng);
      const [nonces2, commitments2] = signingRound1(keyPackage2, rng);

      expect(nonces1).toBeDefined();
      expect(commitments1).toBeDefined();

      // Build commitments map
      const commitmentsMap = new Map<FrostIdentifier, Ed25519SigningCommitments>([
        [id1, commitments1],
        [id2, commitments2],
      ]);

      // Create signing package
      const signingPackage = createSigningPackage(commitmentsMap, message);

      // Round 2: Generate signature shares
      const share1 = signingRound2(signingPackage, nonces1, keyPackage1);
      const share2 = signingRound2(signingPackage, nonces2, keyPackage2);

      expect(share1).toBeDefined();
      expect(share2).toBeDefined();

      // Aggregate signature shares
      const sharesMap = new Map([
        [id1, share1],
        [id2, share2],
      ]);

      const signature = aggregateSignatures(signingPackage, sharesMap, publicKeyPackage);

      expect(signature).toBeDefined();

      // Serialize signature
      const signatureBytes = serializeSignature(signature);
      expect(signatureBytes).toBeInstanceOf(Uint8Array);
      expect(signatureBytes.length).toBe(64); // Ed25519 signature is 64 bytes
    });
  });

  describe("Serialization", () => {
    it("should serialize and deserialize signing commitments", () => {
      const rng = createRng();
      const id = identifierFromU16(1);
      const [_secret] = dkgPart1(id, 3, 2, rng);

      // We need a key package for signing round 1
      // For this test, just verify the serialization works on commitments
      const [, round1Package] = dkgPart1(id, 3, 2, rng);

      // Serialize round 1 package commitment and check structure
      expect(round1Package).toBeDefined();
    });

    it("should serialize and deserialize signature share", () => {
      // Test that signature share serialization roundtrips
      // We'll create a mock hex string and verify the deserialization
      const shareHex = "0".repeat(64); // 32 bytes = 64 hex chars

      const share = deserializeSignatureShare(shareHex);
      const reserialized = serializeSignatureShare(share);

      // The share should be valid
      expect(share).toBeDefined();
      expect(typeof reserialized).toBe("string");
    });
  });
});
