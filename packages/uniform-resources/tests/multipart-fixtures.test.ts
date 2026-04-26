/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Cross-platform parity fixtures for the multipart fountain code.
 *
 * Every test in this file pins a byte-level vector taken verbatim from the
 * upstream Rust `ur` crate (`ur-0.4.1`, the same crate `bc-ur-rust` wraps
 * via its `multipart_encoder.rs` / `multipart_decoder.rs` shims). Names of
 * the Rust counterparts are listed in each describe-block.
 *
 * If a vector here ever fails, the TS port has drifted away from
 * byte-identical Rust ↔ TS interop for fountain-encoded multipart URs and
 * a regression has been introduced. See
 * `packages/uniform-resources/PARITY_AUDIT_MULTIPART.md` for context.
 */
import { describe, expect, it } from "vitest";
import { sha256 } from "@bcts/crypto";
import { cbor } from "@bcts/dcbor";
import { Xoshiro256 } from "../src/xoshiro";
import {
  FountainEncoder,
  FountainDecoder,
  chooseFragments,
  fragmentLength,
  partition,
} from "../src/fountain";
import { crc32, encodeBytewords, BytewordsStyle } from "../src/utils";

// -- helpers ---------------------------------------------------------------

const utf8 = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("hex string must have even length");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
  }
  return out;
}

/**
 * Mirrors Rust `From<&str> for Xoshiro256`:
 *   `Xoshiro256::from(value: &str)` hashes `value.as_bytes()` with
 *   SHA-256 to produce the 32-byte seed.
 */
function xoshiroFromStr(s: string): Xoshiro256 {
  return new Xoshiro256(sha256(utf8.encode(s)));
}

/**
 * Mirrors Rust `Xoshiro256::from_crc(bytes)` (test-only helper at
 * `xoshiro.rs:99-102`):
 *   `Self::from(&crc32().checksum(bytes).to_be_bytes()[..])`
 * — i.e. CRC32 of `bytes`, big-endian-serialized, SHA-256-hashed, then
 * fed to the 32-byte Xoshiro seed constructor.
 */
function xoshiroFromCrc(bytes: Uint8Array): Xoshiro256 {
  const c = crc32(bytes);
  const beBytes = new Uint8Array([
    (c >>> 24) & 0xff,
    (c >>> 16) & 0xff,
    (c >>> 8) & 0xff,
    c & 0xff,
  ]);
  return new Xoshiro256(sha256(beBytes));
}

/**
 * Mirrors Rust `xoshiro::test_utils::make_message(seed, size)` —
 * the deterministic message generator used throughout the upstream
 * test suite.
 */
function makeMessage(seed: string, size: number): Uint8Array {
  return xoshiroFromStr(seed).nextData(size);
}

// -- test_rng_1 / test_rng_2 / test_rng_3 ---------------------------------
// Source: `ur-0.4.1/src/xoshiro.rs::tests::test_rng_{1,2,3}` (lines 116-158).

