/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

// Ported from provenance-mark-rust/src/resolution.rs

import { type Cbor, cbor, expectUnsigned } from "@bcts/dcbor";

import { ProvenanceMarkError, ProvenanceMarkErrorType } from "./error.js";
import {
  serialize2Bytes,
  deserialize2Bytes,
  serialize4Bytes,
  deserialize4Bytes,
  serialize6Bytes,
  deserialize6Bytes,
} from "./date.js";

// LOW (16 bytes)
// 0000  0000  0000  00  00
// 0123  4567  89ab  cd  ef
// key   hash  id    seq date

// MEDIUM (32 bytes)
// 00000000  00000000  11111111  1111  1111
// 01234567  89abcdef  01234567  89ab  cdef
// key       hash      id        seq   date

// QUARTILE (58 bytes)
// 0000000000000000  1111111111111111  2222222222222222  3333  333333
// 0123456789abcdef  0123456789abcdef  0123456789abcdef  0123  456789
// key               hash              id                seq   date

// HIGH (106 bytes)
// 00000000000000001111111111111111  22222222222222223333333333333333
// 44444444444444445555555555555555  6666  666666
// 0123456789abcdef0123456789abcdef  0123456789abcdef0123456789abcdef
// 0123456789abcdef0123456789abcdef  0123  456789 key
// hash                              id                                seq
// date

/**
 * Resolution levels for provenance marks.
 * Higher resolution provides more security but larger mark sizes.
 */
export enum ProvenanceMarkResolution {
  Low = 0,
  Medium = 1,
  Quartile = 2,
  High = 3,
}

/**
 * Convert a resolution to its numeric value.
 */
export function resolutionToNumber(res: ProvenanceMarkResolution): number {
  return res as number;
}

/**
 * Create a resolution from a numeric value.
 */
export function resolutionFromNumber(value: number): ProvenanceMarkResolution {
  switch (value) {
    case 0:
      return ProvenanceMarkResolution.Low;
    case 1:
      return ProvenanceMarkResolution.Medium;
    case 2:
      return ProvenanceMarkResolution.Quartile;
    case 3:
      return ProvenanceMarkResolution.High;
    default:
      throw new ProvenanceMarkError(ProvenanceMarkErrorType.ResolutionError, undefined, {
        details: `invalid provenance mark resolution value: ${value}`,
      });
  }
}

/**
 * Get the link length (key/hash/chainID length) for a resolution.
 */
export function linkLength(res: ProvenanceMarkResolution): number {
  switch (res) {
    case ProvenanceMarkResolution.Low:
      return 4;
    case ProvenanceMarkResolution.Medium:
      return 8;
    case ProvenanceMarkResolution.Quartile:
      return 16;
    case ProvenanceMarkResolution.High:
      return 32;
  }
}

/**
 * Get the sequence bytes length for a resolution.
 */
export function seqBytesLength(res: ProvenanceMarkResolution): number {
  switch (res) {
    case ProvenanceMarkResolution.Low:
      return 2;
    case ProvenanceMarkResolution.Medium:
    case ProvenanceMarkResolution.Quartile:
    case ProvenanceMarkResolution.High:
      return 4;
  }
}

/**
 * Get the date bytes length for a resolution.
 */
export function dateBytesLength(res: ProvenanceMarkResolution): number {
  switch (res) {
    case ProvenanceMarkResolution.Low:
      return 2;
    case ProvenanceMarkResolution.Medium:
      return 4;
    case ProvenanceMarkResolution.Quartile:
    case ProvenanceMarkResolution.High:
      return 6;
  }
}

/**
 * Get the fixed-length portion size for a resolution.
 */
export function fixedLength(res: ProvenanceMarkResolution): number {
  return linkLength(res) * 3 + seqBytesLength(res) + dateBytesLength(res);
}

/**
 * Get the key range for a resolution.
 */
export function keyRange(res: ProvenanceMarkResolution): { start: number; end: number } {
  return { start: 0, end: linkLength(res) };
}

/**
 * Get the chain ID range for a resolution.
 */
export function chainIdRange(res: ProvenanceMarkResolution): { start: number; end: number } {
  return { start: 0, end: linkLength(res) };
}

/**
 * Get the hash range for a resolution.
 */
export function hashRange(res: ProvenanceMarkResolution): { start: number; end: number } {
  const chainIdEnd = chainIdRange(res).end;
  return { start: chainIdEnd, end: chainIdEnd + linkLength(res) };
}

/**
 * Get the sequence bytes range for a resolution.
 */
export function seqBytesRange(res: ProvenanceMarkResolution): { start: number; end: number } {
  const hashEnd = hashRange(res).end;
  return { start: hashEnd, end: hashEnd + seqBytesLength(res) };
}

