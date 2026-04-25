/**
 * Cross-platform fixture parity tests for `@bcts/sskr`.
 *
 * The fixtures pin **share bytes produced by `bc-sskr-rust`** with the
 * `FakeRandomNumberGenerator` from its lib.rs tests, then decode them
 * with the TypeScript `sskrCombine`. This proves bidirectional interop:
 *
 *   • The deterministic-RNG round-trip tests in `sskr.test.ts`
 *     (`split 3/5 single group`, `split 2/7 single group`,
 *     `split 2/3 + 2/3 two groups`) prove TS-produced shares recover the
 *     original secret when generated and combined inside TS.
 *   • This file proves TS can decode Rust-produced shares with no detour
 *     through TS's `sskrGenerateUsing` path — i.e. given a third party
 *     producing Rust output, our TS combiner recovers the original
 *     secret.
 *
 * The `value` portion (bytes 5+) of every fixture below is **identical**
 * to the `bc-shamir-rust` Shamir share KATs in
 * `bc-shamir-rust/src/lib.rs::test_split_secret_3_5` (line 122) and
 * `test_split_secret_2_7` (line 148). The 5-byte SSKR metadata header is
 * derived deterministically from the SSKR `Spec` plus the FakeRng's
 * leading two-byte identifier (`0x0011`).
 *
 * If a future Rust release changes the SSKR wire format, the fixtures
 * below diverge from `sskrCombine`'s expectation and these tests fail
 * loud — exactly the early warning we want for cross-impl interop.
 */

import { describe, it, expect } from "vitest";
import {
  Secret,
  sskrCombine,
  SSKRError,
  SSKRErrorType,
} from "../src/index.js";

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

