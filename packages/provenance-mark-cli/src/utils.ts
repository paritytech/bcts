/**
 * Utilities module - 1:1 port of utils.rs
 *
 * Helper functions for CLI operations.
 */

import * as fs from "fs";
import * as path from "path";

/**
 * Read a new path, supporting globbing, and resolving relative paths.
 *
 * Corresponds to Rust `read_new_path()`
 */
export function readNewPath(pathStr: string): string {
  // For TypeScript, we simplify glob handling - just resolve the path
  let effectivePath: string;

  if (path.isAbsolute(pathStr)) {
    effectivePath = pathStr;
  } else {
    const currentDir = process.cwd();
    effectivePath = path.join(currentDir, pathStr);
  }

  // Normalize the path (resolve . and ..)
  return path.normalize(effectivePath);
}

/**
 * Read an existing directory path, supporting globbing, and resolving relative paths.
 *
 * Corresponds to Rust `read_existing_directory_path()`
 */
export function readExistingDirectoryPath(pathStr: string): string {
  const effectivePath = readNewPath(pathStr);

  if (!fs.existsSync(effectivePath)) {
    throw new Error(`Path does not exist: ${effectivePath}`);
  }

  if (!fs.statSync(effectivePath).isDirectory()) {
    throw new Error(`Path is not a directory: ${effectivePath}`);
  }

  return effectivePath;
}

/**
 * Read an argument from command line or stdin.
 *
 * Corresponds to Rust `read_argument()`
 */
export function readArgument(argument?: string): string {
  if (argument !== undefined && argument !== "") {
    return argument;
  }

  // Read from stdin
  const input = readStdinSync();
  if (input.trim() === "") {
    throw new Error("No argument provided");
  }
  return input.trim();
}

/**
 * Read all stdin synchronously.
 */
export function readStdinSync(): string {
  let input = "";
  const BUFSIZE = 256;
  const buf = Buffer.alloc(BUFSIZE);

  try {
    // Use process.stdin.fd (file descriptor 0) directly for reading
    const fd = process.stdin.fd;

    while (true) {
      try {
        const bytesRead = fs.readSync(fd, buf, 0, BUFSIZE, null);
        if (bytesRead === 0) break;
        input += buf.toString("utf8", 0, bytesRead);
      } catch {
        break;
      }
    }
  } catch {
    // Fallback: stdin might not be readable
  }

  return input;
}

/**
 * Convert bytes to hex string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Convert hex string to bytes.
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert bytes to base64 string.
 */
export function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

/**
 * Convert base64 string to bytes.
 */
export function fromBase64(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, "base64"));
}
