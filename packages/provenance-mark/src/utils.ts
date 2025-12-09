/**
 * Utility functions for byte array conversions.
 *
 * These functions provide cross-platform support for common byte manipulation
 * operations needed in provenance mark encoding.
 */

// Declare Node.js types for environments where they might not be available
declare const require: ((module: string) => unknown) | undefined;

/**
 * Convert a Uint8Array to a lowercase hexadecimal string.
 *
 * @param data - The byte array to convert
 * @returns A lowercase hex string representation (2 characters per byte)
 */
export function bytesToHex(data: Uint8Array): string {
  return Array.from(data)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Convert a hexadecimal string to a Uint8Array.
 *
 * @param hex - A hex string (must have even length, case-insensitive)
 * @returns The decoded byte array
 * @throws {Error} If the hex string has odd length or contains invalid characters
 */
export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error(`Hex string must have even length, got ${hex.length}`);
  }
  if (!/^[0-9A-Fa-f]*$/.test(hex)) {
    throw new Error("Invalid hex string: contains non-hexadecimal characters");
  }
  const data = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    data[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return data;
}

/**
 * Convert a Uint8Array to a base64-encoded string.
 *
 * This function works in both browser and Node.js environments.
 *
 * @param data - The byte array to encode
 * @returns A base64-encoded string
 */
export function toBase64(data: Uint8Array): string {
  // Use globalThis.btoa for browser/modern Node.js compatibility
  const globalBtoa = globalThis.btoa as ((data: string) => string) | undefined;
  if (typeof globalBtoa === "function") {
    // Convert bytes to binary string without spread operator to avoid
    // call stack limits for large arrays
    let binary = "";
    for (const byte of data) {
      binary += String.fromCharCode(byte);
    }
    return globalBtoa(binary);
  }
  // Node.js environment (fallback for Node < 18)
  const requireFn = require;
  if (typeof requireFn === "function") {
    const { Buffer: NodeBuffer } = requireFn("buffer") as {
      Buffer: { from: (data: Uint8Array) => { toString: (encoding: string) => string } };
    };
    return NodeBuffer.from(data).toString("base64");
  }
  throw new Error("btoa not available and require is not defined");
}

/**
 * Convert a base64-encoded string to a Uint8Array.
 *
 * This function works in both browser and Node.js environments.
 *
 * @param base64 - A base64-encoded string
 * @returns The decoded byte array
 */
export function fromBase64(base64: string): Uint8Array {
  // Use globalThis.atob for browser/modern Node.js compatibility
  const globalAtob = globalThis.atob as ((data: string) => string) | undefined;
  if (typeof globalAtob === "function") {
    const binary = globalAtob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  // Node.js environment (fallback for Node < 18)
  const requireFn = require;
  if (typeof requireFn === "function") {
    const { Buffer: NodeBuffer } = requireFn("buffer") as {
      Buffer: { from: (data: string, encoding: string) => Uint8Array };
    };
    return new Uint8Array(NodeBuffer.from(base64, "base64"));
  }
  throw new Error("atob not available and require is not defined");
}
