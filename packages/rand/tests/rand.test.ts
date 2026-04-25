// Tests ported from bc-rand-rust

import {
  SeededRandomNumberGenerator,
  SecureRandomNumberGenerator,
  makeFakeRandomNumberGenerator,
  fakeRandomData,
  randomData,
  threadRng,
  rngRandomArray,
  rngRandomBool,
  rngRandomU32,
  rngFillRandomData,
  rngNextWithUpperBound,
  rngNextWithUpperBoundU8,
  rngNextWithUpperBoundU16,
  rngNextWithUpperBoundU32,
  rngNextWithUpperBoundU64,
  rngNextInRange,
  rngNextInRangeI32,
  rngNextInClosedRange,
  rngNextInClosedRangeI32,
  wideMulU8,
  wideMulU16,
  wideMulU32,
  wideMulU64,
  toMagnitude,
  toMagnitude64,
  fromMagnitude,
  fromMagnitude64,
} from "../src/index";

// Standard test seed used across Blockchain Commons implementations.
// Mirrors the private TEST_SEED in `bc-rand-rust/src/seeded_random.rs`.
const TEST_SEED: [bigint, bigint, bigint, bigint] = [
  17295166580085024720n,
  422929670265678780n,
  5577237070365765850n,
  7953171132032326923n,
];

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("SeededRandomNumberGenerator", () => {
  test("test_next_u64", () => {
    const rng = new SeededRandomNumberGenerator(TEST_SEED);
    expect(rng.nextU64()).toBe(1104683000648959614n);
  });

  test("test_next_50", () => {
    const rng = new SeededRandomNumberGenerator(TEST_SEED);
    const expectedValues: bigint[] = [
      1104683000648959614n,
      9817345228149227957n,
      546276821344993881n,
      15870950426333349563n,
      830653509032165567n,
      14772257893953840492n,
      3512633850838187726n,
      6358411077290857510n,
      7897285047238174514n,
      18314839336815726031n,
      4978716052961022367n,
      17373022694051233817n,
      663115362299242570n,
      9811238046242345451n,
      8113787839071393872n,
      16155047452816275860n,
      673245095821315645n,
      1610087492396736743n,
      1749670338128618977n,
      3927771759340679115n,
      9610589375631783853n,
      5311608497352460372n,
      11014490817524419548n,
      6320099928172676090n,
      12513554919020212402n,
      6823504187935853178n,
      1215405011954300226n,
      8109228150255944821n,
      4122548551796094879n,
      16544885818373129566n,
      5597102191057004591n,
      11690994260783567085n,
      9374498734039011409n,
      18246806104446739078n,
      2337407889179712900n,
      12608919248151905477n,
      7641631838640172886n,
      8421574250687361351n,
      8697189342072434208n,
      8766286633078002696n,
      14800090277885439654n,
      17865860059234099833n,
      4673315107448681522n,
      14288183874156623863n,
      7587575203648284614n,
      9109213819045273474n,
      11817665411945280786n,
      1745089530919138651n,
      5730370365819793488n,
      5496865518262805451n,
    ];

    for (const expected of expectedValues) {
      expect(rng.nextU64()).toBe(expected);
    }
  });

  test("test_fake_random_data", () => {
    const data = fakeRandomData(100);
    const expected =
      "7eb559bbbf6cce2632cf9f194aeb50943de7e1cbad54dcfab27a42759f5e2fed518684c556472008a67932f7c682125b50cb72e8216f6906358fdaf28d3545532daee0c5bb5023f50cd8e71ec14901ac746c576c481b893be6656b80622b3a564e59b4e2";
    expect(bytesToHex(data)).toBe(expected);
  });

  test("test_next_with_upper_bound", () => {
    const rng = new SeededRandomNumberGenerator(TEST_SEED);
    expect(rngNextWithUpperBoundU32(rng, 10000)).toBe(745);
  });

  test("test_in_range", () => {
    const rng = new SeededRandomNumberGenerator(TEST_SEED);
    const v: number[] = [];
    for (let i = 0; i < 100; i++) {
      v.push(rngNextInRangeI32(rng, 0, 100));
    }
    const expected: number[] = [
      7, 44, 92, 16, 16, 67, 41, 74, 66, 20, 18, 6, 62, 34, 4, 69, 99, 19, 0, 85, 22, 27, 56, 23,
      19, 5, 23, 76, 80, 27, 74, 69, 17, 92, 31, 32, 55, 36, 49, 23, 53, 2, 46, 6, 43, 66, 34, 71,
      64, 69, 25, 14, 17, 23, 32, 6, 23, 65, 35, 11, 21, 37, 58, 92, 98, 8, 38, 49, 7, 24, 24, 71,
      37, 63, 91, 21, 11, 66, 52, 54, 55, 19, 76, 46, 89, 38, 91, 95, 33, 25, 4, 30, 66, 51, 5, 91,
      62, 27, 92, 39,
    ];
    expect(v).toEqual(expected);
  });

  test("test_fill_random_data", () => {
    let rng = new SeededRandomNumberGenerator(TEST_SEED);
    const v1 = rng.randomData(100);

    rng = new SeededRandomNumberGenerator(TEST_SEED);
    const v2 = new Uint8Array(100);
    rng.fillRandomData(v2);

    expect(v1).toEqual(v2);
  });

  test("test_fake_numbers (from random_number_generator.rs)", () => {
    const rng = makeFakeRandomNumberGenerator();
    const array: number[] = [];
    for (let i = 0; i < 100; i++) {
      array.push(rngNextInClosedRangeI32(rng, -50, 50));
    }
    const expected = [
      -43, -6, 43, -34, -34, 17, -9, 24, 17, -29, -32, -44, 12, -15, -46, 20, 50, -31, -50, 36, -28,
      -23, 6, -27, -31, -45, -27, 26, 31, -23, 24, 19, -32, 43, -18, -17, 6, -13, -1, -27, 4, -48,
      -4, -44, -6, 17, -15, 22, 15, 20, -25, -35, -33, -27, -17, -44, -27, 15, -14, -38, -29, -12,
      8, 43, 49, -42, -11, -1, -42, -26, -25, 22, -13, 14, 42, -29, -38, 17, 2, 5, 5, -31, 27, -3,
      39, -12, 42, 46, -17, -25, -46, -19, 16, 2, -45, 41, 12, -22, 43, -11,
    ];
    expect(array).toEqual(expected);
  });
});

