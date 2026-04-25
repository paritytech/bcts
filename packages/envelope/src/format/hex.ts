/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Hex formatting for Gordian Envelopes.
 *
 * Mirrors Rust `bc-envelope-rust/src/format/hex.rs`, which delegates to
 * `dcbor::HexFormatOpts` for an annotated multi-line hex dump (tag names,
 * column-aligned notes). We do the same — both {@link Envelope.hex} and
 * {@link Envelope.hexOpt} reuse the canonical {@link hexOpt} formatter in
 * `@bcts/dcbor` so envelope hex output stays byte-for-byte compatible with
 * Rust's parity-test fixtures.
 */

import { Envelope } from "../base/envelope";
import { cborData, hexOpt, type HexFormatOpts } from "@bcts/dcbor";
import { type FormatContext, getGlobalFormatContext } from "./format-context";

// Note: Method declarations are in the base Envelope class.
// This module provides the prototype implementations.

/// Implementation of hex()
///
/// Mirrors Rust `Envelope::hex`
/// (`bc-envelope-rust/src/format/hex.rs`): the default is the **annotated**
/// multi-line dump because that's the call most consumers expect when
/// they ask for a debuggable hex view of an envelope.
Envelope.prototype.hex = function (this: Envelope): string {
  const ctx = getGlobalFormatContext();
  return hexOpt(this.taggedCbor(), { annotate: true, tagsStore: ctx.tags() });
};

/// Implementation of hexOpt()
///
/// Mirrors Rust `Envelope::hex_opt(annotate, context)`. When `annotate` is
/// `false` we emit a flat hex string (`hexOpt` short-circuits to plain
/// `hex(...)` in that case). When `annotate` is `true` the optional
/// `context` provides the tag store used to resolve tag names.
Envelope.prototype.hexOpt = function (
  this: Envelope,
  annotate: boolean,
  context?: FormatContext,
): string {
  const opts: HexFormatOpts = { annotate };
  if (annotate) {
    const ctx = context ?? getGlobalFormatContext();
    opts.tagsStore = ctx.tags();
  }
  return hexOpt(this.taggedCbor(), opts);
};

/// Implementation of cborBytes()
Envelope.prototype.cborBytes = function (this: Envelope): Uint8Array {
  const cbor = this.taggedCbor();
  return cborData(cbor);
};
