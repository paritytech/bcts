/**
 * Tests for the array command
 *
 * Ported from:
 * - ref/bc-dcbor-cli/tests/test_array.rs
 * - ref/bc-dcbor-cli/src/main.rs (test_compose_array)
 */

import { describe, it } from "vitest";
import { runCliExpect, arrayCmd } from "./common.js";

describe("array command", () => {
  it("creates basic array", () => {
    runCliExpect(arrayCmd(["1", "2", "3"], "diag"), "[1, 2, 3]");
  });

  it("creates array with mixed types", () => {
    runCliExpect(arrayCmd(["42", '"hello"', "true"], "diag"), '[42, "hello", true]');
  });

  it("outputs hex format", () => {
    runCliExpect(arrayCmd(["1", "2", "3"], "hex"), "83010203");
  });

  it("outputs annotated hex", () => {
    runCliExpect(
      arrayCmd(["1", "2"], "hex", true),
      "82      # array(2)\n    01  # unsigned(1)\n    02  # unsigned(2)",
    );
  });

  it("creates empty array", () => {
    runCliExpect(arrayCmd([], "diag"), "[]");
    runCliExpect(arrayCmd([], "hex"), "80");
  });

  it("creates nested arrays", () => {
    runCliExpect(arrayCmd(["[1, 2]", "[3, 4]"], "diag"), "[[1, 2], [3, 4]]");
  });

  it("creates array with complex elements", () => {
    runCliExpect(arrayCmd(['{"1": "a"}', '{"2": "b"}'], "diag"), '[{"1": "a"}, {"2": "b"}]');
  });

  // Inline test from main.rs
  it("composes array (inline test)", () => {
    runCliExpect(arrayCmd(["1", "2", "3"], "diag"), "[1, 2, 3]");
  });
});