describe("Xoshiro256 cross-platform fixture", () => {
  it("test_rng_1: 100 'Wolf'-seeded next() values mod 100", () => {
    const rng = xoshiroFromStr("Wolf");
    const expected = [
      42, 81, 85, 8, 82, 84, 76, 73, 70, 88, 2, 74, 40, 48, 77, 54, 88, 7, 5,
      88, 37, 25, 82, 13, 69, 59, 30, 39, 11, 82, 19, 99, 45, 87, 30, 15, 32,
      22, 89, 44, 92, 77, 29, 78, 4, 92, 44, 68, 92, 69, 1, 42, 89, 50, 37, 84,
      63, 34, 32, 3, 17, 62, 40, 98, 82, 89, 24, 43, 85, 39, 15, 3, 99, 29, 20,
      42, 27, 10, 85, 66, 50, 35, 69, 70, 70, 74, 30, 13, 72, 54, 11, 5, 70,
      55, 91, 52, 10, 43, 43, 52,
    ];
    for (const e of expected) {
      expect(Number(rng.next() % 100n)).toBe(e);
    }
  });

  it("test_rng_2: 100 'Wolf'-CRC-seeded next() values mod 100", () => {
    const rng = xoshiroFromCrc(utf8.encode("Wolf"));
    const expected = [
      88, 44, 94, 74, 0, 99, 7, 77, 68, 35, 47, 78, 19, 21, 50, 15, 42, 36, 91,
      11, 85, 39, 64, 22, 57, 11, 25, 12, 1, 91, 17, 75, 29, 47, 88, 11, 68,
      58, 27, 65, 21, 54, 47, 54, 73, 83, 23, 58, 75, 27, 26, 15, 60, 36, 30,
      21, 55, 57, 77, 76, 75, 47, 53, 76, 9, 91, 14, 69, 3, 95, 11, 73, 20, 99,
      68, 61, 3, 98, 36, 98, 56, 65, 14, 80, 74, 57, 63, 68, 51, 56, 24, 39,
      53, 80, 57, 51, 81, 3, 1, 30,
    ];
    for (const e of expected) {
      expect(Number(rng.next() % 100n)).toBe(e);
    }
  });

  it("test_rng_3: 100 'Wolf'-seeded nextInt(1, 10) values", () => {
    const rng = xoshiroFromStr("Wolf");
    const expected = [
      6, 5, 8, 4, 10, 5, 7, 10, 4, 9, 10, 9, 7, 7, 1, 1, 2, 9, 9, 2, 6, 4, 5,
      7, 8, 5, 4, 2, 3, 8, 7, 4, 5, 1, 10, 9, 3, 10, 2, 6, 8, 5, 7, 9, 3, 1, 5,
      2, 7, 1, 4, 4, 4, 4, 9, 4, 5, 5, 6, 9, 5, 1, 2, 8, 3, 3, 2, 8, 4, 3, 2,
      1, 10, 8, 9, 3, 10, 8, 5, 5, 6, 7, 10, 5, 8, 9, 4, 6, 4, 2, 10, 2, 1, 7,
      9, 6, 7, 4, 2, 5,
    ];
    for (const e of expected) {
      expect(rng.nextInt(1, 10)).toBe(e);
    }
  });

  it("test_shuffle: 10 'Wolf'-seeded shuffles of [1..=10]", () => {
    const rng = xoshiroFromStr("Wolf");
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const expected = [
      [6, 4, 9, 3, 10, 5, 7, 8, 1, 2],
      [10, 8, 6, 5, 1, 2, 3, 9, 7, 4],
      [6, 4, 5, 8, 9, 3, 2, 1, 7, 10],
      [7, 3, 5, 1, 10, 9, 4, 8, 2, 6],
      [8, 5, 7, 10, 2, 1, 4, 3, 9, 6],
      [4, 3, 5, 6, 10, 2, 7, 8, 9, 1],
      [5, 1, 3, 9, 4, 6, 2, 10, 7, 8],
      [2, 1, 10, 8, 9, 4, 7, 6, 3, 5],
      [6, 7, 10, 4, 8, 9, 2, 3, 1, 5],
      [10, 2, 1, 7, 9, 5, 6, 3, 4, 8],
    ];
    for (const e of expected) {
      expect(rng.shuffled(values)).toEqual(e);
    }
  });
});

// -- test_choose_degree (uses sampler internally) -------------------------
// Source: `ur-0.4.1/src/sampler.rs::tests::test_choose_degree` (lines 107-128).