describe("Cross-platform Rust → TS SSKR share decoding", () => {
  // Rust KAT: 3-of-5 single group, 16-byte secret, FakeRng.
  // From `bc-sskr-rust/src/lib.rs::test_split_3_5` (line 132).
  // Header decode for each share (5 bytes per the SSKR wire format):
  //   bytes 0-1: identifier 0x0011 (FakeRng b=0, b=17)
  //   byte 2:   (group_threshold-1)<<4 | (group_count-1) = 0x00
  //   byte 3:   group_index<<4 | (member_threshold-1)    = 0x02
  //   byte 4:   member_index                             = 0x00..0x04
  // Bytes 5+ are byte-identical to the Shamir 3/5 KAT shares.
  const RUST_3_5_SECRET = "0ff784df000c4380a5ed683f7e6e3dcf";
  const RUST_3_5_SHARES = [
    "001100020000112233445566778899aabbccddeeff", // share 0
    "0011000201d43099fe444807c46921a4f33a2a798b", // share 1
    "0011000202d9ad4e3bec2e1a7485698823abf05d36", // share 2
    "00110002030d8cf5f6ec337bc764d1866b5d07ca42", // share 3
    "00110002041aa7fe3199bc5092ef3816b074cabdf2", // share 4
  ];

  it("recovers the 3/5 secret from Rust-produced shares (combination 1, 2, 4)", () => {
    const indexes = [1, 2, 4];
    const shares = indexes.map((i) => hexToBytes(RUST_3_5_SHARES[i]));
    const recovered = sskrCombine(shares);
    expect(bytesToHex(recovered.getData())).toBe(RUST_3_5_SECRET);
  });

  it("recovers the 3/5 secret from Rust-produced shares (combination 0, 1, 2)", () => {
    const indexes = [0, 1, 2];
    const shares = indexes.map((i) => hexToBytes(RUST_3_5_SHARES[i]));
    const recovered = sskrCombine(shares);
    expect(bytesToHex(recovered.getData())).toBe(RUST_3_5_SECRET);
  });

  it("recovers the 3/5 secret from Rust-produced shares (combination 2, 3, 4)", () => {
    const indexes = [2, 3, 4];
    const shares = indexes.map((i) => hexToBytes(RUST_3_5_SHARES[i]));
    const recovered = sskrCombine(shares);
    expect(bytesToHex(recovered.getData())).toBe(RUST_3_5_SECRET);
  });

  // Rust KAT: 2-of-7 single group, 32-byte secret, FakeRng.
  // From `bc-sskr-rust/src/lib.rs::test_split_2_7` (line 156).
  // Header bytes for each share:
  //   identifier 0x0011, gt/gc 0x00, gi/mt 0x01, mi 0x00..0x06.
  const RUST_2_7_SECRET =
    "204188bfa6b440a1bdfd6753ff55a8241e07af5c5be943db917e3efabc184b1a";
  const RUST_2_7_SHARES = [
    "00110001002dcd14c2252dc8489af3985030e74d5a48e8eff1478ab86e65b43869bf39d556", // 0
    "0011000101a1dfdd798388aada635b9974472b4fc59a32ae520c42c9f6a0af70149b882487", // 1
    "00110001022ee99daf727c0c7773b89a18de64497ff7476dacd1015a45f482a893f7402cef", // 2
    "0011000103a2fb5414d4d96ee58a109b3ca9a84be0259d2c0f9ac92bdd3199e0eed3f1dd3e", // 3
    "00110001042b851d188b8f5b3653659cc0f7fa45102dadf04b708767385cd803862fcb3c3f", // 4
    "0011000105a797d4a32d2a39a4aacd9de48036478fff77b1e83b4f16a099c34bfb0b7acdee", // 5
    "001100010628a19475dcde9f09ba2e9e881979413592027216e60c8513cdee937c67b2c586", // 6
  ];

  it("recovers the 2/7 secret from Rust-produced shares (combination 3, 4)", () => {
    const indexes = [3, 4];
    const shares = indexes.map((i) => hexToBytes(RUST_2_7_SHARES[i]));
    const recovered = sskrCombine(shares);
    expect(bytesToHex(recovered.getData())).toBe(RUST_2_7_SECRET);
  });

  it("recovers the 2/7 secret from every two-share combination", () => {
    // Exhaustive sweep: any 2 of 7 shares must recover the same secret.
    // 21 combinations total.
    let combinations = 0;
    for (let i = 0; i < 7; i++) {
      for (let j = i + 1; j < 7; j++) {
        const indexes = [i, j];
        const shares = indexes.map((k) => hexToBytes(RUST_2_7_SHARES[k]));
        const recovered = sskrCombine(shares);
        expect(bytesToHex(recovered.getData())).toBe(RUST_2_7_SECRET);
        combinations++;
      }
    }
    expect(combinations).toBe(21);
  });

  // Rust KAT: 2-of-3 + 2-of-3 two groups, 32-byte secret, FakeRng.
  // From `bc-sskr-rust/src/lib.rs::test_split_2_3_2_3` (line 185).
  // Header bytes:
  //   identifier 0x0011, gt/gc 0x11 (gt=2,gc=2), gi/mt = 0x01 (g0,mt=2)
  //   or 0x11 (g1,mt=2), mi = 0x00..0x02 per group.
  const RUST_2_3_2_3_SECRET =
    "204188bfa6b440a1bdfd6753ff55a8241e07af5c5be943db917e3efabc184b1a";
  const RUST_2_3_2_3_SHARES = [
    // Group 0
    "0011110100ce5cce1ad9fe9cefa4707449576e8eadfc7d107c5a9e812b21f80aeca635cacd",
    "001111010184190ee2fcc276947ad68a6eef10694c784811720d350b061029440281a5a550",
    "00111101025ad655f193865319032793073c925b74ef171260f4d38e714341962be80e14ec",
    // Group 1
    "00111111004d741d38fcc276947ad68a6eef10694c784811720d350b061029440281a5a550",
    "0011111101b39fde657f5bfe7d5dd8756d20a28c322ea751df1156f0b3e4e3429182843b1c",
    "0011111102aab98082e1eb7d5d34ca6f686a6fb8b0d48d913335f3e677e3a6483f87e782c8",
  ];

  it("recovers the 2/3+2/3 secret from Rust-produced shares (g0[0,1] g1[0,2])", () => {
    const indexes = [0, 1, 3, 5];
    const shares = indexes.map((i) => hexToBytes(RUST_2_3_2_3_SHARES[i]));
    const recovered = sskrCombine(shares);
    expect(bytesToHex(recovered.getData())).toBe(RUST_2_3_2_3_SECRET);
  });

  it("recovers the 2/3+2/3 secret from Rust-produced shares (g0[1,2] g1[1,2])", () => {
    const indexes = [1, 2, 4, 5];
    const shares = indexes.map((i) => hexToBytes(RUST_2_3_2_3_SHARES[i]));
    const recovered = sskrCombine(shares);
    expect(bytesToHex(recovered.getData())).toBe(RUST_2_3_2_3_SECRET);
  });

  it("rejects a Rust-produced share with corrupted reserved nibble", () => {
    // Flip the reserved nibble (high nibble of byte 4) on share 0 of the
    // 3/5 fixture. Rust raises `Error::ShareReservedBitsInvalid`; TS
    // must surface the same enum variant.
    const tampered = hexToBytes(RUST_3_5_SHARES[0]);
    tampered[4] |= 0x10; // any non-zero high nibble
    expect(() => sskrCombine([tampered])).toThrow(SSKRError);
    try {
      sskrCombine([tampered]);
    } catch (e) {
      expect(e).toBeInstanceOf(SSKRError);
      expect((e as InstanceType<typeof SSKRError>).type).toBe(
        SSKRErrorType.ShareReservedBitsInvalid,
      );
    }
  });

  it("rejects a Rust-produced share that is too short", () => {
    // Truncate to 4 bytes — below METADATA_SIZE_BYTES = 5.
    const tampered = hexToBytes(RUST_3_5_SHARES[0]).slice(0, 4);
    expect(() => sskrCombine([tampered])).toThrow(SSKRError);
    try {
      sskrCombine([tampered]);
    } catch (e) {
      expect(e).toBeInstanceOf(SSKRError);
      expect((e as InstanceType<typeof SSKRError>).type).toBe(
        SSKRErrorType.ShareLengthInvalid,
      );
    }
  });

  it("rejects mismatched share-set metadata across Rust-produced shares", () => {
    // Mix one share from the 3/5 set with two shares from the 2/7 set.
    // Both have identifier 0x0011 but different groupCount/memberThreshold;
    // Rust raises `Error::ShareSetInvalid`.
    const mixed = [
      hexToBytes(RUST_3_5_SHARES[0]),
      hexToBytes(RUST_2_7_SHARES[1]),
      hexToBytes(RUST_2_7_SHARES[2]),
    ];
    expect(() => sskrCombine(mixed)).toThrow(SSKRError);
  });

  it("Rust-produced shares preserve the FakeRng identifier 0x0011", () => {
    // Confirms the identifier byte ordering matches Rust
    // (`((bytes[0] as u16) << 8) | bytes[1] as u16`). The FakeRng emits
    // bytes [0x00, 0x11] for the first identifier draw, packing to
    // 0x0011 = 17 — every Rust-produced share above must have this
    // identifier in its first two bytes.
    for (const hex of [
      RUST_3_5_SHARES[0],
      RUST_2_7_SHARES[0],
      RUST_2_3_2_3_SHARES[0],
    ]) {
      expect(hex.slice(0, 4)).toBe("0011");
    }
    // And that the recovered secret is unaffected.
    const recovered = sskrCombine(
      [0, 1, 2].map((i) => hexToBytes(RUST_3_5_SHARES[i])),
    );
    expect(recovered.equals(Secret.new(hexToBytes(RUST_3_5_SECRET)))).toBe(true);
  });
});
