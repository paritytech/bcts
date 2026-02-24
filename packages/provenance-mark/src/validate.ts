/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

// Ported from provenance-mark-rust/src/validate.rs

import type { ProvenanceMark } from "./mark.js";
import { ProvenanceMarkError } from "./error.js";

/**
 * Format for validation report output.
 */
export enum ValidationReportFormat {
  /** Human-readable text format */
  Text = "text",
  /** Compact JSON format (no whitespace) */
  JsonCompact = "json-compact",
  /** Pretty-printed JSON format (with indentation) */
  JsonPretty = "json-pretty",
}

/**
 * Issue flagged during validation.
 */
export type ValidationIssue =
  | { type: "HashMismatch"; expected: string; actual: string }
  | { type: "KeyMismatch" }
  | { type: "SequenceGap"; expected: number; actual: number }
  | { type: "DateOrdering"; previous: string; next: string }
  | { type: "NonGenesisAtZero" }
  | { type: "InvalidGenesisKey" };

/**
 * Format a validation issue as a string.
 */
export function formatValidationIssue(issue: ValidationIssue): string {
  switch (issue.type) {
    case "HashMismatch":
      return `hash mismatch: expected ${issue.expected}, got ${issue.actual}`;
    case "KeyMismatch":
      return "key mismatch: current hash was not generated from next key";
    case "SequenceGap":
      return `sequence number gap: expected ${issue.expected}, got ${issue.actual}`;
    case "DateOrdering":
      return `date must be equal or later: previous is ${issue.previous}, next is ${issue.next}`;
    case "NonGenesisAtZero":
      return "non-genesis mark at sequence 0";
    case "InvalidGenesisKey":
      return "genesis mark must have key equal to chain_id";
  }
}

/**
 * A mark with any issues flagged during validation.
 */
export interface FlaggedMark {
  mark: ProvenanceMark;
  issues: ValidationIssue[];
}

/**
 * Report for a contiguous sequence of marks within a chain.
 */
export interface SequenceReport {
  startSeq: number;
  endSeq: number;
  marks: FlaggedMark[];
}

/**
 * Report for a chain of marks with the same chain ID.
 */
export interface ChainReport {
  chainId: Uint8Array;
  hasGenesis: boolean;
  marks: ProvenanceMark[];
  sequences: SequenceReport[];
}

/**
 * Get the chain ID as a hex string for display.
 */
export function chainIdHex(report: ChainReport): string {
  return hexEncode(report.chainId);
}

/**
 * Complete validation report.
 */
export interface ValidationReport {
  marks: ProvenanceMark[];
  chains: ChainReport[];
}

/**
 * Check if the validation report has any issues.
 */
export function hasIssues(report: ValidationReport): boolean {
  // Missing genesis is considered an issue
  for (const chain of report.chains) {
    if (!chain.hasGenesis) {
      return true;
    }
  }

  // Check for validation issues in marks
  for (const chain of report.chains) {
    for (const seq of chain.sequences) {
      for (const mark of seq.marks) {
        if (mark.issues.length > 0) {
          return true;
        }
      }
    }
  }

  // Multiple chains or sequences are also considered issues
  if (report.chains.length > 1) {
    return true;
  }

  if (report.chains.length === 1 && report.chains[0].sequences.length > 1) {
    return true;
  }

  return false;
}

/**
 * Check if the validation report contains interesting information.
 */
