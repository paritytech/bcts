import { describe, it, expect } from "vitest";
import { Fingerprint, ScannableFingerprint } from "../src/fingerprint/fingerprint.js";
import { IdentityKey } from "../src/keys/identity-key.js";

// Test vectors from libsignal fingerprint.rs
const ALICE_IDENTITY = hexToBytes(
  "0506863bc66d02b40d27b8d49ca7c09e9239236f9d7d25d6fcca5ce13c7064d868",
);
const BOB_IDENTITY = hexToBytes(
  "05f781b6fb32fed9ba1cf2de978d4d5da28dc34046ae814402b5c0dbd96fda907b",
);
const ALICE_STABLE_ID = "+14152222222";
const BOB_STABLE_ID = "+14153333333";

const DISPLAYABLE_FINGERPRINT_V1 = "300354477692869396892869876765458257569162576843440918079131";

const ALICE_SCANNABLE_FINGERPRINT_V1 =
  "080112220a201e301a0353dce3dbe7684cb8336e85136cdc0ee96219494ada305d62a7bd61df1a220a20d62cbf73a11592015b6b9f1682ac306fea3aaf3885b84d12bca631e9d4fb3a4d";
const BOB_SCANNABLE_FINGERPRINT_V1 =
  "080112220a20d62cbf73a11592015b6b9f1682ac306fea3aaf3885b84d12bca631e9d4fb3a4d1a220a201e301a0353dce3dbe7684cb8336e85136cdc0ee96219494ada305d62a7bd61df";

const ALICE_SCANNABLE_FINGERPRINT_V2 =
  "080212220a201e301a0353dce3dbe7684cb8336e85136cdc0ee96219494ada305d62a7bd61df1a220a20d62cbf73a11592015b6b9f1682ac306fea3aaf3885b84d12bca631e9d4fb3a4d";
const BOB_SCANNABLE_FINGERPRINT_V2 =
  "080212220a20d62cbf73a11592015b6b9f1682ac306fea3aaf3885b84d12bca631e9d4fb3a4d1a220a201e301a0353dce3dbe7684cb8336e85136cdc0ee96219494ada305d62a7bd61df";

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

