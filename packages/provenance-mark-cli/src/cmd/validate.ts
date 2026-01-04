/**
 * Validate command - 1:1 port of validate.rs
 *
 * Validate one or more provenance marks.
 */

 

import * as fs from "fs";
import * as path from "path";
import { UR } from "@bcts/uniform-resources";
import { Envelope } from "@bcts/envelope";
import { PROVENANCE } from "@bcts/known-values";
import {
  ProvenanceMark,
  ProvenanceMarkInfo,
  ValidationReportFormat,
  validate,
  hasIssues,
  formatReport,
} from "@bcts/provenance-mark";

import type { Exec } from "../exec.js";
import { readExistingDirectoryPath } from "../utils.js";

/**
 * Output format for the validation report.
 *
 * Corresponds to Rust `Format`
 */
export enum ValidateFormat {
  Text = "text",
  JsonCompact = "json-compact",
  JsonPretty = "json-pretty",
}

/**
 * Convert ValidateFormat to ValidationReportFormat.
 */
function formatToValidationReportFormat(format: ValidateFormat): ValidationReportFormat {
  switch (format) {
    case ValidateFormat.Text:
      return ValidationReportFormat.Text;
    case ValidateFormat.JsonCompact:
      return ValidationReportFormat.JsonCompact;
    case ValidateFormat.JsonPretty:
      return ValidationReportFormat.JsonPretty;
  }
}

/**
 * Parse a format string.
 */
export function parseValidateFormat(value: string): ValidateFormat {
  switch (value.toLowerCase()) {
    case "text":
      return ValidateFormat.Text;
    case "json-compact":
      return ValidateFormat.JsonCompact;
    case "json-pretty":
      return ValidateFormat.JsonPretty;
    default:
      throw new Error(`Invalid format: ${value}. Must be one of: text, json-compact, json-pretty`);
  }
}

/**
 * Arguments for the validate command.
 *
 * Corresponds to Rust `CommandArgs`
 */
export interface ValidateCommandArgs {
  /** One or more provenance mark URs to validate. */
  marks: string[];
  /** Path to a chain directory containing marks to validate. */
  dir?: string;
  /** Report issues as warnings without failing. */
  warn: boolean;
  /** Output format for the validation report. */
  format: ValidateFormat;
}

/**
 * Create default args for the validate command.
 */
export function defaultValidateCommandArgs(): ValidateCommandArgs {
  return {
    marks: [],
    warn: false,
    format: ValidateFormat.Text,
  };
}

/**
 * Validate command implementation.
 *
 * Corresponds to Rust `impl Exec for CommandArgs`
 */
export class ValidateCommand implements Exec {
  private readonly args: ValidateCommandArgs;

  constructor(args: ValidateCommandArgs) {
    this.args = args;
  }

  exec(): string {
    // Collect marks from either URs or directory
    let marks: ProvenanceMark[];
    if (this.args.dir !== undefined) {
      marks = this.loadMarksFromDir(this.args.dir);
    } else {
      marks = this.parseMarksFromUrs(this.args.marks);
    }

    // Validate the marks
    const report = validate(marks);

    // Format the output
    const output = formatReport(report, formatToValidationReportFormat(this.args.format));

    // Determine if we should fail
    if (hasIssues(report) && !this.args.warn) {
      throw new Error(`Validation failed with issues:\n${output}`);
    }

    return output;
  }

  /**
   * Parse marks from UR strings.
   *
   * Corresponds to Rust `parse_marks_from_urs()`
   */
  private parseMarksFromUrs(urStrings: string[]): ProvenanceMark[] {
    const marks: ProvenanceMark[] = [];
    for (const urString of urStrings) {
      const mark = this.extractProvenanceMark(urString.trim());
      marks.push(mark);
    }
    return marks;
  }

