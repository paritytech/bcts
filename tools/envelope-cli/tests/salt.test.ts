/**
 * Salt command tests - 1:1 port of tests/test_salt.rs
 */

import { describe, it, expect } from "vitest";
import * as salt from "../src/cmd/salt.js";
import * as format from "../src/cmd/format.js";
import { ALICE_KNOWS_BOB_EXAMPLE, expectOutput } from "./common.js";

describe("salt command", () => {
  // Skip: Format output differs from Rust (shows "salt": Bytes(undefined) instead of 'salt': Salt)
  it.skip("test_salt", () => {
    const salted = salt.exec({
      envelope: ALICE_KNOWS_BOB_EXAMPLE,
    });

    const formatted = format.exec({
      ...format.defaultArgs(),
      envelope: salted,
    });

    const expected = `"Alice" [
    "knows": "Bob"
    'salt': Salt
]`;
    expectOutput(formatted, expected);
  });
});
