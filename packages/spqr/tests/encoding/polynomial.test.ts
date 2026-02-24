/**
 * Tests for polynomial erasure coding over GF(2^16).
 */
import { describe, it, expect } from "vitest";
import {
  GF16,
  Poly,
  PolyEncoder,
  PolyDecoder,
} from "../../src/encoding/index.js";
import type { Pt, Chunk } from "../../src/encoding/index.js";

describe("Poly", () => {
  describe("zeros", () => {
    it("creates polynomial of all zeros", () => {
      const p = Poly.zeros(5);
      expect(p.length).toBe(5);
      for (let i = 0; i < 5; i++) {
        expect(p.coefficients[i].value).toBe(0);
      }
    });
  });

  describe("computeAt", () => {
    it("constant polynomial evaluates to constant", () => {
      const p = new Poly([new GF16(42)]);
      expect(p.computeAt(new GF16(0)).value).toBe(42);
      expect(p.computeAt(new GF16(100)).value).toBe(42);
    });

    it("identity polynomial (x) evaluates correctly", () => {
      // p(x) = 0 + 1*x (coefficients: [0, 1])
      const p = new Poly([GF16.ZERO, GF16.ONE]);
      expect(p.computeAt(new GF16(0)).value).toBe(0);
      expect(p.computeAt(new GF16(1)).value).toBe(1);
      expect(p.computeAt(new GF16(5)).value).toBe(5);
      expect(p.computeAt(new GF16(0x1234)).value).toBe(0x1234);
    });

    it("evaluates a + b*x correctly", () => {
      const a = new GF16(3);
      const b = new GF16(5);
      const p = new Poly([a, b]);
      // p(2) = 3 ^ (5 * 2)
      const expected = a.add(b.mul(new GF16(2)));
      expect(p.computeAt(new GF16(2)).value).toBe(expected.value);
    });

    it("empty polynomial returns zero", () => {
      const p = new Poly([]);
      expect(p.computeAt(new GF16(42)).value).toBe(0);
    });
  });

  describe("addAssign", () => {
    it("adds coefficients element-wise", () => {
      const p = new Poly([new GF16(1), new GF16(2)]);
      const q = new Poly([new GF16(3), new GF16(4)]);
      p.addAssign(q);
      expect(p.coefficients[0].value).toBe(1 ^ 3);
      expect(p.coefficients[1].value).toBe(2 ^ 4);
    });

    it("extends shorter polynomial", () => {
      const p = new Poly([new GF16(1)]);
      const q = new Poly([new GF16(2), new GF16(3), new GF16(4)]);
      p.addAssign(q);
      expect(p.length).toBe(3);
      expect(p.coefficients[0].value).toBe(1 ^ 2);
      expect(p.coefficients[1].value).toBe(3);
      expect(p.coefficients[2].value).toBe(4);
    });
  });

  describe("multAssign", () => {
    it("multiplies all coefficients by scalar", () => {
      const p = new Poly([new GF16(1), new GF16(2), new GF16(3)]);
      const m = new GF16(5);
      p.multAssign(m);
      expect(p.coefficients[0].value).toBe(new GF16(1).mul(m).value);
      expect(p.coefficients[1].value).toBe(new GF16(2).mul(m).value);
      expect(p.coefficients[2].value).toBe(new GF16(3).mul(m).value);
    });
  });

  describe("serialize / deserialize", () => {
    it("roundtrips correctly", () => {
      const p = new Poly([new GF16(0x1234), new GF16(0x5678), new GF16(0xabcd)]);
      const data = p.serialize();
      expect(data.length).toBe(6);
      const q = Poly.deserialize(data);
      expect(q.length).toBe(3);
      for (let i = 0; i < 3; i++) {
        expect(q.coefficients[i].value).toBe(p.coefficients[i].value);
      }
    });

    it("rejects odd-length data", () => {
      expect(() => Poly.deserialize(new Uint8Array(3))).toThrow("even");
    });
  });

  describe("lagrangeInterpolate", () => {
    it("single point yields constant polynomial", () => {
      const pts: Pt[] = [{ x: new GF16(5), y: new GF16(42) }];
      const p = Poly.lagrangeInterpolate(pts);
      // A single-point interpolation should yield p(5) = 42
      expect(p.computeAt(new GF16(5)).value).toBe(42);
    });

    it("interpolation passes through all given points", () => {
      const pts: Pt[] = [
        { x: new GF16(0), y: new GF16(100) },
        { x: new GF16(1), y: new GF16(200) },
        { x: new GF16(2), y: new GF16(300) },
      ];
      const p = Poly.lagrangeInterpolate(pts);
      for (const pt of pts) {
        expect(p.computeAt(pt.x).value).toBe(pt.y.value);
      }
    });

    it("two points define a line", () => {
      const pts: Pt[] = [
        { x: new GF16(0), y: new GF16(7) },
        { x: new GF16(1), y: new GF16(13) },
      ];
      const p = Poly.lagrangeInterpolate(pts);
      expect(p.computeAt(new GF16(0)).value).toBe(7);
      expect(p.computeAt(new GF16(1)).value).toBe(13);
    });

    it("empty points yield empty polynomial", () => {
      const p = Poly.lagrangeInterpolate([]);
      expect(p.length).toBe(0);
    });

    it("interpolation with more points", () => {
      const pts: Pt[] = [];
      for (let i = 0; i < 5; i++) {
        pts.push({ x: new GF16(i), y: new GF16((i * 7 + 3) & 0xffff) });
      }
      const p = Poly.lagrangeInterpolate(pts);
      for (const pt of pts) {
        expect(p.computeAt(pt.x).value).toBe(pt.y.value);
      }
    });
  });
});

