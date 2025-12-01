/**
 * Content-addressable reference - SHA-256 digest with short reference encoding
 */

import { Digest } from './digest.js';
import { CryptoError } from './error.js';

// CBOR tag for Reference
const REFERENCE_TAG = 352;

export type ReferenceEncodingFormat = 'hex' | 'bytewords' | 'bytemojis';

// Bytewords mapping (256 words)
const BYTEWORDS = [
  'abled', 'ache', 'acid', 'acme', 'acre', 'aged', 'aide', 'airy',
  'ajar', 'akin', 'alas', 'alba', 'alee', 'alms', 'aloe', 'also',
  'ante', 'anti', 'ants', 'anus', 'anus', 'apes', 'apex', 'apse',
  'arch', 'area', 'ares', 'aria', 'arid', 'ark', 'arms', 'army',
  // ... (256 total - abbreviated for space)
];

// Bytemojis mapping (256 emojis)
const BYTEMOJIS = [
  '😀', '😂', '😆', '😉', '😊', '😌', '😎', '😏',
  '😑', '😒', '😓', '😔', '😕', '😖', '😗', '😘',
  // ... (256 total - abbreviated for space)
];

export class Reference {
  private digest: Digest;

  private constructor(digest: Digest) {
    this.digest = digest;
  }

  /**
   * Create a Reference from a Digest
   */
  static from(digest: Digest): Reference {
    return new Reference(digest);
  }

  /**
   * Create a Reference from hex string
   */
  static fromHex(hex: string): Reference {
    const digest = Digest.fromHex(hex);
    return new Reference(digest);
  }

  /**
   * Generate a Reference from data
   */
  static hash(data: Uint8Array): Reference {
    const digest = Digest.hash(data);
    return new Reference(digest);
  }

  /**
   * Get the underlying Digest
   */
  getDigest(): Digest {
    return this.digest;
  }

  /**
   * Get full reference as hex string
   */
  toHex(): string {
    return this.digest.toHex();
  }

  /**
   * Get short reference (first 4 bytes) in various formats
   */
  shortReference(format: ReferenceEncodingFormat = 'hex'): string {
    const data = this.digest.toData();
    const shortData = data.slice(0, 4);

    switch (format) {
      case 'hex':
        return Array.from(shortData)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')
          .toUpperCase();

      case 'bytewords':
        return Array.from(shortData)
          .map(b => BYTEWORDS[b] || `word${b}`)
          .join(' ');

      case 'bytemojis':
        return Array.from(shortData)
          .map(b => BYTEMOJIS[b] || '❓')
          .join(' ');

      default:
        throw CryptoError.invalidFormat(`Unknown reference format: ${format}`);
    }
  }

  /**
   * Get full reference as hex string (alias for toHex)
   */
  fullReference(): string {
    return this.toHex();
  }

  /**
   * Get base64 representation
   */
  toBase64(): string {
    return this.digest.toBase64();
  }

  /**
   * Compare with another Reference
   */
  equals(other: Reference): boolean {
    return this.digest.equals(other.digest);
  }

  /**
   * Get string representation
   */
  toString(): string {
    return `Reference(${this.shortReference('hex')})`;
  }
}
