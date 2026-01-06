import { Envelope } from "../src";
import { UNIT } from "@bcts/known-values";

describe("Known Value Methods", () => {
  describe("unit()", () => {
    it("should create a unit envelope", () => {
      const unit = (Envelope as unknown as { unit: () => Envelope }).unit();
      expect(unit.isKnownValue()).toBe(true);
      expect(unit.asKnownValue()?.equals(UNIT)).toBe(true);
    });
  });

  describe("asKnownValue() and tryKnownValue()", () => {
    it("should return KnownValue for known value envelopes", () => {
      const envelope = Envelope.new(UNIT);

      const kv = envelope.asKnownValue();
      expect(kv).toBeDefined();
      expect(kv?.equals(UNIT)).toBe(true);

      const tryKv = envelope.tryKnownValue();
      expect(tryKv.equals(UNIT)).toBe(true);
    });

    it("should return undefined for non-known-value envelopes", () => {
      const envelope = Envelope.new("hello");

      expect(envelope.asKnownValue()).toBeUndefined();
      expect(() => envelope.tryKnownValue()).toThrow();
    });
  });

  describe("isKnownValue()", () => {
    it("should return true for known value envelopes", () => {
      const envelope = Envelope.new(UNIT);
      expect(envelope.isKnownValue()).toBe(true);
    });

    it("should return false for leaf envelopes", () => {
      const envelope = Envelope.new("hello");
      expect(envelope.isKnownValue()).toBe(false);
    });
  });

  describe("isSubjectUnit()", () => {
    it("should return true for unit envelopes", () => {
      const unit = (Envelope as unknown as { unit: () => Envelope }).unit();
      expect(unit.isSubjectUnit()).toBe(true);
    });

    it("should return true for node with unit subject", () => {
      const node = (Envelope as unknown as { unit: () => Envelope })
        .unit()
        .addAssertion("note", "test");
      expect(node.isSubjectUnit()).toBe(true);
    });

    it("should return false for non-unit envelopes", () => {
      const envelope = Envelope.new("hello");
      expect(envelope.isSubjectUnit()).toBe(false);
    });
  });

  describe("checkSubjectUnit()", () => {
    it("should return the envelope if subject is unit", () => {
      const unit = (Envelope as unknown as { unit: () => Envelope }).unit();
      expect(unit.checkSubjectUnit()).toBe(unit);
    });

    it("should throw if subject is not unit", () => {
      const envelope = Envelope.new("hello");
      expect(() => envelope.checkSubjectUnit()).toThrow();
    });
  });
});

