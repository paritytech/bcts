/**
 * Regression tests for the medium-severity parity fixes (M1, M4, M5) from the
 * dCBOR Rust parity audit.
 */

import { describe, test, expect } from "vitest";
import {
  cbor,
  toTaggedValue,
  hasTag,
  getTaggedContent,
  expectTaggedContent,
  asFloat,
  expectFloat,
  diagnosticOpt,
  TagsStore,
  CborError,
} from "../src";

describe("M1: value-normalized tag equality (number/bigint boundary)", () => {
  test("hasTag matches across the number/bigint divide", () => {
    const tagNum = toTaggedValue(100, 1); // tag stored as number 100
    const tagBig = toTaggedValue(100n, 1); // tag stored as bigint 100n
    // Rust's Tag equality is value-only over u64; in JS `100n === 100` is false,
    // so the raw === used previously would have rejected these.
    expect(hasTag(tagNum, 100n)).toBe(true);
    expect(hasTag(tagBig, 100)).toBe(true);
    expect(hasTag(tagNum, 100)).toBe(true);
    expect(hasTag(tagBig, 100n)).toBe(true);
    // Still rejects a genuinely different tag value.
    expect(hasTag(tagNum, 101)).toBe(false);
    expect(hasTag(tagNum, 101n)).toBe(false);
  });

  test("getTaggedContent / expectTaggedContent match across number/bigint", () => {
    const tagBig = toTaggedValue(100n, 7);
    expect(getTaggedContent(tagBig, 100)).not.toBeUndefined();
    expect(expectTaggedContent(tagBig, 100).type).toBeDefined();

    const tagNum = toTaggedValue(100, 7);
    expect(getTaggedContent(tagNum, 100n)).not.toBeUndefined();
    expect(expectTaggedContent(tagNum, 100n).type).toBeDefined();
  });

  test("expectTaggedContent still throws WrongTag for a real mismatch", () => {
    const t = toTaggedValue(100, 1);
    expect(() => expectTaggedContent(t, 101)).toThrow(CborError);
  });

  test("Cbor.expectTag / validateTag match across number/bigint", () => {
    const tagBig = toTaggedValue(100n, 1);
    // method form — a bigint-stored tag matches a number-declared expected tag.
    expect(() => tagBig.expectTag(100)).not.toThrow();
    // validateTag returns the matching *expected* Tag object (declared as 100).
    expect(tagBig.validateTag([{ value: 100 }]).value).toBe(100);
    // and a number-stored tag matches a bigint-declared expected tag.
    const tagNum = toTaggedValue(100, 1);
    expect(tagNum.validateTag([{ value: 100n }]).value).toBe(100n);
  });
});

describe("M5: asFloat/expectFloat coerce integers (Rust TryFrom<CBOR> for f64)", () => {
  test("asFloat coerces Unsigned/Negative and passes through floats", () => {
    expect(asFloat(cbor(42))).toBe(42);
    expect(asFloat(cbor(-5))).toBe(-5);
    expect(asFloat(cbor(0))).toBe(0);
    expect(asFloat(cbor(1.5))).toBe(1.5);
  });

  test("asFloat returns undefined for non-numeric and inexact integers", () => {
    expect(asFloat(cbor("hello"))).toBeUndefined();
    expect(asFloat(cbor(true))).toBeUndefined();
    // 2^63 + 1 is not exactly representable as f64 -> Rust OutOfRange -> undefined.
    expect(asFloat(cbor(9223372036854775809n))).toBeUndefined();
  });

  test("expectFloat coerces integers, throws WrongType / OutOfRange", () => {
    expect(expectFloat(cbor(42))).toBe(42);
    expect(expectFloat(cbor(-5))).toBe(-5);
    expect(expectFloat(cbor(1.5))).toBe(1.5);
    // non-numeric -> WrongType
    try {
      expectFloat(cbor("hello"));
      throw new Error("should have thrown");
    } catch (e) {
      expect(CborError.isCborError(e) && e.errorType.type).toBe("WrongType");
    }
    // numeric but inexact -> OutOfRange
    try {
      expectFloat(cbor(9223372036854775809n));
      throw new Error("should have thrown");
    } catch (e) {
      expect(CborError.isCborError(e) && e.errorType.type).toBe("OutOfRange");
    }
  });
});

describe("M4: summarizer error rendered via the full Error Display", () => {
  test("non-Custom/non-WrongTag summarizer errors show the Rust message", () => {
    const store = new TagsStore();
    store.insert({ value: 1234, name: "thing" });
    // Summarizer that always fails with WrongType.
    store.setSummarizer(1234, () => ({ ok: false, error: { type: "WrongType" } }));
    const tagged = toTaggedValue(1234, 1);
    const out = diagnosticOpt(tagged, { summarize: true, tags: store });
    // Previously this rendered the bare variant id `<error: WrongType>`.
    expect(out).toBe("<error: the decoded CBOR value was not the expected type>");
  });

  test("WrongTag summarizer error is name-aware (uses tagToString)", () => {
    const store = new TagsStore();
    store.insert({ value: 1234, name: "thing" });
    store.setSummarizer(1234, () => ({
      ok: false,
      error: { type: "WrongTag", expected: { value: 1, name: "date" }, actual: { value: 100 } },
    }));
    const tagged = toTaggedValue(1234, 1);
    const out = diagnosticOpt(tagged, { summarize: true, tags: store });
    // Name-aware: expected tag prints its name "date", not the number 1.
    expect(out).toBe("<error: expected CBOR tag date, but got 100>");
  });
});
