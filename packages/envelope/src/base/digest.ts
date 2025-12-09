import { sha256 } from "@bcts/crypto";

/// A cryptographic digest used to uniquely identify digital objects.
///
/// Digests in Gordian Envelope are always SHA-256 hashes (32 bytes).
/// This is a fundamental building block for the Merkle-like digest tree
/// that enables privacy features while maintaining integrity.
///
/// Based on BCR-2021-002: Digests for Digital Objects
/// @see https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2021-002-digest.md
export class Digest {
  readonly #data: Uint8Array;

  /// Creates a new Digest from raw bytes.
  ///
  /// @param data - The 32-byte digest data
  /// @throws {Error} If data is not exactly 32 bytes
  constructor(data: Uint8Array) {
    if (data.length !== 32) {
      throw new Error(`Digest must be exactly 32 bytes, got ${data.length} bytes`);
    }
    this.#data = data;
  }

  /// Returns the raw digest bytes.
  ///
  /// @returns A Uint8Array containing the 32-byte digest
  data(): Uint8Array {
    return this.#data;
  }

  /// Creates a digest from an image (arbitrary byte array).
  ///
  /// This is the primary way to create a digest from data. The data is
  /// hashed using SHA-256 to produce a 32-byte digest.
  ///
  /// @param image - The data to hash
  /// @returns A new Digest instance
  ///
  /// @example
  /// ```typescript
  /// const digest = Digest.fromImage(new TextEncoder().encode("Hello, world!"));
  /// ```
  static fromImage(image: Uint8Array): Digest {
    const hash = sha256(image);
    return new Digest(hash);
  }

  /// Creates a digest from multiple digests.
  ///
  /// This is used to combine digests in the Merkle-like tree structure.
  /// The digests are concatenated and then hashed.
  ///
  /// @param digests - An array of digests to combine
  /// @returns A new Digest instance representing the combined digests
  ///
  /// @example
  /// ```typescript
  /// const digest1 = Digest.fromImage(data1);
  /// const digest2 = Digest.fromImage(data2);
  /// const combined = Digest.fromDigests([digest1, digest2]);
  /// ```
  static fromDigests(digests: Digest[]): Digest {
    const totalLength = digests.length * 32;
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const digest of digests) {
      combined.set(digest.data(), offset);
      offset += 32;
    }
    return Digest.fromImage(combined);
  }

  /// Returns the hexadecimal string representation of the digest.
  ///
  /// @returns A 64-character hexadecimal string
  ///
  /// @example
  /// ```typescript
  /// const digest = Digest.fromImage(data);
  /// console.log(digest.hex()); // "5feceb66ffc86f38d952786c6d696c79c2dbc239dd4e91b46729d73a27fb57e9"
  /// ```
  hex(): string {
    return Array.from(this.#data)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /// Returns an abbreviated hexadecimal representation for visual comparison.
  ///
  /// Following Blockchain Commons conventions, this returns the first 7
  /// hexadecimal digits of the digest, which provides sufficient entropy
  /// for human visual comparison while being easy to read.
  ///
  /// @returns A 7-character hexadecimal string
  ///
  /// @example
  /// ```typescript
  /// const digest = Digest.fromImage(data);
  /// console.log(digest.short()); // "5feceb6"
  /// ```
  short(): string {
    return this.hex().substring(0, 7);
  }

  /// Creates a digest from a hexadecimal string.
  ///
  /// @param hex - A 64-character hexadecimal string
  /// @returns A new Digest instance
  /// @throws {Error} If the hex string is not exactly 64 characters
  ///
  /// @example
  /// ```typescript
  /// const digest = Digest.fromHex("5feceb66ffc86f38d952786c6d696c79c2dbc239dd4e91b46729d73a27fb57e9");
  /// ```
  static fromHex(hex: string): Digest {
    if (hex.length !== 64) {
      throw new Error(`Hex string must be exactly 64 characters, got ${hex.length}`);
    }
    const data = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      data[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return new Digest(data);
  }

  /// Checks if two digests are equal.
  ///
  /// @param other - The other digest to compare with
  /// @returns `true` if the digests are equal, `false` otherwise
  equals(other: Digest): boolean {
    if (this.#data.length !== other.#data.length) {
      return false;
    }
    for (let i = 0; i < this.#data.length; i++) {
      if (this.#data[i] !== other.#data[i]) {
        return false;
      }
    }
    return true;
  }

  /// Returns a string representation of the digest (short form).
  ///
  /// @returns The short hexadecimal representation
  toString(): string {
    return this.short();
  }

  /// Creates a deep copy of the digest.
  ///
  /// @returns A new Digest instance with the same data
  clone(): Digest {
    return new Digest(new Uint8Array(this.#data));
  }
}

/// Trait for types that can provide a digest.
///
/// This is equivalent to Rust's `DigestProvider` trait. Types that
/// implement this interface can be used in contexts where a digest
/// is needed for identity or integrity verification.
export interface DigestProvider {
  /// Returns the digest of this object.
  ///
  /// The digest uniquely identifies the semantic content of the object,
  /// regardless of whether parts of it are elided, encrypted, or compressed.
  digest(): Digest;
}

/// Helper function to create a digest from a string.
///
/// This is a convenience function for creating digests from text strings,
/// which are encoded as UTF-8 before hashing.
///
/// @param text - The text to hash
/// @returns A new Digest instance
///
/// @example
/// ```typescript
/// const digest = digestFromString("Hello, world!");
/// ```
export function digestFromString(text: string): Digest {
  const encoder = new TextEncoder();
  return Digest.fromImage(encoder.encode(text));
}

/// Helper function to create a digest from a number.
///
/// The number is converted to a big-endian byte representation before hashing.
///
/// @param num - The number to hash
/// @returns A new Digest instance
///
/// @example
/// ```typescript
/// const digest = digestFromNumber(42);
/// ```
export function digestFromNumber(num: number): Digest {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setFloat64(0, num, false); // big-endian
  return Digest.fromImage(new Uint8Array(buffer));
}
