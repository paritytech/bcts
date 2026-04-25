/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

import type { Cbor } from "@bcts/dcbor";
import { decodeCbor } from "@bcts/dcbor";
import {
  BytewordsError,
  CBORError,
  InvalidSchemeError,
  NotSinglePartError,
  TypeUnspecifiedError,
  UnexpectedTypeError,
  URDecodeError,
} from "./error.js";
import { URType } from "./ur-type.js";
import { encodeBytewords, decodeBytewords, BytewordsStyle } from "./utils.js";

/**
 * A Uniform Resource (UR) is a URI-encoded CBOR object.
 *
 * URs are defined in [BCR-2020-005: Uniform Resources](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2020-005-ur.md).
 *
 * @example
 * ```typescript
 * import { UR } from '@bcts/uniform-resources';
 * import { CBOR } from '@bcts/dcbor';
 *
 * // Create a UR from a CBOR object
 * const cbor = CBOR.fromArray([1, 2, 3]);
 * const ur = UR.new('test', cbor);
 *
 * // Encode to string
 * const urString = ur.string();
 * console.log(urString); // "ur:test/..."
 *
 * // Decode from string
 * const decodedUR = UR.fromURString(urString);
 * console.log(decodedUR.urTypeStr()); // "test"
 * ```
 */
export class UR {
  private readonly _urType: URType;
  private readonly _cbor: Cbor;

  /**
   * Creates a new UR from the provided type and CBOR data.
   *
   * @param urType - The UR type (will be validated)
   * @param cbor - The CBOR data to encode
   * @throws {InvalidTypeError} If the type is invalid
   *
   * @example
   * ```typescript
   * const ur = UR.new('bytes', CBOR.fromString('hello'));
   * ```
   */
  static new(urType: string | URType, cbor: Cbor): UR {
    const type = typeof urType === "string" ? new URType(urType) : urType;
    return new UR(type, cbor);
  }

  /**
   * Creates a new UR from a UR string.
   *
   * Mirrors Rust's `UR::from_ur_string` (`bc-ur-rust/src/ur.rs:25-38`):
   * 1. lowercase the entire string.
   * 2. strip the `"ur:"` prefix → {@link InvalidSchemeError} if absent.
   * 3. split on the first `/` → {@link TypeUnspecifiedError} if absent.
   * 4. validate the type via {@link URType} → {@link InvalidTypeError}.
   * 5. delegate the data section to the upstream-style decoder, which
   *    classifies the UR as single- or multi-part. Multi-part input is
   *    rejected with {@link NotSinglePartError}.
   * 6. decode the bytewords payload (CRC32 + minimal mapping) →
   *    {@link BytewordsError} on failure.
   * 7. parse the resulting bytes as CBOR → {@link CBORError} on failure.
   *
   * @param urString - A UR string like "ur:test/..."
   * @throws {InvalidSchemeError} If the string doesn't start with "ur:"
   * @throws {TypeUnspecifiedError} If no `/` separator is present
   * @throws {InvalidTypeError} If the type contains invalid characters
   * @throws {NotSinglePartError} If the UR is multi-part
   * @throws {URDecodeError} For upstream-decoder errors (invalid indices, etc.)
   * @throws {BytewordsError} If bytewords decoding fails
   * @throws {CBORError} If CBOR parsing fails
   *
   * @example
   * ```typescript
   * const ur = UR.fromURString('ur:test/lsadaoaxjygonesw');
   * ```
   */
  static fromURString(urString: string): UR {
    const { urType, cbor } = URStringDecoder.decode(urString);
    return new UR(urType, cbor);
  }

  private constructor(urType: URType, cbor: Cbor) {
    this._urType = urType;
    this._cbor = cbor;
  }

  /**
   * Returns the UR type.
   */
  urType(): URType {
    return this._urType;
  }

  /**
   * Returns the UR type as a string.
   */
  urTypeStr(): string {
    return this._urType.string();
  }

  /**
   * Returns the CBOR data.
   */
  cbor(): Cbor {
    return this._cbor;
  }

  /**
   * Returns the string representation of the UR (lowercase, suitable for display).
   *
   * @example
   * ```typescript
   * const ur = UR.new('test', CBOR.fromArray([1, 2, 3]));
   * console.log(ur.string()); // "ur:test/lsadaoaxjygonesw"
   * ```
   */
  string(): string {
    const cborData = this._cbor.toData();
    return URStringEncoder.encode(this._urType.string(), cborData);
  }

  /**
   * Returns the QR string representation (uppercase, most efficient for QR codes).
   */
  qrString(): string {
    return this.string().toUpperCase();
  }

  /**
   * Returns the QR data as bytes (uppercase UR string as UTF-8).
   *
   * Mirrors Rust's `UR::qr_data` (`ur.rs:52`) which does
   * `self.qr_string().as_bytes().to_vec()` — the string's UTF-8 byte
   * representation. We use `TextEncoder` rather than per-codepoint
   * truncation so the behaviour stays correct if the QR string ever
   * contains non-ASCII characters.
   */
  qrData(): Uint8Array {
    return new TextEncoder().encode(this.qrString());
  }

