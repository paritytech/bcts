// Ported from provenance-mark-rust/src/mark_info.rs

import { UR } from "@blockchain-commons/uniform-resources";
import { decodeCbor, cborData } from "@blockchain-commons/dcbor";
import { PROVENANCE_MARK } from "@blockchain-commons/tags";

import { ProvenanceMark } from "./mark.js";

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
   */
  static new(mark: ProvenanceMark, comment = ""): ProvenanceMarkInfo {
    const tagName = PROVENANCE_MARK.name;
    if (tagName === undefined) {
      throw new Error("PROVENANCE_MARK tag has no name");
    }
    const cborValue = decodeCbor(mark.toCborData());
    const ur = UR.new(tagName, cborValue);
    const bytewords = mark.bytewordsIdentifier(true);
    const bytemoji = mark.bytemojiIdentifier(true);
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
   */
  markdownSummary(): string {
    const lines: string[] = [];

    lines.push("---");

    lines.push("");
    lines.push(this._mark.date().toISOString());

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
   */
  static fromJSON(json: Record<string, unknown>): ProvenanceMarkInfo {
    const urString = json["ur"] as string;
    const ur = UR.fromURString(urString);
    const cborBytes = cborData(ur.cbor());
    const mark = ProvenanceMark.fromCborData(cborBytes);
    const bytewords = json["bytewords"] as string;
    const bytemoji = json["bytemoji"] as string;
    const comment = typeof json["comment"] === "string" ? json["comment"] : "";
    return new ProvenanceMarkInfo(mark, ur, bytewords, bytemoji, comment);
  }
}
