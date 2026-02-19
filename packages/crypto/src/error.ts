/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

// Ported from bc-crypto-rust/src/error.rs

/**
 * AEAD-specific error for authentication failures
 */
export class AeadError extends Error {
  constructor(message = "AEAD authentication failed") {
    super(message);
    this.name = "AeadError";
  }
}

/**
 * Generic crypto error type
 */
export class CryptoError extends Error {
  override readonly cause?: Error | undefined;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = "CryptoError";
    this.cause = cause;
  }

  /**
   * Create a CryptoError for AEAD authentication failures.
   *
   * @param error - Optional underlying AeadError
   * @returns A CryptoError wrapping the AEAD error
   */
  static aead(error?: AeadError): CryptoError {
    return new CryptoError("AEAD error", error ?? new AeadError());
  }

  /**
   * Create a CryptoError for invalid parameter values.
   *
   * @param message - Description of the invalid parameter
   * @returns A CryptoError describing the invalid parameter
   */
  static invalidParameter(message: string): CryptoError {
    return new CryptoError(`Invalid parameter: ${message}`);
  }
}

/**
 * Result type for crypto operations (using standard Error)
 */
export type CryptoResult<T> = T;
