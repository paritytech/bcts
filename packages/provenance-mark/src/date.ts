/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

// Ported from provenance-mark-rust/src/date.rs

import { ProvenanceMarkError, ProvenanceMarkErrorType } from "./error.js";

/**
 * Interface for serializable date operations.
 */
export interface SerializableDate {
  serialize2Bytes(): Uint8Array;
  serialize4Bytes(): Uint8Array;
  serialize6Bytes(): Uint8Array;
}

/**
 * Reference date for 4-byte and 6-byte serialization (2001-01-01T00:00:00Z).
 */
const REFERENCE_DATE = Date.UTC(2001, 0, 1, 0, 0, 0, 0);

/**
 * Maximum value for 6-byte millisecond representation.
 */
const MAX_6_BYTE_VALUE = 0xe5940a78a7ff;

/**
 * Get the number of days in a month.
 */
function daysInMonth(year: number, month: number): number {
  // month is 1-based
  return new Date(year, month, 0).getDate();
}

/**
 * Check if a day is valid for a given year and month.
 */
function isValidDay(year: number, month: number, day: number): boolean {
  if (day < 1) return false;
  return day <= daysInMonth(year, month);
}

/**
 * Serialize a date to 2 bytes (year + month + day only, day precision).
 * Year range: 2023-2150 (128 years)
 * Format: YYYYYYY MMMM DDDDD (7 bits year offset, 4 bits month, 5 bits day)
 */
export function serialize2Bytes(date: Date): Uint8Array {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1; // 1-based
  const day = date.getUTCDate();

  const yy = year - 2023;
  if (yy < 0 || yy >= 128) {
    throw new ProvenanceMarkError(ProvenanceMarkErrorType.YearOutOfRange, undefined, { year });
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new ProvenanceMarkError(ProvenanceMarkErrorType.InvalidMonthOrDay, undefined, {
      year,
      month,
      day,
    });
  }

  const value = (yy << 9) | (month << 5) | day;
  const buf = new Uint8Array(2);
  buf[0] = (value >> 8) & 0xff;
  buf[1] = value & 0xff;
  return buf;
}

/**
 * Deserialize 2 bytes to a date.
 */
export function deserialize2Bytes(bytes: Uint8Array): Date {
  if (bytes.length !== 2) {
    throw new ProvenanceMarkError(ProvenanceMarkErrorType.InvalidDate, undefined, {
      details: `expected 2 bytes, got ${bytes.length}`,
    });
  }

  const value = (bytes[0] << 8) | bytes[1];
  const day = value & 0b11111;
  const month = (value >> 5) & 0b1111;
  const yy = (value >> 9) & 0b1111111;
  const year = yy + 2023;

  if (month < 1 || month > 12 || !isValidDay(year, month, day)) {
    throw new ProvenanceMarkError(ProvenanceMarkErrorType.InvalidMonthOrDay, undefined, {
      year,
      month,
      day,
    });
  }

  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/**
 * Serialize a date to 4 bytes (seconds since 2001-01-01).
 */
export function serialize4Bytes(date: Date): Uint8Array {
  const duration = date.getTime() - REFERENCE_DATE;
  const seconds = Math.floor(duration / 1000);

  if (seconds < 0 || seconds > 0xffffffff) {
    throw new ProvenanceMarkError(ProvenanceMarkErrorType.DateOutOfRange, undefined, {
      details: "seconds value out of range for u32",
    });
  }

  const buf = new Uint8Array(4);
  buf[0] = (seconds >> 24) & 0xff;
  buf[1] = (seconds >> 16) & 0xff;
  buf[2] = (seconds >> 8) & 0xff;
  buf[3] = seconds & 0xff;
  return buf;
}

/**
 * Deserialize 4 bytes to a date.
 */
export function deserialize4Bytes(bytes: Uint8Array): Date {
  if (bytes.length !== 4) {
    throw new ProvenanceMarkError(ProvenanceMarkErrorType.InvalidDate, undefined, {
      details: `expected 4 bytes, got ${bytes.length}`,
    });
  }

  const seconds = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  return new Date(REFERENCE_DATE + seconds * 1000);
}

/**
 * Serialize a date to 6 bytes (milliseconds since 2001-01-01).
 */
export function serialize6Bytes(date: Date): Uint8Array {
  const duration = date.getTime() - REFERENCE_DATE;
  const milliseconds = BigInt(duration);

  if (milliseconds < 0n || milliseconds > BigInt(MAX_6_BYTE_VALUE)) {
    throw new ProvenanceMarkError(ProvenanceMarkErrorType.DateOutOfRange, undefined, {
      details: "date exceeds maximum representable value",
    });
  }

  const buf = new Uint8Array(6);
  buf[0] = Number((milliseconds >> 40n) & 0xffn);
  buf[1] = Number((milliseconds >> 32n) & 0xffn);
  buf[2] = Number((milliseconds >> 24n) & 0xffn);
  buf[3] = Number((milliseconds >> 16n) & 0xffn);
  buf[4] = Number((milliseconds >> 8n) & 0xffn);
  buf[5] = Number(milliseconds & 0xffn);
  return buf;
}

/**
 * Deserialize 6 bytes to a date.
 */
export function deserialize6Bytes(bytes: Uint8Array): Date {
  if (bytes.length !== 6) {
    throw new ProvenanceMarkError(ProvenanceMarkErrorType.InvalidDate, undefined, {
      details: `expected 6 bytes, got ${bytes.length}`,
    });
  }

  const milliseconds =
    (BigInt(bytes[0]) << 40n) |
    (BigInt(bytes[1]) << 32n) |
    (BigInt(bytes[2]) << 24n) |
    (BigInt(bytes[3]) << 16n) |
    (BigInt(bytes[4]) << 8n) |
    BigInt(bytes[5]);

  if (milliseconds > BigInt(MAX_6_BYTE_VALUE)) {
    throw new ProvenanceMarkError(ProvenanceMarkErrorType.DateOutOfRange, undefined, {
      details: "date exceeds maximum representable value",
    });
  }

  return new Date(REFERENCE_DATE + Number(milliseconds));
}

/**
 * Get the range of valid days in a month.
 */
export function rangeOfDaysInMonth(year: number, month: number): { min: number; max: number } {
  return { min: 1, max: daysInMonth(year, month) };
}

/**
 * Format a date as ISO8601 string.
 */
export function dateToIso8601(date: Date): string {
  return date.toISOString();
}

/**
 * Parse an ISO8601 string to a Date.
 */
export function dateFromIso8601(str: string): Date {
  const date = new Date(str);
  if (isNaN(date.getTime())) {
    throw new ProvenanceMarkError(ProvenanceMarkErrorType.InvalidDate, undefined, {
      details: `cannot parse date: ${str}`,
    });
  }
  return date;
}

/**
 * Format a date as a simple date string (YYYY-MM-DD).
 */
export function dateToDateString(date: Date): string {
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}
