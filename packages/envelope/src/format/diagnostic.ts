/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Diagnostic notation formatting for Gordian Envelopes.
 *
 * This module provides methods for converting envelopes to CBOR diagnostic
 * notation, a human-readable text format defined in
 * [RFC-8949 §8](https://www.rfc-editor.org/rfc/rfc8949.html#name-diagnostic-notation).
 *
 * Mirrors Rust `bc-envelope-rust/src/format/diagnostic.rs`, which delegates
 * to `dcbor::diagnostic_opt` / `dcbor::diagnostic_annotated`. We do the same
 * — the {@link diagnostic} and {@link diagnosticAnnotated} methods reuse the
 * canonical formatters in `@bcts/dcbor` so envelope diagnostic output stays
 * byte-for-byte compatible with the rest of the suite (and with Rust output
 * in the parity-test fixtures).
 */

import { Envelope } from "../base/envelope";
import { diagnostic, diagnosticOpt, type DiagFormatOpts } from "@bcts/dcbor";
import { type FormatContext, getGlobalFormatContext } from "./format-context";

// Note: Method declarations are in the base Envelope class.
// This module provides the prototype implementations.

/// Implementation of diagnostic()
///
/// Mirrors Rust `Envelope::diagnostic` (`bc-envelope-rust/src/format/
/// diagnostic.rs:27`):
///
///     pub fn diagnostic(&self) -> String { self.tagged_cbor().diagnostic() }
///
/// Plain CBOR diagnostic notation, no tag-name annotations. The annotated
/// variant lives on `diagnosticAnnotated()` below.
Envelope.prototype.diagnostic = function (this: Envelope): string {
  return diagnostic(this.taggedCbor());
};

/// Implementation of diagnosticAnnotated()
///
/// Mirrors Rust `Envelope::diagnostic_annotated` — explicit annotation on,
/// optionally threading a {@link FormatContext} so consumer-registered tag
/// names appear in the output. `dcbor` accepts a `TagsStore` directly via
/// its `tags` option; we read it off the format context's `tags()`
/// accessor (or the global tag store when no context is provided).
Envelope.prototype.diagnosticAnnotated = function (
  this: Envelope,
  context?: FormatContext,
): string {
  const opts: DiagFormatOpts = { annotate: true };
  const ctx = context ?? getGlobalFormatContext();
  opts.tags = ctx.tags();
  return diagnosticOpt(this.taggedCbor(), opts);
};
