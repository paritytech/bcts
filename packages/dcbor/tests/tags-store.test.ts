/**
 * Tests for TagsStore validation matching Rust bc-dcbor-rust behavior.
 */

import { TagsStore, createTag } from "../src";

describe("TagsStore", () => {
  let store: TagsStore;

  beforeEach(() => {
    store = new TagsStore();
  });

  describe("insert validation (matching Rust behavior)", () => {
    it("should insert a tag with a valid name", () => {
      const tag = createTag(100, "test-tag");
      expect(() => store.insert(tag)).not.toThrow();
      expect(store.tagForValue(100)).toEqual(tag);
      expect(store.tagForName("test-tag")).toEqual(tag);
    });

    it("should throw when inserting a tag without a name", () => {
      const tag = createTag(100);
      expect(() => store.insert(tag)).toThrow("Tag 100 must have a non-empty name");
    });

    it("should throw when inserting a tag with empty name", () => {
      const tag = createTag(100, "");
      expect(() => store.insert(tag)).toThrow("Tag 100 must have a non-empty name");
    });

    it("should throw when registering tag with conflicting name", () => {
      store.insert(createTag(100, "first-name"));
      expect(() => store.insert(createTag(100, "different-name"))).toThrow(
        "Attempt to register tag: 100 'first-name' with different name: 'different-name'",
      );
    });

    it("should allow re-registering tag with same name", () => {
      store.insert(createTag(100, "same-name"));
      expect(() => store.insert(createTag(100, "same-name"))).not.toThrow();
    });

    it("should allow different tags with different values", () => {
      store.insert(createTag(100, "tag-100"));
      store.insert(createTag(200, "tag-200"));
      expect(store.tagForValue(100)?.name).toBe("tag-100");
      expect(store.tagForValue(200)?.name).toBe("tag-200");
    });

    it("should handle bigint tag values", () => {
      const bigValue = 9007199254740993n; // Larger than MAX_SAFE_INTEGER
      store.insert(createTag(bigValue, "big-tag"));
      expect(store.tagForValue(bigValue)?.name).toBe("big-tag");

      // Should also throw on conflict with bigint
      expect(() => store.insert(createTag(bigValue, "different-name"))).toThrow(
        `Attempt to register tag: ${bigValue} 'big-tag' with different name: 'different-name'`,
      );
    });
  });

  describe("insertAll validation", () => {
    it("should insert all valid tags", () => {
      const tags = [createTag(1, "one"), createTag(2, "two"), createTag(3, "three")];
      expect(() => store.insertAll(tags)).not.toThrow();
      expect(store.tagForValue(1)?.name).toBe("one");
      expect(store.tagForValue(2)?.name).toBe("two");
      expect(store.tagForValue(3)?.name).toBe("three");
    });

    it("should throw on first invalid tag", () => {
      const tags = [
        createTag(1, "one"),
        createTag(2), // Invalid - no name
        createTag(3, "three"),
      ];
      expect(() => store.insertAll(tags)).toThrow("Tag 2 must have a non-empty name");
      // First tag should have been inserted before the error
      expect(store.tagForValue(1)?.name).toBe("one");
    });

    it("should throw on conflicting tag in batch", () => {
      store.insert(createTag(2, "original-name"));
      const tags = [createTag(1, "one"), createTag(2, "different-name"), createTag(3, "three")];
      expect(() => store.insertAll(tags)).toThrow(
        "Attempt to register tag: 2 'original-name' with different name: 'different-name'",
      );
    });
  });

  describe("lookup operations (matching Rust TagsStoreTrait)", () => {
    it("should look up tag by value", () => {
      store.insert(createTag(42, "answer"));
      expect(store.tagForValue(42)?.name).toBe("answer");
      expect(store.tagForValue(999)).toBeUndefined();
    });

    it("should look up tag by name", () => {
      store.insert(createTag(42, "answer"));
      expect(store.tagForName("answer")?.value).toBe(42);
      expect(store.tagForName("unknown")).toBeUndefined();
    });

    it("should get name for value", () => {
      store.insert(createTag(42, "answer"));
      expect(store.nameForValue(42)).toBe("answer");
      expect(store.nameForValue(999)).toBe("999"); // Falls back to string value
    });

    it("should get assigned name for tag", () => {
      store.insert(createTag(42, "answer"));
      expect(store.assignedNameForTag(createTag(42, "any"))).toBe("answer");
      expect(store.assignedNameForTag(createTag(999, "unknown"))).toBeUndefined();
    });

    it("should get name for tag", () => {
      store.insert(createTag(42, "answer"));
      expect(store.nameForTag(createTag(42, "any"))).toBe("answer");
      // Falls back to string value when not registered
      expect(store.nameForTag(createTag(999, "unknown"))).toBe("999");
    });
  });

  describe("summarizers", () => {
    it("should set and get summarizers", () => {
      const summarizer = () => ({ ok: true as const, value: "summary" });
      store.setSummarizer(42, summarizer);
      expect(store.summarizer(42)).toBe(summarizer);
      expect(store.summarizer(999)).toBeUndefined();
    });
  });
});
