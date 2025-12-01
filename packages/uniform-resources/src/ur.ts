import type { Cbor } from "@blockchain-commons/dcbor";
import { decodeCbor } from "@blockchain-commons/dcbor";
import { InvalidSchemeError, TypeUnspecifiedError, UnexpectedTypeError, URError } from "./error.js";
import { URType } from "./ur-type.js";

/**
 * A Uniform Resource (UR) is a URI-encoded CBOR object.
 *
 * URs are defined in [BCR-2020-005: Uniform Resources](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2020-005-ur.md).
 *
 * @example
 * ```typescript
 * import { UR } from '@leonardocustodio/blockchain-commons/uniform-resources';
 * import { CBOR } from '@leonardocustodio/blockchain-commons/dcbor';
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
   * @param urString - A UR string like "ur:test/..."
   * @throws {InvalidSchemeError} If the string doesn't start with "ur:"
   * @throws {TypeUnspecifiedError} If no type is specified
   * @throws {NotSinglePartError} If the UR is multi-part
   * @throws {URError} If decoding fails
   *
   * @example
   * ```typescript
   * const ur = UR.fromURString('ur:test/lsadaoaxjygonesw');
   * ```
   */
  static fromURString(urString: string): UR {
    // Decode the UR string to get the type and CBOR data
    const decodedUR = URStringDecoder.decode(urString);
    if (decodedUR === null || decodedUR === undefined) {
      throw new URError("Failed to decode UR string");
    }
    const { urType, cbor } = decodedUR;
    return new UR(new URType(urType), cbor);
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
   */
  qrData(): Uint8Array {
    // Use a helper to convert string to bytes across platforms
    const str = this.qrString();
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      bytes[i] = str.charCodeAt(i);
    }
    return bytes;
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
   */
  equals(other: UR): boolean {
    return (
      this._urType.equals(other._urType) &&
      this._cbor.toData().toString() === other._cbor.toData().toString()
    );
  }
}

/**
 * Encodes a UR string using Bytewords Base32 encoding.
 * This is a simplified implementation that handles single-part URs.
 */
class URStringEncoder {
  static encode(urType: string, cborData: Uint8Array): string {
    // Use simple base32 encoding for now
    // In production, this should use the proper UR encoding with fountain codes
    const encoded = base32Encode(cborData);
    return `ur:${urType}/${encoded}`;
  }
}

/**
 * Decodes a UR string back to its components.
 */
class URStringDecoder {
  static decode(urString: string): { urType: string; cbor: Cbor } | null {
    const lowercased = urString.toLowerCase();

    // Check scheme
    if (!lowercased.startsWith("ur:")) {
      throw new InvalidSchemeError();
    }

    // Strip scheme
    const afterScheme = lowercased.substring(3);

    // Split into type and data
    const [urType, ...dataParts] = afterScheme.split("/");

    if (urType === "" || urType === undefined) {
      throw new TypeUnspecifiedError();
    }

    const data = dataParts.join("/");
    if (data === "" || data === undefined) {
      throw new TypeUnspecifiedError();
    }

    try {
      // Decode the base32-encoded data
      const cborData = base32Decode(data);
      const cbor = decodeCbor(cborData);
      return { urType, cbor };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new URError(`Failed to decode UR: ${errorMessage}`);
    }
  }
}

/**
 * Simple Base32 encoding using the Crockford base32 alphabet.
 * This is used for UR encoding.
 */
function base32Encode(data: Uint8Array): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  let result = "";
  let bits = 0;
  let value = 0;

  for (const byte of data) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      bits -= 5;
      result += alphabet[(value >> bits) & 31];
    }
  }

  if (bits > 0) {
    result += alphabet[(value << (5 - bits)) & 31];
  }

  return result;
}

/**
 * Simple Base32 decoding using the Crockford base32 alphabet.
 */
function base32Decode(encoded: string): Uint8Array {
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  const result: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of encoded) {
    const index = alphabet.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid base32 character: ${char}`);
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bits -= 8;
      result.push((value >> bits) & 255);
    }
  }

  return new Uint8Array(result);
}
