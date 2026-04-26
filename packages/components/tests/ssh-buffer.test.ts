import { describe, it, expect } from "vitest";
import {
  SshBufferReader,
  SshBufferWriter,
  stripMpintSignByte,
  padLeftToLength,
} from "../src/ssh/internal/ssh-buffer.js";

const hex = (s: string): Uint8Array => {
  const clean = s.replace(/\s+/g, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
};

describe("SshBuffer wire-format primitives (RFC 4251 §5)", () => {
  it("uint32 round-trip across boundary values", () => {
    for (const v of [0, 1, 0xff, 0x100, 0x12345678, 0xffffffff]) {
      const bytes = new SshBufferWriter().writeUint32(v).bytes();
      expect(bytes.length).toBe(4);
      const back = new SshBufferReader(bytes).readUint32();
      expect(back).toBe(v);
    }
  });

  it("uint32 rejects out-of-range and non-integer", () => {
    const w = new SshBufferWriter();
    expect(() => w.writeUint32(-1)).toThrow();
    expect(() => w.writeUint32(0x100000000)).toThrow();
    expect(() => w.writeUint32(1.5)).toThrow();
  });

  it("byte / boolean round-trip", () => {
    const bytes = new SshBufferWriter()
      .writeBoolean(true)
      .writeBoolean(false)
      .writeByte(0xab)
      .bytes();
    expect(bytes).toEqual(new Uint8Array([0x01, 0x00, 0xab]));
    const r = new SshBufferReader(bytes);
    expect(r.readBoolean()).toBe(true);
    expect(r.readBoolean()).toBe(false);
    expect(r.readByte()).toBe(0xab);
    expect(r.isAtEnd()).toBe(true);
  });

  it("string round-trip empty and short", () => {
    const w = new SshBufferWriter();
    w.writeString(new Uint8Array(0));
    w.writeString(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
    const bytes = w.bytes();
    expect(bytes).toEqual(hex("00000000 00000004 deadbeef"));
    const r = new SshBufferReader(bytes);
    expect(r.readString()).toEqual(new Uint8Array(0));
    expect(r.readString()).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
  });

  it("UTF-8 string round-trip with ssh-ed25519 algorithm name", () => {
    const w = new SshBufferWriter();
    w.writeStringUtf8("ssh-ed25519");
    const bytes = w.bytes();
    // 0x0b = 11 bytes
    expect(bytes).toEqual(hex("0000000b 7373682d65643235353139"));
    const r = new SshBufferReader(bytes);
    expect(r.readStringUtf8()).toBe("ssh-ed25519");
  });

  it("mpint encodes zero as empty string", () => {
    const bytes = new SshBufferWriter().writeMpintUnsigned(new Uint8Array(0)).bytes();
    expect(bytes).toEqual(hex("00000000"));
    const bytesAlt = new SshBufferWriter().writeMpintUnsigned(new Uint8Array([0, 0, 0])).bytes();
    expect(bytesAlt).toEqual(hex("00000000"));
  });

  it("mpint adds 0x00 sign byte when MSB high (RFC 4251 example: 0x80)", () => {
    const bytes = new SshBufferWriter().writeMpintUnsigned(new Uint8Array([0x80])).bytes();
    expect(bytes).toEqual(hex("00000002 0080"));
  });

  it("mpint omits sign byte when MSB low (RFC 4251 example: 0x9a378f9b2e332a7)", () => {
    const bytes = new SshBufferWriter().writeMpintUnsigned(hex("09 a3 78 f9 b2 e3 32 a7")).bytes();
    expect(bytes).toEqual(hex("00000008 09a378f9b2e332a7"));
  });

  it("mpint strips leading zeros on encode", () => {
    const bytes = new SshBufferWriter().writeMpintUnsigned(hex("00 00 12 34")).bytes();
    expect(bytes).toEqual(hex("00000002 1234"));
  });

  it("name-list round-trip (empty, single, multi)", () => {
    const cases: [string[], string][] = [
      [[], "00000000"],
      [["zlib"], "00000004 7a6c6962"],
      [["zlib", "none"], "00000009 7a6c69622c6e6f6e65"],
    ];
    for (const [names, expected] of cases) {
      const w = new SshBufferWriter();
      w.writeNameList(names);
      const bytes = w.bytes();
      expect(bytes).toEqual(hex(expected));
      const r = new SshBufferReader(bytes);
      expect(r.readNameList()).toEqual(names);
    }
  });

  it("strip / pad helpers round-trip", () => {
    expect(stripMpintSignByte(hex("00 80"))).toEqual(hex("80"));
    expect(stripMpintSignByte(hex("80"))).toEqual(hex("80"));
    expect(stripMpintSignByte(new Uint8Array(0))).toEqual(new Uint8Array(0));

    expect(padLeftToLength(hex("12 34"), 4)).toEqual(hex("00 00 12 34"));
    expect(padLeftToLength(hex("12 34 56 78"), 4)).toEqual(hex("12 34 56 78"));
    expect(() => padLeftToLength(hex("12 34 56 78 9a"), 4)).toThrow();
  });

  it("reader complains on truncated input", () => {
    expect(() => new SshBufferReader(new Uint8Array([0, 0, 0])).readUint32()).toThrow();
    expect(() => new SshBufferReader(hex("00 00 00 04 ab cd")).readString()).toThrow();
  });
});