describe("Fingerprint", () => {
  const aliceKey = IdentityKey.deserialize(ALICE_IDENTITY);
  const bobKey = IdentityKey.deserialize(BOB_IDENTITY);

  describe("version 1 test vectors", () => {
    const version = 1;
    const iterations = 5200;

    it("produces correct displayable fingerprint", () => {
      const aFprint = Fingerprint.create(
        version,
        iterations,
        new TextEncoder().encode(ALICE_STABLE_ID),
        aliceKey,
        new TextEncoder().encode(BOB_STABLE_ID),
        bobKey,
      );
      expect(aFprint.displayString()).toBe(DISPLAYABLE_FINGERPRINT_V1);
    });

    it("is symmetric", () => {
      const aFprint = Fingerprint.create(
        version,
        iterations,
        new TextEncoder().encode(ALICE_STABLE_ID),
        aliceKey,
        new TextEncoder().encode(BOB_STABLE_ID),
        bobKey,
      );
      const bFprint = Fingerprint.create(
        version,
        iterations,
        new TextEncoder().encode(BOB_STABLE_ID),
        bobKey,
        new TextEncoder().encode(ALICE_STABLE_ID),
        aliceKey,
      );
      expect(aFprint.displayString()).toBe(bFprint.displayString());
    });

    it("produces correct scannable fingerprint for Alice", () => {
      const aFprint = Fingerprint.create(
        version,
        iterations,
        new TextEncoder().encode(ALICE_STABLE_ID),
        aliceKey,
        new TextEncoder().encode(BOB_STABLE_ID),
        bobKey,
      );
      expect(bytesToHex(aFprint.scannable.serialize())).toBe(ALICE_SCANNABLE_FINGERPRINT_V1);
    });

    it("produces correct scannable fingerprint for Bob", () => {
      const bFprint = Fingerprint.create(
        version,
        iterations,
        new TextEncoder().encode(BOB_STABLE_ID),
        bobKey,
        new TextEncoder().encode(ALICE_STABLE_ID),
        aliceKey,
      );
      expect(bytesToHex(bFprint.scannable.serialize())).toBe(BOB_SCANNABLE_FINGERPRINT_V1);
    });

    it("scannable fingerprints compare correctly", () => {
      const aFprint = Fingerprint.create(
        version,
        iterations,
        new TextEncoder().encode(ALICE_STABLE_ID),
        aliceKey,
        new TextEncoder().encode(BOB_STABLE_ID),
        bobKey,
      );
      const bFprint = Fingerprint.create(
        version,
        iterations,
        new TextEncoder().encode(BOB_STABLE_ID),
        bobKey,
        new TextEncoder().encode(ALICE_STABLE_ID),
        aliceKey,
      );
      expect(aFprint.scannable.compare(bFprint.scannable.serialize())).toBe(true);
      expect(bFprint.scannable.compare(aFprint.scannable.serialize())).toBe(true);
      // Self-compare should fail (local/remote are swapped)
      expect(aFprint.scannable.compare(aFprint.scannable.serialize())).toBe(false);
    });

    it("display string is 60 digits", () => {
      const aFprint = Fingerprint.create(
        version,
        iterations,
        new TextEncoder().encode(ALICE_STABLE_ID),
        aliceKey,
        new TextEncoder().encode(BOB_STABLE_ID),
        bobKey,
      );
      expect(aFprint.displayString().length).toBe(60);
    });
  });

  describe("version 2 test vectors", () => {
    const version = 2;
    const iterations = 5200;

    it("produces correct scannable fingerprint for Alice v2", () => {
      const aFprint = Fingerprint.create(
        version,
        iterations,
        new TextEncoder().encode(ALICE_STABLE_ID),
        aliceKey,
        new TextEncoder().encode(BOB_STABLE_ID),
        bobKey,
      );
      expect(bytesToHex(aFprint.scannable.serialize())).toBe(ALICE_SCANNABLE_FINGERPRINT_V2);
    });

    it("produces correct scannable fingerprint for Bob v2", () => {
      const bFprint = Fingerprint.create(
        version,
        iterations,
        new TextEncoder().encode(BOB_STABLE_ID),
        bobKey,
        new TextEncoder().encode(ALICE_STABLE_ID),
        aliceKey,
      );
      expect(bytesToHex(bFprint.scannable.serialize())).toBe(BOB_SCANNABLE_FINGERPRINT_V2);
    });

    it("display string unchanged from v1", () => {
      const aFprint = Fingerprint.create(
        version,
        iterations,
        new TextEncoder().encode(ALICE_STABLE_ID),
        aliceKey,
        new TextEncoder().encode(BOB_STABLE_ID),
        bobKey,
      );
      expect(aFprint.displayString()).toBe(DISPLAYABLE_FINGERPRINT_V1);
    });
  });

  describe("scannable fingerprint serialization", () => {
    it("round-trips through serialize/deserialize", () => {
      const aFprint = Fingerprint.create(
        1,
        1024,
        new TextEncoder().encode(ALICE_STABLE_ID),
        aliceKey,
        new TextEncoder().encode(BOB_STABLE_ID),
        bobKey,
      );
      const serialized = aFprint.scannable.serialize();
      const deserialized = ScannableFingerprint.deserialize(serialized);
      expect(deserialized.version).toBe(1);
    });

    it("round-trip preserves compare behavior", () => {
      const aFprint = Fingerprint.create(
        1,
        1024,
        new TextEncoder().encode(ALICE_STABLE_ID),
        aliceKey,
        new TextEncoder().encode(BOB_STABLE_ID),
        bobKey,
      );
      const bFprint = Fingerprint.create(
        1,
        1024,
        new TextEncoder().encode(BOB_STABLE_ID),
        bobKey,
        new TextEncoder().encode(ALICE_STABLE_ID),
        aliceKey,
      );
      const aSerialized = aFprint.scannable.serialize();
      const bSerialized = bFprint.scannable.serialize();

      // Deserialize and re-serialize should produce same bytes
      const aDeserialized = ScannableFingerprint.deserialize(aSerialized);
      expect(bytesToHex(aDeserialized.serialize())).toBe(bytesToHex(aSerialized));

      // Cross-compare should still work
      expect(aDeserialized.compare(bSerialized)).toBe(true);
    });
  });

  describe("mismatching fingerprints", () => {
    it("different identity keys produce different fingerprints", () => {
      const aFprint = Fingerprint.create(
        1,
        1024,
        new TextEncoder().encode(ALICE_STABLE_ID),
        aliceKey,
        new TextEncoder().encode(BOB_STABLE_ID),
        bobKey,
      );
      const bFprint = Fingerprint.create(
        1,
        1024,
        new TextEncoder().encode(BOB_STABLE_ID),
        bobKey,
        new TextEncoder().encode("+14150000000"),
        aliceKey,
      );
      expect(aFprint.displayString()).not.toBe(bFprint.displayString());
      expect(aFprint.scannable.compare(bFprint.scannable.serialize())).toBe(false);
    });

    it("different stable IDs produce different fingerprints", () => {
      const aFprint = Fingerprint.create(
        1,
        1024,
        new TextEncoder().encode("+141512222222"),
        aliceKey,
        new TextEncoder().encode(BOB_STABLE_ID),
        bobKey,
      );
      const bFprint = Fingerprint.create(
        1,
        1024,
        new TextEncoder().encode(BOB_STABLE_ID),
        bobKey,
        new TextEncoder().encode(ALICE_STABLE_ID),
        aliceKey,
      );
      expect(aFprint.displayString()).not.toBe(bFprint.displayString());
      expect(aFprint.scannable.compare(bFprint.scannable.serialize())).toBe(false);
    });
  });

  describe("version mismatch", () => {
    it("throws on version mismatch during compare", () => {
      const v1Fprint = Fingerprint.create(
        1,
        5200,
        new TextEncoder().encode(ALICE_STABLE_ID),
        aliceKey,
        new TextEncoder().encode(BOB_STABLE_ID),
        bobKey,
      );
      const v2Fprint = Fingerprint.create(
        2,
        5200,
        new TextEncoder().encode(BOB_STABLE_ID),
        bobKey,
        new TextEncoder().encode(ALICE_STABLE_ID),
        aliceKey,
      );
      expect(() => v1Fprint.scannable.compare(v2Fprint.scannable.serialize())).toThrow(
        "version mismatch",
      );
    });
  });

  describe("protobuf encoding", () => {
    it("matches expected encoding for known inputs", () => {
      // Matches fingerprint_encodings test from libsignal
      const local = new Uint8Array(32).fill(0x12);
      const remote = new Uint8Array(32).fill(0xba);

      const fprint = new ScannableFingerprint(2, local, remote);
      const proto = fprint.serialize();

      const expectedHex = "080212220a20" + "12".repeat(32) + "1a220a20" + "ba".repeat(32);
      expect(bytesToHex(proto)).toBe(expectedHex);
    });
  });
});
