/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * String utility functions used throughout the envelope library.
 *
 * Provides helper methods for string formatting and manipulation.
 */

/**
 * Flanks a string with specified left and right delimiters.
 *
 * @param str - The string to flank
 * @param left - The left delimiter
 * @param right - The right delimiter
 * @returns The flanked string
 *
 * @example
 * ```typescript
 * flanked('hello', '"', '"')  // Returns: "hello"
 * flanked('name', "'", "'")   // Returns: 'name'
 * flanked('item', '[', ']')   // Returns: [item]
 * ```
 */
export function flanked(str: string, left: string, right: string): string {
  return `${left}${str}${right}`;
}

/**
 * Extension methods for String objects to support fluent API style.
 */
declare global {
  interface String {
    /**
     * Flanks this string with specified left and right delimiters.
     *
     * @param left - The left delimiter
     * @param right - The right delimiter
     * @returns The flanked string
     */
    flankedBy(left: string, right: string): string;
  }
}

// Extend String prototype with flankedBy method
String.prototype.flankedBy = function (this: string, left: string, right: string): string {
  return flanked(this, left, right);
};

// Export the extension for side-effects
export {};
