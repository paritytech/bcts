/**
 * Error types for cryptographic and component operations
 *
 * Ported from bc-components-rust/src/error.rs
 *
 * This module provides a unified error handling system that matches the Rust
 * implementation's error variants with full structural parity:
 *
 * - InvalidSize: Invalid data size for the specified type
 * - InvalidData: Invalid data format or content
 * - DataTooShort: Data too short for the expected type
 * - Crypto: Cryptographic operation failed
 * - Cbor: CBOR encoding or decoding error
 * - Sskr: SSKR error
 * - Ssh: SSH key operation failed
 * - Uri: URI parsing failed
 * - Compression: Data compression/decompression failed
 * - PostQuantum: Post-quantum cryptography library error
 * - LevelMismatch: Signature level mismatch
 * - SshAgent: SSH agent operation failed
 * - Hex: Hex decoding error
 * - Utf8: UTF-8 conversion error
 * - Env: Environment variable error
 * - SshAgentClient: SSH agent client error
 * - General: General error with custom message
 */

/**
 * Error kind enum matching Rust's Error variants.
 *
 * This enum allows programmatic checking of error types, matching the
 * Rust enum variants exactly.
 */
export enum ErrorKind {
  /** Invalid data size for the specified type */
  InvalidSize = "InvalidSize",
  /** Invalid data format or content */
  InvalidData = "InvalidData",
  /** Data too short for the expected type */
  DataTooShort = "DataTooShort",
  /** Cryptographic operation failed */
  Crypto = "Crypto",
  /** CBOR encoding or decoding error */
  Cbor = "Cbor",
  /** SSKR error */
  Sskr = "Sskr",
  /** SSH key operation failed */
  Ssh = "Ssh",
  /** URI parsing failed */
  Uri = "Uri",
  /** Data compression/decompression failed */
  Compression = "Compression",
  /** Post-quantum cryptography library error */
  PostQuantum = "PostQuantum",
  /** Signature level mismatch */
  LevelMismatch = "LevelMismatch",
  /** SSH agent operation failed */
  SshAgent = "SshAgent",
  /** Hex decoding error */
  Hex = "Hex",
  /** UTF-8 conversion error */
  Utf8 = "Utf8",
  /** Environment variable error */
  Env = "Env",
  /** SSH agent client error */
  SshAgentClient = "SshAgentClient",
  /** General error with custom message */
  General = "General",
}

/**
 * Structured data for InvalidSize errors.
 */
export interface InvalidSizeData {
  dataType: string;
  expected: number;
  actual: number;
}

/**
 * Structured data for InvalidData errors.
 */
export interface InvalidDataData {
  dataType: string;
  reason: string;
}

/**
 * Structured data for DataTooShort errors.
 */
export interface DataTooShortData {
  dataType: string;
  minimum: number;
  actual: number;
}

/**
 * Union type for all possible error data.
 */
export type ErrorData =
  | ({ kind: ErrorKind.InvalidSize } & InvalidSizeData)
  | ({ kind: ErrorKind.InvalidData } & InvalidDataData)
  | ({ kind: ErrorKind.DataTooShort } & DataTooShortData)
  | { kind: ErrorKind.Crypto; message: string }
  | { kind: ErrorKind.Cbor; message: string }
  | { kind: ErrorKind.Sskr; message: string }
  | { kind: ErrorKind.Ssh; message: string }
  | { kind: ErrorKind.Uri; message: string }
  | { kind: ErrorKind.Compression; message: string }
  | { kind: ErrorKind.PostQuantum; message: string }
  | { kind: ErrorKind.LevelMismatch }
  | { kind: ErrorKind.SshAgent; message: string }
  | { kind: ErrorKind.Hex; message: string }
  | { kind: ErrorKind.Utf8; message: string }
  | { kind: ErrorKind.Env; message: string }
  | { kind: ErrorKind.SshAgentClient; message: string }
  | { kind: ErrorKind.General; message: string };

/**
 * Error type for cryptographic and component operations.
 *
 * This class provides full structural parity with the Rust Error enum,
 * including:
 * - An `errorKind` property for programmatic error type checking
 * - Structured `errorData` for accessing error-specific fields
 * - Factory methods matching Rust's impl block
 */
