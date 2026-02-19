/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

import {
  type Cbor,
  type CborNumber,
  MajorType,
  isCbor,
  encodeCbor,
  cborData,
  attachMethods,
} from "./cbor";
import { areBytesEqual } from "./stdlib";
import { binary16ToNumber, binary32ToNumber, binary64ToNumber } from "./float";
import { CborMap } from "./map";
import { CborError } from "./error";

export function decodeCbor(data: Uint8Array): Cbor {
  const { cbor, len } = decodeCborInternal(
    new DataView(data.buffer, data.byteOffset, data.byteLength),
  );
  const remaining = data.length - len;
  if (remaining !== 0) {
    throw new CborError({ type: "UnusedData", count: remaining });
  }
  return cbor;
}

function parseHeader(header: number): { majorType: MajorType; headerValue: number } {
  const majorType = (header >> 5) as MajorType;
  const headerValue = header & 31;
  return { majorType, headerValue };
}

function at(data: DataView, index: number): number {
  return data.getUint8(index);
}

function from(data: DataView, index: number): DataView {
  return new DataView(data.buffer, data.byteOffset + index);
}

function range(data: DataView, start: number, end: number): DataView {
  return new DataView(data.buffer, data.byteOffset + start, end - start);
}

function parseBytes(data: DataView, len: number): DataView {
  if (data.byteLength < len) {
    throw new CborError({ type: "Underrun" });
  }
  return range(data, 0, len);
}

function parseHeaderVarint(data: DataView): {
  majorType: MajorType;
  value: CborNumber;
  varIntLen: number;
} {
  if (data.byteLength < 1) {
    throw new CborError({ type: "Underrun" });
  }

  const header = at(data, 0);
  const { majorType, headerValue } = parseHeader(header);
  const dataRemaining = data.byteLength - 1;
  let value: CborNumber;
  let varIntLen: number;
  if (headerValue <= 23) {
    value = headerValue;
    varIntLen = 1;
  } else if (headerValue === 24) {
    if (dataRemaining < 1) {
      throw new CborError({ type: "Underrun" });
    }
    value = at(data, 1);
    if (value < 24) {
      throw new CborError({ type: "NonCanonicalNumeric" });
    }
    varIntLen = 2;
  } else if (headerValue === 25) {
    if (dataRemaining < 2) {
      throw new CborError({ type: "Underrun" });
    }
    value = ((at(data, 1) << 8) | at(data, 2)) >>> 0;
    // Floats with header 0xf9 are allowed to have values <= 0xFF
    if (value <= 0xff && header !== 0xf9) {
      throw new CborError({ type: "NonCanonicalNumeric" });
    }
    varIntLen = 3;
  } else if (headerValue === 26) {
    if (dataRemaining < 4) {
      throw new CborError({ type: "Underrun" });
    }
    value = ((at(data, 1) << 24) | (at(data, 2) << 16) | (at(data, 3) << 8) | at(data, 4)) >>> 0;
    // Floats with header 0xfa are allowed to have values <= 0xFFFF
    if (value <= 0xffff && header !== 0xfa) {
      throw new CborError({ type: "NonCanonicalNumeric" });
    }
    varIntLen = 5;
  } else if (headerValue === 27) {
    if (dataRemaining < 8) {
      throw new CborError({ type: "Underrun" });
    }
    const a = BigInt(at(data, 1)) << 56n;
    const b = BigInt(at(data, 2)) << 48n;
    const c = BigInt(at(data, 3)) << 40n;
    const d = BigInt(at(data, 4)) << 32n;
    const e = BigInt(at(data, 5)) << 24n;
    const f = BigInt(at(data, 6)) << 16n;
    const g = BigInt(at(data, 7)) << 8n;
    const h = BigInt(at(data, 8));
    value = a | b | c | d | e | f | g | h;
    if (value <= Number.MAX_SAFE_INTEGER) {
      value = Number(value);
    }
    // Floats with header 0xfb are allowed to have values <= 0xFFFFFFFF
    if (value <= 0xffffffff && header !== 0xfb) {
      throw new CborError({ type: "NonCanonicalNumeric" });
    }
    varIntLen = 9;
  } else {
    throw new CborError({ type: "UnsupportedHeaderValue", value: headerValue });
  }
  return { majorType, value, varIntLen };
}

