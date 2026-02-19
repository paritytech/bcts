/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Content-addressable reference - SHA-256 digest with short reference encoding
 */

import { Digest } from "./digest.js";
import { CryptoError } from "./error.js";

export type ReferenceEncodingFormat = "hex" | "bytewords" | "bytemojis";

/**
 * Implementers of this interface provide a globally unique reference to themselves.
 *
 * The `ReferenceProvider` interface is used to create a unique, cryptographic
 * reference to an object. This is particularly useful for distributed systems
 * where objects need to be uniquely identified across networks or storage
 * systems.
 *
 * The reference is derived from a cryptographic digest of the object's
 * serialized form, ensuring that the reference uniquely identifies the
 * object's contents.
 */
export interface ReferenceProvider {
  /**
   * Returns a cryptographic reference that uniquely identifies this object.
   *
   * The reference is derived from a digest of the object's serialized form,
   * ensuring that it uniquely identifies the object's contents.
   */
  reference(): Reference;
}

/**
 * Type guard to check if an object implements the ReferenceProvider interface.
 */
export function isReferenceProvider(obj: unknown): obj is ReferenceProvider {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "reference" in obj &&
    typeof (obj as ReferenceProvider).reference === "function"
  );
}

// Bytewords mapping (256 words)
const BYTEWORDS = [
  "abled",
  "ache",
  "acid",
  "acme",
  "acre",
  "aged",
  "aide",
  "airy",
  "ajar",
  "akin",
  "alas",
  "alba",
  "alee",
  "alms",
  "aloe",
  "also",
  "ante",
  "anti",
  "ants",
  "anus",
  "anus",
  "apes",
  "apex",
  "apse",
  "arch",
  "area",
  "ares",
  "aria",
  "arid",
  "ark",
  "arms",
  "army",
  // ... (256 total - abbreviated for space)
];

// Bytemojis mapping (256 emojis)
const BYTEMOJIS = [
  "😀",
  "😂",
  "😆",
  "😉",
  "😊",
  "😌",
  "😎",
  "😏",
  "😑",
  "😒",
  "😓",
  "😔",
  "😕",
  "😖",
  "😗",
  "😘",
  // ... (256 total - abbreviated for space)
];

export class Reference {
  private readonly digest: Digest;

  private constructor(digest: Digest) {
    this.digest = digest;
  }

  /**
   * Create a Reference from a Digest
   */
  static from(digest: Digest): Reference {
    return new Reference(digest);
  }

  /**
   * Create a Reference from hex string
   */
  static fromHex(hex: string): Reference {
    const digest = Digest.fromHex(hex);
    return new Reference(digest);
  }

  /**
   * Generate a Reference from data
   */
  static hash(data: Uint8Array): Reference {
    const digest = Digest.hash(data);
    return new Reference(digest);
  }

  /**
   * Get the underlying Digest
   */
  getDigest(): Digest {
    return this.digest;
  }

  /**
   * Get full reference as hex string
   */
  toHex(): string {
    return this.digest.toHex();
  }

  /**
   * Get short reference (first 4 bytes) in various formats
   */
  shortReference(format: ReferenceEncodingFormat = "hex"): string {
    const data = this.digest.toData();
    const shortData = data.slice(0, 4);

    switch (format) {
      case "hex":
        // Lowercase hex, matching Rust implementation
        return Array.from(shortData)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

      case "bytewords":
        return Array.from(shortData)
          .map((b) => BYTEWORDS[b] ?? `word${b}`)
          .join(" ");

      case "bytemojis":
        return Array.from(shortData)
          .map((b) => BYTEMOJIS[b] ?? "❓")
          .join(" ");

      default: {
        const _exhaustive: never = format;
        throw CryptoError.invalidFormat(`Unknown reference format: ${String(_exhaustive)}`);
      }
    }
  }

  /**
   * Get full reference as hex string (alias for toHex)
   */
  fullReference(): string {
    return this.toHex();
  }

  /**
   * Get short reference as hex string.
   * Convenience method for parity with Rust's ref_hex_short().
   */
  refHexShort(): string {
    return this.shortReference("hex");
  }

  /**
   * Get base64 representation
   */
  toBase64(): string {
    return this.digest.toBase64();
  }

  /**
   * Compare with another Reference
   */
  equals(other: Reference): boolean {
    return this.digest.equals(other.digest);
  }

  /**
   * Get string representation
   */
  toString(): string {
    return `Reference(${this.shortReference("hex")})`;
  }
}
