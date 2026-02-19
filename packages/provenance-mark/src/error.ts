/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

// Ported from provenance-mark-rust/src/error.rs

/**
 * Error types for Provenance Mark operations.
 */
export enum ProvenanceMarkErrorType {
  /** Invalid Seed length */
  InvalidSeedLength = "InvalidSeedLength",
  /** Duplicate key */
  DuplicateKey = "DuplicateKey",
  /** Missing key */
  MissingKey = "MissingKey",
  /** Invalid key */
  InvalidKey = "InvalidKey",
  /** Extra keys */
  ExtraKeys = "ExtraKeys",
  /** Invalid key length for the given resolution */
  InvalidKeyLength = "InvalidKeyLength",
  /** Invalid next key length for the given resolution */
  InvalidNextKeyLength = "InvalidNextKeyLength",
  /** Invalid chain ID length for the given resolution */
  InvalidChainIdLength = "InvalidChainIdLength",
  /** Invalid message length for the given resolution */
  InvalidMessageLength = "InvalidMessageLength",
  /** Invalid CBOR data in info field */
  InvalidInfoCbor = "InvalidInfoCbor",
  /** Date out of range for serialization */
  DateOutOfRange = "DateOutOfRange",
  /** Invalid date components */
  InvalidDate = "InvalidDate",
  /** Missing required URL parameter */
  MissingUrlParameter = "MissingUrlParameter",
  /** Year out of range for 2-byte serialization */
  YearOutOfRange = "YearOutOfRange",
  /** Invalid month or day */
  InvalidMonthOrDay = "InvalidMonthOrDay",
  /** Resolution serialization error */
  ResolutionError = "ResolutionError",
  /** Bytewords encoding/decoding error */
  BytewordsError = "BytewordsError",
  /** CBOR encoding/decoding error */
  CborError = "CborError",
  /** URL parsing error */
  UrlError = "UrlError",
  /** Base64 decoding error */
  Base64Error = "Base64Error",
  /** JSON serialization error */
  JsonError = "JsonError",
  /** Integer conversion error */
  IntegerConversionError = "IntegerConversionError",
  /** Validation error */
  ValidationError = "ValidationError",
}

/**
 * Error class for Provenance Mark operations.
 */
export class ProvenanceMarkError extends Error {
  readonly type: ProvenanceMarkErrorType;
  readonly details?: Record<string, unknown> | undefined;

  constructor(type: ProvenanceMarkErrorType, message?: string, details?: Record<string, unknown>) {
    const fullMessage =
      message !== undefined && message !== ""
        ? `${type}: ${message}`
        : ProvenanceMarkError.defaultMessage(type, details);
    super(fullMessage);
    this.name = "ProvenanceMarkError";
    this.type = type;
    this.details = details;
  }

  private static defaultMessage(
    type: ProvenanceMarkErrorType,
    details?: Record<string, unknown>,
  ): string {
    const d = (key: string): string => {
      const value = details?.[key];
      if (value === undefined || value === null) return "?";
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return String(value);
      }
      return JSON.stringify(value);
    };
    switch (type) {
      case ProvenanceMarkErrorType.InvalidSeedLength:
        return `invalid seed length: expected 32 bytes, got ${d("actual")} bytes`;
      case ProvenanceMarkErrorType.DuplicateKey:
        return `duplicate key: ${d("key")}`;
      case ProvenanceMarkErrorType.MissingKey:
        return `missing key: ${d("key")}`;
      case ProvenanceMarkErrorType.InvalidKey:
        return `invalid key: ${d("key")}`;
      case ProvenanceMarkErrorType.ExtraKeys:
        return `wrong number of keys: expected ${d("expected")}, got ${d("actual")}`;
      case ProvenanceMarkErrorType.InvalidKeyLength:
        return `invalid key length: expected ${d("expected")}, got ${d("actual")}`;
      case ProvenanceMarkErrorType.InvalidNextKeyLength:
        return `invalid next key length: expected ${d("expected")}, got ${d("actual")}`;
      case ProvenanceMarkErrorType.InvalidChainIdLength:
        return `invalid chain ID length: expected ${d("expected")}, got ${d("actual")}`;
      case ProvenanceMarkErrorType.InvalidMessageLength:
        return `invalid message length: expected at least ${d("expected")}, got ${d("actual")}`;
      case ProvenanceMarkErrorType.InvalidInfoCbor:
        return "invalid CBOR data in info field";
      case ProvenanceMarkErrorType.DateOutOfRange:
        return `date out of range: ${d("details")}`;
      case ProvenanceMarkErrorType.InvalidDate:
        return `invalid date: ${d("details")}`;
      case ProvenanceMarkErrorType.MissingUrlParameter:
        return `missing required URL parameter: ${d("parameter")}`;
      case ProvenanceMarkErrorType.YearOutOfRange:
        return `year out of range for 2-byte serialization: must be between 2023-2150, got ${d("year")}`;
      case ProvenanceMarkErrorType.InvalidMonthOrDay:
        return `invalid month (${d("month")}) or day (${d("day")}) for year ${d("year")}`;
      case ProvenanceMarkErrorType.ResolutionError:
        return `resolution serialization error: ${d("details")}`;
      case ProvenanceMarkErrorType.BytewordsError:
        return `bytewords error: ${d("message")}`;
      case ProvenanceMarkErrorType.CborError:
        return `CBOR error: ${d("message")}`;
      case ProvenanceMarkErrorType.UrlError:
        return `URL parsing error: ${d("message")}`;
      case ProvenanceMarkErrorType.Base64Error:
        return `base64 decoding error: ${d("message")}`;
      case ProvenanceMarkErrorType.JsonError:
        return `JSON error: ${d("message")}`;
      case ProvenanceMarkErrorType.IntegerConversionError:
        return `integer conversion error: ${d("message")}`;
      case ProvenanceMarkErrorType.ValidationError:
        return `validation error: ${d("message")}`;
      default:
        return type;
    }
  }
}

/**
 * Result type for Provenance Mark operations.
 */
export type ProvenanceMarkResult<T> = T;