describe("Xoshiro256.chooseDegree cross-platform fixture", () => {
  it("test_choose_degree: degrees for 'Wolf-{nonce}' seeds, nonces 1..=200", () => {
    const message = makeMessage("Wolf", 1024);
    const fragLen = fragmentLength(message.length, 100);
    const fragments = partition(message, fragLen);
    const expectedDegrees = [
      11, 3, 6, 5, 2, 1, 2, 11, 1, 3, 9, 10, 10, 4, 2, 1, 1, 2, 1, 1, 5, 2, 4,
      10, 3, 2, 1, 1, 3, 11, 2, 6, 2, 9, 9, 2, 6, 7, 2, 5, 2, 4, 3, 1, 6, 11,
      2, 11, 3, 1, 6, 3, 1, 4, 5, 3, 6, 1, 1, 3, 1, 2, 2, 1, 4, 5, 1, 1, 9, 1,
      1, 6, 4, 1, 5, 1, 2, 2, 3, 1, 1, 5, 2, 6, 1, 7, 11, 1, 8, 1, 5, 1, 1, 2,
      2, 6, 4, 10, 1, 2, 5, 5, 5, 1, 1, 4, 1, 1, 1, 3, 5, 5, 5, 1, 4, 3, 3, 5,
      1, 11, 3, 2, 8, 1, 2, 1, 1, 4, 5, 2, 1, 1, 1, 5, 6, 11, 10, 7, 4, 7, 1,
      5, 3, 1, 1, 9, 1, 2, 5, 5, 2, 2, 3, 10, 1, 3, 2, 3, 3, 1, 1, 2, 1, 3, 2,
      2, 1, 3, 8, 4, 1, 11, 6, 3, 1, 1, 1, 1, 1, 3, 1, 2, 1, 10, 1, 1, 8, 2,
      7, 1, 2, 1, 9, 2, 10, 2, 1, 3, 4, 10,
    ];
    for (let nonce = 1; nonce <= 200; nonce++) {
      const rng = xoshiroFromStr(`Wolf-${nonce}`);
      expect(rng.chooseDegree(fragments.length)).toBe(expectedDegrees[nonce - 1]);
    }
  });
});

// -- test_fragment_length -------------------------------------------------
// Source: `ur-0.4.1/src/fountain.rs::tests::test_fragment_length` (lines 675-683).

describe("fragmentLength cross-platform fixture", () => {
  it("matches Rust fragment_length for the documented vector", () => {
    expect(fragmentLength(12345, 1955)).toBe(1764);
    expect(fragmentLength(12345, 30000)).toBe(12345);
    expect(fragmentLength(10, 4)).toBe(4);
    expect(fragmentLength(10, 5)).toBe(5);
    expect(fragmentLength(10, 6)).toBe(5);
    expect(fragmentLength(10, 10)).toBe(10);
  });
});

// -- test_partition_and_join ---------------------------------------------
// Source: `ur-0.4.1/src/fountain.rs::tests::test_partition_and_join`
// (lines 686-715).