function decodeCborInternal(data: DataView): { cbor: Cbor; len: number } {
  if (data.byteLength < 1) {
    throw new CborError({ type: "Underrun" });
  }
  const { majorType, value, varIntLen } = parseHeaderVarint(data);
  switch (majorType) {
    case MajorType.Unsigned: {
      const cborObj = { isCbor: true, type: MajorType.Unsigned, value: value } as const;
      const cbor = attachMethods(cborObj);
      const buf = new Uint8Array(data.buffer, data.byteOffset, varIntLen);
      checkCanonicalEncoding(cbor, buf);
      return { cbor, len: varIntLen };
    }
    case MajorType.Negative: {
      // Store the magnitude as-is, matching Rust's representation
      // The decoded value is what gets encoded (not the actual negative number)
      const cborObj = { isCbor: true, type: MajorType.Negative, value: value } as const;
      const cbor = attachMethods(cborObj);
      const buf = new Uint8Array(data.buffer, data.byteOffset, varIntLen);
      checkCanonicalEncoding(cbor, buf);
      return { cbor, len: varIntLen };
    }
    case MajorType.ByteString: {
      const dataLen = value;
      if (typeof dataLen === "bigint") {
        throw new CborError({ type: "OutOfRange" });
      }
      const buf = parseBytes(from(data, varIntLen), dataLen);
      const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      const cborObj = { isCbor: true, type: MajorType.ByteString, value: bytes } as const;
      return { cbor: attachMethods(cborObj), len: varIntLen + dataLen };
    }
    case MajorType.Text: {
      const textLen = value;
      if (typeof textLen === "bigint") {
        throw new CborError({ type: "OutOfRange" });
      }
      const textBuf = parseBytes(from(data, varIntLen), textLen);
      const text = new TextDecoder().decode(textBuf);
      // dCBOR requires all text strings to be in Unicode Normalization Form C (NFC)
      // Reject any strings that are not already in NFC form
      if (text.normalize("NFC") !== text) {
        throw new CborError({ type: "NonCanonicalString" });
      }
      const cborObj = { isCbor: true, type: MajorType.Text, value: text } as const;
      return { cbor: attachMethods(cborObj), len: varIntLen + textLen };
    }
    case MajorType.Array: {
      let pos = varIntLen;
      const items: Cbor[] = [];
      for (let i = 0; i < value; i++) {
        const { cbor: item, len: itemLen } = decodeCborInternal(from(data, pos));
        items.push(item);
        pos += itemLen;
      }
      const cborObj = { isCbor: true, type: MajorType.Array, value: items } as const;
      return { cbor: attachMethods(cborObj), len: pos };
    }
    case MajorType.Map: {
      let pos = varIntLen;
      const map = new CborMap();
      for (let i = 0; i < value; i++) {
        const { cbor: key, len: keyLen } = decodeCborInternal(from(data, pos));
        pos += keyLen;
        const { cbor: value, len: valueLen } = decodeCborInternal(from(data, pos));
        pos += valueLen;
        map.setNext(key, value);
      }
      const cborObj = { isCbor: true, type: MajorType.Map, value: map } as const;
      return { cbor: attachMethods(cborObj), len: pos };
    }
    case MajorType.Tagged: {
      const { cbor: item, len: itemLen } = decodeCborInternal(from(data, varIntLen));
      const cborObj = { isCbor: true, type: MajorType.Tagged, tag: value, value: item } as const;
      return { cbor: attachMethods(cborObj), len: varIntLen + itemLen };
    }
    case MajorType.Simple:
      switch (varIntLen) {
        case 3: {
          const f = binary16ToNumber(new Uint8Array(data.buffer, data.byteOffset + 1, 2));
          checkCanonicalEncoding(f, new Uint8Array(data.buffer, data.byteOffset, varIntLen));
          const cborObj = {
            isCbor: true,
            type: MajorType.Simple,
            value: { type: "Float", value: f },
          } as const;
          return { cbor: attachMethods(cborObj), len: varIntLen };
        }
        case 5: {
          const f = binary32ToNumber(new Uint8Array(data.buffer, data.byteOffset + 1, 4));
          checkCanonicalEncoding(f, new Uint8Array(data.buffer, data.byteOffset, varIntLen));
          const cborObj = {
            isCbor: true,
            type: MajorType.Simple,
            value: { type: "Float", value: f },
          } as const;
          return { cbor: attachMethods(cborObj), len: varIntLen };
        }
        case 9: {
          const f = binary64ToNumber(new Uint8Array(data.buffer, data.byteOffset + 1, 8));
          checkCanonicalEncoding(f, new Uint8Array(data.buffer, data.byteOffset, varIntLen));
          const cborObj = {
            isCbor: true,
            type: MajorType.Simple,
            value: { type: "Float", value: f },
          } as const;
          return { cbor: attachMethods(cborObj), len: varIntLen };
        }
        default:
          switch (value) {
            case 20:
              return {
                cbor: attachMethods({
                  isCbor: true,
                  type: MajorType.Simple,
                  value: { type: "False" },
                }),
                len: varIntLen,
              };
            case 21:
              return {
                cbor: attachMethods({
                  isCbor: true,
                  type: MajorType.Simple,
                  value: { type: "True" },
                }),
                len: varIntLen,
              };
            case 22:
              return {
                cbor: attachMethods({
                  isCbor: true,
                  type: MajorType.Simple,
                  value: { type: "Null" },
                }),
                len: varIntLen,
              };
            default:
              // Per dCBOR spec, only false/true/null/floats are valid
              throw new CborError({ type: "InvalidSimpleValue" });
          }
      }
  }
}

function checkCanonicalEncoding(cbor: Cbor | CborNumber, buf: Uint8Array): void {
  // If it's already a CBOR object, encode it directly
  // Otherwise treat it as a native value (for floats, etc.)
  const buf2 = isCbor(cbor) ? cborData(cbor) : encodeCbor(cbor);
  if (!areBytesEqual(buf, buf2)) {
    throw new CborError({ type: "NonCanonicalNumeric" });
  }
}
