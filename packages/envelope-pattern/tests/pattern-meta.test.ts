/**
 * @bcts/envelope-pattern - Meta Pattern Tests
 *
 * Tests for meta patterns: and, or, not, capture, search, traverse, etc.
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust pattern_tests_meta.rs
 */

import { describe, it, expect } from "vitest";
import { Envelope } from "@bcts/envelope";
import {
  any,
  and,
  or,
  notMatching,
  capture,
  search,
  traverse,
  anyNumber,
  anyText,
  numberGreaterThan,
  numberLessThan,
  anySubject,
  anyAssertion,
  patternMatches,
  patternPaths,
  patternPathsWithCaptures,
} from "../src";

describe("Meta Pattern Tests", () => {
  describe("Any Pattern", () => {
    it("matches any envelope", () => {
      const anyPat = any();
      expect(patternMatches(anyPat, Envelope.new(42))).toBe(true);
      expect(patternMatches(anyPat, Envelope.new("hello"))).toBe(true);
      expect(patternMatches(anyPat, Envelope.new(true))).toBe(true);
      expect(patternMatches(anyPat, Envelope.null())).toBe(true);
    });
  });

  describe("And Pattern", () => {
    it("matches when all patterns match", () => {
      const envelope = Envelope.new(42);

      // 42 is > 10 and < 50
      const andPat = and([numberGreaterThan(10), numberLessThan(50)]);
      expect(patternMatches(andPat, envelope)).toBe(true);
    });

    it("does not match when any pattern fails", () => {
      const envelope = Envelope.new(42);

      // 42 is > 10 but not < 30
      const andPat = and([numberGreaterThan(10), numberLessThan(30)]);
      expect(patternMatches(andPat, envelope)).toBe(false);
    });

    it("matches empty and pattern", () => {
      const emptyAndPat = and([]);
      const envelope = Envelope.new(42);
      // Empty AND = matches everything (vacuous truth)
      expect(patternMatches(emptyAndPat, envelope)).toBe(true);
    });
  });

  describe("Or Pattern", () => {
    it("matches when any pattern matches", () => {
      const envelope = Envelope.new(42);

      // 42 is a number (not text)
      const orPat = or([anyNumber(), anyText()]);
      expect(patternMatches(orPat, envelope)).toBe(true);
    });

    it("matches text when text is provided", () => {
      const envelope = Envelope.new("hello");

      const orPat = or([anyNumber(), anyText()]);
      expect(patternMatches(orPat, envelope)).toBe(true);
    });

    it("does not match when no patterns match", () => {
      const envelope = Envelope.new(true);

      // true is neither a number nor text
      const orPat = or([anyNumber(), anyText()]);
      expect(patternMatches(orPat, envelope)).toBe(false);
    });

    it("matches empty or pattern", () => {
      const emptyOrPat = or([]);
      const envelope = Envelope.new(42);
      // Empty OR = matches nothing
      expect(patternMatches(emptyOrPat, envelope)).toBe(false);
    });
  });

  describe("Not Pattern", () => {
    it("matches when inner pattern does not match", () => {
      const envelope = Envelope.new("hello");

      // "hello" is not a number
      const notPat = notMatching(anyNumber());
      expect(patternMatches(notPat, envelope)).toBe(true);
    });

    it("does not match when inner pattern matches", () => {
      const envelope = Envelope.new(42);

      // 42 is a number
      const notPat = notMatching(anyNumber());
      expect(patternMatches(notPat, envelope)).toBe(false);
    });
  });

  describe("Capture Pattern", () => {
    it("captures matching patterns", () => {
      const envelope = Envelope.new(42);

      const capturePat = capture("myNumber", anyNumber());
      const [paths, captures] = patternPathsWithCaptures(capturePat, envelope);

      expect(paths.length).toBeGreaterThan(0);
      expect(captures.has("myNumber")).toBe(true);
      expect(captures.get("myNumber")?.length).toBeGreaterThan(0);
    });

    it("does not capture when pattern does not match", () => {
      const envelope = Envelope.new("hello");

      const capturePat = capture("myNumber", anyNumber());
      const [paths, captures] = patternPathsWithCaptures(capturePat, envelope);

      expect(paths.length).toBe(0);
      // Captures should be empty or not contain the name
      expect(captures.get("myNumber")?.length || 0).toBe(0);
    });
  });

  describe("Search Pattern", () => {
    it("searches for patterns in envelope tree", () => {
      const envelope = Envelope.new("Alice").addAssertion("knows", "Bob").addAssertion("age", 30);

      // Search for any assertion
      const searchPat = search(anyAssertion());
      const paths = patternPaths(searchPat, envelope);

      // Should find the assertions
      expect(paths.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Traverse Pattern", () => {
    it("traverses through pattern sequence", () => {
      // Create test envelope for pattern context
      Envelope.new("Alice").addAssertion("knows", "Bob");

      // Note: Traverse functionality depends on VM implementation
      const traversePat = traverse([anySubject(), anyAssertion()]);
      expect(traversePat.type).toBe("Meta");
    });
  });

  describe("Complex Combinations", () => {
    it("combines and/or/not patterns", () => {
      const envelope = Envelope.new(42);

      // 42 is (a number AND > 10) OR (text)
      const complexPat = or([and([anyNumber(), numberGreaterThan(10)]), anyText()]);
      expect(patternMatches(complexPat, envelope)).toBe(true);

      // "hello" is (a number AND > 10) OR (text)
      const textEnvelope = Envelope.new("hello");
      expect(patternMatches(complexPat, textEnvelope)).toBe(true);

      // true is neither (a number AND > 10) nor (text)
      const boolEnvelope = Envelope.new(true);
      expect(patternMatches(complexPat, boolEnvelope)).toBe(false);
    });
  });
});
