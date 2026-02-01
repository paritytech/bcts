import {
  KnownValue,
  KnownValuesStore,
  IS_A,
  IS_A_RAW,
  NOTE,
  NOTE_RAW,
  SIGNED,
  KNOWN_VALUES,
  ID,
  TAG_KNOWN_VALUE,
  KNOWN_VALUE_TAG,
  SELF,
  SELF_RAW,
} from "../src/index";
import { cbor, MajorType, bytesToHex, hexToBytes, isTagged } from "@bcts/dcbor";

describe("KnownValue", () => {
  test("should create a KnownValue with just a value", () => {
    const kv = new KnownValue(42);
    expect(kv.value()).toBe(42);
    expect(kv.assignedName()).toBeUndefined();
    expect(kv.name()).toBe("42");
  });

  test("should create a KnownValue with a value and name", () => {
    const kv = new KnownValue(1, "isA");
    expect(kv.value()).toBe(1);
    expect(kv.assignedName()).toBe("isA");
    expect(kv.name()).toBe("isA");
  });

  test("should have proper equality based on value only", () => {
    const kv1 = new KnownValue(1, "isA");
    const kv2 = new KnownValue(1, "different");
    const kv3 = new KnownValue(2, "isA");

    expect(kv1.equals(kv2)).toBe(true);
    expect(kv1.equals(kv3)).toBe(false);
  });

  test("should have consistent toString", () => {
    const named = new KnownValue(1, "isA");
    const unnamed = new KnownValue(42);

    expect(named.toString()).toBe("isA");
    expect(unnamed.toString()).toBe("42");
  });

  test("predefined values should have correct values and names", () => {
    expect(IS_A.value()).toBe(1);
    expect(IS_A.name()).toBe("isA");

    expect(NOTE.value()).toBe(4);
    expect(NOTE.name()).toBe("note");

    expect(SIGNED.value()).toBe(3);
    expect(SIGNED.name()).toBe("signed");

    expect(ID.value()).toBe(2);
    expect(ID.name()).toBe("id");
  });
});

describe("KnownValuesStore", () => {
  test("should create an empty store", () => {
    const store = new KnownValuesStore();
    expect(store.knownValueNamed("isA")).toBeUndefined();
  });

  test("should create a store with initial values", () => {
    const store = new KnownValuesStore([IS_A, NOTE, SIGNED]);

    expect(store.knownValueNamed("isA")).toBe(IS_A);
    expect(store.knownValueNamed("note")).toBe(NOTE);
    expect(store.knownValueNamed("signed")).toBe(SIGNED);
  });

  test("should insert values", () => {
    const store = new KnownValuesStore();
    const custom = new KnownValue(100, "custom");

    store.insert(custom);
    expect(store.knownValueNamed("custom")).toBe(custom);
  });

  test("should get assigned names", () => {
    const store = new KnownValuesStore([IS_A, NOTE]);

    expect(store.assignedName(IS_A)).toBe("isA");
    expect(store.assignedName(NOTE)).toBe("note");
    expect(store.assignedName(new KnownValue(999))).toBeUndefined();
  });

  test("should get names with fallback to value", () => {
    const store = new KnownValuesStore([IS_A, NOTE]);

    expect(store.name(IS_A)).toBe("isA");
    expect(store.name(new KnownValue(999))).toBe("999");
  });

  test("should look up by raw value", () => {
    const store = new KnownValuesStore([IS_A, NOTE]);

    const isA = KnownValuesStore.knownValueForRawValue(1, store);
    expect(isA.equals(IS_A)).toBe(true);

    const unknown = KnownValuesStore.knownValueForRawValue(999, store);
    expect(unknown.value()).toBe(999);
    expect(unknown.assignedName()).toBeUndefined();
  });

  test("should look up by name", () => {
    const store = new KnownValuesStore([IS_A, NOTE]);

    const isA = KnownValuesStore.knownValueForName("isA", store);
    expect(isA?.value()).toBe(1);

    const unknown = KnownValuesStore.knownValueForName("unknown", store);
    expect(unknown).toBeUndefined();
  });

  test("should get name for a known value", () => {
    const store = new KnownValuesStore([IS_A, NOTE]);

    expect(KnownValuesStore.nameForKnownValue(IS_A, store)).toBe("isA");
    expect(KnownValuesStore.nameForKnownValue(new KnownValue(999), store)).toBe("999");
    expect(KnownValuesStore.nameForKnownValue(IS_A, undefined)).toBe("isA");
  });

  test("should clone the store", () => {
    const store1 = new KnownValuesStore([IS_A, NOTE]);
    const store2 = store1.clone();

    const custom = new KnownValue(100, "custom");
    store2.insert(custom);

    expect(store1.knownValueNamed("custom")).toBeUndefined();
    expect(store2.knownValueNamed("custom")).toBe(custom);
  });
});