  /**
   * Extract a ProvenanceMark from a UR string.
   *
   * Supports three types of URs:
   * 1. `ur:provenance` - Direct provenance mark
   * 2. `ur:envelope` - Envelope with a 'provenance' assertion
   * 3. Any other UR type - Attempts to decode CBOR as an envelope
   *
   * Corresponds to Rust `extract_provenance_mark()`
   */
  private extractProvenanceMark(urString: string): ProvenanceMark {
    // Parse the UR to get its type and CBOR
    let ur: UR;
    try {
      ur = UR.fromURString(urString);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(`Failed to parse UR '${urString}': ${message}`);
    }

    const urType = ur.urTypeStr();
    const cborValue = ur.cbor();

    // Case 1: Direct provenance mark
    // URs don't include the CBOR tag in their encoded format, so we use fromUntaggedCbor
    if (urType === "provenance") {
      try {
        return ProvenanceMark.fromUntaggedCbor(cborValue);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        throw new Error(`Failed to decode provenance mark from '${urString}': ${message}`);
      }
    }

    // Case 2 & 3: Try to decode CBOR as an envelope
    let envelope: Envelope;
    try {
      envelope = Envelope.fromUntaggedCbor(cborValue);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(
        `UR type '${urType}' is not 'provenance', and CBOR is not decodable as an envelope: ${message}`,
      );
    }

    // Extract the provenance mark from the envelope
    return this.extractProvenanceMarkFromEnvelope(envelope, urString);
  }

  /**
   * Extract a ProvenanceMark from an Envelope.
   *
   * The envelope must contain exactly one 'provenance' assertion,
   * and the object subject of that assertion must be a ProvenanceMark.
   *
   * Corresponds to Rust `extract_provenance_mark_from_envelope()`
   */
  private extractProvenanceMarkFromEnvelope(envelope: Envelope, urString: string): ProvenanceMark {
    // If the envelope is wrapped, unwrap it to get to the actual content
    let workingEnvelope = envelope;
    if (envelope.isWrapped()) {
      const innerEnvelope = envelope.unwrap();
      if (innerEnvelope !== undefined) {
        workingEnvelope = innerEnvelope;
      }
    }

    // Find all assertions with the 'provenance' predicate
    const provenancePredicate = Envelope.newWithKnownValue(PROVENANCE);
    const provenanceAssertions = workingEnvelope.assertionsWithPredicate(provenancePredicate);

    // Verify exactly one provenance assertion exists
    if (provenanceAssertions.length === 0) {
      throw new Error(`Envelope in '${urString}' does not contain a 'provenance' assertion`);
    }
    if (provenanceAssertions.length > 1) {
      throw new Error(
        `Envelope in '${urString}' contains ${provenanceAssertions.length} 'provenance' assertions, expected exactly one`,
      );
    }

    // Get the object of the provenance assertion
    const provenanceAssertion = provenanceAssertions[0];
    const objectEnvelope = provenanceAssertion.asObject();
    if (objectEnvelope === undefined) {
      throw new Error(`Failed to extract object from provenance assertion in '${urString}'`);
    }

    // The object should be decodable as a ProvenanceMark.
    // Extract the CBOR from the leaf envelope and parse it.
    try {
      const cborValue = objectEnvelope.asLeaf();
      if (cborValue === undefined) {
        throw new Error("Object envelope is not a leaf");
      }
      return ProvenanceMark.fromTaggedCbor(cborValue);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(
        `Failed to decode ProvenanceMark from provenance assertion in '${urString}': ${message}`,
      );
    }
  }

  /**
   * Load marks from a directory.
   *
   * Corresponds to Rust `load_marks_from_dir()`
   */
  private loadMarksFromDir(dirPath: string): ProvenanceMark[] {
    // Get the chain's directory path
    const resolvedPath = readExistingDirectoryPath(dirPath);

    // Get the marks subdirectory
    const marksPath = path.join(resolvedPath, "marks");
    if (!fs.existsSync(marksPath) || !fs.statSync(marksPath).isDirectory()) {
      throw new Error(`Marks subdirectory not found: ${marksPath}`);
    }

    // Read all JSON files from the marks directory
    const entries = fs.readdirSync(marksPath);
    const markFiles = entries
      .map((entry) => path.join(marksPath, entry))
      .filter((p) => p.endsWith(".json"))
      .sort();

    if (markFiles.length === 0) {
      throw new Error(`No mark JSON files found in: ${marksPath}`);
    }

    // Parse each JSON file and extract the mark
    const marks: ProvenanceMark[] = [];
    for (const markFile of markFiles) {
      try {
        const jsonContent = fs.readFileSync(markFile, "utf-8");
        const markInfo = ProvenanceMarkInfo.fromJSON(
          JSON.parse(jsonContent) as Record<string, unknown>,
        );
        marks.push(markInfo.mark());
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        throw new Error(`Failed to parse JSON from ${markFile}: ${message}`);
      }
    }

    return marks;
  }
}