describe("partition cross-platform fixture", () => {
  it("test_partition_and_join: 1024-byte 'Wolf' msg @ max=100", () => {
    const message = makeMessage("Wolf", 1024);
    const fragLen = fragmentLength(message.length, 100);
    const fragments = partition(message, fragLen);
    const expectedFragments = [
      "916ec65cf77cadf55cd7f9cda1a1030026ddd42e905b77adc36e4f2d3ccba44f7f04f2de44f42d84c374a0e149136f25b01852545961d55f7f7a8cde6d0e2ec43f3b2dcb644a2209e8c9e34af5c4747984a5e873c9cf5f965e25ee29039f",
      "df8ca74f1c769fc07eb7ebaec46e0695aea6cbd60b3ec4bbff1b9ffe8a9e7240129377b9d3711ed38d412fbb4442256f1e6f595e0fc57fed451fb0a0101fb76b1fb1e1b88cfdfdaa946294a47de8fff173f021c0e6f65b05c0a494e50791",
      "270a0050a73ae69b6725505a2ec8a5791457c9876dd34aadd192a53aa0dc66b556c0c215c7ceb8248b717c22951e65305b56a3706e3e86eb01c803bbf915d80edcd64d4d41977fa6f78dc07eecd072aae5bc8a852397e06034dba6a0b570",
      "797c3a89b16673c94838d884923b8186ee2db5c98407cab15e13678d072b43e406ad49477c2e45e85e52ca82a94f6df7bbbe7afbed3a3a830029f29090f25217e48d1f42993a640a67916aa7480177354cc7440215ae41e4d02eae9a1912",
      "33a6d4922a792c1b7244aa879fefdb4628dc8b0923568869a983b8c661ffab9b2ed2c149e38d41fba090b94155adbed32f8b18142ff0d7de4eeef2b04adf26f2456b46775c6c20b37602df7da179e2332feba8329bbb8d727a138b4ba7a5",
      "03215eda2ef1e953d89383a382c11d3f2cad37a4ee59a91236a3e56dcf89f6ac81dd4159989c317bd649d9cbc617f73fe10033bd288c60977481a09b343d3f676070e67da757b86de27bfca74392bac2996f7822a7d8f71a489ec6180390",
      "089ea80a8fcd6526413ec6c9a339115f111d78ef21d456660aa85f790910ffa2dc58d6a5b93705caef1091474938bd312427021ad1eeafbd19e0d916ddb111fabd8dcab5ad6a6ec3a9c6973809580cb2c164e26686b5b98cfb017a337968",
      "c7daaa14ae5152a067277b1b3902677d979f8e39cc2aafb3bc06fcf69160a853e6869dcc09a11b5009f91e6b89e5b927ab1527a735660faa6012b420dd926d940d742be6a64fb01cdc0cff9faa323f02ba41436871a0eab851e7f5782d10",
      "fbefde2a7e9ae9dc1e5c2c48f74f6c824ce9ef3c89f68800d44587bedc4ab417cfb3e7447d90e1e417e6e05d30e87239d3a5d1d45993d4461e60a0192831640aa32dedde185a371ded2ae15f8a93dba8809482ce49225daadfbb0fec629e",
      "23880789bdf9ed73be57fa84d555134630e8d0f7df48349f29869a477c13ccca9cd555ac42ad7f568416c3d61959d0ed568b2b81c7771e9088ad7fd55fd4386bafbf5a528c30f107139249357368ffa980de2c76ddd9ce4191376be0e6b5",
      "170010067e2e75ebe2d2904aeb1f89d5dc98cd4a6f2faaa8be6d03354c990fd895a97feb54668473e9d942bb99e196d897e8f1b01625cf48a7b78d249bb4985c065aa8cd1402ed2ba1b6f908f63dcd84b66425df00000000000000000000",
    ];
    expect(fragments.length).toBe(expectedFragments.length);
    for (let i = 0; i < fragments.length; i++) {
      expect(bytesToHex(fragments[i])).toBe(expectedFragments[i]);
    }
    // join: concatenate fragments and truncate to message_length.
    const joined = new Uint8Array(message.length);
    let offset = 0;
    for (const f of fragments) {
      const remaining = message.length - offset;
      const slice = f.slice(0, Math.min(f.length, remaining));
      joined.set(slice, offset);
      offset += slice.length;
    }
    expect(bytesToHex(joined)).toBe(bytesToHex(message));
  });
});

// -- test_xor -------------------------------------------------------------
// Source: `ur-0.4.1/src/fountain.rs::tests::test_xor` (lines 763-778).

describe("xor cross-platform fixture", () => {
  it("test_xor: 'Wolf'-seeded 10-byte streams xor", () => {
    const rng = xoshiroFromStr("Wolf");
    const data1 = rng.nextData(10);
    expect(bytesToHex(data1)).toBe("916ec65cf77cadf55cd7");
    const data2 = rng.nextData(10);
    expect(bytesToHex(data2)).toBe("f9cda1a1030026ddd42e");
    const data3 = new Uint8Array(data1);
    for (let i = 0; i < data3.length; i++) {
      data3[i] ^= data2[i];
    }
    expect(bytesToHex(data3)).toBe("68a367fdf47c8b2888f9");
    // xor-then-xor returns the original
    for (let i = 0; i < data3.length; i++) {
      data3[i] ^= data1[i];
    }
    expect(bytesToHex(data3)).toBe(bytesToHex(data2));
  });
});

// -- test_choose_fragments -----------------------------------------------
// Source: `ur-0.4.1/src/fountain.rs::tests::test_choose_fragments`
// (lines 718-760).

