/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * DigestProvider interface for types that can provide a cryptographic digest.
 *
 * Ported from bc-components-rust/src/digest_provider.rs
 *
 * A type that can provide a single unique digest that characterizes its contents.
 * This trait is used to define a common interface for objects that can produce
 * a cryptographic digest (hash) of their content.
 *
 * @example
 * ```typescript
 * import { DigestProvider, Digest } from '@bcts/components';
 *
 * class Document implements DigestProvider {
 *   private content: Uint8Array;
 *   private cachedDigest?: Digest;
 *
 *   constructor(content: Uint8Array) {
 *     this.content = content;
 *   }
 *
 *   digest(): Digest {
 *     if (!this.cachedDigest) {
 *       this.cachedDigest = Digest.fromImage(this.content);
 *     }
 *     return this.cachedDigest;
 *   }
 * }
 * ```
 */
import type { Digest } from "./digest.js";

/**
 * A type that can provide a single unique digest that characterizes its contents.
 *
 * Use Cases:
 * - Data integrity verification
 * - Unique identifier for an object based on its content
 * - Content-addressable storage implementation
 * - Comparing objects by their content rather than identity
 */
export interface DigestProvider {
  /**
   * Returns a digest that uniquely characterizes the content of the
   * implementing type.
   */
  digest(): Digest;
}

/**
 * Helper function to get a digest from a byte array.
 * This provides DigestProvider-like functionality for raw bytes.
 *
 * @param data - The byte array to hash
 * @returns A Promise resolving to a Digest of the data
 */
export async function digestFromBytes(data: Uint8Array): Promise<Digest> {
  // Dynamic import to avoid circular dependency
  const { Digest } = await import("./digest.js");
  return Digest.fromImage(data);
}
