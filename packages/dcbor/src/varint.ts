/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

import { type CborNumber, isCborNumber, type MajorType } from "./cbor";
import { hasFractionalPart } from "./float";
import { CborError } from "./error";

const typeBits = (t: MajorType): number => {
  return t << 5;
};

export const encodeVarInt = (value: CborNumber, majorType: MajorType): Uint8Array => {
  // throw an error if the value is negative.
  if (value < 0) {
    throw new CborError({ type: "OutOfRange" });
  }
  // throw an error if the value is a number with a fractional part.
  if (typeof value === "number" && hasFractionalPart(value)) {
    throw new CborError({ type: "OutOfRange" });
  }
  const type = typeBits(majorType);
  // If the value is a `number` or a `bigint` that can be represented as a `number`, convert it to a `number`.
  if (isCborNumber(value) && value <= Number.MAX_SAFE_INTEGER) {
    value = Number(value);
    if (value <= 23) {
      return new Uint8Array([value | type]);
    } else if (value <= 0xff) {
      // Fits in UInt8
      return new Uint8Array([0x18 | type, value]);
    } else if (value <= 0xffff) {
      // Fits in UInt16
      const buffer = new ArrayBuffer(3);
      const view = new DataView(buffer);
      view.setUint8(0, 0x19 | type);
      view.setUint16(1, value);
      return new Uint8Array(buffer);
    } else if (value <= 0xffffffff) {
      // Fits in UInt32
      const buffer = new ArrayBuffer(5);
      const view = new DataView(buffer);
      view.setUint8(0, 0x1a | type);
      view.setUint32(1, value);
      return new Uint8Array(buffer);
    } else {
      // Fits in MAX_SAFE_INTEGER
      const buffer = new ArrayBuffer(9);
      const view = new DataView(buffer);
      view.setUint8(0, 0x1b | type);
      view.setBigUint64(1, BigInt(value));
      return new Uint8Array(buffer);
    }
  } else {
    value = BigInt(value);
    const bitsNeeded = Math.ceil(Math.log2(Number(value)) / 8) * 8;
    if (bitsNeeded > 64) {
      throw new CborError({ type: "OutOfRange" });
    }
    const length = Math.ceil(bitsNeeded / 8) + 1;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    let i = length - 1;
    while (value > 0) {
      view.setUint8(i, Number(value & 0xffn));
      value >>= 8n;
      i--;
    }
    view.setUint8(0, 0x1b | type);
    return new Uint8Array(buffer);
  }
};

export const decodeVarIntData = (
  dataView: DataView,
  offset: number,
): { majorType: MajorType; value: CborNumber; offset: number } => {
  const initialByte = dataView.getUint8(offset);
  const majorType = (initialByte >> 5) as MajorType;
  const additionalInfo = initialByte & 0x1f;
  let value: CborNumber;
  offset += 1;
  switch (additionalInfo) {
    case 24: // 1-byte additional info
      value = dataView.getUint8(offset);
      offset += 1;
      break;
    case 25: // 2-byte additional info
      value = ((dataView.getUint8(offset) << 8) | dataView.getUint8(offset + 1)) >>> 0;
      offset += 2;
      break;
    case 26: // 4-byte additional info
      value =
        ((dataView.getUint8(offset) << 24) |
          (dataView.getUint8(offset + 1) << 16) |
          (dataView.getUint8(offset + 2) << 8) |
          dataView.getUint8(offset + 3)) >>>
        0;
      offset += 4;
      break;
    case 27: // 8-byte additional info
      value = getUint64(dataView, offset, false);
      if (value <= Number.MAX_SAFE_INTEGER) {
        value = Number(value);
      }
      offset += 8;
      break;
    default: // no additional info
      value = additionalInfo;
      break;
  }
  return { majorType, value, offset };
};

export const decodeVarInt = (
  data: Uint8Array,
): { majorType: MajorType; value: CborNumber; offset: number } => {
  return decodeVarIntData(new DataView(data.buffer, data.byteOffset, data.byteLength), 0);
};

function getUint64(view: DataView, byteOffset: number, littleEndian: boolean): bigint {
  const lowWord = littleEndian
    ? view.getUint32(byteOffset, true)
    : view.getUint32(byteOffset + 4, false);
  const highWord = littleEndian
    ? view.getUint32(byteOffset + 4, true)
    : view.getUint32(byteOffset, false);
  return (BigInt(highWord) << BigInt(32)) + BigInt(lowWord);
}
