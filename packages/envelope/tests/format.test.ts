import { Envelope } from "../src";
import {
  MermaidOrientation,
  MermaidTheme,
  defaultMermaidOpts,
  defaultFormatOpts,
  flatFormatOpts,
  FormatContext,
  globalFormatContext,
  withFormatContext,
} from "../src/format";

describe("Mermaid Formatting", () => {
  describe("mermaidFormat()", () => {
    it("should generate mermaid diagram for simple leaf", () => {
      const envelope = Envelope.new("Hello");
      const mermaid = envelope.mermaidFormat();

      expect(mermaid).toContain("graph");
      expect(mermaid).toContain("Hello");
    });

    it("should generate mermaid diagram for envelope with assertions", () => {
      const envelope = Envelope.new("Alice").addAssertion("knows", "Bob").addAssertion("age", 30);

      const mermaid = envelope.mermaidFormat();

      expect(mermaid).toContain("graph");
      expect(mermaid).toContain("Alice");
    });

    it("should handle nested envelopes", () => {
      const inner = Envelope.new("Inner").addAssertion("key", "value");
      const outer = Envelope.new(inner.wrap()).addAssertion("note", "wrapped");

      const mermaid = outer.mermaidFormat();

      expect(mermaid).toContain("graph");
    });
  });

  describe("mermaidFormatOpt()", () => {
    it("should respect orientation option", () => {
      const envelope = Envelope.new("Test");

      const lr = envelope.mermaidFormatOpt({
        orientation: MermaidOrientation.LeftToRight,
      });
      expect(lr).toContain("LR");

      const tb = envelope.mermaidFormatOpt({
        orientation: MermaidOrientation.TopToBottom,
      });
      expect(tb).toContain("TB");
    });

    it("should respect theme option", () => {
      const envelope = Envelope.new("Test");

      const dark = envelope.mermaidFormatOpt({
        theme: MermaidTheme.Dark,
      });
      expect(dark).toContain("dark");

      const forest = envelope.mermaidFormatOpt({
        theme: MermaidTheme.Forest,
      });
      expect(forest).toContain("forest");
    });

    it("should respect monochrome option", () => {
      const envelope = Envelope.new("Test").addAssertion("key", "value");

      const mono = envelope.mermaidFormatOpt({ monochrome: true });
      const color = envelope.mermaidFormatOpt({ monochrome: false });

      // Both should generate valid mermaid
      expect(mono).toContain("graph");
      expect(color).toContain("graph");
    });
  });

  describe("defaultMermaidOpts()", () => {
    it("should return default options", () => {
      const opts = defaultMermaidOpts();

      expect(opts.hideNodes).toBe(false);
      expect(opts.monochrome).toBe(false);
      expect(opts.theme).toBe(MermaidTheme.Default);
      expect(opts.orientation).toBe(MermaidOrientation.LeftToRight);
    });
  });
});

describe("Notation Formatting", () => {
  describe("format()", () => {
    it("should format simple leaf envelope", () => {
      const envelope = Envelope.new("Hello");
      const formatted = envelope.format();

      expect(formatted).toContain("Hello");
    });

    it("should format number envelope", () => {
      const envelope = Envelope.new(42);
      const formatted = envelope.format();

      expect(formatted).toContain("42");
    });

    it("should format envelope with assertions", () => {
      const envelope = Envelope.new("Alice").addAssertion("knows", "Bob").addAssertion("age", 30);

      const formatted = envelope.format();

      expect(formatted).toContain("Alice");
      expect(formatted).toContain("knows");
      expect(formatted).toContain("Bob");
      expect(formatted).toContain("age");
      expect(formatted).toContain("30");
    });

    it("should format wrapped envelope", () => {
      const inner = Envelope.new("Secret");
      const wrapped = inner.wrap();
      const formatted = wrapped.format();

      expect(formatted).toContain("Secret");
    });

    it("should format elided envelope", () => {
      const envelope = Envelope.new("Hello");
      const elided = envelope.elide();
      const formatted = elided.format();

      expect(formatted).toContain("ELIDED");
    });
  });

  describe("formatFlat()", () => {
    it("should format on single line", () => {
      const envelope = Envelope.new("Alice").addAssertion("knows", "Bob");

      const formatted = envelope.formatFlat();

      // Flat format should not have newlines in the middle
      expect(formatted.split("\n").length).toBeLessThanOrEqual(2);
    });
  });

  describe("formatOpt()", () => {
    it("should accept custom options", () => {
      const envelope = Envelope.new("Test");

      const defaultFormatted = envelope.formatOpt(defaultFormatOpts());
      const flatFormatted = envelope.formatOpt(flatFormatOpts());

      expect(defaultFormatted).toBeDefined();
      expect(flatFormatted).toBeDefined();
    });
  });
});

describe("Format Context", () => {
  describe("FormatContext", () => {
    it("should create empty context", () => {
      const ctx = new FormatContext();
      expect(ctx).toBeDefined();
    });

    it("should register and retrieve tags", () => {
      const ctx = new FormatContext();
      ctx.registerTag(12345, "CustomTag");

      // Use assignedNameForTag which returns string | undefined
      const tag = ctx.tagForValue(BigInt(12345));
      expect(tag).toBeDefined();
      expect(tag?.name).toBe("CustomTag");
    });

    it("should return undefined for unregistered tags", () => {
      const ctx = new FormatContext();
      const tag = ctx.tagForValue(BigInt(99999));
      expect(tag).toBeUndefined();
    });
  });

  describe("globalFormatContext()", () => {
    it("should return the global context", () => {
      const ctx = globalFormatContext();
      expect(ctx).toBeInstanceOf(FormatContext);
    });

    it("should return the same instance each time", () => {
      const ctx1 = globalFormatContext();
      const ctx2 = globalFormatContext();
      expect(ctx1).toBe(ctx2);
    });
  });

  describe("withFormatContext()", () => {
    it("should execute callback with context", () => {
      let executed = false;
      withFormatContext((ctx) => {
        expect(ctx).toBeInstanceOf(FormatContext);
        executed = true;
      });
      expect(executed).toBe(true);
    });

    it("should return callback result", () => {
      const result = withFormatContext(() => {
        return "test-result";
      });
      expect(result).toBe("test-result");
    });
  });
});

describe("Envelope Summary", () => {
  describe("summary()", () => {
    it("should summarize leaf envelope", () => {
      const envelope = Envelope.new("Hello, World!");
      const summary = envelope.summary(20);

      expect(summary.length).toBeLessThanOrEqual(25); // some buffer for quotes
      expect(summary).toContain("Hello");
    });

    it("should truncate long strings", () => {
      const longString = "A".repeat(100);
      const envelope = Envelope.new(longString);
      const summary = envelope.summary(20);

      expect(summary.length).toBeLessThan(longString.length);
    });

    it("should summarize number envelope", () => {
      const envelope = Envelope.new(12345);
      const summary = envelope.summary(10);

      expect(summary).toContain("12345");
    });

    it("should summarize bytes envelope", () => {
      const envelope = Envelope.new(new Uint8Array([1, 2, 3, 4, 5]));
      const summary = envelope.summary(30);

      // Should show hex representation
      expect(summary.length).toBeGreaterThan(0);
    });
  });
});