describe("Global KNOWN_VALUES Registry", () => {
  test("should provide access to the global store", () => {
    const store = KNOWN_VALUES.get();

    expect(store.knownValueNamed("isA")?.value()).toBe(1);
    expect(store.knownValueNamed("note")?.value()).toBe(4);
    expect(store.knownValueNamed("signed")?.value()).toBe(3);
  });

  test("should cache the store", () => {
    const store1 = KNOWN_VALUES.get();
    const store2 = KNOWN_VALUES.get();

    expect(store1).toBe(store2);
  });

  test("should contain all predefined values", () => {
    const store = KNOWN_VALUES.get();

    expect(store.knownValueNamed("id")?.value()).toBe(2);
    expect(store.knownValueNamed("entity")?.value()).toBe(10);
    expect(store.knownValueNamed("name")?.value()).toBe(11);
    expect(store.knownValueNamed("isA")?.value()).toBe(1);
  });
});

describe("KnownValue CBOR Encoding", () => {
  test("should export TAG_KNOWN_VALUE constant", () => {
    expect(TAG_KNOWN_VALUE).toBe(40000);
  });

  test("should export KNOWN_VALUE_TAG with name", () => {
    expect(KNOWN_VALUE_TAG.value).toBe(40000);
    expect(KNOWN_VALUE_TAG.name).toBe("known-value");
  });

  test("should provide cborTags()", () => {
    const kv = new KnownValue(1, "isA");
    const tags = kv.cborTags();
    expect(tags).toHaveLength(1);
    expect(tags[0].value).toBe(40000);
  });

  test("should encode to untagged CBOR (unsigned integer)", () => {
    const kv = new KnownValue(42);
    const untagged = kv.untaggedCbor();

    expect(untagged.type).toBe(MajorType.Unsigned);
    expect(untagged.value).toBe(42n);
  });

  test("should encode to tagged CBOR with tag 40000", () => {
    const kv = new KnownValue(1, "isA");
    const tagged = kv.taggedCbor();

    expect(tagged.type).toBe(MajorType.Tagged);
    if (isTagged(tagged)) {
      expect(tagged.tag).toBe(40000);
      expect(tagged.value.type).toBe(MajorType.Unsigned);
      if (tagged.value.type === MajorType.Unsigned) {
        expect(tagged.value.value).toBe(1n);
      }
    }
  });

  test("should encode IS_A to correct CBOR hex", () => {
    // Tag 40000 (0xd99c40) + value 1 (0x01) = d99c4001
    const bytes = IS_A.toCborData();
    const hex = bytesToHex(bytes);
    expect(hex).toBe("d99c4001");
  });

  test("should encode various values correctly", () => {
    // Tag 40000 = d99c40 (0xd9 = tag with 2-byte value, 0x9c40 = 40000)
    // Value 0 -> d99c4000
    expect(bytesToHex(new KnownValue(0).toCborData())).toBe("d99c4000");

    // Value 23 -> d99c4017 (23 fits in single byte)
    expect(bytesToHex(new KnownValue(23).toCborData())).toBe("d99c4017");

    // Value 24 -> d99c401818 (24 requires additional byte)
    expect(bytesToHex(new KnownValue(24).toCborData())).toBe("d99c401818");

    // Value 100 -> d99c401864
    expect(bytesToHex(new KnownValue(100).toCborData())).toBe("d99c401864");

    // Value 256 -> d99c40190100
    expect(bytesToHex(new KnownValue(256).toCborData())).toBe("d99c40190100");
  });

  test("taggedCborData should be alias for toCborData", () => {
    const kv = new KnownValue(42);
    expect(kv.taggedCborData()).toEqual(kv.toCborData());
  });
});

