/**
 * Validate all wire-format test vectors from wire-format-v1.json.
 *
 * This test ensures that:
 * 1. Each vector deserializes to the expected epoch/index/payload
 * 2. Re-serializing produces identical bytes (round-trip)
 * 3. The .bin files match the JSON hex
 */

/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serializeMessage, deserializeMessage } from "../../src/v1/chunked/message.js";
import type { Message, MessagePayload } from "../../src/v1/chunked/states.js";
import type { Chunk } from "../../src/encoding/polynomial.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function toHex(buf: Uint8Array): string {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Build a Chunk from a vector payload, asserting required fields exist. */
function buildChunk(p: VectorPayload): Chunk {
  if (p.chunk_index === undefined || p.chunk_data_hex === undefined) {
    throw new Error(`Expected chunk data for payload type ${p.type}`);
  }
  return { index: p.chunk_index, data: fromHex(p.chunk_data_hex) };
}

// ---------------------------------------------------------------------------
// Load vectors
// ---------------------------------------------------------------------------

interface VectorPayload {
  type: string;
  chunk_index?: number;
  chunk_data_hex?: string;
}

interface TestVector {
  name: string;
  description: string;
  epoch: string;
  index: number;
  payload: VectorPayload;
  bytes_hex: string;
  bytes_length: number;
  layout: string;
}

interface VectorFile {
  vector_count: number;
  vectors: TestVector[];
}

import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
const vectorsDir = dirname(fileURLToPath(import.meta.url));
const vectorFile: VectorFile = JSON.parse(
  readFileSync(join(vectorsDir, "wire-format-v1.json"), "utf-8"),
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Wire format V1 test vectors", () => {
  it(`should have ${vectorFile.vector_count} vectors`, () => {
    expect(vectorFile.vectors.length).toBe(vectorFile.vector_count);
  });

  for (const vec of vectorFile.vectors) {
    describe(vec.name, () => {
      const bytes = fromHex(vec.bytes_hex);

      it("has correct byte length", () => {
        expect(bytes.length).toBe(vec.bytes_length);
      });

      it("deserializes correctly", () => {
        const { msg, index, bytesRead } = deserializeMessage(bytes);

        expect(bytesRead).toBe(bytes.length);
        expect(msg.epoch).toBe(BigInt(vec.epoch));
        expect(index).toBe(vec.index);
        expect(msg.payload.type).toBe(vec.payload.type);

        if (vec.payload.chunk_index !== undefined) {
          const chunk = (msg.payload as { chunk: Chunk }).chunk;
          expect(chunk.index).toBe(vec.payload.chunk_index);
          expect(toHex(chunk.data)).toBe(vec.payload.chunk_data_hex);
        }
      });

      it("round-trips (serialize -> deserialize -> serialize)", () => {
        const { msg, index } = deserializeMessage(bytes);
        const reserialized = serializeMessage(msg, index);
        expect(toHex(reserialized)).toBe(vec.bytes_hex);
      });

      it(".bin file matches JSON hex", () => {
        const binPath = join(vectorsDir, `${vec.name}.bin`);
        const binBytes = new Uint8Array(readFileSync(binPath));
        expect(toHex(binBytes)).toBe(vec.bytes_hex);
      });
    });
  }
});

describe("Construct and serialize each vector", () => {
  for (const vec of vectorFile.vectors) {
    it(`${vec.name}: construct -> serialize matches expected`, () => {
      let payload: MessagePayload;
      switch (vec.payload.type) {
        case "none":
          payload = { type: "none" };
          break;
        case "hdr":
          payload = { type: "hdr", chunk: buildChunk(vec.payload) };
          break;
        case "ek":
          payload = { type: "ek", chunk: buildChunk(vec.payload) };
          break;
        case "ekCt1Ack":
          payload = { type: "ekCt1Ack", chunk: buildChunk(vec.payload) };
          break;
        case "ct1Ack":
          payload = { type: "ct1Ack" };
          break;
        case "ct1":
          payload = { type: "ct1", chunk: buildChunk(vec.payload) };
          break;
        case "ct2":
          payload = { type: "ct2", chunk: buildChunk(vec.payload) };
          break;
        default:
          throw new Error(`Unknown payload type: ${vec.payload.type}`);
      }

      const msg: Message = { epoch: BigInt(vec.epoch), payload };
      const serialized = serializeMessage(msg, vec.index);
      expect(toHex(serialized)).toBe(vec.bytes_hex);
    });
  }
});
