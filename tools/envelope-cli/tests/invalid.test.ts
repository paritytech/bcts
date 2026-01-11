/**
 * Invalid input tests - 1:1 port of tests/test_invalid.rs
 */

import { describe, it, expect } from "vitest";
import * as format from "../src/cmd/format.js";

describe("invalid command", () => {
  it("test_invalid_data", () => {
    // Invalid UR type (seed instead of envelope) should throw
    expect(() =>
      format.exec({
        ...format.defaultArgs(),
        envelope: "ur:seed/oyadgdtokgdpwkrsonfdltvdwttsnddneonbmdbntakkss",
      }),
    ).toThrow();
  });
});
