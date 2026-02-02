/**
 * @bcts/envelope-pattern - Structure Parsing Tests
 *
 * Tests for parsing structure patterns: node, wrapped, subject, assertion, etc.
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust parse_tests_structure.rs
 */

import { describe, it, expect } from "vitest";
import { parse } from "../src";

describe("Structure Parsing Tests", () => {
  describe("Node Patterns", () => {
    it("parses any node pattern", () => {
      const result = parse("node");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Structure");
      }
    });

    it("parses node with assertion range", () => {
      const result = parse("node({1,3})");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Structure");
      }
    });

    it("parses node with exact assertion count", () => {
      const result = parse("node({2})");
      expect(result.ok).toBe(true);
    });

    it("parses node with minimum assertion count", () => {
      const result = parse("node({1,})");
      expect(result.ok).toBe(true);
    });
  });

  describe("Wrapped Patterns", () => {
    it("parses wrapped pattern", () => {
      const result = parse("wrapped");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Structure");
      }
    });
  });

  describe("Unwrap Patterns", () => {
    it("parses unwrap pattern", () => {
      const result = parse("unwrap");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Structure");
      }
    });

    it("parses unwrap with inner pattern", () => {
      const result = parse("unwrap(node)");
      expect(result.ok).toBe(true);
    });

    it("parses unwrap with number pattern", () => {
      const result = parse("unwrap(42)");
      expect(result.ok).toBe(true);
    });
  });

  describe("Subject Patterns", () => {
    it("parses any subject pattern", () => {
      const result = parse("subj");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Structure");
      }
    });

    it("parses subject with text pattern", () => {
      const result = parse('subj("hi")');
      expect(result.ok).toBe(true);
    });

    it("parses subject with number pattern", () => {
      const result = parse("subj(42)");
      expect(result.ok).toBe(true);
    });
  });

  describe("Assertion Patterns", () => {
    it("parses any assertion pattern", () => {
      const result = parse("assert");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Structure");
      }
    });

    it("parses assertion with predicate pattern", () => {
      const result = parse('assertpred("hi")');
      expect(result.ok).toBe(true);
    });

    it("parses assertion with predicate and spaces", () => {
      const result = parse('assertpred ( "hi" )');
      expect(result.ok).toBe(true);
    });

    it("parses assertion with object pattern", () => {
      const result = parse("assertobj(1)");
      expect(result.ok).toBe(true);
    });

    it("parses assertion with object and spaces", () => {
      const result = parse("assertobj ( 1 )");
      expect(result.ok).toBe(true);
    });
  });

  describe("Object Patterns", () => {
    it("parses any object pattern", () => {
      const result = parse("obj");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Structure");
      }
    });

    it("parses object with text pattern", () => {
      const result = parse('obj("hi")');
      expect(result.ok).toBe(true);
    });

    it("parses object with spaces", () => {
      const result = parse('obj ( "hi" )');
      expect(result.ok).toBe(true);
    });

    it("parses object with number pattern", () => {
      const result = parse("obj(42)");
      expect(result.ok).toBe(true);
    });
  });

  describe("Predicate Patterns", () => {
    it("parses any predicate pattern", () => {
      const result = parse("pred");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Structure");
      }
    });

    it("parses predicate with number pattern", () => {
      const result = parse("pred(1)");
      expect(result.ok).toBe(true);
    });

    it("parses predicate with spaces", () => {
      const result = parse("pred ( 1 )");
      expect(result.ok).toBe(true);
    });

    it("parses predicate with text pattern", () => {
      const result = parse('pred("knows")');
      expect(result.ok).toBe(true);
    });
  });

  describe("Obscured Patterns", () => {
    it("parses obscured pattern", () => {
      const result = parse("obscured");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Structure");
      }
    });

    it("parses elided pattern", () => {
      const result = parse("elided");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Structure");
      }
    });

    it("parses encrypted pattern", () => {
      const result = parse("encrypted");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Structure");
      }
    });

    it("parses compressed pattern", () => {
      const result = parse("compressed");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Structure");
      }
    });
  });

  describe("Digest Patterns", () => {
    it("parses digest prefix pattern", () => {
      const result = parse("digest(a1b2c3)");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Structure");
      }
    });

    it("parses digest with spaces", () => {
      const result = parse("digest ( a1b2c3 )");
      expect(result.ok).toBe(true);
    });

    it("parses digest with longer hex", () => {
      const result = parse("digest(a1b2c3d4e5f6)");
      expect(result.ok).toBe(true);
    });
  });

  describe("Complex Structure Patterns", () => {
    it("parses traversal with structure patterns", () => {
      const result = parse("subj -> assert -> obj");
      expect(result.ok).toBe(true);
    });

    it("parses nested unwrap pattern", () => {
      const result = parse("unwrap(unwrap(42))");
      expect(result.ok).toBe(true);
    });

    it("parses wrapped with repeat", () => {
      const result = parse("(wrapped)* -> node");
      expect(result.ok).toBe(true);
    });

    it("parses search with assertion pattern", () => {
      const result = parse("search(assertpred(text))");
      expect(result.ok).toBe(true);
    });
  });
});
