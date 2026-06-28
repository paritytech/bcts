/**
 * Regression tests for M2 — strict `CborDate.fromString` parsing.
 *
 * Mirrors Rust `Date::from_string`: accept only strict RFC-3339 date-times
 * (seconds + explicit Z/offset) or bare `YYYY-MM-DD` dates (UTC midnight);
 * reject everything else, including the lenient/engine-dependent forms the old
 * `new Date(value)` accepted.
 */

import { describe, test, expect } from "vitest";
import { CborDate, CborError } from "../src";

describe("M2: strict CborDate.fromString", () => {
  test("accepts strict RFC-3339 date-times", () => {
    expect(() => CborDate.fromString("2023-02-08T15:30:45Z")).not.toThrow();
    expect(() => CborDate.fromString("2023-02-08T15:30:45.5Z")).not.toThrow();
    expect(() => CborDate.fromString("2023-02-08T15:30:45+02:00")).not.toThrow();
    expect(() => CborDate.fromString("2023-02-08T15:30:45-05:00")).not.toThrow();
  });

  test("accepts bare YYYY-MM-DD as UTC midnight", () => {
    const d = CborDate.fromString("2023-02-08");
    // UTC midnight 2023-02-08 = 1675814400 seconds since epoch.
    expect(d.timestamp()).toBe(1675814400);
  });

  test("rejects lenient / engine-dependent forms that new Date() would accept", () => {
    for (const bad of [
      "2023/02/08",
      "Feb 8 2023",
      "2023-02-08T15:30", // no seconds
      "2023-02-08 15:30:45", // space instead of T, no offset
      "2023-02-08T15:30:45", // no zone
      "garbage",
      "",
    ]) {
      expect(() => CborDate.fromString(bad), bad).toThrow(CborError);
    }
  });

  test("rejects impossible calendar dates (no silent rollover)", () => {
    for (const bad of [
      "2023-02-30",
      "2023-04-31",
      "2023-13-01",
      "2023-00-10",
      "2023-02-08T15:30:45Z".replace("02-08", "02-30"),
    ]) {
      expect(() => CborDate.fromString(bad), bad).toThrow(CborError);
    }
  });

  test("accepts a leap day in a leap year, rejects it in a common year", () => {
    expect(() => CborDate.fromString("2024-02-29")).not.toThrow();
    expect(() => CborDate.fromString("2023-02-29")).toThrow(CborError);
  });

  test("round-trips a whole-second timestamp through encode", () => {
    const d = CborDate.fromString("2022-03-21T18:24:31Z");
    // Same instant as Rust's encode_date-style vector.
    expect(d.timestamp()).toBe(1647887071);
  });
});
