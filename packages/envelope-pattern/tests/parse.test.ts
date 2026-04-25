/**
 * @bcts/envelope-pattern - Parser tests
 *
 * Tests for the pattern parser.
 */

import { describe, it, expect } from "vitest";
import { parse } from "../src";

describe("Parser", () => {
  describe("Simple Patterns", () => {
    it("parses any pattern (*)", () => {
      const result = parse("*");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Meta");
      }
    });

    it("parses bool keyword", () => {
      const result = parse("bool");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Leaf");
      }
    });

    it("parses true literal", () => {
      const result = parse("true");
      expect(result.ok).toBe(true);
    });

    it("parses false literal", () => {
      const result = parse("false");
      expect(result.ok).toBe(true);
    });

    it("parses number keyword", () => {
      const result = parse("number");
      expect(result.ok).toBe(true);
    });

    it("parses text keyword", () => {
      const result = parse("text");
      expect(result.ok).toBe(true);
    });

    it("parses null keyword", () => {
      const result = parse("null");
      expect(result.ok).toBe(true);
    });

    it("parses date keyword", () => {
      const result = parse("date");
      expect(result.ok).toBe(true);
    });

    it("parses bstr keyword", () => {
      const result = parse("bstr");
      expect(result.ok).toBe(true);
    });

    it("parses known keyword", () => {
      const result = parse("known");
      expect(result.ok).toBe(true);
    });
  });

  describe("Number Patterns", () => {
    it("parses positive integer", () => {
      const result = parse("42");
      expect(result.ok).toBe(true);
    });

    it("parses negative integer", () => {
      const result = parse("-42");
      expect(result.ok).toBe(true);
    });

    it("parses float", () => {
      const result = parse("3.14");
      expect(result.ok).toBe(true);
    });

    it("parses Infinity", () => {
      const result = parse("Infinity");
      expect(result.ok).toBe(true);
    });

    it("parses -Infinity", () => {
      const result = parse("-Infinity");
      expect(result.ok).toBe(true);
    });

    it("parses NaN", () => {
      const result = parse("NaN");
      expect(result.ok).toBe(true);
    });
  });

  describe("String Patterns", () => {
    it("parses string literal", () => {
      const result = parse('"hello"');
      expect(result.ok).toBe(true);
    });

    it("parses string with escapes", () => {
      const result = parse('"hello\\nworld"');
      expect(result.ok).toBe(true);
    });
  });

  describe("Regex Patterns", () => {
    it("parses text regex", () => {
      const result = parse("/[a-z]+/");
      expect(result.ok).toBe(true);
    });
  });

  describe("Hex Patterns", () => {
    it("parses hex byte pattern", () => {
      const result = parse("h'deadbeef'");
      expect(result.ok).toBe(true);
    });
  });

  describe("Array Patterns", () => {
    it("parses empty array", () => {
      const result = parse("[]");
      expect(result.ok).toBe(true);
    });

    it("parses any array", () => {
      const result = parse("[*]");
      expect(result.ok).toBe(true);
    });
  });

  describe("Structure Patterns", () => {
    it("parses node keyword", () => {
      const result = parse("node");
      expect(result.ok).toBe(true);
    });

    it("parses subj keyword", () => {
      const result = parse("subj");
      expect(result.ok).toBe(true);
    });

    it("parses pred keyword", () => {
      const result = parse("pred");
      expect(result.ok).toBe(true);
    });

    it("parses obj keyword", () => {
      const result = parse("obj");
      expect(result.ok).toBe(true);
    });

    it("parses assert keyword", () => {
      const result = parse("assert");
      expect(result.ok).toBe(true);
    });

    it("parses wrapped keyword", () => {
      const result = parse("wrapped");
      expect(result.ok).toBe(true);
    });

    it("parses unwrap keyword", () => {
      const result = parse("unwrap");
      expect(result.ok).toBe(true);
    });

    it("parses digest keyword", () => {
      const result = parse("digest");
      expect(result.ok).toBe(true);
    });

    it("parses obscured keyword", () => {
      const result = parse("obscured");
      expect(result.ok).toBe(true);
    });

    it("parses elided keyword", () => {
      const result = parse("elided");
      expect(result.ok).toBe(true);
    });

    it("parses encrypted keyword", () => {
      const result = parse("encrypted");
      expect(result.ok).toBe(true);
    });

    it("parses compressed keyword", () => {
      const result = parse("compressed");
      expect(result.ok).toBe(true);
    });
  });

  describe("Meta Patterns", () => {
    it("parses search pattern", () => {
      const result = parse("search(42)");
      expect(result.ok).toBe(true);
    });

    it("parses or pattern", () => {
      const result = parse("42 | text");
      expect(result.ok).toBe(true);
    });

    it("parses and pattern", () => {
      const result = parse("number & 42");
      expect(result.ok).toBe(true);
    });

    it("parses not pattern", () => {
      const result = parse("!42");
      expect(result.ok).toBe(true);
    });

    it("parses grouped pattern", () => {
      const result = parse("(42 | text)");
      expect(result.ok).toBe(true);
    });

    it("parses capture pattern", () => {
      // Capture requires explicit parentheses; mirrors Rust grammar.
      const result = parse("@myCapture(number)");
      expect(result.ok).toBe(true);
    });
  });

  describe("Quantifiers", () => {
    // Quantifier suffixes attach only to parenthesised groups in Rust;
    // bare-primary forms like `number*` are syntax errors. The tests
    // below use the parenthesised form to mirror that grammar.
    it("parses zero or more", () => {
      const result = parse("(number)*");
      expect(result.ok).toBe(true);
    });

    it("parses one or more", () => {
      const result = parse("(number)+");
      expect(result.ok).toBe(true);
    });

    it("parses zero or one", () => {
      const result = parse("(number)?");
      expect(result.ok).toBe(true);
    });

    it("parses exact range", () => {
      const result = parse("(number){3}");
      expect(result.ok).toBe(true);
    });

    it("parses bounded range", () => {
      const result = parse("(number){2,5}");
      expect(result.ok).toBe(true);
    });

    it("parses open-ended range", () => {
      const result = parse("(number){2,}");
      expect(result.ok).toBe(true);
    });
  });

  describe("Traverse Patterns", () => {
    it("parses simple traverse", () => {
      const result = parse("subj -> number");
      expect(result.ok).toBe(true);
    });

    it("parses multi-step traverse", () => {
      const result = parse("node -> subj -> number");
      expect(result.ok).toBe(true);
    });
  });
});