describe("Typed Extraction Methods", () => {
  // Helper decoder for testing - just returns the CBOR as-is for simple values
  const stringDecoder = (cbor: unknown): string => {
    if (
      typeof cbor === "object" &&
      cbor !== null &&
      "type" in cbor &&
      (cbor as { type: number }).type === 3
    ) {
      return (cbor as { value: string }).value;
    }
    throw new Error("Not a string");
  };

  const numberDecoder = (cbor: unknown): number => {
    if (
      typeof cbor === "object" &&
      cbor !== null &&
      "type" in cbor &&
      (cbor as { type: number }).type === 0
    ) {
      const value = (cbor as { value: number | bigint }).value;
      return typeof value === "bigint" ? Number(value) : value;
    }
    throw new Error("Not a number");
  };

  describe("extractSubject()", () => {
    it("should extract subject using decoder function", () => {
      const envelope = Envelope.new("hello");
      const result = envelope.extractSubject(stringDecoder);
      expect(result).toBe("hello");
    });

    it("should throw on type mismatch", () => {
      const envelope = Envelope.new(42);
      expect(() => envelope.extractSubject(stringDecoder)).toThrow();
    });
  });

  describe("tryObjectForPredicate()", () => {
    it("should extract object for predicate using decoder", () => {
      const envelope = Envelope.new("Alice").addAssertion("age", 30);

      const age = envelope.tryObjectForPredicate("age", numberDecoder);
      expect(age).toBe(30);
    });

    it("should throw if predicate not found", () => {
      const envelope = Envelope.new("Alice");

      expect(() => envelope.tryObjectForPredicate("age", numberDecoder)).toThrow();
    });
  });

  describe("tryOptionalObjectForPredicate()", () => {
    it("should extract object if predicate exists", () => {
      const envelope = Envelope.new("Alice").addAssertion("age", 30);

      const age = envelope.tryOptionalObjectForPredicate("age", numberDecoder);
      expect(age).toBe(30);
    });

    it("should return undefined if predicate not found", () => {
      const envelope = Envelope.new("Alice");

      const age = envelope.tryOptionalObjectForPredicate("age", numberDecoder);
      expect(age).toBeUndefined();
    });
  });

  describe("extractObjectForPredicateWithDefault()", () => {
    it("should extract object if predicate exists", () => {
      const envelope = Envelope.new("Alice").addAssertion("age", 30);

      const age = envelope.extractObjectForPredicateWithDefault("age", numberDecoder, 0);
      expect(age).toBe(30);
    });

    it("should return default if predicate not found", () => {
      const envelope = Envelope.new("Alice");

      const age = envelope.extractObjectForPredicateWithDefault("age", numberDecoder, 25);
      expect(age).toBe(25);
    });
  });

  describe("extractObjectsForPredicate()", () => {
    it("should extract all objects for predicate", () => {
      const envelope = Envelope.new("Shopping List")
        .addAssertion("item", "Apples")
        .addAssertion("item", "Bananas")
        .addAssertion("item", "Oranges");

      const items = envelope.extractObjectsForPredicate("item", stringDecoder);
      expect(items.length).toBe(3);
      expect(items).toContain("Apples");
      expect(items).toContain("Bananas");
      expect(items).toContain("Oranges");
    });

    it("should return empty array if predicate not found", () => {
      const envelope = Envelope.new("Empty");

      const items = envelope.extractObjectsForPredicate("item", stringDecoder);
      expect(items).toEqual([]);
    });
  });

  describe("tryObjectsForPredicate()", () => {
    it("should extract all objects for predicate", () => {
      const envelope = Envelope.new("Shopping List")
        .addAssertion("item", "Apples")
        .addAssertion("item", "Bananas");

      const items = envelope.tryObjectsForPredicate("item", stringDecoder);
      expect(items.length).toBe(2);
    });

    it("should return empty array if predicate not found", () => {
      const envelope = Envelope.new("Empty");

      const items = envelope.tryObjectsForPredicate("item", stringDecoder);
      expect(items).toEqual([]);
    });
  });
});

describe("Subject State Queries", () => {
  describe("isSubjectElided()", () => {
    it("should return false for non-elided envelopes", () => {
      const envelope = Envelope.new("hello");
      expect(envelope.isSubjectElided()).toBe(false);
    });

    it("should return true for elided envelopes", () => {
      const envelope = Envelope.new("hello");
      const elided = envelope.elide();
      expect(elided.isSubjectElided()).toBe(true);
    });
  });
});

describe("Position Methods", () => {
  describe("setPosition() and position()", () => {
    it("should set and get position", () => {
      const envelope = Envelope.new("item").setPosition(5);
      expect(envelope.position()).toBe(5);
    });

    it("should replace existing position", () => {
      const envelope = Envelope.new("item").setPosition(3).setPosition(7);
      expect(envelope.position()).toBe(7);
    });
  });

  describe("removePosition()", () => {
    it("should remove position assertion", () => {
      const envelope = Envelope.new("item").setPosition(5);
      const removed = envelope.removePosition();

      expect(() => removed.position()).toThrow();
    });

    it("should be no-op if no position exists", () => {
      const envelope = Envelope.new("item");
      const removed = envelope.removePosition();

      expect(removed.subject().extractString()).toBe("item");
    });
  });
});
