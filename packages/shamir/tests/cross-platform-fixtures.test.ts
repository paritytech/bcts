/**
 * Cross-platform fixture parity tests.
 *
 * The fixtures in this file pin **share bytes produced by `bc-shamir-rust`**
 * (the Rust source-of-truth) as canonical hex blobs, then decode them with
 * the TypeScript `recoverSecret`. This proves bidirectional interop:
 *
 *   • The KATs in `shamir.test.ts` (`test_split_secret_3_5`,
 *     `test_split_secret_2_7`) prove TS-produced shares match Rust bytes
 *     when both use the same seeded RNG.
 *   • This file proves TS can decode Rust-produced shares with no detour
 *     through TS's split path — i.e. given a third party producing Rust
 *     output, our TS decoder recovers the original secret.
 *
 * Source: `bc-shamir-rust/src/lib.rs` `test_split_secret_3_5` (line 122)
 *         `bc-shamir-rust/src/lib.rs` `test_split_secret_2_7` (line 148)
 *
 * If a future Rust release changes share encoding at the wire level, the
 * fixtures below diverge from `recoverSecret`'s expectation and these
 * tests fail loud — exactly the early warning we want for cross-impl
 * interop.
 */

import { recoverSecret } from "../src/index.js";

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("Cross-platform Rust → TS share decoding", () => {
  // Rust KAT: 3-of-5 split of a 16-byte secret.
  // From `bc-shamir-rust/src/lib.rs::test_split_secret_3_5`.
  const RUST_3_5_SECRET = "0ff784df000c4380a5ed683f7e6e3dcf";
  const RUST_3_5_SHARES = [
    "00112233445566778899aabbccddeeff", // share 0
    "d43099fe444807c46921a4f33a2a798b", // share 1
    "d9ad4e3bec2e1a7485698823abf05d36", // share 2
    "0d8cf5f6ec337bc764d1866b5d07ca42", // share 3
    "1aa7fe3199bc5092ef3816b074cabdf2", // share 4
  ];

  it("recovers the 3/5 secret from Rust-produced shares (combination 1, 2, 4)", () => {
    const indexes = [1, 2, 4];
    const shares = indexes.map((i) => hexToBytes(RUST_3_5_SHARES[i]));
    const recovered = recoverSecret(indexes, shares);
    expect(bytesToHex(recovered)).toBe(RUST_3_5_SECRET);
  });

  it("recovers the 3/5 secret from Rust-produced shares (combination 0, 1, 2)", () => {
    const indexes = [0, 1, 2];
    const shares = indexes.map((i) => hexToBytes(RUST_3_5_SHARES[i]));
    const recovered = recoverSecret(indexes, shares);
    expect(bytesToHex(recovered)).toBe(RUST_3_5_SECRET);
  });

  it("recovers the 3/5 secret from Rust-produced shares (combination 2, 3, 4)", () => {
    const indexes = [2, 3, 4];
    const shares = indexes.map((i) => hexToBytes(RUST_3_5_SHARES[i]));
    const recovered = recoverSecret(indexes, shares);
    expect(bytesToHex(recovered)).toBe(RUST_3_5_SECRET);
  });

  it("recovers the 3/5 secret from Rust-produced shares (combination 0, 3, 4)", () => {
    const indexes = [0, 3, 4];
    const shares = indexes.map((i) => hexToBytes(RUST_3_5_SHARES[i]));
    const recovered = recoverSecret(indexes, shares);
    expect(bytesToHex(recovered)).toBe(RUST_3_5_SECRET);
  });

  // Rust KAT: 2-of-7 split of a 32-byte secret.
  // From `bc-shamir-rust/src/lib.rs::test_split_secret_2_7`.
  const RUST_2_7_SECRET =
    "204188bfa6b440a1bdfd6753ff55a8241e07af5c5be943db917e3efabc184b1a";
  const RUST_2_7_SHARES = [
    "2dcd14c2252dc8489af3985030e74d5a48e8eff1478ab86e65b43869bf39d556", // share 0
    "a1dfdd798388aada635b9974472b4fc59a32ae520c42c9f6a0af70149b882487", // share 1
    "2ee99daf727c0c7773b89a18de64497ff7476dacd1015a45f482a893f7402cef", // share 2
    "a2fb5414d4d96ee58a109b3ca9a84be0259d2c0f9ac92bdd3199e0eed3f1dd3e", // share 3
    "2b851d188b8f5b3653659cc0f7fa45102dadf04b708767385cd803862fcb3c3f", // share 4
    "a797d4a32d2a39a4aacd9de48036478fff77b1e83b4f16a099c34bfb0b7acdee", // share 5
    "28a19475dcde9f09ba2e9e881979413592027216e60c8513cdee937c67b2c586", // share 6
  ];

  it("recovers the 2/7 secret from Rust-produced shares (combination 3, 4)", () => {
    const indexes = [3, 4];
    const shares = indexes.map((i) => hexToBytes(RUST_2_7_SHARES[i]));
    const recovered = recoverSecret(indexes, shares);
    expect(bytesToHex(recovered)).toBe(RUST_2_7_SECRET);
  });

  it("recovers the 2/7 secret from every two-share combination", () => {
    // Exhaustive sweep: any 2 of 7 shares must recover the same secret.
    // 21 combinations total.
    let combinations = 0;
    for (let i = 0; i < 7; i++) {
      for (let j = i + 1; j < 7; j++) {
        const indexes = [i, j];
        const shares = indexes.map((k) => hexToBytes(RUST_2_7_SHARES[k]));
        const recovered = recoverSecret(indexes, shares);
        expect(bytesToHex(recovered)).toBe(RUST_2_7_SECRET);
        combinations++;
      }
    }
    expect(combinations).toBe(21);
  });

  it("rejects a tampered Rust-produced share with ChecksumFailure", async () => {
    const { ShamirError, ShamirErrorType } = await import("../src/index.js");
    // Corrupt a single byte in share 1 of the 3/5 fixture; the digest
    // check inside recoverSecret should reject the recovery.
    const tampered = hexToBytes(RUST_3_5_SHARES[1]);
    tampered[0] ^= 0x01;

    expect(() =>
      recoverSecret(
        [0, 1, 2],
        [hexToBytes(RUST_3_5_SHARES[0]), tampered, hexToBytes(RUST_3_5_SHARES[2])],
      ),
    ).toThrow(ShamirError);

    try {
      recoverSecret(
        [0, 1, 2],
        [hexToBytes(RUST_3_5_SHARES[0]), tampered, hexToBytes(RUST_3_5_SHARES[2])],
      );
    } catch (e) {
      expect(e).toBeInstanceOf(ShamirError);
      expect((e as InstanceType<typeof ShamirError>).type).toBe(ShamirErrorType.ChecksumFailure);
    }
  });
});