export class CryptoError extends Error {
  /** The error kind for programmatic type checking */
  readonly errorKind: ErrorKind;

  /** Structured error data matching Rust's error variants */
  readonly errorData: ErrorData;

  private constructor(message: string, errorData: ErrorData) {
    super(message);
    this.name = "CryptoError";
    this.errorKind = errorData.kind;
    this.errorData = errorData;

    // Maintains proper stack trace in V8 environments
    const ErrorWithStackTrace = Error as { captureStackTrace?: (target: Error, ctor: unknown) => void };
    if (typeof ErrorWithStackTrace.captureStackTrace === "function") {
      ErrorWithStackTrace.captureStackTrace(this, CryptoError);
    }
  }

  // ============================================================================
  // Size and Data Errors
  // ============================================================================

  /**
   * Create an invalid size error.
   *
   * Rust equivalent: `Error::InvalidSize { data_type, expected, actual }`
   *
   * @param expected - The expected size
   * @param actual - The actual size received
   */
  static invalidSize(expected: number, actual: number): CryptoError {
    return CryptoError.invalidSizeForType("data", expected, actual);
  }

  /**
   * Create an invalid size error with a data type name.
   *
   * Rust equivalent: `Error::invalid_size(data_type, expected, actual)`
   *
   * @param dataType - The name of the data type
   * @param expected - The expected size
   * @param actual - The actual size received
   */
  static invalidSizeForType(dataType: string, expected: number, actual: number): CryptoError {
    return new CryptoError(`invalid ${dataType} size: expected ${expected}, got ${actual}`, {
      kind: ErrorKind.InvalidSize,
      dataType,
      expected,
      actual,
    });
  }

  /**
   * Create an invalid data error.
   *
   * @param message - Description of what's invalid
   */
  static invalidData(message: string): CryptoError {
    return CryptoError.invalidDataForType("data", message);
  }

  /**
   * Create an invalid data error with a data type name.
   *
   * Rust equivalent: `Error::invalid_data(data_type, reason)`
   *
   * @param dataType - The name of the data type
   * @param reason - The reason the data is invalid
   */
  static invalidDataForType(dataType: string, reason: string): CryptoError {
    return new CryptoError(`invalid ${dataType}: ${reason}`, {
      kind: ErrorKind.InvalidData,
      dataType,
      reason,
    });
  }

  /**
   * Create a data too short error.
   *
   * Rust equivalent: `Error::data_too_short(data_type, minimum, actual)`
   *
   * @param dataType - The name of the data type
   * @param minimum - The minimum required size
   * @param actual - The actual size received
   */
  static dataTooShort(dataType: string, minimum: number, actual: number): CryptoError {
    return new CryptoError(
      `data too short: ${dataType} expected at least ${minimum}, got ${actual}`,
      {
        kind: ErrorKind.DataTooShort,
        dataType,
        minimum,
        actual,
      },
    );
  }

  // ============================================================================
  // Format and Input Errors (convenience methods)
  // ============================================================================

  /**
   * Create an invalid format error.
   *
   * @param message - Description of the format error
   */
  static invalidFormat(message: string): CryptoError {
    return CryptoError.invalidDataForType("format", message);
  }

  /**
   * Create an invalid input error.
   *
   * @param message - Description of the invalid input
   */
  static invalidInput(message: string): CryptoError {
    return CryptoError.invalidDataForType("input", message);
  }

  // ============================================================================
  // Cryptographic Errors
  // ============================================================================

  /**
   * Create a cryptographic operation failed error.
   *
   * Rust equivalent: `Error::crypto(msg)`
   *
   * @param message - Description of the failure
   */
  static cryptoOperation(message: string): CryptoError {
    return CryptoError.crypto(message);
  }

  /**
   * Create a crypto error.
   *
   * Rust equivalent: `Error::Crypto(msg)`
   *
   * @param message - Description of the failure
   */
  static crypto(message: string): CryptoError {
    return new CryptoError(`cryptographic operation failed: ${message}`, {
      kind: ErrorKind.Crypto,
      message,
    });
  }