describe("chooseFragments cross-platform fixture", () => {
  it("test_choose_fragments: index sets for seqNum 1..=30 of 1024-byte 'Wolf' @ max=100", () => {
    const message = makeMessage("Wolf", 1024);
    const checksum = crc32(message);
    const fragLen = fragmentLength(message.length, 100);
    const fragments = partition(message, fragLen);
    const expected: number[][] = [
      [0],
      [1],
      [2],
      [3],
      [4],
      [5],
      [6],
      [7],
      [8],
      [9],
      [10],
      [9],
      [2, 5, 6, 8, 9, 10],
      [8],
      [1, 5],
      [1],
      [0, 2, 4, 5, 8, 10],
      [5],
      [2],
      [2],
      [0, 1, 3, 4, 5, 7, 9, 10],
      [0, 1, 2, 3, 5, 6, 8, 9, 10],
      [0, 2, 4, 5, 7, 8, 9, 10],
      [3, 5],
      [4],
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      [0, 1, 3, 4, 5, 6, 7, 9, 10],
      [6],
      [5, 6],
      [7],
    ];
    for (let seqNum = 1; seqNum <= 30; seqNum++) {
      const indexes = chooseFragments(seqNum, fragments.length, checksum)
        .slice()
        .sort((a, b) => a - b);
      expect(indexes).toEqual(expected[seqNum - 1]);
    }
  });
});

// -- test_fountain_encoder ------------------------------------------------
// Source: `ur-0.4.1/src/fountain.rs::tests::test_fountain_encoder`
// (lines 781-819).

