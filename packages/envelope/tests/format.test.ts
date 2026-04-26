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

  // E1b — pin TS Mermaid output byte-for-byte against Rust fixtures
  // from `bc-envelope-rust/tests/format_tests.rs`. Same bug-class as
  // the G1 / X1 format-string pins for GSTP / XID — round-trip checks
  // never noticed encoder-path drift in the format-context summarizers
  // until those pins were added; Mermaid was the last big-format
  // surface lacking byte-shape pins.
  describe("E1b — Mermaid byte-shape parity with Rust", () => {
    it("matches Rust encrypted-subject Mermaid (E1b-1)", async () => {
      // Source: `bc-envelope-rust/tests/format_tests.rs:152-202`
      //   let envelope = Envelope::new("Alice")
      //       .add_assertion("knows", "Bob")
      //       .encrypt_subject(&SymmetricKey::new())
      //       .unwrap();
      //
      // The encryption key is fresh every call, but the ENCRYPTED
      // leaf's digest is the digest of the plaintext envelope it
      // covers, so the rendered Mermaid is byte-stable across runs.
      const { SymmetricKey } = await import("@bcts/components");
      const env = Envelope.new("Alice")
        .addAssertion("knows", "Bob")
        .encryptSubject(SymmetricKey.new());

      const expected = [
        "%%{ init: { 'theme': 'default', 'flowchart': { 'curve': 'basis' } } }%%",
        "graph LR",
        '0(("NODE<br>8955db5e"))',
        '    0 -- subj --> 1>"ENCRYPTED<br>13941b48"]',
        '    0 --> 2(["ASSERTION<br>78d666eb"])',
        '        2 -- pred --> 3["&quot;knows&quot;<br>db7dd21c"]',
        '        2 -- obj --> 4["&quot;Bob&quot;<br>13b74194"]',
        "style 0 stroke:red,stroke-width:4px",
        "style 1 stroke:coral,stroke-width:4px",
        "style 2 stroke:green,stroke-width:4px",
        "style 3 stroke:teal,stroke-width:4px",
        "style 4 stroke:teal,stroke-width:4px",
        "linkStyle 0 stroke:red,stroke-width:2px",
        "linkStyle 1 stroke-width:2px",
        "linkStyle 2 stroke:cyan,stroke-width:2px",
        "linkStyle 3 stroke:magenta,stroke-width:2px",
      ].join("\n");
      expect(env.mermaidFormat()).toBe(expected);
    });

    it("matches Rust plaintext envelope Mermaid (E1b-2)", () => {
      // The unencrypted version of the same envelope. The Rust suite
      // doesn't have an explicit Mermaid fixture for this case, but
      // the rendered output structurally mirrors the encrypted variant
      // (the "Alice" leaf replaces the ENCRYPTED leaf, with the same
      // digest). This pin therefore catches encoder-path regressions
      // for the plain-leaf code path that the encrypted pin doesn't
      // exercise (different leaf shape / style class).
      const env = Envelope.new("Alice").addAssertion("knows", "Bob");

      const expected = [
        "%%{ init: { 'theme': 'default', 'flowchart': { 'curve': 'basis' } } }%%",
        "graph LR",
        '0(("NODE<br>8955db5e"))',
        '    0 -- subj --> 1["&quot;Alice&quot;<br>13941b48"]',
        '    0 --> 2(["ASSERTION<br>78d666eb"])',
        '        2 -- pred --> 3["&quot;knows&quot;<br>db7dd21c"]',
        '        2 -- obj --> 4["&quot;Bob&quot;<br>13b74194"]',
        "style 0 stroke:red,stroke-width:4px",
        "style 1 stroke:teal,stroke-width:4px",
        "style 2 stroke:green,stroke-width:4px",
        "style 3 stroke:teal,stroke-width:4px",
        "style 4 stroke:teal,stroke-width:4px",
        "linkStyle 0 stroke:red,stroke-width:2px",
        "linkStyle 1 stroke-width:2px",
        "linkStyle 2 stroke:cyan,stroke-width:2px",
        "linkStyle 3 stroke:magenta,stroke-width:2px",
      ].join("\n");
      expect(env.mermaidFormat()).toBe(expected);
    });

    it("propagates non-default theme + orientation (E1b-3)", () => {
      // Pins that the `MermaidFormatOpts` flags reach the rendered
      // header verbatim — same byte-shape contract Rust's
      // `MermaidFormatOpts::default().theme(MermaidTheme::Dark)`
      // produces in `format_tests.rs:1125-1132`.
      const env = Envelope.new("Alice").addAssertion("knows", "Bob");

      const dark = env.mermaidFormatOpt({
        theme: MermaidTheme.Dark,
        orientation: MermaidOrientation.TopToBottom,
      });
      expect(
        dark.startsWith(
          "%%{ init: { 'theme': 'dark', 'flowchart': { 'curve': 'basis' } } }%%\ngraph TB\n",
        ),
      ).toBe(true);

      const forest = env.mermaidFormatOpt({
        theme: MermaidTheme.Forest,
        orientation: MermaidOrientation.LeftToRight,
      });
      expect(
        forest.startsWith(
          "%%{ init: { 'theme': 'forest', 'flowchart': { 'curve': 'basis' } } }%%\ngraph LR\n",
        ),
      ).toBe(true);
    });

    it("hides NODE elements (and their digests) under hideNodes (E1b-4)", () => {
      // Mirrors the warranty fixture pattern from
      // `bc-envelope-rust/tests/format_tests.rs:1288+` — when
      // `hide_nodes(true)` is set, NODE elements are *omitted
      // entirely* (not just their digests), the subject becomes the
      // root element, and ids re-index from 0. Every visible label
      // also drops the `<br><digest>` suffix.
      const env = Envelope.new("Alice").addAssertion("knows", "Bob");
      const expected = [
        "%%{ init: { 'theme': 'default', 'flowchart': { 'curve': 'basis' } } }%%",
        "graph LR",
        '0["&quot;Alice&quot;"]',
        '    0 --> 1(["ASSERTION"])',
        '        1 -- pred --> 2["&quot;knows&quot;"]',
        '        1 -- obj --> 3["&quot;Bob&quot;"]',
        "style 0 stroke:teal,stroke-width:4px",
        "style 1 stroke:green,stroke-width:4px",
        "style 2 stroke:teal,stroke-width:4px",
        "style 3 stroke:teal,stroke-width:4px",
        "linkStyle 0 stroke-width:2px",
        "linkStyle 1 stroke:cyan,stroke-width:2px",
        "linkStyle 2 stroke:magenta,stroke-width:2px",
      ].join("\n");
      expect(env.mermaidFormatOpt({ hideNodes: true })).toBe(expected);
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

describe("E1a — format-context summarizer parity with Rust", () => {
  // Pinned regression tests for the per-tag summarizer output strings,
  // matching `bc-components-rust/src/tags_registry.rs::register_tags_in`.
  // Same bug-class as the SealedMessage scheme-uppercase fix from G1
  // and the MLDSA-44/MLDSA44 hyphen fix landed alongside this pin
  // pass — wrong summarizer output silently breaks cross-impl format
  // parity since round-trip digest checks pass either way.

  it("renders TAG_JSON as JSON(<as_str>) (E1a-1)", async () => {
    const { JSON: JSONTagged } = await import("@bcts/components");
    const json = JSONTagged.fromString('{"a":1}');
    const envelope = Envelope.new(json);
    expect(envelope.format()).toBe('JSON({"a":1})');
  });

  it("renders TAG_REFERENCE via Reference.toString() (E1a-2)", async () => {
    const { Reference } = await import("@bcts/components");
    // Build a Reference from a known 32-byte digest image; the short
    // ref is the first 8 hex chars of that data.
    const data = new Uint8Array(32);
    for (let i = 0; i < 32; i++) data[i] = i;
    const ref = Reference.fromData(data);
    const envelope = Envelope.new(ref);
    // Reference.toString() = `Reference(<refHexShort>)`. We assert the
    // shape rather than the exact short ref so the test stays valid
    // even if the input bytes are tweaked.
    expect(envelope.format()).toMatch(/^Reference\([0-9a-f]{8}\)$/);
  });

  it("renders TAG_SIGNATURE for non-default scheme using raw enum name, not human-friendly form (E1a-3)", async () => {
    const { Signature, MLDSASignature, MLDSALevel } = await import("@bcts/components");
    // Construct a stub Signature with the MLDSA44 scheme. The summarizer
    // path must render `Signature(MLDSA44)` (Rust enum-Debug shape),
    // NOT `Signature(MLDSA-44)` (TS `signatureType()` human form).
    // The summarizer only reads the scheme tag, but the round-trip
    // decoder validates length, so we use the canonical MLDSA44 sig
    // length (2420 bytes).
    const inner = MLDSASignature.fromBytes(MLDSALevel.MLDSA44, new Uint8Array(2420));
    const stub = Signature.mldsaFromSignature(inner);
    const envelope = Envelope.new(stub);
    const formatted = envelope.format();
    expect(formatted).toBe("Signature(MLDSA44)");
    expect(formatted).not.toContain("MLDSA-44");
  });
});

describe("E1f — SSH summarizer parity with Rust tags_registry.rs:196-238", () => {
  // Pinned regression tests for the four `TAG_SSH_TEXT_*` summarizers,
  // matching `bc-components-rust/src/tags_registry.rs:196-238`. CBOR shape
  // for all four is `tag(N, text:openssh_text)` and the summarizer outputs
  // either `<Type>(refHexShort)` (private/public key) or a fixed string
  // (signature/certificate). Inputs are the verbatim Rust fixture strings
  // from `bc-components-rust/src/lib.rs:361,473` (Ed25519 + ECDSA-P256
  // generated from seed 59f2293a5bce7d4de59e71b4207ac5d2).

  it("renders TAG_SSH_TEXT_PRIVATE_KEY as SSHPrivateKey(refHexShort) (E1f-1)", async () => {
    const { cbor, toTaggedValue } = await import("@bcts/dcbor");
    const { SSH_TEXT_PRIVATE_KEY } = await import("@bcts/tags");
    const text = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACBUe4FDGyGIgHf75yVdE4hYl9guj02FdsIadgLC04zObQAAAJA+TyZiPk8m
YgAAAAtzc2gtZWQyNTUxOQAAACBUe4FDGyGIgHf75yVdE4hYl9guj02FdsIadgLC04zObQ
AAAECsX3CKi3hm5VrrU26ffa2FB2YrFogg45ucOVbIz4FQo1R7gUMbIYiAd/vnJV0TiFiX
2C6PTYV2whp2AsLTjM5tAAAADEtleSBjb21tZW50LgE=
-----END OPENSSH PRIVATE KEY-----
`;
    const tagged = toTaggedValue(SSH_TEXT_PRIVATE_KEY.value, cbor(text));
    const envelope = Envelope.newLeaf(tagged);
    expect(envelope.format()).toMatch(/^SSHPrivateKey\([0-9a-f]{8}\)$/);
  });

  it("renders TAG_SSH_TEXT_PUBLIC_KEY as SSHPublicKey(refHexShort) (E1f-2)", async () => {
    const { cbor, toTaggedValue } = await import("@bcts/dcbor");
    const { SSH_TEXT_PUBLIC_KEY } = await import("@bcts/tags");
    const text =
      "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFR7gUMbIYiAd/vnJV0TiFiX2C6PTYV2whp2AsLTjM5t Key comment.";
    const tagged = toTaggedValue(SSH_TEXT_PUBLIC_KEY.value, cbor(text));
    const envelope = Envelope.newLeaf(tagged);
    expect(envelope.format()).toMatch(/^SSHPublicKey\([0-9a-f]{8}\)$/);
  });

  it("renders TAG_SSH_TEXT_SIGNATURE as fixed 'SSHSignature' (E1f-3)", async () => {
    const { cbor, toTaggedValue } = await import("@bcts/dcbor");
    const { SSH_TEXT_SIGNATURE } = await import("@bcts/tags");
    const { SSHPublicKey, SSHSignature } = await import("@bcts/components");
    const pub = SSHPublicKey.fromOpenssh(
      "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFR7gUMbIYiAd/vnJV0TiFiX2C6PTYV2whp2AsLTjM5t Key comment.",
    );
    const sigBytes = new Uint8Array(64);
    for (let i = 0; i < 64; i++) sigBytes[i] = i + 1;
    const sig = SSHSignature.fromParts(pub, "test", "sha256", sigBytes);
    const tagged = toTaggedValue(SSH_TEXT_SIGNATURE.value, cbor(sig.toPem()));
    const envelope = Envelope.newLeaf(tagged);
    expect(envelope.format()).toBe("SSHSignature");
  });

  it("renders TAG_SSH_TEXT_CERTIFICATE as fixed 'SSHCertificate' (E1f-4)", async () => {
    const { cbor, toTaggedValue } = await import("@bcts/dcbor");
    const { SSH_TEXT_CERTIFICATE } = await import("@bcts/tags");
    // Rust placeholder summarizer doesn't validate — any text payload works.
    const tagged = toTaggedValue(
      SSH_TEXT_CERTIFICATE.value,
      cbor("ssh-ed25519-cert-v01@openssh.com AAAA= user@host"),
    );
    const envelope = Envelope.newLeaf(tagged);
    expect(envelope.format()).toBe("SSHCertificate");
  });
});
