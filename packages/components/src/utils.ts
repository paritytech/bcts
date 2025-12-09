/**
 * Utility functions for byte array conversions
 */

/**
 * Convert Uint8Array to hex string
 */
export function bytesToHex(data: Uint8Array): string {
  return Array.from(data)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Convert hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const data = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    data[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return data;
}

/**
 * Convert Uint8Array to base64 string
 */
export function toBase64(data: Uint8Array): string {
  // Use btoa for browser compatibility, or Buffer for Node.js
  if (typeof btoa !== "undefined") {
    return btoa(String.fromCharCode(...data));
  }
  // Node.js environment
  return Buffer.from(data).toString("base64");
}

/**
 * Convert base64 string to Uint8Array
 */
export function fromBase64(base64: string): Uint8Array {
  // Use atob for browser compatibility, or Buffer for Node.js
  if (typeof atob !== "undefined") {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  // Node.js environment
  return new Uint8Array(Buffer.from(base64, "base64"));
}

/**
 * Compare two Uint8Arrays for equality (constant-time)
 */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}
