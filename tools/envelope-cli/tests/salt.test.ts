/**
 * Salt command tests - 1:1 port of tests/test_salt.rs
 */

import { describe, it, expect } from "vitest";
import * as salt from "../src/cmd/salt.js";
import * as format from "../src/cmd/format.js";
import { ALICE_KNOWS_BOB_EXAMPLE, expectOutput } from "./common.js";

describe("salt command", () => {
  it("test_salt", () => {
    const salted = salt.exec({
      envelope: ALICE_KNOWS_BOB_EXAMPLE,
    });

    const formatted = format.exec({
      ...format.defaultArgs(),
      envelope: salted,
    });

    // Assertion order depends on digest sort, which varies with random salt
    expect(formatted).toContain('"Alice"');
    expect(formatted).toContain('"knows": "Bob"');
    expect(formatted).toContain("'salt': Salt");
  });
});
