import { cbor } from "@bcts/dcbor";
import {
  ProvenanceMark,
  ProvenanceMarkGenerator,
  ProvenanceMarkResolution,
  provenanceMarkToEnvelope,
  provenanceMarkFromEnvelope,
  provenanceMarkGeneratorToEnvelope,
  provenanceMarkGeneratorFromEnvelope,
} from "../src";

// =============================================================================
// Envelope Tests
// =============================================================================

describe("ProvenanceMark Envelope Support", () => {
  describe("ProvenanceMark to/from Envelope", () => {
    it("should convert mark to envelope and back (low resolution)", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      const date = new Date(Date.UTC(2023, 5, 20, 12, 0, 0, 0));
      const mark = generator.next(date);

      // Convert to envelope
      const envelope = mark.intoEnvelope();

      // Convert back
      const restored = ProvenanceMark.fromEnvelope(envelope);

      expect(mark.equals(restored)).toBe(true);
      expect(mark.identifier()).toBe(restored.identifier());
    });

    it("should convert mark to envelope and back (medium resolution)", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Medium,
        "Wolf",
      );

      const date = new Date(Date.UTC(2023, 5, 20, 12, 0, 0, 0));
      const mark = generator.next(date);

      const envelope = mark.intoEnvelope();
      const restored = ProvenanceMark.fromEnvelope(envelope);

      expect(mark.equals(restored)).toBe(true);
    });

    it("should convert mark to envelope and back (quartile resolution)", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Quartile,
        "Wolf",
      );

      const date = new Date(Date.UTC(2023, 5, 20, 12, 0, 0, 0));
      const mark = generator.next(date);

      const envelope = mark.intoEnvelope();
      const restored = ProvenanceMark.fromEnvelope(envelope);

      expect(mark.equals(restored)).toBe(true);
    });

    it("should convert mark to envelope and back (high resolution)", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.High,
        "Wolf",
      );

      const date = new Date(Date.UTC(2023, 5, 20, 12, 0, 0, 0));
      const mark = generator.next(date);

      const envelope = mark.intoEnvelope();
      const restored = ProvenanceMark.fromEnvelope(envelope);

      expect(mark.equals(restored)).toBe(true);
    });

    it("should convert mark with info to envelope and back", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Medium,
        "Wolf",
      );

      const date = new Date(Date.UTC(2023, 5, 20, 12, 0, 0, 0));
      const mark = generator.next(date, cbor("Test info payload"));

      const envelope = mark.intoEnvelope();
      const restored = ProvenanceMark.fromEnvelope(envelope);

      expect(mark.equals(restored)).toBe(true);
      expect(restored.info()).toBeDefined();
    });

    it("should work with standalone envelope functions", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      const date = new Date(Date.UTC(2023, 5, 20, 12, 0, 0, 0));
      const mark = generator.next(date);

      // Use standalone functions
      const envelope = provenanceMarkToEnvelope(mark);
      const restored = provenanceMarkFromEnvelope(envelope);

      expect(mark.equals(restored)).toBe(true);
    });
  });

  describe("ProvenanceMarkGenerator to/from Envelope", () => {
    it("should convert generator to envelope and back (low resolution)", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      // Generate a few marks to advance state
      const date1 = new Date(Date.UTC(2023, 5, 20, 12, 0, 0, 0));
      generator.next(date1);
      generator.next(new Date(Date.UTC(2023, 5, 21, 12, 0, 0, 0)));

      // Convert to envelope
      const envelope = generator.intoEnvelope();

      // Convert back
      const restored = ProvenanceMarkGenerator.fromEnvelope(envelope);

      // Verify state matches
      expect(restored.nextSeq()).toBe(generator.nextSeq());
      expect(restored.chainId()).toEqual(generator.chainId());
      expect(restored.res()).toBe(generator.res());

      // Generate marks from both and compare
      const date3 = new Date(Date.UTC(2023, 5, 22, 12, 0, 0, 0));
      const mark1 = generator.next(date3);
      const mark2 = restored.next(date3);

      expect(mark1.equals(mark2)).toBe(true);
    });

    it("should convert generator to envelope and back (medium resolution)", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Medium,
        "Wolf",
      );

      generator.next(new Date(Date.UTC(2023, 5, 20, 12, 0, 0, 0)));

      const envelope = generator.intoEnvelope();
      const restored = ProvenanceMarkGenerator.fromEnvelope(envelope);

      expect(restored.nextSeq()).toBe(generator.nextSeq());
      expect(restored.res()).toBe(ProvenanceMarkResolution.Medium);
    });

    it("should convert generator to envelope and back (quartile resolution)", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Quartile,
        "Wolf",
      );

      generator.next(new Date(Date.UTC(2023, 5, 20, 12, 0, 0, 0)));

      const envelope = generator.intoEnvelope();
      const restored = ProvenanceMarkGenerator.fromEnvelope(envelope);

      expect(restored.nextSeq()).toBe(generator.nextSeq());
      expect(restored.res()).toBe(ProvenanceMarkResolution.Quartile);
    });

    it("should convert generator to envelope and back (high resolution)", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.High,
        "Wolf",
      );

      generator.next(new Date(Date.UTC(2023, 5, 20, 12, 0, 0, 0)));

      const envelope = generator.intoEnvelope();
      const restored = ProvenanceMarkGenerator.fromEnvelope(envelope);

      expect(restored.nextSeq()).toBe(generator.nextSeq());
      expect(restored.res()).toBe(ProvenanceMarkResolution.High);
    });

    it("should work with standalone envelope functions", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      generator.next(new Date(Date.UTC(2023, 5, 20, 12, 0, 0, 0)));

      // Use standalone functions
      const envelope = provenanceMarkGeneratorToEnvelope(generator);
      const restored = provenanceMarkGeneratorFromEnvelope(envelope);

      expect(restored.nextSeq()).toBe(generator.nextSeq());
      expect(restored.chainId()).toEqual(generator.chainId());
    });

    it("should preserve RNG state through envelope roundtrip", () => {
      const generator1 = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      // Generate a few marks
      for (let i = 0; i < 5; i++) {
        generator1.next(new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0)));
      }

      // Roundtrip through envelope
      const envelope = generator1.intoEnvelope();
      const generator2 = ProvenanceMarkGenerator.fromEnvelope(envelope);

      // Generate marks from both - should be identical
      const marks1: ProvenanceMark[] = [];
      const marks2: ProvenanceMark[] = [];

      for (let i = 0; i < 5; i++) {
        const date = new Date(Date.UTC(2023, 5, 25 + i, 12, 0, 0, 0));
        marks1.push(generator1.next(date));
        marks2.push(generator2.next(date));
      }

      for (let i = 0; i < marks1.length; i++) {
        expect(marks1[i].equals(marks2[i])).toBe(true);
      }
    });
  });

  // ===========================================================================
  // Rust parity: tests/mark.rs::test_envelope
  //
  // Locks the byte-level fingerprint of the mark envelope produced by:
  //   - resolution: High
  //   - passphrase: "test"
  //   - date:       "2025-10-26"
  //   - info:       "Info field content"
  //
  // Rust expects the mark envelope's `format()` to be exactly
  // `ProvenanceMark(59def089a4d373a2d3f6a449c6758f62ba55cda64c7faf01c1c74a1130d3c1ee)`
  // and the mark debug string to include `date: 2025-10-26` and
  // `info: "Info field content"`. Together these vectors lock down
  // generator → mark → envelope parity at the byte level.
  // ===========================================================================
  describe("Rust parity: tests/mark.rs::test_envelope", () => {
    it("matches the Rust test_envelope mark fingerprint and debug string", async () => {
      const { ProvenanceSeed, parseDate, registerTags } = await import("../src");
      registerTags();

      const seed = ProvenanceSeed.newWithPassphrase("test");
      const date = parseDate("2025-10-26");

      const generator = ProvenanceMarkGenerator.newWithSeed(ProvenanceMarkResolution.High, seed);
      const mark = generator.next(date, cbor("Info field content"));

      // Mark `idHex()` matches Rust's `Display` payload exactly.
      expect(mark.idHex()).toBe(
        "59def089a4d373a2d3f6a449c6758f62ba55cda64c7faf01c1c74a1130d3c1ee",
      );
      expect(mark.toString()).toBe(
        "ProvenanceMark(59def089a4d373a2d3f6a449c6758f62ba55cda64c7faf01c1c74a1130d3c1ee)",
      );

      // Debug string mirrors Rust `tests/mark.rs:1019` byte-for-byte.
      // The High-resolution wire format stores 6 date bytes (millisecond
      // precision); a midnight-UTC date round-trips without time, so
      // `dateToDisplay` emits just `2025-10-26`.
      expect(mark.toDebugString()).toBe(
        'ProvenanceMark(key: b16a7cbd178ee0d41cadb0dcefdbe87d6a41c85b41c551134ae8307f9203babc, hash: 59def089a4d373a2d3f6a449c6758f62ba55cda64c7faf01c1c74a1130d3c1ee, chainID: b16a7cbd178ee0d41cadb0dcefdbe87d6a41c85b41c551134ae8307f9203babc, seq: 0, date: 2025-10-26, info: "Info field content")',
      );

      // Envelope round-trip preserves the mark exactly.
      const envelope = mark.intoEnvelope();
      const restored = ProvenanceMark.fromEnvelope(envelope);
      expect(restored.equals(mark)).toBe(true);
      expect(restored.idHex()).toBe(mark.idHex());
    });
  });

  describe("Envelope error handling", () => {
    it("should throw on invalid envelope for generator", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      const date = new Date(Date.UTC(2023, 5, 20, 12, 0, 0, 0));
      const mark = generator.next(date);

      // Try to parse mark envelope as generator
      const markEnvelope = mark.intoEnvelope();

      expect(() => {
        ProvenanceMarkGenerator.fromEnvelope(markEnvelope);
      }).toThrow();
    });
  });
});