describe("KnownValue CBOR Decoding", () => {
  test("should decode from untagged CBOR", () => {
    const cborValue = cbor(42);
    const kv = KnownValue.fromUntaggedCbor(cborValue);

    expect(kv.value()).toBe(42);
    expect(kv.assignedName()).toBeUndefined();
  });

  test("should decode from tagged CBOR", () => {
    const kv = new KnownValue(1, "isA");
    const tagged = kv.taggedCbor();
    const decoded = KnownValue.fromTaggedCbor(tagged);

    expect(decoded.value()).toBe(1);
    // Note: name is not preserved in CBOR encoding
    expect(decoded.assignedName()).toBeUndefined();
  });

  test("should decode from binary CBOR data", () => {
    // d99c4001 = tag 40000, value 1
    const bytes = hexToBytes("d99c4001");
    const kv = KnownValue.fromCborData(bytes);

    expect(kv.value()).toBe(1);
  });

  test("should decode various values from binary", () => {
    // Tag 40000 = d99c40 (0xd9 = tag with 2-byte value, 0x9c40 = 40000)
    // Value 0
    expect(KnownValue.fromCborData(hexToBytes("d99c4000")).value()).toBe(0);

    // Value 23
    expect(KnownValue.fromCborData(hexToBytes("d99c4017")).value()).toBe(23);

    // Value 24
    expect(KnownValue.fromCborData(hexToBytes("d99c401818")).value()).toBe(24);

    // Value 100
    expect(KnownValue.fromCborData(hexToBytes("d99c401864")).value()).toBe(100);

    // Value 256
    expect(KnownValue.fromCborData(hexToBytes("d99c40190100")).value()).toBe(256);
  });

  test("should auto-detect tagged vs untagged with fromCbor", () => {
    // Tagged
    const tagged = cbor({ tag: 40000, value: 42 });
    const kv1 = KnownValue.fromCbor(tagged);
    expect(kv1.value()).toBe(42);

    // Untagged
    const untagged = cbor(42);
    const kv2 = KnownValue.fromCbor(untagged);
    expect(kv2.value()).toBe(42);
  });

  test("should throw on wrong tag", () => {
    const wrongTag = cbor({ tag: 100, value: 42 });
    expect(() => KnownValue.fromTaggedCbor(wrongTag)).toThrow(/Expected tag 40000/);
  });

  test("should throw on wrong type for untagged", () => {
    const text = cbor("hello");
    expect(() => KnownValue.fromUntaggedCbor(text)).toThrow(/Expected unsigned integer/);
  });

  test("instance methods should delegate to static methods", () => {
    const kv = new KnownValue(0); // dummy instance for interface compliance
    const tagged = cbor({ tag: 40000, value: 99 });
    const untagged = cbor(99);

    const decoded1 = kv.fromTaggedCbor(tagged);
    const decoded2 = kv.fromUntaggedCbor(untagged);

    expect(decoded1.value()).toBe(99);
    expect(decoded2.value()).toBe(99);
  });
});

describe("KnownValue roundtrip", () => {
  test("should roundtrip encode/decode", () => {
    const values = [0, 1, 23, 24, 100, 255, 256, 1000, 65535, 65536];

    for (const v of values) {
      const original = new KnownValue(v);
      const bytes = original.toCborData();
      const decoded = KnownValue.fromCborData(bytes);
      expect(decoded.value()).toBe(v);
    }
  });

  test("should roundtrip predefined values", () => {
    const predefined = [IS_A, ID, SIGNED, NOTE];

    for (const kv of predefined) {
      const bytes = kv.toCborData();
      const decoded = KnownValue.fromCborData(bytes);
      expect(decoded.value()).toBe(kv.value());
    }
  });
});

describe("KnownValue BigInt support", () => {
  test("should accept bigint in constructor", () => {
    const kv = new KnownValue(42n);
    expect(kv.value()).toBe(42);
    expect(kv.valueBigInt()).toBe(42n);
  });

  test("should return bigint from valueBigInt()", () => {
    const kv = new KnownValue(42);
    expect(typeof kv.valueBigInt()).toBe("bigint");
    expect(kv.valueBigInt()).toBe(42n);
  });

  test("should encode bigint values correctly", () => {
    const kv = new KnownValue(1000n);
    const hex = bytesToHex(kv.toCborData());
    expect(hex).toBe("d99c401903e8"); // tag 40000 + 1000
  });

  test("should decode to bigint internally", () => {
    const bytes = hexToBytes("d99c401903e8");
    const kv = KnownValue.fromCborData(bytes);
    expect(kv.valueBigInt()).toBe(1000n);
  });
});

// =============================================================================
// Rust Parity Tests
// =============================================================================

describe("Rust Parity: test_1", () => {
  // Direct port of Rust's test_1 from known_values_registry.rs
  test("test_1 - IS_A value and name, registry lookup", () => {
    // Rust: assert_eq!(IS_A.value(), 1);
    expect(IS_A.value()).toBe(1);

    // Rust: assert_eq!(IS_A.name(), "isA");
    expect(IS_A.name()).toBe("isA");

    // Rust: let store = KNOWN_VALUES.get();
    const store = KNOWN_VALUES.get();

    // Rust: assert_eq!(store.known_value_named("isA").unwrap().value(), 1);
    expect(store.knownValueNamed("isA")?.value()).toBe(1);
  });
});

