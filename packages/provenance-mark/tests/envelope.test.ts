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