describe("PolyEncoder / PolyDecoder", () => {
  describe("encode and decode small message", () => {
    it("roundtrips a 2-byte message", () => {
      const msg = new Uint8Array([0xab, 0xcd]);
      const encoder = PolyEncoder.encodeBytes(msg);
      const decoder = PolyDecoder.create(msg.length);

      // One chunk should be enough for a tiny message
      decoder.addChunk(encoder.nextChunk());

      const decoded = decoder.decodedMessage();
      expect(decoded).not.toBeNull();
      expect(decoded!).toEqual(msg);
    });

    it("roundtrips a 32-byte message with exact chunks", () => {
      const msg = new Uint8Array(32);
      for (let i = 0; i < 32; i++) msg[i] = i;

      const encoder = PolyEncoder.encodeBytes(msg);
      const decoder = PolyDecoder.create(msg.length);

      // Feed chunks until complete
      while (!decoder.isComplete) {
        decoder.addChunk(encoder.nextChunk());
      }

      const decoded = decoder.decodedMessage();
      expect(decoded).not.toBeNull();
      expect(decoded!).toEqual(msg);
    });

    it("roundtrips an odd-length message", () => {
      const msg = new Uint8Array([1, 2, 3]);
      const encoder = PolyEncoder.encodeBytes(msg);
      const decoder = PolyDecoder.create(msg.length);

      // Feed chunks until complete
      for (let i = 0; i < 10 && !decoder.isComplete; i++) {
        decoder.addChunk(encoder.nextChunk());
      }

      const decoded = decoder.decodedMessage();
      expect(decoded).not.toBeNull();
      // Decoded will be padded to even length (4 bytes with trailing 0)
      expect(decoded![0]).toBe(1);
      expect(decoded![1]).toBe(2);
      expect(decoded![2]).toBe(3);
      expect(decoded![3]).toBe(0);
    });
  });

  describe("erasure coding", () => {
    it("can decode from non-sequential chunks", () => {
      const msg = new Uint8Array(64);
      for (let i = 0; i < 64; i++) msg[i] = (i * 13 + 7) & 0xff;

      const encoder = PolyEncoder.encodeBytes(msg);
      const decoder = PolyDecoder.create(msg.length);

      // Generate more chunks than needed, skip some
      const chunks: Chunk[] = [];
      for (let i = 0; i < 20; i++) {
        chunks.push(encoder.chunkAt(i));
      }

      // Feed only even-indexed chunks (should still work via interpolation)
      for (const chunk of chunks) {
        decoder.addChunk(chunk);
        if (decoder.isComplete) break;
      }

      const decoded = decoder.decodedMessage();
      expect(decoded).not.toBeNull();
      expect(decoded!).toEqual(msg);
    });
  });

  describe("decoder returns null when incomplete", () => {
    it("returns null before enough chunks", () => {
      const msg = new Uint8Array(64);
      const decoder = PolyDecoder.create(msg.length);
      expect(decoder.decodedMessage()).toBeNull();
    });
  });

  describe("chunkAt is deterministic", () => {
    it("same index produces same chunk", () => {
      const msg = new Uint8Array([10, 20, 30, 40]);
      const encoder = PolyEncoder.encodeBytes(msg);

      const c1 = encoder.chunkAt(0);
      const c2 = encoder.chunkAt(0);
      expect(c1.data).toEqual(c2.data);
      expect(c1.index).toBe(c2.index);
    });
  });

  describe("proto serialization", () => {
    it("encoder roundtrips through proto", () => {
      const msg = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const encoder = PolyEncoder.encodeBytes(msg);
      const chunk0 = encoder.chunkAt(0);

      const proto = encoder.toProto();
      const restored = PolyEncoder.fromProto(proto);
      const restoredChunk0 = restored.chunkAt(0);

      expect(restoredChunk0.data).toEqual(chunk0.data);
    });

    it("decoder roundtrips through proto", () => {
      const msg = new Uint8Array(32);
      for (let i = 0; i < 32; i++) msg[i] = i;

      const encoder = PolyEncoder.encodeBytes(msg);
      const decoder = PolyDecoder.create(msg.length);

      // Add one chunk
      decoder.addChunk(encoder.nextChunk());

      const proto = decoder.toProto();
      expect(proto.ptsNeeded).toBe(16);
      expect(proto.polys).toBe(16);
      expect(proto.pts.length).toBe(16);
    });
  });

  describe("larger messages", () => {
    it("roundtrips a 128-byte message", () => {
      const msg = new Uint8Array(128);
      for (let i = 0; i < 128; i++) msg[i] = (i * 31 + 17) & 0xff;

      const encoder = PolyEncoder.encodeBytes(msg);
      const decoder = PolyDecoder.create(msg.length);

      for (let i = 0; i < 100 && !decoder.isComplete; i++) {
        decoder.addChunk(encoder.nextChunk());
      }

      const decoded = decoder.decodedMessage();
      expect(decoded).not.toBeNull();
      expect(decoded!).toEqual(msg);
    });
  });
});
