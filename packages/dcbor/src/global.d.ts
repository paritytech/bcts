/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Global type declarations for cross-platform APIs
 */

declare global {
  /**
   * TextEncoder encodes a string into a Uint8Array of UTF-8 bytes.
   * Available in Node.js 11.0.0+ and all modern browsers.
   */
  interface TextEncoder {
    encode(input: string): Uint8Array;
  }

  /**
   * TextDecoder decodes a Uint8Array of UTF-8 bytes into a string.
   * Available in Node.js 11.0.0+ and all modern browsers.
   */
  interface TextDecoder {
    decode(input: Uint8Array | ArrayBuffer | null | undefined): string;
  }

  type TextEncoderConstructor = new () => TextEncoder;
  type TextDecoderConstructor = new (label?: string, options?: TextDecoderOptions) => TextDecoder;

  interface TextDecoderOptions {
    fatal?: boolean;
    ignoreBOM?: boolean;
  }

  const TextEncoder: TextEncoderConstructor;
  const TextDecoder: TextDecoderConstructor;
}

export {};
