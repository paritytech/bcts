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
import { diagnosticOpt, type DiagFormatOpts } from "@bcts/dcbor";
import { type FormatContext, getGlobalFormatContext } from "./format-context";

// Note: Method declarations are in the base Envelope class.
// This module provides the prototype implementations.

/// Implementation of diagnostic()
///
/// Mirrors Rust `Envelope::diagnostic` (`bc-envelope-rust/src/format/
/// diagnostic.rs`): the envelope's tagged CBOR is rendered via the dCBOR
/// pretty-printer (multi-line, tag annotations on by default — matching
/// Rust which uses `dcbor::diagnostic_opt(self.tagged_cbor(), opts)` with
/// `annotate = true` by default in the no-arg call site).
Envelope.prototype.diagnostic = function (this: Envelope): string {
  return diagnosticOpt(this.taggedCbor(), { annotate: true });
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