  /**
   * Create a post-quantum cryptography error.
   *
   * Rust equivalent: `Error::post_quantum(msg)`
   *
   * @param message - Description of the failure
   */
  static postQuantum(message: string): CryptoError {
    return new CryptoError(`post-quantum cryptography error: ${message}`, {
      kind: ErrorKind.PostQuantum,
      message,
    });
  }

  /**
   * Create a signature level mismatch error.
   *
   * Rust equivalent: `Error::LevelMismatch`
   */
  static levelMismatch(): CryptoError {
    return new CryptoError("signature level does not match key level", {
      kind: ErrorKind.LevelMismatch,
    });
  }

  // ============================================================================
  // Encoding/Serialization Errors
  // ============================================================================

  /**
   * Create a CBOR error.
   *
   * Rust equivalent: `Error::Cbor(err)`
   *
   * @param message - Description of the CBOR error
   */
  static cbor(message: string): CryptoError {
    return new CryptoError(`CBOR error: ${message}`, {
      kind: ErrorKind.Cbor,
      message,
    });
  }

  /**
   * Create a hex decoding error.
   *
   * Rust equivalent: `Error::Hex(err)`
   *
   * @param message - Description of the hex error
   */
  static hex(message: string): CryptoError {
    return new CryptoError(`hex decoding error: ${message}`, {
      kind: ErrorKind.Hex,
      message,
    });
  }

  /**
   * Create a UTF-8 conversion error.
   *
   * Rust equivalent: `Error::Utf8(err)`
   *
   * @param message - Description of the UTF-8 error
   */
  static utf8(message: string): CryptoError {
    return new CryptoError(`UTF-8 conversion error: ${message}`, {
      kind: ErrorKind.Utf8,
      message,
    });
  }

  // ============================================================================
  // Compression Errors
  // ============================================================================

  /**
   * Create a compression error.
   *
   * Rust equivalent: `Error::compression(msg)`
   *
   * @param message - Description of the compression error
   */
  static compression(message: string): CryptoError {
    return new CryptoError(`compression error: ${message}`, {
      kind: ErrorKind.Compression,
      message,
    });
  }

  // ============================================================================
  // URI Errors
  // ============================================================================

  /**
   * Create a URI parsing error.
   *
   * Rust equivalent: `Error::Uri(err)`
   *
   * @param message - Description of the URI error
   */
  static uri(message: string): CryptoError {
    return new CryptoError(`invalid URI: ${message}`, {
      kind: ErrorKind.Uri,
      message,
    });
  }

  // ============================================================================
  // SSKR Errors
  // ============================================================================

  /**
   * Create an SSKR error.
   *
   * Rust equivalent: `Error::Sskr(err)`
   *
   * @param message - Description of the SSKR error
   */
  static sskr(message: string): CryptoError {
    return new CryptoError(`SSKR error: ${message}`, {
      kind: ErrorKind.Sskr,
      message,
    });
  }

  // ============================================================================
  // SSH Errors
  // ============================================================================

  /**
   * Create an SSH operation error.
   *
   * Rust equivalent: `Error::ssh(msg)`
   *
   * @param message - Description of the SSH error
   */
  static ssh(message: string): CryptoError {
    return new CryptoError(`SSH operation failed: ${message}`, {
      kind: ErrorKind.Ssh,
      message,
    });
  }

  /**
   * Create an SSH agent error.
   *
   * Rust equivalent: `Error::ssh_agent(msg)`
   *
   * @param message - Description of the SSH agent error
   */
  static sshAgent(message: string): CryptoError {
    return new CryptoError(`SSH agent error: ${message}`, {
      kind: ErrorKind.SshAgent,
      message,
    });
  }

  /**
   * Create an SSH agent client error.
   *
   * Rust equivalent: `Error::ssh_agent_client(msg)`
   *
   * @param message - Description of the SSH agent client error
   */
  static sshAgentClient(message: string): CryptoError {
    return new CryptoError(`SSH agent client error: ${message}`, {
      kind: ErrorKind.SshAgentClient,
      message,
    });
  }

  // ============================================================================
  // Environment Errors
  // ============================================================================

  /**
   * Create an environment variable error.
   *
   * Rust equivalent: `Error::Env(err)`
   *
   * @param message - Description of the environment error
   */
  static env(message: string): CryptoError {
    return new CryptoError(`environment variable error: ${message}`, {
      kind: ErrorKind.Env,
      message,
    });
  }

