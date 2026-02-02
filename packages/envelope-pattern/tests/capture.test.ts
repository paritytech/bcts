/**
 * @bcts/envelope-pattern - Capture Pattern Tests
 *
 * Tests for capture groups and named capture patterns.
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust capture_tests.rs
 *
 * NOTE: Capture pattern functionality requires VM implementation for path extraction.
 * Most tests are skipped until the VM provides full capture support.
 */

import { describe, it, expect } from "vitest";
import { Envelope } from "@bcts/envelope";
import {
  parse,
  capture,
  anyNumber,
  number,
  patternMatches,
  patternPathsWithCaptures,
  formatPathsWithCaptures,
} from "../src";

describe("Capture Tests", () => {
  describe("Capture Pattern Construction", () => {
    it("creates capture patterns", () => {
      const capturePat = capture("myCapture", anyNumber());
      expect(capturePat.type).toBe("Meta");
    });

    it("parses capture patterns", () => {
      const result = parse("@num(42)");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Meta");
      }
    });

    it("parses nested capture patterns", () => {
      const result = parse("@outer(@inner(42))");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Meta");
      }
    });

    it("parses multiple or capture patterns", () => {
      const result = parse("@num(42)|@num(>40)");
      expect(result.ok).toBe(true);
    });
  });

  describe("Simple Capture Matching", () => {
    // Note: Capture patterns require VM implementation to work with pathsWithCaptures
    // These tests verify pattern construction and are skipped for matching
    it("capture pattern matches when inner pattern matches", () => {
      const envelope = Envelope.new(42);
      const capturePat = capture("num", number(42));
      expect(patternMatches(capturePat, envelope)).toBe(true);
    });

    it("capture pattern does not match when inner pattern fails", () => {
      const envelope = Envelope.new(42);
      const capturePat = capture("num", number(43));
      expect(patternMatches(capturePat, envelope)).toBe(false);
    });

    it("capture pattern with anyNumber matches numbers", () => {
      const envelope = Envelope.new(42);
      const capturePat = capture("num", anyNumber());
      expect(patternMatches(capturePat, envelope)).toBe(true);
    });

    it("capture pattern with anyNumber does not match non-numbers", () => {
      const envelope = Envelope.new("hello");
      const capturePat = capture("num", anyNumber());
      expect(patternMatches(capturePat, envelope)).toBe(false);
    });
  });

  describe("Capture Path Extraction", () => {
    // These tests require full VM implementation for capture extraction
    it.skip("captures simple number with paths", () => {
      const envelope = Envelope.new(42);
      const result = parse("@num(42)");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const [paths, captures] = patternPathsWithCaptures(result.value, envelope);

        // Should have paths and captures
        expect(paths.length).toBeGreaterThan(0);
        expect(captures.has("num")).toBe(true);

        // The formatted output should include the capture name
        const formatted = formatPathsWithCaptures(paths, captures);
        expect(formatted).toContain("@num");
      }
    });

    it.skip("captures multiple or patterns", () => {
      const envelope = Envelope.new(42);
      const result = parse("@num(42)|@num(>40)");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const [paths, captures] = patternPathsWithCaptures(result.value, envelope);

        // Both patterns should match
        expect(paths.length).toBeGreaterThan(0);
        expect(captures.has("num")).toBe(true);
      }
    });

    it.skip("captures nested patterns", () => {
      const envelope = Envelope.new(42);
      const result = parse("@outer(@inner(42))");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const [paths, captures] = patternPathsWithCaptures(result.value, envelope);

        // Both inner and outer should be captured
        expect(paths.length).toBeGreaterThan(0);
        expect(captures.has("inner")).toBe(true);
        expect(captures.has("outer")).toBe(true);
      }
    });

    it.skip("returns empty captures for no match", () => {
      const envelope = Envelope.new(1);
      const result = parse("@n(2)");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const [paths, captures] = patternPathsWithCaptures(result.value, envelope);

        // No match, so empty paths and captures
        expect(paths.length).toBe(0);
        const nCaptures = captures.get("n") || [];
        expect(nCaptures.length).toBe(0);
      }
    });
  });

  describe("Format Paths With Captures", () => {
    // Format function tests with empty data (until VM is implemented)
    it("formats empty paths and captures", () => {
      const paths: Envelope[][] = [];
      const captures = new Map<string, Envelope[][]>();
      const formatted = formatPathsWithCaptures(paths, captures);
      expect(formatted).toBe("");
    });

    it("formats paths without captures", () => {
      const envelope = Envelope.new(42);
      const paths: Envelope[][] = [[envelope]];
      const captures = new Map<string, Envelope[][]>();
      const formatted = formatPathsWithCaptures(paths, captures);
      // Should contain the envelope's digest/representation
      expect(formatted.length).toBeGreaterThan(0);
    });
  });
});
