/**
 * Validation tests ported from Rust provenance-mark-rust/tests/validate.rs
 */

import { cbor } from "@bcts/dcbor";
import {
  ProvenanceMark,
  ProvenanceMarkGenerator,
  ProvenanceMarkResolution,
  ValidationReportFormat,
  validate,
  formatReport,
  chainIdHex,
} from "../src";

/**
 * Helper to create test marks with a given passphrase
 */
function createTestMarks(
  count: number,
  resolution: ProvenanceMarkResolution,
  passphrase: string,
): ProvenanceMark[] {
  const generator = ProvenanceMarkGenerator.newWithPassphrase(resolution, passphrase);
  const marks: ProvenanceMark[] = [];

  for (let i = 0; i < count; i++) {
    const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
    marks.push(generator.next(date));
  }

  return marks;
}

describe("Validation (Rust parity)", () => {
  describe("test_validate_empty", () => {
    it("should produce correct JSON for empty input", () => {
      const report = validate([]);

      const json = formatReport(report, ValidationReportFormat.JsonPretty);
      expect(JSON.parse(json)).toEqual({
        marks: [],
        chains: [],
      });

      // Compact JSON format
      const jsonCompact = formatReport(report, ValidationReportFormat.JsonCompact);
      expect(jsonCompact).toBe('{"marks":[],"chains":[]}');

      // Text format should return empty string for empty report
      expect(formatReport(report, ValidationReportFormat.Text)).toBe("");
    });
  });

  describe("test_validate_single_mark", () => {
    it("should validate a single mark correctly", () => {
      const marks = createTestMarks(1, ProvenanceMarkResolution.Low, "test");
      const report = validate(marks);

      const json = formatReport(report, ValidationReportFormat.JsonPretty);
      const parsed = JSON.parse(json);

      expect(parsed.marks.length).toBe(1);
      expect(parsed.chains.length).toBe(1);
      expect(parsed.chains[0].chain_id).toBe("b16a7cbd");
      expect(parsed.chains[0].has_genesis).toBe(true);
      expect(parsed.chains[0].sequences.length).toBe(1);
      expect(parsed.chains[0].sequences[0].start_seq).toBe(0);
      expect(parsed.chains[0].sequences[0].end_seq).toBe(0);
      expect(parsed.chains[0].sequences[0].marks[0].issues).toEqual([]);

      // Text format should be empty for single perfect chain
      expect(formatReport(report, ValidationReportFormat.Text)).toBe("");
    });
  });

  describe("test_validate_valid_sequence", () => {
    it("should validate a valid sequence of 5 marks", () => {
      const marks = createTestMarks(5, ProvenanceMarkResolution.Low, "test");
      const report = validate(marks);

      const json = formatReport(report, ValidationReportFormat.JsonPretty);
      const parsed = JSON.parse(json);

      expect(parsed.marks.length).toBe(5);
      expect(parsed.chains.length).toBe(1);
      expect(parsed.chains[0].chain_id).toBe("b16a7cbd");
      expect(parsed.chains[0].has_genesis).toBe(true);
      expect(parsed.chains[0].sequences.length).toBe(1);
      expect(parsed.chains[0].sequences[0].start_seq).toBe(0);
      expect(parsed.chains[0].sequences[0].end_seq).toBe(4);

      // All marks should have no issues
      for (const mark of parsed.chains[0].sequences[0].marks) {
        expect(mark.issues).toEqual([]);
      }

      // Text format should be empty for single perfect chain
      expect(formatReport(report, ValidationReportFormat.Text)).toBe("");
    });
  });

  describe("test_validate_deduplication", () => {
    it("should deduplicate exact duplicate marks", () => {
      const marks = createTestMarks(3, ProvenanceMarkResolution.Low, "test");

      // Create duplicates
      const marksWithDups = [...marks, marks[0], marks[1], marks[0]];

      const report = validate(marksWithDups);

      const json = formatReport(report, ValidationReportFormat.JsonPretty);
      const parsed = JSON.parse(json);

      // Should have only 3 unique marks
      expect(parsed.marks.length).toBe(3);
      expect(parsed.chains.length).toBe(1);
      expect(parsed.chains[0].chain_id).toBe("b16a7cbd");
      expect(parsed.chains[0].has_genesis).toBe(true);
      expect(parsed.chains[0].sequences[0].end_seq).toBe(2);

      // Text format should be empty after deduplication
      expect(formatReport(report, ValidationReportFormat.Text)).toBe("");
    });
  });

  describe("test_validate_multiple_chains", () => {
    it("should handle multiple chains correctly", () => {
      const marks1 = createTestMarks(3, ProvenanceMarkResolution.Low, "alice");
      const marks2 = createTestMarks(3, ProvenanceMarkResolution.Low, "bob");

      const allMarks = [...marks1, ...marks2];
      const report = validate(allMarks);

      const json = formatReport(report, ValidationReportFormat.JsonPretty);
      const parsed = JSON.parse(json);

      expect(parsed.marks.length).toBe(6);
      expect(parsed.chains.length).toBe(2);

      // Both chains should have genesis
      expect(parsed.chains[0].has_genesis).toBe(true);
      expect(parsed.chains[1].has_genesis).toBe(true);

      // Text format should show both chains
      const text = formatReport(report, ValidationReportFormat.Text);
      expect(text).toContain("Total marks: 6");
      expect(text).toContain("Chains: 2");
      expect(text).toContain("Chain 1:");
      expect(text).toContain("Chain 2:");
    });
  });

  describe("test_validate_missing_genesis", () => {
    it("should detect missing genesis mark", () => {
      const marks = createTestMarks(5, ProvenanceMarkResolution.Low, "test");

      // Remove genesis mark (index 0)
      const marksNoGenesis = marks.slice(1);

      const report = validate(marksNoGenesis);

      const json = formatReport(report, ValidationReportFormat.JsonPretty);
      const parsed = JSON.parse(json);

      expect(parsed.marks.length).toBe(4);
      expect(parsed.chains.length).toBe(1);
      expect(parsed.chains[0].chain_id).toBe("b16a7cbd");
      expect(parsed.chains[0].has_genesis).toBe(false);
      expect(parsed.chains[0].sequences[0].start_seq).toBe(1);
      expect(parsed.chains[0].sequences[0].end_seq).toBe(4);

      // Text format should show warning
      const text = formatReport(report, ValidationReportFormat.Text);
      expect(text).toContain("Warning: No genesis mark found");
    });
  });

  describe("test_validate_sequence_gap", () => {
    it("should detect sequence gaps", () => {
      const marks = createTestMarks(5, ProvenanceMarkResolution.Low, "test");

      // Create a gap by removing mark at index 2 (sequence 2)
      const marksWithGap = [
        marks[0],
        marks[1],
        marks[3], // Gap: skips seq 2, this is seq 3
        marks[4],
      ];

      const report = validate(marksWithGap);

      const json = formatReport(report, ValidationReportFormat.JsonPretty);
      const parsed = JSON.parse(json);

      expect(parsed.marks.length).toBe(4);
      expect(parsed.chains.length).toBe(1);

      // Should have 2 sequences due to gap
      expect(parsed.chains[0].sequences.length).toBe(2);
      expect(parsed.chains[0].sequences[0].start_seq).toBe(0);
      expect(parsed.chains[0].sequences[0].end_seq).toBe(1);
      expect(parsed.chains[0].sequences[1].start_seq).toBe(3);
      expect(parsed.chains[0].sequences[1].end_seq).toBe(4);

      // First mark in second sequence should have gap issue
      // Matches Rust serde format: #[serde(tag = "type", content = "data")]
      expect(parsed.chains[0].sequences[1].marks[0].issues[0].type).toBe("SequenceGap");
      expect(parsed.chains[0].sequences[1].marks[0].issues[0].data.expected).toBe(2);
      expect(parsed.chains[0].sequences[1].marks[0].issues[0].data.actual).toBe(3);

      // Text format should show gap
      const text = formatReport(report, ValidationReportFormat.Text);
      expect(text).toContain("gap: 2 missing");
    });
  });

  describe("test_validate_out_of_order", () => {
    it("should handle out-of-order marks by sorting", () => {
      const marks = createTestMarks(5, ProvenanceMarkResolution.Low, "test");

      // Swap marks 2 and 3
      const marksOutOfOrder = [
        marks[0],
        marks[1],
        marks[3], // Out of order
        marks[2],
        marks[4],
      ];

      const report = validate(marksOutOfOrder);

      const json = formatReport(report, ValidationReportFormat.JsonPretty);
      const parsed = JSON.parse(json);

      // Validation sorts by seq number, so should be valid
      expect(parsed.marks.length).toBe(5);
      expect(parsed.chains.length).toBe(1);
      expect(parsed.chains[0].sequences.length).toBe(1);
      expect(parsed.chains[0].sequences[0].start_seq).toBe(0);
      expect(parsed.chains[0].sequences[0].end_seq).toBe(4);

      // Text format should be empty - sorted correctly
      expect(formatReport(report, ValidationReportFormat.Text)).toBe("");
    });
  });

  describe("test_validate_hash_mismatch", () => {
    it("should detect hash mismatches", () => {
      const marks = createTestMarks(3, ProvenanceMarkResolution.Low, "test");
      const mark0 = marks[0];
      const mark1 = marks[1];

      // Create a third mark that claims to follow mark1 but with wrong prev hash
      const date = new Date(Date.UTC(2023, 5, 22, 12, 0, 0, 0));

      // Use mark1's chain_id and key, but use mark0's hash as prev (wrong!)
      const badMark = ProvenanceMark.new(
        mark1.res(),
        mark1.key(),
        mark0.hash(), // Wrong! Should be mark1.hash()
        mark1.chainId(),
        2,
        date,
        undefined,
      );

      const report = validate([mark0, mark1, badMark]);

      const json = formatReport(report, ValidationReportFormat.JsonPretty);
      const parsed = JSON.parse(json);

      expect(parsed.marks.length).toBe(3);
      expect(parsed.chains.length).toBe(1);

      // Should have 2 sequences due to hash mismatch
      expect(parsed.chains[0].sequences.length).toBe(2);

      // Second sequence should have hash mismatch issue
      expect(parsed.chains[0].sequences[1].marks[0].issues[0].type).toBe("HashMismatch");

      // Text format should show hash mismatch
      const text = formatReport(report, ValidationReportFormat.Text);
      expect(text).toContain("hash mismatch");
    });
  });

  describe("test_validate_date_ordering_violation", () => {
    it("should handle date ordering (valid sequence)", () => {
      const marks = createTestMarks(3, ProvenanceMarkResolution.Low, "test");
      const report = validate(marks);

      const json = formatReport(report, ValidationReportFormat.JsonPretty);
      const parsed = JSON.parse(json);

      expect(parsed.marks.length).toBe(3);
      expect(parsed.chains.length).toBe(1);
      expect(parsed.chains[0].has_genesis).toBe(true);
      expect(parsed.chains[0].sequences.length).toBe(1);
    });
  });

  describe("test_validate_multiple_sequences_in_chain", () => {
    it("should handle multiple sequence gaps in a chain", () => {
      const marks = createTestMarks(7, ProvenanceMarkResolution.Low, "test");

      // Create multiple gaps
      const marksWithGaps = [
        marks[0], // Sequence 1: [0,1]
        marks[1],
        marks[3], // Sequence 2: [3,4] (gap from 1 to 3)
        marks[4],
        marks[6], // Sequence 3: [6] (gap from 4 to 6)
      ];

      const report = validate(marksWithGaps);

      const json = formatReport(report, ValidationReportFormat.JsonPretty);
      const parsed = JSON.parse(json);

      expect(parsed.marks.length).toBe(5);
      expect(parsed.chains.length).toBe(1);

      // Should have 3 sequences due to gaps
      expect(parsed.chains[0].sequences.length).toBe(3);
      expect(parsed.chains[0].sequences[0].start_seq).toBe(0);
      expect(parsed.chains[0].sequences[0].end_seq).toBe(1);
      expect(parsed.chains[0].sequences[1].start_seq).toBe(3);
      expect(parsed.chains[0].sequences[1].end_seq).toBe(4);
      expect(parsed.chains[0].sequences[2].start_seq).toBe(6);
      expect(parsed.chains[0].sequences[2].end_seq).toBe(6);

      // Text format should show gaps
      const text = formatReport(report, ValidationReportFormat.Text);
      expect(text).toContain("gap: 2 missing");
      expect(text).toContain("gap: 5 missing");
    });
  });

  describe("test_validate_precedes_opt", () => {
    it("should validate precedes_opt correctly", () => {
      const marks = createTestMarks(3, ProvenanceMarkResolution.Low, "test");

      // Test valid precedes
      expect(() => marks[0].precedesOpt(marks[1])).not.toThrow();
      expect(() => marks[1].precedesOpt(marks[2])).not.toThrow();

      // Test invalid precedes (reverse order)
      expect(() => marks[1].precedesOpt(marks[0])).toThrow();

      // Test gap
      expect(() => marks[0].precedesOpt(marks[2])).toThrow();
    });
  });

  describe("test_validate_chain_id_hex", () => {
    it("should correctly encode chain ID as hex", () => {
      const marks = createTestMarks(2, ProvenanceMarkResolution.Low, "test");
      const report = validate(marks);

      const chain = report.chains[0];
      const chainIdHexStr = chainIdHex(chain);

      // Verify hex encoding
      expect(/^[0-9a-f]+$/.test(chainIdHexStr)).toBe(true);

      // Verify it matches the mark's chain ID
      const markChainIdHex = Array.from(marks[0].chainId())
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      expect(chainIdHexStr).toBe(markChainIdHex);
    });
  });

  describe("test_validate_with_info", () => {
    it("should validate marks with info field", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "test",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 3; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date, cbor("Test info")));
      }

      const report = validate(marks);

      const json = formatReport(report, ValidationReportFormat.JsonPretty);
      const parsed = JSON.parse(json);

      expect(parsed.marks.length).toBe(3);
      expect(parsed.chains.length).toBe(1);
      expect(parsed.chains[0].has_genesis).toBe(true);
      expect(parsed.chains[0].sequences.length).toBe(1);

      // All marks should have no issues
      for (const mark of parsed.chains[0].sequences[0].marks) {
        expect(mark.issues).toEqual([]);
      }
    });
  });

  describe("test_validate_sorted_chains", () => {
    it("should sort chains by chain ID", () => {
      const marks1 = createTestMarks(2, ProvenanceMarkResolution.Low, "zebra");
      const marks2 = createTestMarks(2, ProvenanceMarkResolution.Low, "apple");
      const marks3 = createTestMarks(2, ProvenanceMarkResolution.Low, "middle");

      const allMarks = [...marks1, ...marks2, ...marks3];
      const report = validate(allMarks);

      const json = formatReport(report, ValidationReportFormat.JsonPretty);
      const parsed = JSON.parse(json);

      expect(parsed.chains.length).toBe(3);

      // Chains should be sorted by chain_id
      const chainIds = parsed.chains.map((c: { chain_id: string }) => c.chain_id);
      const sortedChainIds = [...chainIds].sort();
      expect(chainIds).toEqual(sortedChainIds);
    });
  });

  describe("test_validate_genesis_check", () => {
    it("should correctly identify genesis status", () => {
      const marks = createTestMarks(3, ProvenanceMarkResolution.Low, "test");

      // With genesis
      const reportWithGenesis = validate(marks);
      const parsedWith = JSON.parse(
        formatReport(reportWithGenesis, ValidationReportFormat.JsonPretty),
      );
      expect(parsedWith.chains[0].has_genesis).toBe(true);

      // Without genesis
      const marksNoGenesis = marks.slice(1);
      const reportNoGenesis = validate(marksNoGenesis);
      const parsedWithout = JSON.parse(
        formatReport(reportNoGenesis, ValidationReportFormat.JsonPretty),
      );
      expect(parsedWithout.chains[0].has_genesis).toBe(false);
    });
  });

  describe("test_validate_date_ordering_violation_constructed", () => {
    it("should detect date ordering violations", () => {
      const marks = createTestMarks(2, ProvenanceMarkResolution.Low, "test");
      const mark0 = marks[0];

      // Create a second generator to get the correct key but with an earlier date
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "test",
      );
      generator.next(mark0.date()); // Skip first to sync state

      // Create mark with earlier date
      const earlierDate = new Date(Date.UTC(2023, 5, 19, 12, 0, 0, 0));
      const markBadDate = generator.next(earlierDate);

      const report = validate([mark0, markBadDate]);

      const json = formatReport(report, ValidationReportFormat.JsonPretty);
      const parsed = JSON.parse(json);

      expect(parsed.marks.length).toBe(2);
      expect(parsed.chains.length).toBe(1);

      // Should have 2 sequences due to date ordering violation
      expect(parsed.chains[0].sequences.length).toBe(2);
      expect(parsed.chains[0].sequences[1].marks[0].issues[0].type).toBe("DateOrdering");
    });
  });

  describe("test_validate_non_genesis_at_seq_zero", () => {
    it("should detect non-genesis mark at sequence 0", () => {
      const marks = createTestMarks(2, ProvenanceMarkResolution.Low, "test");
      const mark0 = marks[0];
      const mark1 = marks[1];

      const date = new Date(Date.UTC(2023, 5, 21, 12, 0, 0, 0));

      // Create a mark that claims seq 0 but is not a genesis mark
      const badMark = ProvenanceMark.new(
        mark1.res(),
        mark1.key(),
        mark1.hash(),
        mark1.chainId(),
        0, // Claim seq 0 but not genesis
        date,
        undefined,
      );

      const report = validate([mark0, badMark]);

      const json = formatReport(report, ValidationReportFormat.JsonPretty);
      const parsed = JSON.parse(json);

      expect(parsed.marks.length).toBe(2);
      expect(parsed.chains.length).toBe(1);

      // Should have 2 sequences
      expect(parsed.chains[0].sequences.length).toBe(2);
      expect(parsed.chains[0].sequences[1].marks[0].issues[0].type).toBe("NonGenesisAtZero");
    });
  });

  describe("test_validate_invalid_genesis_key_constructed", () => {
    it("should detect invalid genesis key at non-zero sequence", () => {
      const marks = createTestMarks(2, ProvenanceMarkResolution.Low, "test");
      const mark0 = marks[0];
      const mark1 = marks[1];

      const date = new Date(Date.UTC(2023, 5, 21, 12, 0, 0, 0));

      // Create a mark at seq > 0 but with key == chain_id (not allowed)
      const badMark = ProvenanceMark.new(
        mark1.res(),
        mark1.chainId(), // key == chain_id (not allowed at seq > 0)
        mark1.hash(),
        mark1.chainId(),
        1, // seq 1
        date,
        undefined,
      );

      const report = validate([mark0, badMark]);

      const json = formatReport(report, ValidationReportFormat.JsonPretty);
      const parsed = JSON.parse(json);

      expect(parsed.marks.length).toBe(2);
      expect(parsed.chains.length).toBe(1);

      // Should have 2 sequences
      expect(parsed.chains[0].sequences.length).toBe(2);
      expect(parsed.chains[0].sequences[1].marks[0].issues[0].type).toBe("InvalidGenesisKey");
    });
  });
});