describe("FountainEncoder cross-platform fixture", () => {
  it("test_fountain_encoder: 256-byte 'Wolf' @ max=30, 20 parts", () => {
    const message = makeMessage("Wolf", 256);
    const encoder = new FountainEncoder(message, 30);
    const expectedHex = [
      "916ec65cf77cadf55cd7f9cda1a1030026ddd42e905b77adc36e4f2d3c",
      "cba44f7f04f2de44f42d84c374a0e149136f25b01852545961d55f7f7a",
      "8cde6d0e2ec43f3b2dcb644a2209e8c9e34af5c4747984a5e873c9cf5f",
      "965e25ee29039fdf8ca74f1c769fc07eb7ebaec46e0695aea6cbd60b3e",
      "c4bbff1b9ffe8a9e7240129377b9d3711ed38d412fbb4442256f1e6f59",
      "5e0fc57fed451fb0a0101fb76b1fb1e1b88cfdfdaa946294a47de8fff1",
      "73f021c0e6f65b05c0a494e50791270a0050a73ae69b6725505a2ec8a5",
      "791457c9876dd34aadd192a53aa0dc66b556c0c215c7ceb8248b717c22",
      "951e65305b56a3706e3e86eb01c803bbf915d80edcd64d4d0000000000",
      "330f0f33a05eead4f331df229871bee733b50de71afd2e5a79f196de09",
      "3b205ce5e52d8c24a52cffa34c564fa1af3fdffcd349dc4258ee4ee828",
      "dd7bf725ea6c16d531b5f03254783803048ca08b87148daacd1cd7a006",
      "760be7ad1c6187902bbc04f539b9ee5eb8ea6833222edea36031306c01",
      "5bf4031217d2c3254b088fa7553778b5003632f46e21db129416f65b55",
      "73f021c0e6f65b05c0a494e50791270a0050a73ae69b6725505a2ec8a5",
      "b8546ebfe2048541348910267331c643133f828afec9337c318f71b7df",
      "23dedeea74e3a0fb052befabefa13e2f80e4315c9dceed4c8630612e64",
      "d01a8daee769ce34b6b35d3ca0005302724abddae405bdb419c0a6b208",
      "3171c5dc365766eff25ae47c6f10e7de48cfb8474e050e5fe997a6dc24",
      "e055c2433562184fa71b4be94f262e200f01c6f74c284b0dc6fae6673f",
    ];
    // Rust: 256 / 30 + 1 = 9 (because partition rounds the
    // fragment_length down to 29).
    expect(encoder.seqLen).toBe(9);
    for (let i = 0; i < expectedHex.length; i++) {
      const part = encoder.nextPart();
      expect(part.seqNum).toBe(i + 1);
      expect(part.seqLen).toBe(9);
      expect(part.messageLen).toBe(256);
      expect(part.checksum).toBe(23_570_951);
      expect(bytesToHex(part.data)).toBe(expectedHex[i]);
    }
  });

  it("test_fountain_encoder_cbor: same encoder produces the documented CBOR bytes", () => {
    const message = makeMessage("Wolf", 256);
    const encoder = new FountainEncoder(message, 30);
    const expectedCbor = [
      "8501091901001a0167aa07581d916ec65cf77cadf55cd7f9cda1a1030026ddd42e905b77adc36e4f2d3c",
      "8502091901001a0167aa07581dcba44f7f04f2de44f42d84c374a0e149136f25b01852545961d55f7f7a",
      "8503091901001a0167aa07581d8cde6d0e2ec43f3b2dcb644a2209e8c9e34af5c4747984a5e873c9cf5f",
      "8504091901001a0167aa07581d965e25ee29039fdf8ca74f1c769fc07eb7ebaec46e0695aea6cbd60b3e",
      "8505091901001a0167aa07581dc4bbff1b9ffe8a9e7240129377b9d3711ed38d412fbb4442256f1e6f59",
      "8506091901001a0167aa07581d5e0fc57fed451fb0a0101fb76b1fb1e1b88cfdfdaa946294a47de8fff1",
      "8507091901001a0167aa07581d73f021c0e6f65b05c0a494e50791270a0050a73ae69b6725505a2ec8a5",
      "8508091901001a0167aa07581d791457c9876dd34aadd192a53aa0dc66b556c0c215c7ceb8248b717c22",
      "8509091901001a0167aa07581d951e65305b56a3706e3e86eb01c803bbf915d80edcd64d4d0000000000",
      "850a091901001a0167aa07581d330f0f33a05eead4f331df229871bee733b50de71afd2e5a79f196de09",
      "850b091901001a0167aa07581d3b205ce5e52d8c24a52cffa34c564fa1af3fdffcd349dc4258ee4ee828",
      "850c091901001a0167aa07581ddd7bf725ea6c16d531b5f03254783803048ca08b87148daacd1cd7a006",
      "850d091901001a0167aa07581d760be7ad1c6187902bbc04f539b9ee5eb8ea6833222edea36031306c01",
      "850e091901001a0167aa07581d5bf4031217d2c3254b088fa7553778b5003632f46e21db129416f65b55",
      "850f091901001a0167aa07581d73f021c0e6f65b05c0a494e50791270a0050a73ae69b6725505a2ec8a5",
      "8510091901001a0167aa07581db8546ebfe2048541348910267331c643133f828afec9337c318f71b7df",
      "8511091901001a0167aa07581d23dedeea74e3a0fb052befabefa13e2f80e4315c9dceed4c8630612e64",
      "8512091901001a0167aa07581dd01a8daee769ce34b6b35d3ca0005302724abddae405bdb419c0a6b208",
      "8513091901001a0167aa07581d3171c5dc365766eff25ae47c6f10e7de48cfb8474e050e5fe997a6dc24",
      "8514091901001a0167aa07581de055c2433562184fa71b4be94f262e200f01c6f74c284b0dc6fae6673f",
    ];
    expect(encoder.seqLen).toBe(9);
    for (const e of expectedCbor) {
      const part = encoder.nextPart();
      const partCbor = cbor([
        part.seqNum,
        part.seqLen,
        part.messageLen,
        part.checksum,
        part.data,
      ]).toData();
      expect(bytesToHex(partCbor)).toBe(e);
    }
  });

  it("FountainEncoder is_complete after seqLen parts", () => {
    const message = makeMessage("Wolf", 256);
    const encoder = new FountainEncoder(message, 30);
    expect(encoder.isComplete()).toBe(false);
    for (let i = 0; i < encoder.seqLen; i++) {
      encoder.nextPart();
    }
    expect(encoder.isComplete()).toBe(true);
  });
});

// -- test_decoder ---------------------------------------------------------
// Source: `ur-0.4.1/src/fountain.rs::tests::test_decoder` (lines 873-887)
// and `test_decoder_skip_some_simple_fragments` (lines 895-912).