describe("Rust Parity: _RAW constants", () => {
  test("_RAW constants should match KnownValue values", () => {
    // Verify that _RAW constants have the correct values
    expect(IS_A_RAW).toBe(1n);
    expect(NOTE_RAW).toBe(4n);

    // Verify _RAW constants match the KnownValue.valueBigInt()
    expect(IS_A.valueBigInt()).toBe(IS_A_RAW);
    expect(NOTE.valueBigInt()).toBe(NOTE_RAW);
  });

  test("_RAW constants can be used for pattern matching", () => {
    const rawValue = 1n;
    let matched = false;

    // This demonstrates the use case for _RAW constants
    switch (rawValue) {
      case IS_A_RAW:
        matched = true;
        break;
      default:
        break;
    }

    expect(matched).toBe(true);
  });
});

describe("Rust Parity: DigestProvider", () => {
  test("KnownValue should implement digest()", () => {
    const kv = new KnownValue(1, "isA");

    // digest() should return a Digest object
    const digest = kv.digest();
    expect(digest).toBeDefined();

    // The digest should be a SHA-256 hash (32 bytes = 64 hex chars)
    const hex = digest.hex();
    expect(hex).toHaveLength(64);
  });

  test("digest should be deterministic", () => {
    const kv1 = new KnownValue(1);
    const kv2 = new KnownValue(1);

    // Same value should produce same digest
    expect(kv1.digest().hex()).toBe(kv2.digest().hex());
  });

  test("different values should produce different digests", () => {
    const kv1 = new KnownValue(1);
    const kv2 = new KnownValue(2);

    // Different values should produce different digests
    expect(kv1.digest().hex()).not.toBe(kv2.digest().hex());
  });

  test("digest should be based on tagged CBOR encoding", () => {
    const kv = new KnownValue(1);

    // The digest should be the SHA-256 of the tagged CBOR data
    const cborData = kv.toCborData();

    // Manually compute what the digest should be
    // (This verifies the implementation matches Rust's Digest::from_image)
    const digest = kv.digest();

    // The digest validates against the CBOR data
    expect(digest.validate(cborData)).toBe(true);
  });
});

// =============================================================================
// Step 7: _insert bug fix tests
// =============================================================================

describe("Rust Parity: _insert stale name removal", () => {
  test("should remove old name when overriding codepoint", () => {
    const store = new KnownValuesStore([IS_A]);

    // Override IS_A (codepoint 1) with a custom name
    store.insert(new KnownValue(1, "overriddenIsA"));

    // The original "isA" name should be gone
    expect(store.knownValueNamed("isA")).toBeUndefined();

    // The new name should work
    const overridden = store.knownValueNamed("overriddenIsA");
    expect(overridden).toBeDefined();
    expect(overridden!.value()).toBe(1);
  });

  test("should handle multiple overrides on same codepoint", () => {
    const store = new KnownValuesStore([IS_A]);

    // First override
    store.insert(new KnownValue(1, "firstOverride"));
    expect(store.knownValueNamed("isA")).toBeUndefined();
    expect(store.knownValueNamed("firstOverride")).toBeDefined();

    // Second override
    store.insert(new KnownValue(1, "secondOverride"));
    expect(store.knownValueNamed("firstOverride")).toBeUndefined();
    expect(store.knownValueNamed("secondOverride")).toBeDefined();
    expect(store.knownValueNamed("secondOverride")!.value()).toBe(1);
  });

  test("should handle override with unnamed value", () => {
    const store = new KnownValuesStore([IS_A]);

    // Override with an unnamed value (no assigned name)
    store.insert(new KnownValue(1));

    // The original "isA" name should be gone
    expect(store.knownValueNamed("isA")).toBeUndefined();

    // Should still be retrievable by value
    const found = store.knownValueForValue(1);
    expect(found).toBeDefined();
    expect(found!.value()).toBe(1);
    expect(found!.assignedName()).toBeUndefined();
  });
});

// =============================================================================
// Step 8: SELF constant tests
// =============================================================================

describe("Rust Parity: SELF constant (706)", () => {
  test("SELF constant should exist with correct value and name", () => {
    expect(SELF.value()).toBe(706);
    expect(SELF.name()).toBe("Self");
    expect(SELF_RAW).toBe(706n);
  });

  test("SELF_RAW should match SELF.valueBigInt()", () => {
    expect(SELF.valueBigInt()).toBe(SELF_RAW);
  });

  test("SELF should NOT be in default KNOWN_VALUES store", () => {
    // Matching Rust: SELF is exported as a constant but NOT in the default
    // KnownValuesStore initialization list
    const store = KNOWN_VALUES.get();
    expect(store.knownValueNamed("Self")).toBeUndefined();
  });
});