  // ============================================================================
  // General Errors
  // ============================================================================

  /**
   * Create a general error with a custom message.
   *
   * Rust equivalent: `Error::general(msg)` / `Error::General(msg)`
   *
   * @param message - The error message
   */
  static general(message: string): CryptoError {
    return new CryptoError(message, {
      kind: ErrorKind.General,
      message,
    });
  }

  // ============================================================================
  // Error Kind Checking Methods
  // ============================================================================

  /**
   * Check if this error is of a specific kind.
   *
   * @param kind - The error kind to check
   */
  isKind(kind: ErrorKind): boolean {
    return this.errorKind === kind;
  }

  /**
   * Check if this is an InvalidSize error.
   */
  isInvalidSize(): this is CryptoError & {
    errorData: InvalidSizeData & { kind: ErrorKind.InvalidSize };
  } {
    return this.errorKind === ErrorKind.InvalidSize;
  }

  /**
   * Check if this is an InvalidData error.
   */
  isInvalidData(): this is CryptoError & {
    errorData: InvalidDataData & { kind: ErrorKind.InvalidData };
  } {
    return this.errorKind === ErrorKind.InvalidData;
  }

  /**
   * Check if this is a DataTooShort error.
   */
  isDataTooShort(): this is CryptoError & {
    errorData: DataTooShortData & { kind: ErrorKind.DataTooShort };
  } {
    return this.errorKind === ErrorKind.DataTooShort;
  }

  /**
   * Check if this is a Crypto error.
   */
  isCrypto(): boolean {
    return this.errorKind === ErrorKind.Crypto;
  }

  /**
   * Check if this is a Cbor error.
   */
  isCbor(): boolean {
    return this.errorKind === ErrorKind.Cbor;
  }

  /**
   * Check if this is an Sskr error.
   */
  isSskr(): boolean {
    return this.errorKind === ErrorKind.Sskr;
  }

  /**
   * Check if this is an Ssh error.
   */
  isSsh(): boolean {
    return this.errorKind === ErrorKind.Ssh;
  }

  /**
   * Check if this is a Uri error.
   */
  isUri(): boolean {
    return this.errorKind === ErrorKind.Uri;
  }

  /**
   * Check if this is a Compression error.
   */
  isCompression(): boolean {
    return this.errorKind === ErrorKind.Compression;
  }

  /**
   * Check if this is a PostQuantum error.
   */
  isPostQuantum(): boolean {
    return this.errorKind === ErrorKind.PostQuantum;
  }

  /**
   * Check if this is a LevelMismatch error.
   */
  isLevelMismatch(): boolean {
    return this.errorKind === ErrorKind.LevelMismatch;
  }

  /**
   * Check if this is an SshAgent error.
   */
  isSshAgent(): boolean {
    return this.errorKind === ErrorKind.SshAgent;
  }

  /**
   * Check if this is a Hex error.
   */
  isHex(): boolean {
    return this.errorKind === ErrorKind.Hex;
  }

  /**
   * Check if this is a Utf8 error.
   */
  isUtf8(): boolean {
    return this.errorKind === ErrorKind.Utf8;
  }

  /**
   * Check if this is an Env error.
   */
  isEnv(): boolean {
    return this.errorKind === ErrorKind.Env;
  }

  /**
   * Check if this is an SshAgentClient error.
   */
  isSshAgentClient(): boolean {
    return this.errorKind === ErrorKind.SshAgentClient;
  }

  /**
   * Check if this is a General error.
   */
  isGeneral(): boolean {
    return this.errorKind === ErrorKind.General;
  }
}

/**
 * Result type that can be either a success value or an Error.
 */
export type Result<T> = T | Error;

/**
 * Type guard to check if a result is an Error.
 */
export function isError(result: unknown): result is Error {
  return result instanceof Error;
}

/**
 * Type guard to check if a result is a CryptoError.
 */
export function isCryptoError(result: unknown): result is CryptoError {
  return result instanceof CryptoError;
}

/**
 * Type guard to check if an error is a CryptoError of a specific kind.
 */
export function isCryptoErrorKind(result: unknown, kind: ErrorKind): result is CryptoError {
  return isCryptoError(result) && result.errorKind === kind;
}
