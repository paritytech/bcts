/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * String utilities for dCBOR, including Unicode normalization.
 *
 * @module string-util
 */

/**
 * Flank a string with left and right strings.
 *
 * @param s - String to flank
 * @param left - Left flanking string
 * @param right - Right flanking string
 * @returns Flanked string
 */
export const flanked = (s: string, left: string, right: string): string => left + s + right;

/**
 * Check if a character is printable.
 *
 * @param c - Character to check
 * @returns True if printable
 */
export const isPrintable = (c: string): boolean => {
  if (c.length !== 1) return false;
  const code = c.charCodeAt(0);
  // Non-ASCII or ASCII printable (32-126)
  return code > 127 || (code >= 32 && code <= 126);
};

/**
 * Sanitize a string by replacing non-printable characters with dots.
 * Returns None if the string has no printable characters.
 *
 * @param str - String to sanitize
 * @returns Sanitized string or undefined if no printable characters
 */
export const sanitized = (str: string): string | undefined => {
  let hasPrintable = false;
  const chars: string[] = [];

  for (const c of str) {
    if (isPrintable(c)) {
      hasPrintable = true;
      chars.push(c);
    } else {
      chars.push(".");
    }
  }

  if (!hasPrintable) {
    return undefined;
  }

  return chars.join("");
};