/**
 * Get the date bytes range for a resolution.
 */
export function dateBytesRange(res: ProvenanceMarkResolution): { start: number; end: number } {
  const seqEnd = seqBytesRange(res).end;
  return { start: seqEnd, end: seqEnd + dateBytesLength(res) };
}

/**
 * Get the info range start for a resolution.
 */
export function infoRangeStart(res: ProvenanceMarkResolution): number {
  return dateBytesRange(res).end;
}

/**
 * Serialize a Date into bytes based on the resolution.
 */
export function serializeDate(res: ProvenanceMarkResolution, date: Date): Uint8Array {
  switch (res) {
    case ProvenanceMarkResolution.Low:
      return serialize2Bytes(date);
    case ProvenanceMarkResolution.Medium:
      return serialize4Bytes(date);
    case ProvenanceMarkResolution.Quartile:
    case ProvenanceMarkResolution.High:
      return serialize6Bytes(date);
  }
}

/**
 * Deserialize bytes into a Date based on the resolution.
 */
export function deserializeDate(res: ProvenanceMarkResolution, data: Uint8Array): Date {
  switch (res) {
    case ProvenanceMarkResolution.Low:
      if (data.length !== 2) {
        throw new ProvenanceMarkError(ProvenanceMarkErrorType.ResolutionError, undefined, {
          details: `invalid date length: expected 2 bytes, got ${data.length}`,
        });
      }
      return deserialize2Bytes(data);
    case ProvenanceMarkResolution.Medium:
      if (data.length !== 4) {
        throw new ProvenanceMarkError(ProvenanceMarkErrorType.ResolutionError, undefined, {
          details: `invalid date length: expected 4 bytes, got ${data.length}`,
        });
      }
      return deserialize4Bytes(data);
    case ProvenanceMarkResolution.Quartile:
    case ProvenanceMarkResolution.High:
      if (data.length !== 6) {
        throw new ProvenanceMarkError(ProvenanceMarkErrorType.ResolutionError, undefined, {
          details: `invalid date length: expected 6 bytes, got ${data.length}`,
        });
      }
      return deserialize6Bytes(data);
  }
}

/**
 * Serialize a sequence number into bytes based on the resolution.
 */
export function serializeSeq(res: ProvenanceMarkResolution, seq: number): Uint8Array {
  const len = seqBytesLength(res);
  if (len === 2) {
    if (seq > 0xffff) {
      throw new ProvenanceMarkError(ProvenanceMarkErrorType.ResolutionError, undefined, {
        details: `sequence number ${seq} out of range for 2-byte format (max ${0xffff})`,
      });
    }
    const buf = new Uint8Array(2);
    buf[0] = (seq >> 8) & 0xff;
    buf[1] = seq & 0xff;
    return buf;
  } else {
    const buf = new Uint8Array(4);
    buf[0] = (seq >> 24) & 0xff;
    buf[1] = (seq >> 16) & 0xff;
    buf[2] = (seq >> 8) & 0xff;
    buf[3] = seq & 0xff;
    return buf;
  }
}

/**
 * Deserialize bytes into a sequence number based on the resolution.
 */
export function deserializeSeq(res: ProvenanceMarkResolution, data: Uint8Array): number {
  const len = seqBytesLength(res);
  if (len === 2) {
    if (data.length !== 2) {
      throw new ProvenanceMarkError(ProvenanceMarkErrorType.ResolutionError, undefined, {
        details: `invalid sequence number length: expected 2 bytes, got ${data.length}`,
      });
    }
    return (data[0] << 8) | data[1];
  } else {
    if (data.length !== 4) {
      throw new ProvenanceMarkError(ProvenanceMarkErrorType.ResolutionError, undefined, {
        details: `invalid sequence number length: expected 4 bytes, got ${data.length}`,
      });
    }
    return ((data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3]) >>> 0;
  }
}

/**
 * Get the string representation of a resolution.
 */
export function resolutionToString(res: ProvenanceMarkResolution): string {
  switch (res) {
    case ProvenanceMarkResolution.Low:
      return "low";
    case ProvenanceMarkResolution.Medium:
      return "medium";
    case ProvenanceMarkResolution.Quartile:
      return "quartile";
    case ProvenanceMarkResolution.High:
      return "high";
  }
}

/**
 * Convert a resolution to CBOR.
 */
export function resolutionToCbor(res: ProvenanceMarkResolution): Cbor {
  return cbor(res as number);
}

/**
 * Create a resolution from CBOR.
 */
export function resolutionFromCbor(cborValue: Cbor): ProvenanceMarkResolution {
  const value = expectUnsigned(cborValue);
  return resolutionFromNumber(Number(value));
}
