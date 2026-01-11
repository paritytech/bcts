/**
 * Seed type for seedtool-cli
 * Ported from seedtool-cli-rust/src/seed.rs
 *
 * This is a local Seed type that wraps the seed data with metadata
 * and provides Envelope conversion. It differs from @bcts/components Seed
 * in that it doesn't enforce minimum length (for CLI flexibility) and
 * has direct Envelope conversion methods.
 */

import { Envelope } from "@bcts/envelope";
import { Seed as ComponentsSeed } from "@bcts/components";
import { NAME, NOTE, DATE, SEED_TYPE } from "@bcts/known-values";
import { CborDate } from "@bcts/dcbor";

/**
 * Seed with optional metadata.
 * Matches Rust Seed struct in seed.rs.
 */
export class Seed {
  private readonly _data: Uint8Array;
  private _name: string;
  private _note: string;
  private _creationDate: Date | undefined;

  /**
   * Create a new Seed with the given data.
   * Matches Rust Seed::new function.
   */
  constructor(data: Uint8Array) {
    this._data = new Uint8Array(data);
    this._name = "";
    this._note = "";
    this._creationDate = undefined;
  }

  /**
   * Create a new Seed with data and optional metadata.
   * Matches Rust Seed::new_opt function.
   */
  static newOpt(data: Uint8Array, name: string, note: string, creationDate?: Date): Seed {
    const seed = new Seed(data);
    seed._name = name;
    seed._note = note;
    seed._creationDate = creationDate;
    return seed;
  }

  /**
   * Create a new Seed from raw data.
   * Convenience factory method.
   */
  static new(data: Uint8Array): Seed {
    return new Seed(data);
  }

  // ============================================================================
  // Accessors
  // ============================================================================

  /**
   * Get the seed data.
   * Matches Rust seed.data() method.
   */
  data(): Uint8Array {
    return this._data;
  }

  /**
   * Get the seed name.
   * Matches Rust seed.name() method.
   * Returns empty string if not set.
   */
  name(): string {
    return this._name;
  }

  /**
   * Set the seed name.
   * Matches Rust seed.set_name() method.
   */
  setName(name: string): void {
    this._name = name;
  }

  /**
   * Get the seed note.
   * Matches Rust seed.note() method.
   * Returns empty string if not set.
   */
  note(): string {
    return this._note;
  }

  /**
   * Set the seed note.
   * Matches Rust seed.set_note() method.
   */
  setNote(note: string): void {
    this._note = note;
  }

  /**
   * Get the creation date.
   * Matches Rust seed.creation_date() method.
   */
  creationDate(): Date | undefined {
    return this._creationDate;
  }

  /**
   * Set the creation date.
   * Matches Rust seed.set_creation_date() method.
   */
  setCreationDate(date: Date | undefined): void {
    this._creationDate = date;
  }

  // ============================================================================
  // Cloning
  // ============================================================================

  /**
   * Clone the seed.
   */
  clone(): Seed {
    return Seed.newOpt(new Uint8Array(this._data), this._name, this._note, this._creationDate);
  }

  // ============================================================================
  // Envelope Conversion
  // ============================================================================

  /**
   * Convert to Envelope.
   * Matches Rust impl From<Seed> for Envelope.
   *
   * Creates an envelope with:
   * - Subject: byte string of seed data
   * - Type assertion: 'Seed'
   * - Optional date assertion
   * - Optional name assertion (if not empty)
   * - Optional note assertion (if not empty)
   */
  toEnvelope(): Envelope {
    // Create envelope with seed data as byte string subject
    let envelope = Envelope.new(this._data);

    // Add type assertion
    envelope = envelope.addType(SEED_TYPE);

    // Add optional date assertion (using CBOR Date tag 1)
    if (this._creationDate !== undefined) {
      const cborDate = CborDate.fromDatetime(this._creationDate);
      envelope = envelope.addAssertion(DATE, cborDate);
    }

    // Add optional name assertion (only if not empty)
    if (this._name.length > 0) {
      envelope = envelope.addAssertion(NAME, this._name);
    }

    // Add optional note assertion (only if not empty)
    if (this._note.length > 0) {
      envelope = envelope.addAssertion(NOTE, this._note);
    }

    return envelope;
  }

