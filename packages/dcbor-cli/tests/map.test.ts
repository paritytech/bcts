/**
 * Tests for the map command
 *
 * Ported from:
 * - ref/bc-dcbor-cli/tests/test_map.rs
 * - ref/bc-dcbor-cli/src/main.rs (test_compose_map)
 */

import { describe, it, expect } from "vitest";
import { runCliExpect, runCli, mapCmd } from "./common.js";

describe("map command", () => {
  it("creates basic map", () => {
    runCliExpect(mapCmd(["1", "2", "3", "4"], "diag"), "{1: 2, 3: 4}");
  });

  it("creates map with text keys", () => {
    runCliExpect(
      mapCmd(['"key1"', '"value1"', '"key2"', '"value2"'], "diag"),
      '{"key1": "value1", "key2": "value2"}',
    );
  });

  it("outputs hex format", () => {
    runCliExpect(mapCmd(["1", "2", "3", "4"], "hex"), "a201020304");
  });

  it("outputs annotated hex", () => {
    runCliExpect(
      mapCmd(["1", "2"], "hex", true),
      "a1      # map(1)\n    01  # unsigned(1)\n    02  # unsigned(2)",
    );
  });

  it("creates empty map", () => {
    runCliExpect(mapCmd([], "diag"), "{}");
    runCliExpect(mapCmd([], "hex"), "a0");
  });

  it("creates map with mixed types", () => {
    runCliExpect(
      mapCmd(["1", '"text"', '"key"', "42"], "diag"),
      '{1: "text", "key": 42}',
    );
  });

  it("creates map with nested values", () => {
    runCliExpect(
      mapCmd(["1", "[1, 2]", "2", "{3: 4}"], "diag"),
      "{1: [1, 2], 2: {3: 4}}",
    );
  });

  it("fails with odd number of arguments", () => {
    expect(() => runCli(mapCmd(["1", "2", "3"], "diag"))).toThrow();
  });

  // Inline test from main.rs
  it("composes map (inline test)", () => {
    runCliExpect(mapCmd(["1", "2", "3", "4"], "diag"), "{1: 2, 3: 4}");
  });
});
