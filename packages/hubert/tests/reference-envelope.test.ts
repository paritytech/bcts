/**
 * @bcts/hubert — Reference envelope round-trip tests (H-11)
 *
 * Pinned regression for the hybrid storage layer's reference
 * envelopes. These envelopes go on the DHT in the H-1..H-4
 * scenarios and must round-trip byte-identically through the TS
 * <-> Rust boundary.
 *
 * Mirrors Rust `hubert-rust/src/hybrid/reference.rs` round-trip
 * tests. The Rust crate doesn't carry a unit test for these
 * helpers, so this file is the canonical regression for both
 * sides — feed the TS-produced envelope's tagged CBOR into Rust's
 * `is_reference_envelope` to confirm cross-language parity.
 */

import { describe, it, expect } from "vitest";
import { ARID } from "@bcts/components";
import { Envelope } from "@bcts/envelope";
import {
  createReferenceEnvelope,
  extractReferenceArid,
  isReferenceEnvelope,
  ContentNotFoundError,
  InvalidReferenceAridError,
  NoIdAssertionError,
  NotReferenceEnvelopeError,
} from "../src";

const TEST_ARID_HEX =
  "4676635a6e6068c2ef3ffd8ff726dd401fd341036e920f136a1d8af5e829496d";

function testArid(): ARID {
  return ARID.fromHex(TEST_ARID_HEX);
}

describe("H-11 — Reference envelope round-trip", () => {
  it("createReferenceEnvelope produces an envelope that isReferenceEnvelope accepts", () => {
    const env = createReferenceEnvelope(testArid(), 1234);
    expect(isReferenceEnvelope(env)).toBe(true);
  });

  it("extractReferenceArid round-trips the ARID", () => {
    const arid = testArid();
    const env = createReferenceEnvelope(arid, 9876);
    const extracted = extractReferenceArid(env);
    expect(extracted.toHex()).toBe(arid.toHex());
  });

  it("CBOR round-trip preserves both flags and the ARID", async () => {
    const arid = testArid();
    const env = createReferenceEnvelope(arid, 555);

    // Encode → decode through tagged CBOR (the same path the DHT
    // takes when a Rust client GETs a TS-stored reference).
    const { decodeCbor } = await import("@bcts/dcbor");
    const decoded = Envelope.fromTaggedCbor(decodeCbor(env.taggedCborData()));

    expect(isReferenceEnvelope(decoded)).toBe(true);
    expect(extractReferenceArid(decoded).toHex()).toBe(arid.toHex());
  });

  it("rejects non-reference envelopes (plain envelope)", () => {
    const env = Envelope.new("hello");
    expect(isReferenceEnvelope(env)).toBe(false);
    expect(() => extractReferenceArid(env)).toThrow(NotReferenceEnvelopeError);
  });

  it("rejects envelopes missing the dereferenceVia assertion", async () => {
    // Build a unit envelope with only the `id` assertion (no
    // `dereferenceVia: ipfs`). isReferenceEnvelope must reject.
    const { ID } = await import("@bcts/known-values");
    const env = Envelope.unit().addAssertion(ID, testArid());
    expect(isReferenceEnvelope(env)).toBe(false);
  });

  it("rejects envelopes with a non-`ipfs` dereferenceVia value", async () => {
    const { DEREFERENCE_VIA, ID } = await import("@bcts/known-values");
    const env = Envelope.unit()
      .addAssertion(DEREFERENCE_VIA, "https")
      .addAssertion(ID, testArid());
    expect(isReferenceEnvelope(env)).toBe(false);
  });

  it("emits all three error classes for invalid inputs", () => {
    // Smoke that all error classes are constructable + correctly
    // named (mirrors the Rust enum's variant set).
    const errs = [
      new NotReferenceEnvelopeError(),
      new InvalidReferenceAridError(),
      new NoIdAssertionError(),
      new ContentNotFoundError(),
    ];
    for (const e of errs) {
      expect(e).toBeInstanceOf(Error);
      expect(typeof e.message).toBe("string");
      expect(e.message.length).toBeGreaterThan(0);
    }
  });
});
