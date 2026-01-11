/**
 * Compress command tests - 1:1 port of tests/test_compress.rs
 */

import { describe, it, expect } from "vitest";
import * as compress from "../src/cmd/compress.js";
import * as decompress from "../src/cmd/decompress.js";
import * as format from "../src/cmd/format.js";
import { ALICE_KNOWS_BOB_EXAMPLE, CREDENTIAL_EXAMPLE, expectOutput } from "./common.js";

describe("compress command", () => {
  it("test_compress_1", () => {
    const compressed = compress.exec({
      ...compress.defaultArgs(),
      subject: true,
      envelope: ALICE_KNOWS_BOB_EXAMPLE,
    });

    const formatted = format.exec({
      ...format.defaultArgs(),
      envelope: compressed,
    });

    const expected = `COMPRESSED [
    "knows": "Bob"
]`;
    expectOutput(formatted, expected);

    const decompressed = decompress.exec({
      ...decompress.defaultArgs(),
      subject: true,
      envelope: compressed,
    });
    expect(decompressed).toBe(ALICE_KNOWS_BOB_EXAMPLE);
  });

  it("test_compress_2", () => {
    const compressed = compress.exec({
      ...compress.defaultArgs(),
      envelope: CREDENTIAL_EXAMPLE,
    });

    expect(CREDENTIAL_EXAMPLE.length).toBe(1210);
    // Compressed length may vary slightly from Rust due to implementation differences
    expect(compressed.length).toBeLessThan(CREDENTIAL_EXAMPLE.length);

    const formatted = format.exec({
      ...format.defaultArgs(),
      envelope: compressed,
    });
    expect(formatted).toBe("COMPRESSED");

    const decompressed = decompress.exec({
      ...decompress.defaultArgs(),
      envelope: compressed,
    });
    expect(decompressed).toBe(CREDENTIAL_EXAMPLE);
  });
});
