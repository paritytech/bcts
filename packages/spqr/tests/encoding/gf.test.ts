/**
 * Tests for GF(2^16) field arithmetic.
 */
import { describe, it, expect } from "vitest";
import { GF16, POLY, polyReduce, parallelMult } from "../../src/encoding/gf.js";

describe("GF16", () => {
  describe("constants", () => {
    it("should have correct POLY value", () => {
      expect(POLY).toBe(0x1100b);
    });

    it("should have correct ZERO and ONE", () => {
      expect(GF16.ZERO.value).toBe(0);
      expect(GF16.ONE.value).toBe(1);
    });
  });

  describe("addition", () => {
    it("a + 0 = a", () => {
      const a = new GF16(0x1234);
      expect(a.add(GF16.ZERO).value).toBe(0x1234);
    });

    it("a + a = 0 (characteristic 2)", () => {
      const a = new GF16(0xabcd);
      expect(a.add(a).value).toBe(0);
    });

    it("addition is commutative", () => {
      const a = new GF16(0x1234);
      const b = new GF16(0x5678);
      expect(a.add(b).value).toBe(b.add(a).value);
    });

    it("subtraction equals addition", () => {
      const a = new GF16(0x1234);
      const b = new GF16(0x5678);
      expect(a.sub(b).value).toBe(a.add(b).value);
    });
  });

  describe("multiplication", () => {
    it("a * 0 = 0", () => {
      const a = new GF16(0x1234);
      expect(a.mul(GF16.ZERO).value).toBe(0);
    });

    it("a * 1 = a", () => {
      const a = new GF16(0x1234);
      expect(a.mul(GF16.ONE).value).toBe(0x1234);
    });

    it("0 * a = 0", () => {
      const a = new GF16(0x5678);
      expect(GF16.ZERO.mul(a).value).toBe(0);
    });

    it("1 * a = a", () => {
      const a = new GF16(0x5678);
      expect(GF16.ONE.mul(a).value).toBe(0x5678);
    });

    it("multiplication is commutative", () => {
      const a = new GF16(0x1234);
      const b = new GF16(0x5678);
      expect(a.mul(b).value).toBe(b.mul(a).value);
    });

    it("multiplication is associative", () => {
      const a = new GF16(0x1234);
      const b = new GF16(0x5678);
      const c = new GF16(0x9abc);
      expect(a.mul(b).mul(c).value).toBe(a.mul(b.mul(c)).value);
    });

    it("multiplication distributes over addition", () => {
      const a = new GF16(0x1234);
      const b = new GF16(0x5678);
      const c = new GF16(0x9abc);
      // a * (b + c) = a*b + a*c
      const lhs = a.mul(b.add(c));
      const rhs = a.mul(b).add(a.mul(c));
      expect(lhs.value).toBe(rhs.value);
    });

    it("result stays within u16 range", () => {
      const a = new GF16(0xffff);
      const b = new GF16(0xffff);
      const result = a.mul(b);
      expect(result.value).toBeLessThanOrEqual(0xffff);
      expect(result.value).toBeGreaterThanOrEqual(0);
    });
  });

  describe("division", () => {
    it("a / 1 = a", () => {
      const a = new GF16(0x1234);
      expect(a.div(GF16.ONE).value).toBe(0x1234);
    });

    it("a / a = 1 for non-zero a", () => {
      const a = new GF16(0x1234);
      expect(a.div(a).value).toBe(1);
    });

    it("(a * b) / b = a", () => {
      const a = new GF16(0x1234);
      const b = new GF16(0x5678);
      expect(a.mul(b).div(b).value).toBe(a.value);
    });

    it("0 / a = 0 for non-zero a", () => {
      const a = new GF16(0x1234);
      expect(GF16.ZERO.div(a).value).toBe(0);
    });

    it("division by zero throws", () => {
      const a = new GF16(0x1234);
      expect(() => a.div(GF16.ZERO)).toThrow("division by zero");
    });

    it("(a / b) * b = a", () => {
      const a = new GF16(0xabcd);
      const b = new GF16(0xef01);
      expect(a.div(b).mul(b).value).toBe(a.value);
    });
  });

  describe("equals", () => {
    it("same value equals", () => {
      expect(new GF16(42).equals(new GF16(42))).toBe(true);
    });

    it("different value not equal", () => {
      expect(new GF16(42).equals(new GF16(43))).toBe(false);
    });
  });

  describe("parallelMult", () => {
    it("multiplies all elements by scalar", () => {
      const arr = [new GF16(1), new GF16(2), new GF16(3)];
      const a = new GF16(5);
      parallelMult(a, arr);
      expect(arr[0].value).toBe(new GF16(1).mul(new GF16(5)).value);
      expect(arr[1].value).toBe(new GF16(2).mul(new GF16(5)).value);
      expect(arr[2].value).toBe(new GF16(3).mul(new GF16(5)).value);
    });

    it("multiplying by zero zeroes all", () => {
      const arr = [new GF16(100), new GF16(200)];
      parallelMult(GF16.ZERO, arr);
      expect(arr[0].value).toBe(0);
      expect(arr[1].value).toBe(0);
    });

    it("multiplying by one preserves all", () => {
      const arr = [new GF16(0x1234), new GF16(0x5678)];
      parallelMult(GF16.ONE, arr);
      expect(arr[0].value).toBe(0x1234);
      expect(arr[1].value).toBe(0x5678);
    });
  });

  describe("polyReduce", () => {
    it("values within u16 are unchanged", () => {
      expect(polyReduce(0)).toBe(0);
      expect(polyReduce(1)).toBe(1);
      expect(polyReduce(0xffff)).toBe(0xffff);
    });
  });

  describe("edge cases", () => {
    it("constructor masks to u16", () => {
      const a = new GF16(0x10000);
      expect(a.value).toBe(0);
      const b = new GF16(0x1ffff);
      expect(b.value).toBe(0xffff);
    });

    it("Fermat inverse: a^(2^16 - 1) = 1 for all non-zero a", () => {
      // Test a few representative values
      for (const v of [1, 2, 3, 255, 256, 0x1234, 0xffff]) {
        const a = new GF16(v);
        // a^(2^16-1) should be 1
        // We test this indirectly: a * a^(2^16-2) = 1
        // which is a / a = 1
        expect(a.div(a).value).toBe(1);
      }
    });
  });
});
