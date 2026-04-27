import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { makeFromUtf8, makeFromData, Version } from "../src";
import { hexToData } from "../src/hex";

interface TestVector {
  input: string;
  input_type: "utf8" | "hex";
  version: "version1" | "version2" | "detailed" | "fiducial" | "grayscale_fiducial";
  module_size: number;
  has_alpha: boolean;
  width: number;
  height: number;
  colors: number[];
}

const versionMap: Record<TestVector["version"], Version> = {
  version1: Version.version1,
  version2: Version.version2,
  detailed: Version.detailed,
  fiducial: Version.fiducial,
  grayscale_fiducial: Version.grayscale_fiducial,
};

const fixtureUrl = new URL("./fixtures/test-vectors.json", import.meta.url);
const vectors = JSON.parse(readFileSync(fixtureUrl, "utf8")) as TestVector[];

function firstMismatch(actual: Uint8Array, expected: number[]): number | null {
  if (actual.length !== expected.length) return -1;
  for (let i = 0; i < expected.length; i++) {
    if (actual[i] !== expected[i]) return i;
  }
  return null;
}

describe("LifeHash upstream test vectors", () => {
  it("has the expected number of vectors", () => {
    expect(vectors.length).toBe(35);
  });

  for (const [idx, v] of vectors.entries()) {
    const label = `#${idx} ${v.version} m=${v.module_size} alpha=${v.has_alpha} ${v.input_type}:"${v.input}"`;
    it(label, () => {
      const version = versionMap[v.version];
      const image =
        v.input_type === "utf8"
          ? makeFromUtf8(v.input, version, v.module_size, v.has_alpha)
          : makeFromData(hexToData(v.input), version, v.module_size, v.has_alpha);

      expect(image.width).toBe(v.width);
      expect(image.height).toBe(v.height);

      const expectedLen = v.width * v.height * (v.has_alpha ? 4 : 3);
      expect(image.colors.length).toBe(expectedLen);
      expect(v.colors.length).toBe(expectedLen);

      const mm = firstMismatch(image.colors, v.colors);
      if (mm === null) return;
      if (mm === -1) {
        throw new Error(
          `length mismatch: actual=${image.colors.length} expected=${v.colors.length}`,
        );
      }
      const window = 8;
      const start = Math.max(0, mm - window);
      const end = Math.min(expectedLen, mm + window);
      throw new Error(
        `pixel mismatch at byte ${mm}\n` +
          `  actual   [${start}..${end}] = ${Array.from(image.colors.slice(start, end)).join(",")}\n` +
          `  expected [${start}..${end}] = ${v.colors.slice(start, end).join(",")}`,
      );
    });
  }
});