describe("SecureRandomNumberGenerator", () => {
  test("test_random_data", () => {
    const data1 = randomData(32);
    const data2 = randomData(32);
    const data3 = randomData(32);

    expect(data1.length).toBe(32);
    expect(data1).not.toEqual(data2);
    expect(data1).not.toEqual(data3);
  });

  test("test_secure_rng_instance", () => {
    const rng = new SecureRandomNumberGenerator();

    const data1 = rng.randomData(32);
    const data2 = rng.randomData(32);

    expect(data1.length).toBe(32);
    expect(data2.length).toBe(32);
    expect(data1).not.toEqual(data2);
  });

  test("test_next_u32", () => {
    const rng = new SecureRandomNumberGenerator();
    const v1 = rng.nextU32();
    const v2 = rng.nextU32();

    // Values should be in valid u32 range
    expect(v1).toBeGreaterThanOrEqual(0);
    expect(v1).toBeLessThanOrEqual(0xffffffff);
    expect(v2).toBeGreaterThanOrEqual(0);
    expect(v2).toBeLessThanOrEqual(0xffffffff);
  });

  test("test_next_u64", () => {
    const rng = new SecureRandomNumberGenerator();
    const v1 = rng.nextU64();
    const v2 = rng.nextU64();

    // Values should be in valid u64 range
    expect(v1).toBeGreaterThanOrEqual(0n);
    expect(v1).toBeLessThanOrEqual(0xffffffffffffffffn);
    expect(v2).toBeGreaterThanOrEqual(0n);
    expect(v2).toBeLessThanOrEqual(0xffffffffffffffffn);
  });

  test("threadRng returns a working SecureRandomNumberGenerator", () => {
    const rng = threadRng();
    expect(rng).toBeInstanceOf(SecureRandomNumberGenerator);
    expect(rng.randomData(16).length).toBe(16);
  });
});