describe("FountainDecoder cross-platform behaviour", () => {
  it("test_decoder: round-trips a 32767-byte 'Wolf' message at max=1000", () => {
    const message = makeMessage("Wolf", 32767);
    const encoder = new FountainEncoder(message, 1000);
    const decoder = new FountainDecoder();
    while (!decoder.isComplete()) {
      expect(decoder.message()).toBeNull();
      decoder.receive(encoder.nextPart());
    }
    const recovered = decoder.message();
    expect(recovered).not.toBeNull();
    expect(bytesToHex(recovered as Uint8Array)).toBe(bytesToHex(message));
  });

  it("test_decoder_skip_some_simple_fragments: still recovers when half the parts are dropped", () => {
    const message = makeMessage("Wolf", 32767);
    const encoder = new FountainEncoder(message, 1000);
    const decoder = new FountainDecoder();
    let skip = false;
    while (!decoder.isComplete()) {
      const part = encoder.nextPart();
      if (!skip) decoder.receive(part);
      skip = !skip;
    }
    const recovered = decoder.message();
    expect(recovered).not.toBeNull();
    expect(bytesToHex(recovered as Uint8Array)).toBe(bytesToHex(message));
  });

  it("rejects empty parts (Rust EmptyPart)", () => {
    const decoder = new FountainDecoder();
    expect(() =>
      decoder.receive({
        seqNum: 1,
        seqLen: 0,
        messageLen: 100,
        checksum: 0,
        data: new Uint8Array([1]),
      }),
    ).toThrow(/non-empty/);
    expect(() =>
      decoder.receive({
        seqNum: 1,
        seqLen: 1,
        messageLen: 0,
        checksum: 0,
        data: new Uint8Array([1]),
      }),
    ).toThrow(/non-empty/);
    expect(() =>
      decoder.receive({
        seqNum: 1,
        seqLen: 1,
        messageLen: 100,
        checksum: 0,
        data: new Uint8Array([]),
      }),
    ).toThrow(/non-empty/);
  });

  it("rejects parts whose fragment length differs from the first received", () => {
    const decoder = new FountainDecoder();
    decoder.receive({
      seqNum: 1,
      seqLen: 2,
      messageLen: 4,
      checksum: 0x1234,
      data: new Uint8Array([1, 2]),
    });
    // Different fragment_length (3 instead of 2) — Rust validate() rejects.
    expect(() =>
      decoder.receive({
        seqNum: 2,
        seqLen: 2,
        messageLen: 4,
        checksum: 0x1234,
        data: new Uint8Array([1, 2, 3]),
      }),
    ).toThrow(/inconsistent/);
  });
});

// -- test_ur_encoder ------------------------------------------------------
// Source: `ur-0.4.1/src/ur.rs::tests::test_ur_encoder` (lines 353-383).
// Re-implements the upstream `Encoder::next_part` on top of our
// FountainEncoder (`bytes` UR-type, minimal-bytewords-encoded CBOR part)
// and verifies the resulting URIs match Rust character-for-character.

