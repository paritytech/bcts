/**
 * Uniform Resource Identifier (URI) - String-based identifier
 */

declare global {
  interface Global {
    crypto?: Crypto;
  }
  var global: Global;
  var Buffer: any;
}

import { CryptoError } from "../error.js";

export class URI {
  private uri: string;

  private constructor(uri: string) {
    if (!uri || uri.trim().length === 0) {
      throw CryptoError.invalidInput("URI cannot be empty");
    }
    this.uri = uri;
  }

  /**
   * Create a URI from string
   */
  static from(uri: string): URI {
    return new URI(uri);
  }

  /**
   * Parse a URI string
   */
  static parse(uriString: string): URI {
    try {
      // Validate URI format
      new URL(uriString);
      return new URI(uriString);
    } catch {
      // Allow non-URL URIs, just validate it's not empty
      if (!uriString || uriString.trim().length === 0) {
        throw CryptoError.invalidFormat("URI cannot be empty");
      }
      return new URI(uriString);
    }
  }

  /**
   * Get the URI string
   */
  toString(): string {
    return this.uri;
  }

  /**
   * Get the URI string (alias)
   */
  toURI(): string {
    return this.uri;
  }

  /**
   * Get the raw URI string
   */
  getRaw(): string {
    return this.uri;
  }

  /**
   * Get scheme (e.g., "http", "https", "urn")
   */
  scheme(): string | null {
    const match = this.uri.match(/^([a-z][a-z0-9+.-]*):\/?\/?/i);
    return match ? match[1] : null;
  }

  /**
   * Get path component
   */
  path(): string {
    try {
      const url = new URL(this.uri);
      return url.pathname;
    } catch {
      // For non-URL URIs, try to extract path after scheme
      const withoutScheme = this.uri.replace(/^[a-z][a-z0-9+.-]*:\/?\/?/i, "");
      return withoutScheme;
    }
  }

  /**
   * Check if URI is absolute (has a scheme)
   */
  isAbsolute(): boolean {
    return /^[a-z][a-z0-9+.-]*:/i.test(this.uri);
  }

  /**
   * Check if URI is relative
   */
  isRelative(): boolean {
    return !this.isAbsolute();
  }

  /**
   * Compare with another URI
   */
  equals(other: URI): boolean {
    return this.uri === other.uri;
  }

  /**
   * Check if URI starts with given prefix
   */
  startsWith(prefix: string): boolean {
    return this.uri.startsWith(prefix);
  }

  /**
   * Get base64 representation of the URI string
   */
  toBase64(): string {
    return Buffer.from(this.uri).toString("base64");
  }

  /**
   * Get the length of the URI string
   */
  length(): number {
    return this.uri.length;
  }
}