describe("rng utility functions", () => {
  test("rngNextInClosedRange", () => {
    const rng = makeFakeRandomNumberGenerator();
    const value = rngNextInClosedRange(rng, 0n, 100n);
    expect(value).toBeGreaterThanOrEqual(0n);
    expect(value).toBeLessThanOrEqual(100n);
  });

  test("rngNextInRange", () => {
    const rng = makeFakeRandomNumberGenerator();
    const value = rngNextInRange(rng, 0n, 100n);
    expect(value).toBeGreaterThanOrEqual(0n);
    expect(value).toBeLessThan(100n);
  });

  test("rngNextWithUpperBound throws on zero", () => {
    const rng = makeFakeRandomNumberGenerator();
    expect(() => rngNextWithUpperBound(rng, 0n)).toThrow("upperBound must be non-zero");
  });

  test("rngNextWithUpperBoundU8/U16/U32/U64 throw on zero", () => {
    const rng = makeFakeRandomNumberGenerator();
    expect(() => rngNextWithUpperBoundU8(rng, 0)).toThrow("upperBound must be non-zero");
    expect(() => rngNextWithUpperBoundU16(rng, 0)).toThrow("upperBound must be non-zero");
    expect(() => rngNextWithUpperBoundU32(rng, 0)).toThrow("upperBound must be non-zero");
    expect(() => rngNextWithUpperBoundU64(rng, 0n)).toThrow("upperBound must be non-zero");
  });

  test("rngNextInRange throws on invalid range", () => {
    const rng = makeFakeRandomNumberGenerator();
    expect(() => rngNextInRange(rng, 100n, 0n)).toThrow("start must be less than end");
  });

  test("rngNextInClosedRange throws on invalid range", () => {
    const rng = makeFakeRandomNumberGenerator();
    expect(() => rngNextInClosedRange(rng, 100n, 0n)).toThrow(
      "start must be less than or equal to end",
    );
  });

  test("rngRandomBool produces both values across a deterministic seed", () => {
    const rng = makeFakeRandomNumberGenerator();
    let trues = 0;
    let falses = 0;
    for (let i = 0; i < 200; i++) {
      if (rngRandomBool(rng)) trues++;
      else falses++;
    }
    expect(trues).toBeGreaterThan(0);
    expect(falses).toBeGreaterThan(0);
    expect(trues + falses).toBe(200);
  });

  test("rngRandomU32 returns a valid u32", () => {
    const rng = makeFakeRandomNumberGenerator();
    for (let i = 0; i < 50; i++) {
      const v = rngRandomU32(rng);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0xffffffff);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  test("rngRandomArray reproduces fakeRandomData for the same seed", () => {
    const rng1 = makeFakeRandomNumberGenerator();
    const rng2 = makeFakeRandomNumberGenerator();
    expect(rngRandomArray(rng1, 50)).toEqual(rng2.randomData(50));
  });

  test("rngFillRandomData fills exactly the buffer", () => {
    const rng = makeFakeRandomNumberGenerator();
    const buf = new Uint8Array(8);
    rngFillRandomData(rng, buf);
    // Same as the first 8 bytes of fakeRandomData(8): 7eb559bbbf6cce26
    expect(bytesToHex(buf)).toBe("7eb559bbbf6cce26");
  });
});

describe("widening multiplication", () => {
  test("wideMulU8 boundary 0xff * 0xff", () => {
    // 0xff * 0xff = 0xfe01 → low=0x01, high=0xfe
    expect(wideMulU8(0xff, 0xff)).toEqual([0x01, 0xfe]);
    expect(wideMulU8(0, 0)).toEqual([0, 0]);
    expect(wideMulU8(0x10, 0x10)).toEqual([0x00, 0x01]);
  });

  test("wideMulU16 boundary 0xffff * 0xffff", () => {
    // 0xffff * 0xffff = 0xfffe0001 → low=0x0001, high=0xfffe
    expect(wideMulU16(0xffff, 0xffff)).toEqual([0x0001, 0xfffe]);
    expect(wideMulU16(0, 0)).toEqual([0, 0]);
    expect(wideMulU16(0x100, 0x100)).toEqual([0x0000, 0x0001]);
  });

  test("wideMulU32 boundary 0xffffffff * 0xffffffff", () => {
    // 0xffffffff * 0xffffffff = 0xfffffffe00000001
    expect(wideMulU32(0xffffffff, 0xffffffff)).toEqual([0x00000001n, 0xfffffffen]);
    expect(wideMulU32(0, 0)).toEqual([0n, 0n]);
    expect(wideMulU32(0x10000, 0x10000)).toEqual([0n, 1n]);
  });

  test("wideMulU64 boundary u64::MAX * u64::MAX", () => {
    // u64::MAX * u64::MAX = 2^128 - 2^65 + 1
    //                    = 0xfffffffffffffffe_0000000000000001
    const max = 0xffffffffffffffffn;
    expect(wideMulU64(max, max)).toEqual([1n, 0xfffffffffffffffen]);
    expect(wideMulU64(0n, 0n)).toEqual([0n, 0n]);
    expect(wideMulU64(1n << 32n, 1n << 32n)).toEqual([0n, 1n]);
  });
});

describe("magnitude conversion (MIN-value edges)", () => {
  test("toMagnitude for i8::MIN, i16::MIN, i32::MIN", () => {
    // i8::MIN = -128 → wrapping_abs as u8 = 128
    expect(toMagnitude(-128, 8)).toBe(128);
    // i16::MIN = -32768 → wrapping_abs as u16 = 32768
    expect(toMagnitude(-32768, 16)).toBe(32768);
    // i32::MIN = -2147483648 → wrapping_abs as u32 = 2147483648
    expect(toMagnitude(-2147483648, 32)).toBe(2147483648);
  });

  test("toMagnitude64 for i64::MIN", () => {
    const i64Min = -(1n << 63n);
    // wrapping_abs(i64::MIN) as u64 = 0x8000000000000000
    expect(toMagnitude64(i64Min)).toBe(0x8000000000000000n);
  });

  test("fromMagnitude reinterprets as signed", () => {
    expect(fromMagnitude(128, 8)).toBe(-128);
    expect(fromMagnitude(32768, 16)).toBe(-32768);
    expect(fromMagnitude(2147483648, 32)).toBe(-2147483648);
  });

  test("fromMagnitude64 reinterprets sign bit", () => {
    expect(fromMagnitude64(0x8000000000000000n)).toBe(-(1n << 63n));
    expect(fromMagnitude64(0xffffffffffffffffn)).toBe(-1n);
    expect(fromMagnitude64(0n)).toBe(0n);
    expect(fromMagnitude64(0x7fffffffffffffffn)).toBe(0x7fffffffffffffffn);
  });

  test("toMagnitude / fromMagnitude round-trip on MIN edges", () => {
    expect(fromMagnitude(toMagnitude(-128, 8), 8)).toBe(-128);
    expect(fromMagnitude(toMagnitude(-32768, 16), 16)).toBe(-32768);
    expect(fromMagnitude(toMagnitude(-2147483648, 32), 32)).toBe(-2147483648);
    const i64Min = -(1n << 63n);
    expect(fromMagnitude64(toMagnitude64(i64Min))).toBe(i64Min);
  });
});
