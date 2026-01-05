/**
 * @bcts/envelope-pattern - Meta Parsing Tests
 *
 * Tests for parsing meta patterns: or, and, not, traversal, repeat, capture, etc.
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust parse_tests_meta.rs
 */

import { describe, it, expect } from "vitest";
import { parse } from "../src";

describe("Meta Parsing Tests", () => {
  describe("Or Pattern", () => {
    it("parses bool or pattern", () => {
      const result = parse("true | false");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Meta");
      }
    });

    it("parses or pattern without spaces", () => {
      const result = parse("true|false");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Meta");
      }
    });

    it("parses multiple or patterns", () => {
      const result = parse("true | false | 42");
      expect(result.ok).toBe(true);
    });

    it("parses number or text", () => {
      const result = parse('42 | "hello"');
      expect(result.ok).toBe(true);
    });
  });

  describe("And Pattern", () => {
    it("parses bool and pattern", () => {
      const result = parse("true & false");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Meta");
      }
    });

    it("parses and pattern without spaces", () => {
      const result = parse("true&false");
      expect(result.ok).toBe(true);
    });

    it("parses multiple and patterns", () => {
      const result = parse(">10 & <50 & number");
      expect(result.ok).toBe(true);
    });
  });

  describe("Traversal Pattern", () => {
    it("parses bool traversal pattern", () => {
      const result = parse("true -> false");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Meta");
      }
    });

    it("parses traversal pattern without spaces", () => {
      const result = parse("true->false");
      expect(result.ok).toBe(true);
    });

    it("parses multiple traversal steps", () => {
      const result = parse("subj -> assert -> obj");
      expect(result.ok).toBe(true);
    });
  });

  describe("Operator Precedence", () => {
    it("parses complex expression with correct precedence", () => {
      // OR has lowest precedence, then traverse, then AND, then NOT
      const result = parse("* -> true & false -> !* | * -> true & false -> *");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Meta");
      }
    });

    it("parses and before or", () => {
      const result = parse("true & false | 42 & 43");
      expect(result.ok).toBe(true);
    });

    it("parses parentheses override precedence", () => {
      const result = parse("(true | false) & 42");
      expect(result.ok).toBe(true);
    });
  });

  describe("Not Pattern", () => {
    it("parses not text pattern", () => {
      const result = parse('!"hi"');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Meta");
      }
    });

    it("parses double not pattern", () => {
      const result = parse("!* & !*");
      expect(result.ok).toBe(true);
    });

    it("parses not with number", () => {
      const result = parse("!42");
      expect(result.ok).toBe(true);
    });

    it("parses not any pattern", () => {
      const result = parse("!*");
      expect(result.ok).toBe(true);
    });
  });

  describe("Search Pattern", () => {
    it("parses search text pattern", () => {
      const result = parse("search(text)");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Meta");
      }
    });

    it("parses search number pattern", () => {
      const result = parse("search(42)");
      expect(result.ok).toBe(true);
    });

    it("parses nested search pattern", () => {
      const result = parse("search(search(text))");
      expect(result.ok).toBe(true);
    });

    it("parses search with complex pattern", () => {
      const result = parse("search(assert)");
      expect(result.ok).toBe(true);
    });
  });

  describe("Repeat Patterns", () => {
    it("parses zero or more pattern", () => {
      const result = parse("(wrapped)*");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Meta");
      }
    });

    it("parses one or more lazy pattern", () => {
      const result = parse("(text)+?");
      expect(result.ok).toBe(true);
    });

    it("parses range possessive pattern", () => {
      const result = parse("(number){2,4}+");
      expect(result.ok).toBe(true);
    });

    it("parses exact count pattern", () => {
      const result = parse("(text){3}");
      expect(result.ok).toBe(true);
    });

    it("parses at least n pattern", () => {
      const result = parse("(number){2,}");
      expect(result.ok).toBe(true);
    });

    it("parses optional pattern", () => {
      const result = parse("(wrapped)?");
      expect(result.ok).toBe(true);
    });

    it("parses unwrap repeat pattern", () => {
      const result = parse("unwrap*");
      expect(result.ok).toBe(true);
    });
  });

  describe("Capture Patterns", () => {
    it("parses capture pattern", () => {
      const result = parse("@name(1)");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Meta");
      }
    });

    it("parses capture pattern with spaces", () => {
      const result = parse("@name ( 1 )");
      expect(result.ok).toBe(true);
    });

    it("parses nested capture patterns", () => {
      const result = parse('@outer(@inner("hi"))');
      expect(result.ok).toBe(true);
    });

    it("parses capture with underscore in name", () => {
      const result = parse("@cap_1(42)");
      expect(result.ok).toBe(true);
    });

    it("parses capture with text pattern", () => {
      const result = parse('@name("hello")');
      expect(result.ok).toBe(true);
    });
  });

  describe("Any Pattern", () => {
    it("parses star as any pattern", () => {
      const result = parse("*");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Meta");
      }
    });

    it("parses any in complex expression", () => {
      const result = parse("* & true");
      expect(result.ok).toBe(true);
    });

    it("parses any in traversal", () => {
      const result = parse("* -> *");
      expect(result.ok).toBe(true);
    });
  });

  describe("Grouping", () => {
    it("parses simple grouped pattern", () => {
      const result = parse("(42)");
      expect(result.ok).toBe(true);
    });

    it("parses grouped or pattern", () => {
      const result = parse("(true | false)");
      expect(result.ok).toBe(true);
    });

    it("parses nested groups", () => {
      const result = parse("((42))");
      expect(result.ok).toBe(true);
    });

    it("parses group with repeat", () => {
      const result = parse("(text)*");
      expect(result.ok).toBe(true);
    });
  });
});
