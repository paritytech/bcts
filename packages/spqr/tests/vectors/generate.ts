/**
 * Generate cross-implementation wire-format test vectors for SPQR V1 messages.
 *
 * Run: bun tests/vectors/generate.ts
 *
 * Produces:
 *   tests/vectors/wire-format-v1.json   -- all vectors with hex bytes
 *   tests/vectors/*.bin                  -- raw binary files for each vector
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  serializeMessage,
  deserializeMessage,
  encodeVarint,
  encodeChunk,
} from "../../src/v1/chunked/message.js";
import type { Message, MessagePayload } from "../../src/v1/chunked/states.js";
import type { Chunk } from "../../src/encoding/polynomial.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toHex(buf: Uint8Array): string {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function makeChunk(index: number, fill: number): Chunk {
  const data = new Uint8Array(32);
  data.fill(fill);
  return { index, data };
}

function makeSequentialChunk(index: number): Chunk {
  const data = new Uint8Array(32);
  for (let i = 0; i < 32; i++) data[i] = i;
  return { index, data };
}

interface TestVector {
  name: string;
  description: string;
  epoch: string; // bigint as decimal string
  index: number;
  payload: {
    type: string;
    chunk_index?: number;
    chunk_data_hex?: string;
  };
  bytes_hex: string;
  bytes_length: number;
  // Annotated byte layout for human review
  layout: string;
}

// ---------------------------------------------------------------------------
// Varint helper for layout annotation
// ---------------------------------------------------------------------------

function varintHex(value: bigint): string {
  const out: number[] = [];
  encodeVarint(value, out);
  return out.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function varint32Hex(value: number): string {
  // Use encodeVarint with bigint since encodeVarint32 is not exported
  const out: number[] = [];
  encodeVarint(BigInt(value >>> 0), out);
  return out.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function _chunkHex(chunk: Chunk): string {
  const out: number[] = [];
  encodeChunk(chunk, out);
  return out.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Vector definitions
// ---------------------------------------------------------------------------

const vectors: TestVector[] = [];

function addVector(
  name: string,
  description: string,
  epoch: bigint,
  index: number,
  payload: MessagePayload,
) {
  const msg: Message = { epoch, payload };
  const bytes = serializeMessage(msg, index);

  // Verify round-trip
  const { msg: decoded, index: decodedIndex, bytesRead } = deserializeMessage(bytes);
  if (decodedIndex !== index) {
    throw new Error(`${name}: index mismatch ${decodedIndex} !== ${index}`);
  }
  if (decoded.epoch !== epoch) {
    throw new Error(`${name}: epoch mismatch ${decoded.epoch} !== ${epoch}`);
  }
  if (decoded.payload.type !== payload.type) {
    throw new Error(`${name}: type mismatch ${decoded.payload.type} !== ${payload.type}`);
  }
  if (bytesRead !== bytes.length) {
    throw new Error(`${name}: bytesRead mismatch ${bytesRead} !== ${bytes.length}`);
  }

  // Build layout annotation
  const epochHex = varintHex(epoch);
  const indexHex = varint32Hex(index);
  const msgTypeNames: Record<string, [number, string]> = {
    none: [0x00, "None"],
    hdr: [0x01, "Hdr"],
    ek: [0x02, "Ek"],
    ekCt1Ack: [0x03, "EkCt1Ack"],
    ct1Ack: [0x04, "Ct1Ack"],
    ct1: [0x05, "Ct1"],
    ct2: [0x06, "Ct2"],
  };
  const entry = msgTypeNames[payload.type];
  if (entry === undefined) throw new Error(`Unknown payload type: ${payload.type}`);
  const [typeCode, typeName] = entry;

  let layout = `[01:version] [${epochHex}:epoch=${epoch}] [${indexHex}:index=${index}] [${typeCode.toString(16).padStart(2, "0")}:${typeName}]`;

  if ("chunk" in payload) {
    const ch = (payload as { chunk: Chunk }).chunk;
    layout += ` [${varint32Hex(ch.index)}:chunk_idx=${ch.index}] [${toHex(ch.data)}:chunk_data(32)]`;
  }

  const payloadObj: TestVector["payload"] = { type: payload.type };
  if ("chunk" in payload) {
    const ch = (payload as { chunk: Chunk }).chunk;
    payloadObj.chunk_index = ch.index;
    payloadObj.chunk_data_hex = toHex(ch.data);
  }

  vectors.push({
    name,
    description,
    epoch: epoch.toString(),
    index,
    payload: payloadObj,
    bytes_hex: toHex(bytes),
    bytes_length: bytes.length,
    layout,
  });

  // Write raw binary
  const binPath = join(outDir, `${name}.bin`);
  writeFileSync(binPath, bytes);
}

// ---------------------------------------------------------------------------
// Output directory
// ---------------------------------------------------------------------------

const outDir = join(import.meta.dir, ".");

// ---------------------------------------------------------------------------
// 1. Basic vectors -- one per message type, simple params
// ---------------------------------------------------------------------------

addVector("none-basic", "None message: epoch=1, index=0", 1n, 0, { type: "none" });

addVector("hdr-basic", "Hdr message: epoch=1, index=0, chunk(idx=0, data=0x00*32)", 1n, 0, {
  type: "hdr",
  chunk: makeChunk(0, 0x00),
});

addVector("ek-basic", "Ek message: epoch=1, index=1, chunk(idx=0, data=0x11*32)", 1n, 1, {
  type: "ek",
  chunk: makeChunk(0, 0x11),
});

addVector(
  "ekct1ack-basic",
  "EkCt1Ack message: epoch=1, index=2, chunk(idx=0, data=0x22*32)",
  1n,
  2,
  { type: "ekCt1Ack", chunk: makeChunk(0, 0x22) },
);

addVector(
  "ct1ack-basic",
  "Ct1Ack message: epoch=1, index=0. No payload (matches Rust: no value byte)",
  1n,
  0,
  { type: "ct1Ack" },
);

addVector("ct1-basic", "Ct1 message: epoch=1, index=3, chunk(idx=0, data=0x33*32)", 1n, 3, {
  type: "ct1",
  chunk: makeChunk(0, 0x33),
});

addVector("ct2-basic", "Ct2 message: epoch=1, index=4, chunk(idx=0, data=0x44*32)", 1n, 4, {
  type: "ct2",
  chunk: makeChunk(0, 0x44),
});

// ---------------------------------------------------------------------------
// 2. Sequential chunk data -- easier to visually verify byte order
// ---------------------------------------------------------------------------

addVector(
  "hdr-sequential",
  "Hdr with sequential chunk data [0x00..0x1f] for byte-order verification",
  1n,
  0,
  { type: "hdr", chunk: makeSequentialChunk(0) },
);

// ---------------------------------------------------------------------------
// 3. Multi-byte varint epoch
// ---------------------------------------------------------------------------

addVector("none-epoch128", "None with epoch=128 (2-byte LEB128: 0x80 0x01)", 128n, 0, {
  type: "none",
});

addVector("none-epoch16384", "None with epoch=16384 (3-byte LEB128: 0x80 0x80 0x01)", 16384n, 0, {
  type: "none",
});

addVector(
  "hdr-epoch300",
  "Hdr with epoch=300 (2-byte LEB128: 0xAC 0x02), chunk(idx=0, data=0xBB*32)",
  300n,
  0,
  { type: "hdr", chunk: makeChunk(0, 0xbb) },
);

addVector(
  "ct1ack-epoch1000",
  "Ct1Ack with epoch=1000 (2-byte LEB128: 0xE8 0x07). No payload.",
  1000n,
  0,
  { type: "ct1Ack" },
);

addVector(
  "none-epoch-max-u64",
  "None with epoch=2^63 - 1 (max safe epoch, 9-byte LEB128)",
  (1n << 63n) - 1n,
  0,
  { type: "none" },
);

// ---------------------------------------------------------------------------
// 4. Multi-byte varint index
// ---------------------------------------------------------------------------

addVector("none-index128", "None with index=128 (2-byte LEB128)", 1n, 128, { type: "none" });

addVector("none-index300", "None with index=300 (2-byte LEB128: 0xAC 0x02)", 1n, 300, {
  type: "none",
});

addVector(
  "ek-index65535",
  "Ek with index=65535 (3-byte LEB128), chunk(idx=0, data=0xEE*32)",
  1n,
  65535,
  { type: "ek", chunk: makeChunk(0, 0xee) },
);

// ---------------------------------------------------------------------------
// 5. Multi-byte varint chunk index
// ---------------------------------------------------------------------------

addVector(
  "hdr-chunk-idx128",
  "Hdr with chunk_index=128 (2-byte LEB128 for chunk idx), data=0xCC*32",
  1n,
  0,
  { type: "hdr", chunk: makeChunk(128, 0xcc) },
);

addVector(
  "ct1-chunk-idx1000",
  "Ct1 with chunk_index=1000 (2-byte LEB128: 0xE8 0x07), data=0xDD*32",
  1n,
  0,
  { type: "ct1", chunk: makeChunk(1000, 0xdd) },
);

// ---------------------------------------------------------------------------
// 6. Combined multi-byte fields
// ---------------------------------------------------------------------------

addVector(
  "ct2-multi-byte",
  "Ct2 with epoch=500, index=200, chunk(idx=50, data=sequential). All varints > 1 byte.",
  500n,
  200,
  { type: "ct2", chunk: makeSequentialChunk(50) },
);

addVector(
  "ekct1ack-large",
  "EkCt1Ack with epoch=100000, index=50000, chunk(idx=300, data=0xFF*32)",
  100000n,
  50000,
  { type: "ekCt1Ack", chunk: makeChunk(300, 0xff) },
);

// ---------------------------------------------------------------------------
// 7. Epoch = 1 minimum edge case (epoch=0 is rejected by both Rust and TS)
// ---------------------------------------------------------------------------

addVector("none-epoch1", "None with epoch=1 (minimum valid epoch)", 1n, 0, { type: "none" });

addVector("ct1ack-epoch1", "Ct1Ack with epoch=1. No payload. Minimum valid epoch.", 1n, 0, {
  type: "ct1Ack",
});

// ---------------------------------------------------------------------------
// Write JSON
// ---------------------------------------------------------------------------

const jsonPath = join(outDir, "wire-format-v1.json");
const output = {
  _comment: "SPQR V1 wire-format test vectors. Generated by TypeScript implementation.",
  _format:
    "Wire: [version:u8][epoch:varint][index:varint][msg_type:u8][chunk_idx:varint + chunk_data:32B (optional)]",
  _varint: "LEB128 unsigned, same as protobuf",
  _msg_types: {
    "0x00": "None",
    "0x01": "Hdr",
    "0x02": "Ek",
    "0x03": "EkCt1Ack",
    "0x04": "Ct1Ack",
    "0x05": "Ct1",
    "0x06": "Ct2",
  },
  generated_by: "TypeScript @bcts/spqr",
  vector_count: vectors.length,
  vectors,
};

writeFileSync(jsonPath, JSON.stringify(output, null, 2) + "\n");

console.log(`Generated ${vectors.length} test vectors:`);
console.log(`  JSON: ${jsonPath}`);
console.log(`  Binary: ${vectors.length} .bin files in ${outDir}`);
for (const v of vectors) {
  console.log(`  - ${v.name} (${v.bytes_length} bytes): ${v.description}`);
}
