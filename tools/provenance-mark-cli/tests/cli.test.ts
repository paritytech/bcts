/**
 * CLI tests - placeholder for provenance-mark-cli tests
 */

import { describe, it, expect } from "vitest";
import { VERSION } from "../src/index.js";

describe("provenance-mark-cli", () => {
  it("should export VERSION", () => {
    expect(VERSION).toBeDefined();
    expect(typeof VERSION).toBe("string");
  });
});
