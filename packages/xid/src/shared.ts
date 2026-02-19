/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Shared Reference Wrapper
 *
 * Provides a wrapper for shared references to objects.
 * In TypeScript, we don't have Arc/RwLock like Rust, but we can provide
 * a simple wrapper that allows shared access to a value.
 *
 * Ported from bc-xid-rust/src/shared.rs
 */

/**
 * A wrapper for shared references to objects.
 *
 * Unlike Rust's Arc<RwLock<T>>, JavaScript uses reference semantics for objects,
 * so this is primarily a type-safe wrapper that makes the sharing explicit.
 */
export class Shared<T> {
  private readonly value: T;

  constructor(value: T) {
    this.value = value;
  }

  /**
   * Create a new Shared instance.
   */
  static new<T>(value: T): Shared<T> {
    return new Shared(value);
  }

  /**
   * Get a read-only reference to the value.
   */
  read(): T {
    return this.value;
  }

  /**
   * Get a mutable reference to the value.
   */
  write(): T {
    return this.value;
  }

  /**
   * Check equality with another Shared instance.
   */
  equals(other: Shared<T>): boolean {
    // Use JSON.stringify for deep equality check
    // This is a simple approach; for complex objects, a proper deep equals would be better
    if (this.value === other.value) return true;
    try {
      return JSON.stringify(this.value) === JSON.stringify(other.value);
    } catch {
      return false;
    }
  }

  /**
   * Clone this Shared instance.
   * Note: This creates a shallow copy in JS; for deep copy, implement on T.
   */
  clone(): Shared<T> {
    // If the value has a clone method, use it
    if (
      typeof this.value === "object" &&
      this.value !== null &&
      "clone" in this.value &&
      typeof (this.value as { clone(): T }).clone === "function"
    ) {
      return new Shared((this.value as { clone(): T }).clone());
    }
    // Otherwise, return the same reference (shallow copy)
    return new Shared(this.value);
  }
}