describe("UR encoder cross-platform fixture", () => {
  it("test_ur_encoder: 256-byte 'Wolf' wrapped as ur:bytes/n-9/...", () => {
    // Wrap the raw "Wolf" message as `bytes(...)` CBOR — this is what
    // Rust's `make_message_ur` produces (using minicbor::to_vec(ByteVec)).
    const messageCbor = cbor(makeMessage("Wolf", 256)).toData();
    const encoder = new FountainEncoder(messageCbor, 30);
    const expected = [
      "ur:bytes/1-9/lpadascfadaxcywenbpljkhdcahkadaemejtswhhylkepmykhhtsytsnoyoyaxaedsuttydmmhhpktpmsrjtdkgslpgh",
      "ur:bytes/2-9/lpaoascfadaxcywenbpljkhdcagwdpfnsboxgwlbaawzuefywkdplrsrjynbvygabwjldapfcsgmghhkhstlrdcxaefz",
      "ur:bytes/3-9/lpaxascfadaxcywenbpljkhdcahelbknlkuejnbadmssfhfrdpsbiegecpasvssovlgeykssjykklronvsjksopdzmol",
      "ur:bytes/4-9/lpaaascfadaxcywenbpljkhdcasotkhemthydawydtaxneurlkosgwcekonertkbrlwmplssjtammdplolsbrdzcrtas",
      "ur:bytes/5-9/lpahascfadaxcywenbpljkhdcatbbdfmssrkzmcwnezelennjpfzbgmuktrhtejscktelgfpdlrkfyfwdajldejokbwf",
      "ur:bytes/6-9/lpamascfadaxcywenbpljkhdcackjlhkhybssklbwefectpfnbbectrljectpavyrolkzczcpkmwidmwoxkilghdsowp",
      "ur:bytes/7-9/lpatascfadaxcywenbpljkhdcavszmwnjkwtclrtvaynhpahrtoxmwvwatmedibkaegdosftvandiodagdhthtrlnnhy",
      "ur:bytes/8-9/lpayascfadaxcywenbpljkhdcadmsponkkbbhgsoltjntegepmttmoonftnbuoiyrehfrtsabzsttorodklubbuyaetk",
      "ur:bytes/9-9/lpasascfadaxcywenbpljkhdcajskecpmdckihdyhphfotjojtfmlnwmadspaxrkytbztpbauotbgtgtaeaevtgavtny",
      "ur:bytes/10-9/lpbkascfadaxcywenbpljkhdcahkadaemejtswhhylkepmykhhtsytsnoyoyaxaedsuttydmmhhpktpmsrjtwdkiplzs",
      "ur:bytes/11-9/lpbdascfadaxcywenbpljkhdcahelbknlkuejnbadmssfhfrdpsbiegecpasvssovlgeykssjykklronvsjkvetiiapk",
      "ur:bytes/12-9/lpbnascfadaxcywenbpljkhdcarllaluzmdmgstospeyiefmwejlwtpedamktksrvlcygmzemovovllarodtmtbnptrs",
      "ur:bytes/13-9/lpbtascfadaxcywenbpljkhdcamtkgtpknghchchyketwsvwgwfdhpgmgtylctotzopdrpayoschcmhplffziachrfgd",
      "ur:bytes/14-9/lpbaascfadaxcywenbpljkhdcapazewnvonnvdnsbyleynwtnsjkjndeoldydkbkdslgjkbbkortbelomueekgvstegt",
      "ur:bytes/15-9/lpbsascfadaxcywenbpljkhdcaynmhpddpzmversbdqdfyrehnqzlugmjzmnmtwmrouohtstgsbsahpawkditkckynwt",
      "ur:bytes/16-9/lpbeascfadaxcywenbpljkhdcawygekobamwtlihsnpalnsghenskkiynthdzotsimtojetprsttmukirlrsbtamjtpd",
      "ur:bytes/17-9/lpbyascfadaxcywenbpljkhdcamklgftaxykpewyrtqzhydntpnytyisincxmhtbceaykolduortotiaiaiafhiaoyce",
      "ur:bytes/18-9/lpbgascfadaxcywenbpljkhdcahkadaemejtswhhylkepmykhhtsytsnoyoyaxaedsuttydmmhhpktpmsrjtntwkbkwy",
      "ur:bytes/19-9/lpbwascfadaxcywenbpljkhdcadekicpaajootjzpsdrbalpeywllbdsnbinaerkurspbncxgslgftvtsrjtksplcpeo",
      "ur:bytes/20-9/lpbbascfadaxcywenbpljkhdcayapmrleeleaxpasfrtrdkncffwjyjzgyetdmlewtkpktgllepfrltataztksmhkbot",
    ];
    expect(encoder.seqLen).toBe(9);
    for (const e of expected) {
      const part = encoder.nextPart();
      const partCbor = cbor([
        part.seqNum,
        part.seqLen,
        part.messageLen,
        part.checksum,
        part.data,
      ]).toData();
      const body = encodeBytewords(partCbor, BytewordsStyle.Minimal);
      const uri = `ur:bytes/${part.seqNum}-${part.seqLen}/${body}`;
      expect(uri).toBe(e);
    }
  });

  it("hex roundtrip via hexToBytes/bytesToHex sanity check", () => {
    expect(bytesToHex(hexToBytes("00ff10"))).toBe("00ff10");
  });
});
