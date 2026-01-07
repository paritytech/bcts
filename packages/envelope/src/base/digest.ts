/**
 * Re-export Digest from @bcts/components for type compatibility.
 *
 * The @bcts/components Digest class is the canonical implementation with:
 * - Full CBOR support (tagged/untagged)
 * - UR support
 * - Complete factory methods and instance methods
 *
 * This re-export ensures type compatibility between @bcts/envelope
 * and @bcts/components when used together.
 */
export { Digest } from "@bcts/components";
import { Digest } from "@bcts/components";

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

// Extend Digest with short() method for compatibility with bc-envelope-rust
declare module "@bcts/components" {
  interface Digest {
    /// Returns a short 7-character hex representation of the digest.
    /// This matches the Rust bc-envelope behavior.
    short(): string;
  }
}

// Add short() method to Digest prototype
Digest.prototype.short = function (this: Digest): string {
  // Return first 7 hex characters (matches Rust behavior)
  return this.hex().slice(0, 7);
};
