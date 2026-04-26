/**
 * Copyright © 2025-2026 Parity Technologies
 *
 * RFC 4251/4253 length-prefixed wire format primitives used by every OpenSSH
 * binary blob (key bodies, signature blobs, SSHSIG, etc.).
 *
 * Mirrors what Rust's `ssh-encoding` crate (transitive dep of `ssh-key`)
 * produces byte-for-byte, so encodes here round-trip with bytes Rust emits.
 *
 * Spec references:
 *  - RFC 4251 §5  (data types: byte, boolean, uint32, uint64, string, mpint,
 *    name-list)
 *  - RFC 4253 §6.6 (key/signature framing uses the same primitives)
 */
const MAX_UINT32 = 0xffffffff;

export class SshBufferReader {
  private readonly view: DataView;
  private offset: number;

  constructor(public readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.offset = 0;
  }

  position(): number {
    return this.offset;
  }

  remaining(): number {
    return this.bytes.length - this.offset;
  }

  isAtEnd(): boolean {
    return this.offset >= this.bytes.length;
  }

  private requireBytes(n: number, what: string): void {
    if (this.offset + n > this.bytes.length) {
      throw new Error(
        `SshBuffer: not enough bytes for ${what} (need ${n}, have ${this.bytes.length - this.offset})`,
      );
    }
  }

  readByte(): number {
    this.requireBytes(1, "byte");
    return this.bytes[this.offset++];
  }

  readBoolean(): boolean {
    return this.readByte() !== 0;
  }

  readUint32(): number {
    this.requireBytes(4, "uint32");
    const v = this.view.getUint32(this.offset, false);
    this.offset += 4;
    return v;
  }

  /** Read a length-prefixed string as raw bytes (no UTF-8 decoding). */
  readString(): Uint8Array {
    const len = this.readUint32();
    this.requireBytes(len, "string body");
    const start = this.bytes.byteOffset + this.offset;
    const slice = new Uint8Array(this.bytes.buffer.slice(start, start + len));
    this.offset += len;
    return slice;
  }

  /** Read a length-prefixed string as UTF-8 text. */
  readStringUtf8(): string {
    return new TextDecoder("utf-8", { fatal: true }).decode(this.readString());
  }

  /**
   * Read an `mpint` (RFC 4251 §5) — two's-complement big-endian integer with
   * optional 0x00 sign byte. We surface the raw bytes verbatim so callers can
   * decide how to strip the sign byte for unsigned coordinate values.
   */
  readMpint(): Uint8Array {
    return this.readString();
  }

  /** Read a name-list (RFC 4251 §5) — a string of comma-separated US-ASCII names. */
  readNameList(): string[] {
    const text = this.readStringUtf8();
    return text.length === 0 ? [] : text.split(",");
  }
}

export class SshBufferWriter {
  private readonly chunks: Uint8Array[] = [];
  private size = 0;

  writeByte(b: number): this {
    if (b < 0 || b > 0xff || !Number.isInteger(b)) {
      throw new Error(`SshBuffer: byte out of range: ${b}`);
    }
    const buf = new Uint8Array(1);
    buf[0] = b;
    this.chunks.push(buf);
    this.size += 1;
    return this;
  }

  writeBoolean(v: boolean): this {
    return this.writeByte(v ? 1 : 0);
  }

  writeUint32(v: number): this {
    if (v < 0 || v > MAX_UINT32 || !Number.isInteger(v)) {
      throw new Error(`SshBuffer: uint32 out of range: ${v}`);
    }
    const buf = new Uint8Array(4);
    new DataView(buf.buffer).setUint32(0, v, false);
    this.chunks.push(buf);
    this.size += 4;
    return this;
  }

  /** Write a length-prefixed byte string. */
  writeString(bytes: Uint8Array): this {
    this.writeUint32(bytes.length);
    this.chunks.push(bytes);
    this.size += bytes.length;
    return this;
  }

  /** Write a length-prefixed UTF-8 string. */
  writeStringUtf8(text: string): this {
    return this.writeString(new TextEncoder().encode(text));
  }

  /**
   * Write an `mpint` (RFC 4251 §5).
   *
   * Two's complement big-endian. For *positive* values (which is all we
   * handle — EC coordinates, SSH public-key parameters), if the most
   * significant byte has the high bit set, a leading 0x00 must be added so
   * the value is not interpreted as negative. Leading zeros are otherwise
   * stripped. Zero is encoded as an empty string (length 0).
   */
  writeMpintUnsigned(bytes: Uint8Array): this {
    let start = 0;
    while (start < bytes.length && bytes[start] === 0) start++;
    if (start === bytes.length) {
      // value is zero
      return this.writeString(new Uint8Array(0));
    }
    const head = bytes[start];
    const needsSignByte = (head & 0x80) !== 0;
    const len = bytes.length - start + (needsSignByte ? 1 : 0);
    const out = new Uint8Array(len);
    if (needsSignByte) {
      out[0] = 0x00;
      out.set(bytes.subarray(start), 1);
    } else {
      out.set(bytes.subarray(start), 0);
    }
    return this.writeString(out);
  }

  writeNameList(names: string[]): this {
    return this.writeStringUtf8(names.join(","));
  }

  /** Append a raw blob without length-prefixing it. */
  writeRaw(bytes: Uint8Array): this {
    this.chunks.push(bytes);
    this.size += bytes.length;
    return this;
  }

  bytes(): Uint8Array {
    const out = new Uint8Array(this.size);
    let pos = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, pos);
      pos += chunk.length;
    }
    return out;
  }
}

/**
 * Strip an optional leading 0x00 sign byte from an unsigned mpint.
 *
 * RFC 4251 §5 mpints are two's-complement, so positive values whose
 * MSB is set carry a leading 0x00. EC curve coordinate bytes never need
 * the sign byte once stripped.
 */
export function stripMpintSignByte(bytes: Uint8Array): Uint8Array {
  if (bytes.length > 0 && bytes[0] === 0x00) {
    return bytes.subarray(1);
  }
  return bytes;
}

/**
 * Pad an unsigned big-endian byte sequence to an exact length, throwing
 * if the input is longer than `len`. Used for fixed-width EC coordinates.
 */
export function padLeftToLength(bytes: Uint8Array, len: number): Uint8Array {
  if (bytes.length === len) return bytes;
  if (bytes.length > len) {
    throw new Error(`padLeftToLength: input ${bytes.length} > target ${len}`);
  }
  const out = new Uint8Array(len);
  out.set(bytes, len - bytes.length);
  return out;
}