  /**
   * Checks if the UR type matches the expected type.
   *
   * @param expectedType - The expected type
   * @throws {UnexpectedTypeError} If the types don't match
   */
  checkType(expectedType: string | URType): void {
    const expected = typeof expectedType === "string" ? new URType(expectedType) : expectedType;
    if (!this._urType.equals(expected)) {
      throw new UnexpectedTypeError(expected.string(), this._urType.string());
    }
  }

  /**
   * Returns the string representation.
   */
  toString(): string {
    return this.string();
  }

  /**
   * Checks equality with another UR.
   *
   * Mirrors Rust's derived `PartialEq for UR` which compares the inner
   * `ur_type` and the inner `cbor` field directly. We compare CBOR
   * bytewise — `Uint8Array` equality, not `Array#toString` (which would
   * coerce to a comma-joined string and could collide on pathological
   * inputs).
   */
  equals(other: UR): boolean {
    if (!this._urType.equals(other._urType)) return false;
    const a = this._cbor.toData();
    const b = other._cbor.toData();
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
}

/**
 * Encodes a UR string using Bytewords minimal encoding.
 * This handles single-part URs according to BCR-2020-005.
 */
class URStringEncoder {
  static encode(urType: string, cborData: Uint8Array): string {
    // Encode CBOR data using bytewords minimal style (with CRC32 checksum)
    const encoded = encodeBytewords(cborData, BytewordsStyle.Minimal);
    return `ur:${urType}/${encoded}`;
  }
}

/**
 * Decodes a UR string back to its components.
 *
 * Mirrors the validation pipeline of Rust's `UR::from_ur_string`
 * (`bc-ur-rust/src/ur.rs:25-38`) plus the upstream `ur::decode`
 * (`ur-0.4.1/src/ur.rs:238-266`):
 *
 *   1. lowercase
 *   2. strip `"ur:"`               → {@link InvalidSchemeError}
 *   3. find `/`                     → {@link TypeUnspecifiedError}
 *   4. validate the type            → {@link InvalidTypeError}
 *   5. classify single- vs multi-part by looking at the data section
 *   6. multi-part                   → {@link NotSinglePartError}
 *   7. invalid multi-part indices   → {@link URDecodeError("Invalid indices")}
 *   8. minimal bytewords decode     → {@link BytewordsError}
 *   9. CBOR parse                   → {@link CBORError}
 */
class URStringDecoder {
  static decode(urString: string): { urType: URType; cbor: Cbor } {
    const lowercased = urString.toLowerCase();

    // Step 2: strip the scheme.
    if (!lowercased.startsWith("ur:")) {
      throw new InvalidSchemeError();
    }
    const afterScheme = lowercased.substring(3);

    // Step 3: locate the first `/`. Matches Rust's `split_once('/')`.
    const slashIdx = afterScheme.indexOf("/");
    if (slashIdx === -1) {
      throw new TypeUnspecifiedError();
    }
    const typeStr = afterScheme.substring(0, slashIdx);
    const dataSection = afterScheme.substring(slashIdx + 1);

    // Step 4: validate the type *before* any bytewords/CBOR work, so that a
    // malformed payload with an invalid type surfaces InvalidTypeError
    // rather than a downstream BytewordsError. Mirrors `ur.rs:31`.
    const urType = new URType(typeStr);

    // Step 5/6/7: classify the data section, the way `ur::decode` does
    // (`ur-0.4.1/src/ur.rs:249-265`). If the data section contains a `/`,
    // the prefix is the multi-part `<seqNum>-<seqLen>` indices.
    const lastSlash = dataSection.lastIndexOf("/");
    if (lastSlash !== -1) {
      const indices = dataSection.substring(0, lastSlash);
      const dashIdx = indices.indexOf("-");
      if (dashIdx === -1) {
        throw new URDecodeError("Invalid indices");
      }
      const seqNumStr = indices.substring(0, dashIdx);
      const seqLenStr = indices.substring(dashIdx + 1);
      // Rust uses `parse::<u16>()`; accept non-empty strings of digits only.
      // (parseInt on `"1a"` returns 1, so we have to be strict about chars.)
      if (!/^\d+$/.test(seqNumStr) || !/^\d+$/.test(seqLenStr)) {
        throw new URDecodeError("Invalid indices");
      }
      const seqNum = Number(seqNumStr);
      const seqLen = Number(seqLenStr);
      if (seqNum > 0xffff || seqLen > 0xffff) {
        throw new URDecodeError("Invalid indices");
      }
      // Successfully parsed as multi-part — but `from_ur_string` only
      // accepts single-part input. Mirrors `ur.rs:33-35`.
      throw new NotSinglePartError();
    }

    // Step 8: minimal bytewords decode (CRC32 + minimal mapping).
    let cborData: Uint8Array;
    try {
      cborData = decodeBytewords(dataSection, BytewordsStyle.Minimal);
    } catch (error) {
      if (error instanceof BytewordsError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new BytewordsError(message);
    }

    // Step 9: CBOR parse.
    let cbor: Cbor;
    try {
      cbor = decodeCbor(cborData);
    } catch (error) {
      if (error instanceof CBORError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new CBORError(message);
    }

    return { urType, cbor };
  }
}
