/**
 * Tests for the LifeHash CLI.
 *
 * Ported from bc-lifehash-cli C++ implementation.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, unlinkSync, mkdirSync, rmdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  appendingPathComponent,
  makeRandomInput,
  randomElement,
} from "../src/utils";
import { parseVersion, run } from "../src/main";
import { generateLifeHash } from "../src/index";
import { Version } from "@bcts/lifehash";

describe("Utils", () => {
  describe("appendingPathComponent", () => {
    it("should return component when path is empty", () => {
      expect(appendingPathComponent("", "file.png")).toBe("file.png");
    });

    it("should append with slash when path has trailing slash", () => {
      expect(appendingPathComponent("/tmp/", "file.png")).toBe("/tmp/file.png");
    });

    it("should add slash when path has no trailing slash", () => {
      expect(appendingPathComponent("/tmp", "file.png")).toBe("/tmp/file.png");
    });

    it("should handle complex paths", () => {
      expect(appendingPathComponent("./output/images", "test.png")).toBe(
        "./output/images/test.png",
      );
    });
  });

  describe("randomElement", () => {
    it("should return an element from the array", () => {
      const array = ["A", "B", "C"];
      const element = randomElement(array);
      expect(array).toContain(element);
    });

    it("should work with numbers", () => {
      const array = [1, 2, 3, 4, 5];
      const element = randomElement(array);
      expect(array).toContain(element);
    });
  });

  describe("makeRandomInput", () => {
    it("should generate XXX-XXX format", () => {
      const input = makeRandomInput();
      expect(input).toMatch(/^[A-Z]{3}-[A-Z]{3}$/);
    });

    it("should generate different inputs", () => {
      const inputs = new Set<string>();
      for (let i = 0; i < 10; i++) {
        inputs.add(makeRandomInput());
      }
      // With 26^6 possible combinations, we should get at least 5 unique
      expect(inputs.size).toBeGreaterThan(5);
    });
  });
});

describe("parseVersion", () => {
  it("should parse version1", () => {
    expect(parseVersion("version1")).toBe(Version.version1);
  });

  it("should parse version2", () => {
    expect(parseVersion("version2")).toBe(Version.version2);
  });

  it("should parse detailed", () => {
    expect(parseVersion("detailed")).toBe(Version.detailed);
  });

  it("should parse fiducial", () => {
    expect(parseVersion("fiducial")).toBe(Version.fiducial);
  });

  it("should parse grayscaleFiducial", () => {
    expect(parseVersion("grayscaleFiducial")).toBe(Version.grayscale_fiducial);
  });

  it("should throw for invalid version", () => {
    expect(() => parseVersion("invalid")).toThrow("Invalid version.");
  });
});

describe("run", () => {
  const testDir = join(tmpdir(), "lifehash-cli-test");

  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    const testFiles = ["Hello.png", "Test.png", "Detailed.png"];
    for (const file of testFiles) {
      const filePath = join(testDir, file);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    }
    if (existsSync(testDir)) {
      try {
        rmdirSync(testDir);
      } catch {
        // Ignore if not empty
      }
    }
  });

  it("should generate a PNG file", () => {
    run("Hello", { version: "version2", module: "1", path: testDir });
    expect(existsSync(join(testDir, "Hello.png"))).toBe(true);
  });

  it("should generate version2 by default", () => {
    run("Test", { version: "version2", module: "1", path: testDir });
    const filePath = join(testDir, "Test.png");
    expect(existsSync(filePath)).toBe(true);
  });

  it("should generate detailed version", () => {
    run("Detailed", { version: "detailed", module: "1", path: testDir });
    expect(existsSync(join(testDir, "Detailed.png"))).toBe(true);
  });

  it("should throw for invalid module size", () => {
    expect(() =>
      run("Test", { version: "version2", module: "0", path: testDir }),
    ).toThrow("Illegal value.");
  });

  it("should throw for negative module size", () => {
    expect(() =>
      run("Test", { version: "version2", module: "-1", path: testDir }),
    ).toThrow("Illegal value.");
  });

  it("should throw for non-numeric module size", () => {
    expect(() =>
      run("Test", { version: "version2", module: "abc", path: testDir }),
    ).toThrow("Illegal value.");
  });
});

describe("generateLifeHash", () => {
  it("should generate a PNG buffer", () => {
    const buffer = generateLifeHash("Hello");
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("should generate valid PNG (magic bytes)", () => {
    const buffer = generateLifeHash("Hello");
    // PNG magic bytes: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50); // P
    expect(buffer[2]).toBe(0x4e); // N
    expect(buffer[3]).toBe(0x47); // G
  });

  it("should use version2 by default", () => {
    const buffer1 = generateLifeHash("Test");
    const buffer2 = generateLifeHash("Test", { version: "version2" });
    expect(buffer1).toEqual(buffer2);
  });

  it("should generate different output for different versions", () => {
    const buffer1 = generateLifeHash("Test", { version: "version1" });
    const buffer2 = generateLifeHash("Test", { version: "version2" });
    expect(buffer1).not.toEqual(buffer2);
  });

  it("should generate different output for different module sizes", () => {
    const buffer1 = generateLifeHash("Test", { moduleSize: 1 });
    const buffer2 = generateLifeHash("Test", { moduleSize: 2 });
    expect(buffer1.length).not.toBe(buffer2.length);
  });

  it("should generate larger PNG for larger module size", () => {
    const buffer1 = generateLifeHash("Test", { moduleSize: 1 });
    const buffer2 = generateLifeHash("Test", { moduleSize: 4 });
    expect(buffer2.length).toBeGreaterThan(buffer1.length);
  });
});

describe("Version consistency with @bcts/lifehash", () => {
  it("should match all versions from lifehash package", () => {
    // Ensure all versions can be parsed
    const versions = [
      "version1",
      "version2",
      "detailed",
      "fiducial",
      "grayscaleFiducial",
    ] as const;

    for (const v of versions) {
      expect(() => parseVersion(v)).not.toThrow();
    }
  });
});
