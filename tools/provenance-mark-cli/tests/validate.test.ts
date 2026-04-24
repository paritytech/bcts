import { describe, it, expect } from "vitest";
import { Envelope } from "@bcts/envelope";
import { PROVENANCE } from "@bcts/known-values";
import { UR } from "@bcts/uniform-resources";
import {
  type ProvenanceMark,
  ProvenanceMarkGenerator,
  ProvenanceMarkResolution,
} from "@bcts/provenance-mark";

import { ValidateCommand, ValidateFormat } from "../src/cmd/validate.js";

// Port of the new tests added in rust/provenance-mark-cli-rust/tests/validate.rs:
// - test_validate_signed_envelope_with_provenance
// - test_validate_signed_xid_with_provenance

function createTestMark(): ProvenanceMark {
  const generator = ProvenanceMarkGenerator.newWithPassphrase(
    ProvenanceMarkResolution.Low,
    "test",
  );
  return generator.next(new Date(Date.UTC(2023, 5, 20, 12, 0, 0, 0)));
}

function wrappedMarkUr(mark: ProvenanceMark, urType: string): string {
  // Mirror rust helper `wrapped_mark_ur`:
  //   let inner = Envelope::new("fixture").add_assertion(PROVENANCE, mark.clone());
  //   let signed_like = inner.wrap().add_assertion("signed", "fixture-signature");
  //   UR::new(ur_type, signed_like.untagged_cbor())
  const inner = Envelope.new("fixture").addAssertion(
    PROVENANCE,
    mark.intoEnvelope(),
  );
  const signedLike = inner.wrap().addAssertion("signed", "fixture-signature");
  return UR.new(urType, signedLike.untaggedCbor()).toString();
}

function runValidate(urStrings: string[]): { success: boolean; output: string } {
  const cmd = new ValidateCommand({
    marks: urStrings,
    warn: false,
    format: ValidateFormat.Text,
  });
  try {
    return { success: true, output: cmd.exec() };
  } catch (e) {
    return {
      success: false,
      output: e instanceof Error ? e.message : String(e),
    };
  }
}

describe("ValidateCommand — wrapped-envelope unwrap", () => {
  it("accepts a provenance mark inside a signed `ur:envelope` wrapper", () => {
    const mark = createTestMark();
    const urString = wrappedMarkUr(mark, "envelope");

    const { success } = runValidate([urString]);
    expect(success).toBe(true);
  });

  it("accepts a provenance mark inside a signed `ur:xid` wrapper", () => {
    const mark = createTestMark();
    const urString = wrappedMarkUr(mark, "xid");

    const { success } = runValidate([urString]);
    expect(success).toBe(true);
  });

  it("still validates an unwrapped `ur:envelope` with a single provenance assertion", () => {
    const mark = createTestMark();
    const plain = Envelope.new("fixture").addAssertion(
      PROVENANCE,
      mark.intoEnvelope(),
    );
    const urString = UR.new("envelope", plain.untaggedCbor()).toString();

    const { success } = runValidate([urString]);
    expect(success).toBe(true);
  });

  it("rejects an envelope that has no provenance assertion at any layer", () => {
    const noProv = Envelope.new("fixture").addAssertion("unrelated", "value");
    const wrapped = noProv.wrap().addAssertion("signed", "fixture-signature");
    const urString = UR.new("envelope", wrapped.untaggedCbor()).toString();

    const { success, output } = runValidate([urString]);
    expect(success).toBe(false);
    expect(output).toContain("does not contain a 'provenance' assertion");
  });

  it("rejects an envelope with more than one provenance assertion at the same layer", () => {
    const mark1 = createTestMark();
    const mark2 = createTestMark();
    const doubled = Envelope.new("fixture")
      .addAssertion(PROVENANCE, mark1.intoEnvelope())
      .addAssertion(PROVENANCE, mark2.intoEnvelope());
    const urString = UR.new("envelope", doubled.untaggedCbor()).toString();

    const { success, output } = runValidate([urString]);
    expect(success).toBe(false);
    expect(output).toContain("expected exactly one");
  });
});
