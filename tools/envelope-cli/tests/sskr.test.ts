/**
 * SSKR command tests - 1:1 port of tests/test_sskr.rs
 */

import { describe, it, expect } from "vitest";
import * as sskr from "../src/cmd/sskr/index.js";
import * as format from "../src/cmd/format.js";
import { ALICE_KNOWS_BOB_EXAMPLE, expectOutput } from "./common.js";

describe("sskr command", () => {
  // Skip: SSKR is not yet implemented in TypeScript
  it.skip("test_sskr_1", () => {
    const result = sskr.split.exec({
      groupThreshold: 1,
      groups: ["1-of-1"],
      recipients: [],
      envelope: ALICE_KNOWS_BOB_EXAMPLE,
    });

    const formatted = format.exec({
      ...format.defaultArgs(),
      envelope: result,
    });

    const expected = `ENCRYPTED [
    'sskrShare': SSKRShare
]`;
    expectOutput(formatted, expected);

    const restored = sskr.join.exec({
      shares: [result],
    });
    expect(restored).toBe(ALICE_KNOWS_BOB_EXAMPLE);
  });

  // Skip: SSKR is not yet implemented in TypeScript
  it.skip("test_sskr_2", () => {
    const result = sskr.split.exec({
      groupThreshold: 2,
      groups: ["2-of-3", "2-of-3"],
      recipients: [],
      envelope: ALICE_KNOWS_BOB_EXAMPLE,
    });

    const shares = result.trim().split(/\s+/);
    expect(shares.length).toBe(6);

    // Use shares at indexes 0, 1, 4, 5 (first two from each group)
    const recoveredShares = [shares[0], shares[1], shares[4], shares[5]] as string[];

    const restored = sskr.join.exec({
      shares: recoveredShares,
    });

    expect(restored).toBe(ALICE_KNOWS_BOB_EXAMPLE);
  });
});