function isInteresting(report: ValidationReport): boolean {
  // Not interesting if empty
  if (report.chains.length === 0) {
    return false;
  }

  // Check if any chain is missing genesis
  for (const chain of report.chains) {
    if (!chain.hasGenesis) {
      return true;
    }
  }

  // Not interesting if single chain with single perfect sequence
  if (report.chains.length === 1) {
    const chain = report.chains[0];
    if (chain.sequences.length === 1) {
      const seq = chain.sequences[0];
      // Check if the sequence has no issues
      if (seq.marks.every((m) => m.issues.length === 0)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Format the validation report as human-readable text.
 */
function formatText(report: ValidationReport): string {
  if (!isInteresting(report)) {
    return "";
  }

  const lines: string[] = [];

  // Report summary
  lines.push(`Total marks: ${report.marks.length}`);
  lines.push(`Chains: ${report.chains.length}`);
  lines.push("");

  // Report each chain
  for (let chainIdx = 0; chainIdx < report.chains.length; chainIdx++) {
    const chain = report.chains[chainIdx];

    // Show short chain ID (first 4 bytes)
    const chainIdStr = chainIdHex(chain);
    const shortChainId = chainIdStr.length > 8 ? chainIdStr.slice(0, 8) : chainIdStr;

    lines.push(`Chain ${chainIdx + 1}: ${shortChainId}`);

    if (!chain.hasGenesis) {
      lines.push("  Warning: No genesis mark found");
    }

    // Report each sequence
    for (const seq of chain.sequences) {
      // Report each mark in the sequence
      for (const flaggedMark of seq.marks) {
        const mark = flaggedMark.mark;
        const shortId = mark.identifier();
        const seqNum = mark.seq();

        // Build the mark line with annotations
        const annotations: string[] = [];

        // Check if it's genesis
        if (mark.isGenesis()) {
          annotations.push("genesis mark");
        }

        // Add issue annotations
        for (const issue of flaggedMark.issues) {
          let issueStr: string;
          switch (issue.type) {
            case "SequenceGap":
              issueStr = `gap: ${issue.expected} missing`;
              break;
            case "DateOrdering":
              issueStr = `date ${issue.previous} < ${issue.next}`;
              break;
            case "HashMismatch":
              issueStr = "hash mismatch";
              break;
            case "KeyMismatch":
              issueStr = "key mismatch";
              break;
            case "NonGenesisAtZero":
              issueStr = "non-genesis at seq 0";
              break;
            case "InvalidGenesisKey":
              issueStr = "invalid genesis key";
              break;
          }
          annotations.push(issueStr);
        }

        // Format the line
        if (annotations.length === 0) {
          lines.push(`  ${seqNum}: ${shortId}`);
        } else {
          lines.push(`  ${seqNum}: ${shortId} (${annotations.join(", ")})`);
        }
      }
    }

    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

/**
 * Format the validation report.
 */
export function formatReport(report: ValidationReport, format: ValidationReportFormat): string {
  switch (format) {
    case ValidationReportFormat.Text:
      return formatText(report);
    case ValidationReportFormat.JsonCompact:
      return JSON.stringify(reportToJSON(report));
    case ValidationReportFormat.JsonPretty:
      return JSON.stringify(reportToJSON(report), null, 2);
  }
}

/**
 * Convert a report to a JSON-serializable object.
 */
function reportToJSON(report: ValidationReport): unknown {
  return {
    marks: report.marks.map((m) => m.urString()),
    chains: report.chains.map((chain) => ({
      chain_id: hexEncode(chain.chainId),
      has_genesis: chain.hasGenesis,
      marks: chain.marks.map((m) => m.urString()),
      sequences: chain.sequences.map((seq) => ({
        start_seq: seq.startSeq,
        end_seq: seq.endSeq,
        marks: seq.marks.map((fm) => ({
          mark: fm.mark.urString(),
          issues: fm.issues.map(issueToJSON),
        })),
      })),
    })),
  };
}

/**
 * Convert a ValidationIssue to JSON matching Rust's serde format.
 *
 * Rust uses `#[serde(tag = "type", content = "data")]` which wraps
 * struct variant data in a `"data"` field. Unit variants have no
 * `"data"` field.
 */
function issueToJSON(issue: ValidationIssue): unknown {
  switch (issue.type) {
    case "HashMismatch":
      return { type: "HashMismatch", data: { expected: issue.expected, actual: issue.actual } };
    case "SequenceGap":
      return { type: "SequenceGap", data: { expected: issue.expected, actual: issue.actual } };
    case "DateOrdering":
      return { type: "DateOrdering", data: { previous: issue.previous, next: issue.next } };
    case "KeyMismatch":
      return { type: "KeyMismatch" };
    case "NonGenesisAtZero":
      return { type: "NonGenesisAtZero" };
    case "InvalidGenesisKey":
      return { type: "InvalidGenesisKey" };
  }
}

/**
 * Build sequence bins for a chain.
 */
function buildSequenceBins(marks: ProvenanceMark[]): SequenceReport[] {
  const sequences: SequenceReport[] = [];
  let currentSequence: FlaggedMark[] = [];

  for (let i = 0; i < marks.length; i++) {
    const mark = marks[i];

    if (i === 0) {
      // First mark starts a sequence
      currentSequence.push({ mark, issues: [] });
    } else {
      const prev = marks[i - 1];

      // Check if this mark follows the previous one
      try {
        prev.precedesOpt(mark);
        // Continues the current sequence
        currentSequence.push({ mark, issues: [] });
      } catch (e) {
        // Breaks the sequence - save current and start new
        if (currentSequence.length > 0) {
          sequences.push(createSequenceReport(currentSequence));
        }

        // Extract structured issue directly from the error
        // Matches Rust: Error::Validation(v) => v, _ => ValidationIssue::KeyMismatch
        let issue: ValidationIssue;
        if (e instanceof ProvenanceMarkError && e.details?.["validationIssue"] !== undefined) {
          issue = e.details["validationIssue"] as ValidationIssue;
        } else {
          issue = { type: "KeyMismatch" }; // Fallback
        }

        // Start new sequence with this mark, flagged with the issue
        currentSequence = [{ mark, issues: [issue] }];
      }
    }
  }

  // Add the final sequence
  if (currentSequence.length > 0) {
    sequences.push(createSequenceReport(currentSequence));
  }

  return sequences;
}

/**
 * Create a sequence report from flagged marks.
 */
function createSequenceReport(marks: FlaggedMark[]): SequenceReport {
  const startSeq = marks.length > 0 ? marks[0].mark.seq() : 0;
  const endSeq = marks.length > 0 ? marks[marks.length - 1].mark.seq() : 0;
  return { startSeq, endSeq, marks };
}

/**
 * Validate a collection of provenance marks.
 */
export function validate(marks: ProvenanceMark[]): ValidationReport {
  // Deduplicate exact duplicates
  // Matches Rust semantics: PartialEq compares (res, message())
  const seen = new Set<string>();
  const deduplicatedMarks: ProvenanceMark[] = [];
  for (const mark of marks) {
    const key = `${mark.res()}:${hexEncode(mark.message())}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduplicatedMarks.push(mark);
    }
  }

  // Bin marks by chain ID
  const chainBins = new Map<string, ProvenanceMark[]>();
  for (const mark of deduplicatedMarks) {
    const chainIdKey = hexEncode(mark.chainId());
    const bin = chainBins.get(chainIdKey);
    if (bin !== undefined) {
      bin.push(mark);
    } else {
      chainBins.set(chainIdKey, [mark]);
    }
  }

  // Process each chain
  const chains: ChainReport[] = [];
  for (const [chainIdKey, chainMarks] of chainBins) {
    // Sort by sequence number
    chainMarks.sort((a, b) => a.seq() - b.seq());

    // Check for genesis mark
    const hasGenesis =
      chainMarks.length > 0 && chainMarks[0].seq() === 0 && chainMarks[0].isGenesis();

    // Build sequence bins
    const sequences = buildSequenceBins(chainMarks);

    chains.push({
      chainId: hexDecode(chainIdKey),
      hasGenesis,
      marks: chainMarks,
      sequences,
    });
  }

  // Sort chains by chain ID for consistent output
  chains.sort((a, b) => hexEncode(a.chainId).localeCompare(hexEncode(b.chainId)));

  return { marks: deduplicatedMarks, chains };
}

/**
 * Helper function to encode bytes as hex.
 */
function hexEncode(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Helper function to decode hex to bytes.
 */
function hexDecode(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}
