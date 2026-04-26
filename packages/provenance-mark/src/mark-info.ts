/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

// Ported from provenance-mark-rust/src/mark_info.rs

import type { UR } from "@bcts/uniform-resources";

import { ProvenanceMark } from "./mark.js";
import { dateToDisplay } from "./date.js";

/**
 * Wrapper for a provenance mark with additional display information.
 */
export class ProvenanceMarkInfo {
  private readonly _mark: ProvenanceMark;
  private readonly _ur: UR;
  private readonly _bytewords: string;
  private readonly _bytemoji: string;
  private readonly _comment: string;

  private constructor(
    mark: ProvenanceMark,
    ur: UR,
    bytewords: string,
    bytemoji: string,
    comment: string,
  ) {
    this._mark = mark;
    this._ur = ur;
    this._bytewords = bytewords;
    this._bytemoji = bytemoji;
    this._comment = comment;
  }

  /**
   * Create a new ProvenanceMarkInfo from a mark.
   *
   * Mirrors Rust `ProvenanceMarkInfo::new`
   * (`provenance-mark-rust/src/mark_info.rs`), which calls
   * `mark.ur()` — i.e. the {@link UREncodable} implementation, whose
   * payload is the **untagged** CBOR with type `"provenance"`. Earlier
   * revisions of this port called `decodeCbor(mark.toCborData())` and
   * wrapped the resulting *tagged* CBOR in `UR.new("provenance", ...)`,
   * which prepended the CBOR tag to the UR bytewords and broke
   * cross-impl interop (UR strings produced by Rust would not parse,
   * and vice versa).
   */
  static new(mark: ProvenanceMark, comment = ""): ProvenanceMarkInfo {
    const ur = mark.ur();
    const bytewords = mark.idBytewords(4, true);
    const bytemoji = mark.idBytemoji(4, true);
    return new ProvenanceMarkInfo(mark, ur, bytewords, bytemoji, comment);
  }

  mark(): ProvenanceMark {
    return this._mark;
  }

  ur(): UR {
    return this._ur;
  }

  bytewords(): string {
    return this._bytewords;
  }

  bytemoji(): string {
    return this._bytemoji;
  }

  comment(): string {
    return this._comment;
  }

  /**
   * Generate a markdown summary of the mark.
   *
   * Date rendering uses {@link dateToDisplay} so midnight-UTC dates
   * appear as `YYYY-MM-DD` (matching Rust `format!("{}",
   * self.mark.date())`), not as `YYYY-MM-DDT00:00:00Z`.
   */
  markdownSummary(): string {
    const lines: string[] = [];

    lines.push("---");

    lines.push("");
    lines.push(dateToDisplay(this._mark.date()));

    lines.push("");
    lines.push(`#### ${this._ur.toString()}`);

    lines.push("");
    lines.push(`#### \`${this._bytewords}\``);

    lines.push("");
    lines.push(this._bytemoji);

    lines.push("");
    if (this._comment.length > 0) {
      lines.push(this._comment);
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * JSON serialization.
   */
  toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {
      ur: this._ur.toString(),
      bytewords: this._bytewords,
      bytemoji: this._bytemoji,
      mark: this._mark.toJSON(),
    };
    if (this._comment.length > 0) {
      result["comment"] = this._comment;
    }
    return result;
  }

  /**
   * Create from JSON object.
   *
   * Decodes the UR string through {@link ProvenanceMark.fromURString},
   * which correctly handles the **untagged** CBOR payload that
   * `mark.ur()` produces — symmetric with the constructor.
   */
  static fromJSON(json: Record<string, unknown>): ProvenanceMarkInfo {
    const urString = json["ur"] as string;
    const mark = ProvenanceMark.fromURString(urString);
    const ur = mark.ur();
    const bytewords = json["bytewords"] as string;
    const bytemoji = json["bytemoji"] as string;
    const comment = typeof json["comment"] === "string" ? json["comment"] : "";
    return new ProvenanceMarkInfo(mark, ur, bytewords, bytemoji, comment);
  }
}
