import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { makeFromData, Version } from "../src";
import { hexToData } from "../src/hex";
import { sha256 } from "../src/sha256";
import { dataToHex } from "../src/hex";

interface GoldenEntry {
  input_hex: string;
  version: string;
  module_size: number;
  has_alpha: boolean;
  output_sha256: string;
}

const versionMap: Record<string, Version> = {
  version1: Version.version1,
  version2: Version.version2,
  detailed: Version.detailed,
  fiducial: Version.fiducial,
  grayscale_fiducial: Version.grayscale_fiducial,
};

const goldenPath = new URL("./fixtures/golden.json", import.meta.url);
const goldenJson = readFileSync(goldenPath, "utf-8");
const golden: GoldenEntry[] = JSON.parse(goldenJson);

describe("LifeHash parity (Rust golden)", () => {
  it("loads at least 1000 fuzz entries", () => {
    expect(golden.length).toBeGreaterThanOrEqual(1000);
  });

  for (const entry of golden) {
    const version = versionMap[entry.version];
    const label = `${entry.version} ${entry.input_hex.slice(0, 16)}…`;
    it(`matches Rust output for ${label}`, () => {
      const data = hexToData(entry.input_hex);
      const image = makeFromData(data, version, entry.module_size, entry.has_alpha);
      const got = dataToHex(sha256(image.colors));
      expect(got).toBe(entry.output_sha256);
    });
  }
});