  /**
   * Create a Seed from an Envelope.
   * Matches Rust impl TryFrom<Envelope> for Seed.
   */
  static fromEnvelope(envelope: Envelope): Seed {
    // Check type
    envelope.checkTypeValue(SEED_TYPE);

    // Extract data from subject (byte string)
    const subject = envelope.subject();
    const leaf = subject.asLeaf();
    if (leaf === undefined) {
      throw new Error("Seed envelope must have a leaf subject");
    }
    const data = leaf.asByteString();
    if (data === undefined) {
      throw new Error("Seed envelope subject must be a byte string");
    }

    // Extract optional name
    let name = "";
    try {
      const nameObj = envelope.objectForPredicate(NAME);
      if (nameObj !== undefined) {
        const nameStr = nameObj.asText();
        if (nameStr !== undefined) {
          name = nameStr;
        }
      }
    } catch {
      // Name is optional
    }

    // Extract optional note
    let note = "";
    try {
      const noteObj = envelope.objectForPredicate(NOTE);
      if (noteObj !== undefined) {
        const noteStr = noteObj.asText();
        if (noteStr !== undefined) {
          note = noteStr;
        }
      }
    } catch {
      // Note is optional
    }

    // Extract optional creation date (CBOR Date tag 1)
    let creationDate: Date | undefined;
    try {
      const dateObj = envelope.objectForPredicate(DATE);
      if (dateObj !== undefined) {
        // Try to extract as CborDate first (tag 1)
        const leaf = dateObj.asLeaf();
        if (leaf !== undefined) {
          const cborDate = CborDate.fromTaggedCbor(leaf);
          creationDate = cborDate.datetime();
        }
      }
    } catch {
      // Date is optional, or might be a different format - try ISO string fallback
      try {
        const dateObj = envelope.objectForPredicate(DATE);
        if (dateObj !== undefined) {
          const dateStr = dateObj.asText();
          if (dateStr !== undefined) {
            creationDate = new Date(dateStr);
          }
        }
      } catch {
        // Date is optional
      }
    }

    return Seed.newOpt(data, name, note, creationDate);
  }

  // ============================================================================
  // ComponentsSeed Conversion
  // ============================================================================

  /**
   * Convert to @bcts/components Seed.
   * Matches Rust impl TryFrom<&Seed> for ComponentsSeed.
   */
  toComponentsSeed(): ComponentsSeed {
    return ComponentsSeed.newOpt(
      this._data,
      this._name.length > 0 ? this._name : undefined,
      this._note.length > 0 ? this._note : undefined,
      this._creationDate,
    );
  }

  /**
   * Create from @bcts/components Seed.
   * Matches Rust impl From<ComponentsSeed> for Seed.
   */
  static fromComponentsSeed(seed: ComponentsSeed): Seed {
    return Seed.newOpt(seed.asBytes(), seed.name(), seed.note(), seed.creationDate());
  }

  // ============================================================================
  // String Representation
  // ============================================================================

  /**
   * Get string representation.
   */
  toString(): string {
    const hex = Array.from(this._data.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return `Seed(${hex}..., ${this._data.length} bytes)`;
  }

  /**
   * Check equality with another Seed.
   */
  equals(other: Seed): boolean {
    if (this._data.length !== other._data.length) return false;
    for (let i = 0; i < this._data.length; i++) {
      if (this._data[i] !== other._data[i]) return false;
    }
    if (this._name !== other._name) return false;
    if (this._note !== other._note) return false;
    if (this._creationDate?.getTime() !== other._creationDate?.getTime()) return false;
    return true;
  }
}
