/**
 * @bcts/envelope-pattern — Credential pattern tests
 *
 * Port of `bc-envelope-pattern-rust/tests/credential_tests.rs`. The
 * earlier TS port stubbed signing/elision out (see the explicit
 * "without requiring full crypto support" comment); this port uses
 * the real `addSignatureOpt` + Schnorr deterministic-RNG path and a
 * real `elideRevealingSet`-built redacted credential, mirroring
 * `common::test_data::{credential, redacted_credential}` from the
 * Rust crate.
 */

import { describe, it, expect } from "vitest";
import { Envelope } from "@bcts/envelope";
import { ARID, PrivateKeyBase } from "@bcts/components";
import { CborDate } from "@bcts/dcbor";
import { hexToBytes } from "@bcts/components";
import { makeFakeRandomNumberGenerator } from "@bcts/rand";
import { IS_A, ISSUER, CONTROLLER, NOTE } from "@bcts/known-values";
import type { Digest } from "@bcts/envelope";
import {
  parse,
  patternMatches,
  patternPaths,
  patternPathsWithCaptures,
} from "../src";

// `alice_seed` from `common/test_data.rs:30-32`.
const ALICE_SEED_HEX = "82f32c855d3d542256180810797e0073";
// `credential` ARID from `common/test_data.rs:95-97`.
const CREDENTIAL_ARID_HEX =
  "4676635a6e6068c2ef3ffd8ff726dd401fd341036e920f136a1d8af5e829496d";

function alicePrivateKey(): PrivateKeyBase {
  return PrivateKeyBase.fromData(hexToBytes(ALICE_SEED_HEX));
}

/**
 * Build the same credential the Rust test suite uses, minus the
 * `add_signature_opt` step (the `credential` builder below appends
 * the signature). Mirrors `bc-envelope-pattern-rust/tests/common/
 * test_data.rs:85-122` line-for-line.
 */
function credential(): Envelope {
  const arid = ARID.fromData(hexToBytes(CREDENTIAL_ARID_HEX));
  const issueDate = CborDate.fromString("2020-01-01");
  const expirationDate = CborDate.fromString("2028-01-01");

  const inner = Envelope.new(arid)
    .addAssertion(IS_A, "Certificate of Completion")
    .addAssertion(ISSUER, "Example Electrical Engineering Board")
    .addAssertion(CONTROLLER, "Example Electrical Engineering Board")
    .addAssertion("firstName", "James")
    .addAssertion("lastName", "Maxwell")
    .addAssertion("issueDate", issueDate)
    .addAssertion("expirationDate", expirationDate)
    .addAssertion("photo", "This is James Maxwell's photo.")
    .addAssertion("certificateNumber", "123-456-789")
    .addAssertion("subject", "RF and Microwave Engineering")
    .addAssertion("continuingEducationUnits", 1)
    .addAssertion("professionalDevelopmentHours", 15)
    .addAssertion("topics", ["Subject 1", "Subject 2"] as unknown as number);

  const wrapped = inner.wrap();
  const rng = makeFakeRandomNumberGenerator();
  // The Rust crate signs with Alice's Schnorr key (BIP-340) and a
  // deterministic RNG so output is reproducible across runs.
  const schnorrSigner = alicePrivateKey().schnorrPrivateKeys().signingPrivateKey();
  const signed = wrapped.addSignatureOpt(schnorrSigner, { type: "Schnorr", rng });
  return signed.addAssertion(
    NOTE,
    "Signed by Example Electrical Engineering Board",
  );
}

/**
 * Mirrors `redacted_credential()` from
 * `common/test_data.rs:124-173`: a redacted credential where the
 * outer envelope, the ARID subject, and a curated subset of inner
 * assertions (firstName, lastName, isA, issuer, subject,
 * expirationDate) remain visible while everything else is elided.
 */
function redactedCredential(env: Envelope): Envelope {
  const target = new Set<Digest>();
  // Outer envelope digest.
  target.add(env.digest());
  // Outer assertions (note + signature).
  for (const assertion of env.assertions()) {
    for (const d of (assertion as unknown as { deepDigests(): Digest[] }).deepDigests()) {
      target.add(d);
    }
  }
  // Outer subject (the wrapped inner credential).
  target.add(env.subject().digest());

  const content = (env.subject() as unknown as { tryUnwrap(): Envelope }).tryUnwrap();
  target.add(content.digest());
  target.add(content.subject().digest());

  // Reveal selected predicate assertions inside the wrapped content.
  const revealed: Array<unknown> = [
    "firstName",
    "lastName",
    IS_A,
    ISSUER,
    "subject",
    "expirationDate",
  ];
  for (const pred of revealed) {
    const assertion = (content as unknown as {
      assertionWithPredicate(p: unknown): Envelope | undefined;
    }).assertionWithPredicate(pred);
    if (assertion === undefined) continue;
    for (const d of (assertion as unknown as { shallowDigests(): Digest[] }).shallowDigests()) {
      target.add(d);
    }
  }

  return env.elideRevealingSet(target);
}

describe("Credential pattern tests (credential_tests.rs, real crypto)", () => {
  it("credential() produces an envelope with 13 inner assertions + 2 outer", () => {
    const env = credential();
    // Outer envelope has 2 assertions (signed, note). The wrapped
    // inner has 13 (one per `add_assertion` call in the Rust
    // builder).
    expect(env.assertions().length).toBe(2);
    const inner = (env.subject() as unknown as { tryUnwrap(): Envelope }).tryUnwrap();
    expect(inner.assertions().length).toBe(13);
  });

  it("`search(assertobj(text|number))` finds 11 paths in the credential", () => {
    // Mirrors `test_parsed_search_text_or_number` from the Rust test.
    const env = credential();
    const r = parse("search(assertobj(text|number))");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(patternPaths(r.value, env).length).toBe(11);
  });

  it('`search(assertpred("firstName")->obj("James"))` finds exactly 1 path', () => {
    // Mirrors `test_parsed_firstname_capture`.
    const env = credential();
    const r = parse('search(assertpred("firstName")->obj("James"))');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(patternPaths(r.value, env).length).toBe(1);
  });

  it('`search(@cap(assertpred("firstName")->obj("James")))` propagates the capture', () => {
    // Mirrors `test_search_capture_propagation`.
    const env = credential();
    const r = parse('search(@cap(assertpred("firstName")->obj("James")))');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [paths, captures] = patternPathsWithCaptures(r.value, env);
    expect(paths.length).toBe(1);
    expect(captures.has("cap")).toBe(true);
    expect(captures.get("cap")?.length).toBe(1);
  });

  it("real elision: redactedCredential matches `search(elided)` non-trivially", () => {
    // Mirrors the spirit of the redacted-credential tests in the
    // Rust suite — exercises the `elide_revealing_set` path and
    // checks that the resulting envelope has elided sub-elements
    // observable via `search(elided)`.
    const env = credential();
    const redacted = redactedCredential(env);
    const r = parse("search(elided)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const paths = patternPaths(r.value, redacted);
    expect(paths.length).toBeGreaterThan(0);
  });

  it("redactedCredential preserves the visible firstName assertion", () => {
    const env = credential();
    const redacted = redactedCredential(env);
    // `firstName` is in the revealed set, so the assertion stays
    // and `search(assertpred("firstName")->obj("James"))` should
    // still find one path.
    const r = parse('search(assertpred("firstName")->obj("James"))');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(patternPaths(r.value, redacted).length).toBe(1);
  });

  it("redactedCredential elides the photo assertion (non-revealed)", () => {
    const env = credential();
    const redacted = redactedCredential(env);
    // `photo` is NOT in the revealed set, so the assertion gets
    // elided. The bare-predicate search must miss it (contrast with
    // the unredacted credential, where it would match).
    const photoR = parse('search(assertpred("photo"))');
    expect(photoR.ok).toBe(true);
    if (!photoR.ok) return;
    expect(patternPaths(photoR.value, env).length).toBe(1);
    expect(patternPaths(photoR.value, redacted).length).toBe(0);
  });

  it("redactedCredential preserves the outer note assertion (in revealed set)", () => {
    // The outer `'note': "Signed by ..."` assertion is preserved in
    // the redacted form — it was added to `target` via the
    // `for assertion in env.assertions()` loop in
    // `redactedCredential`. The string-predicate search misses it
    // (the predicate is a known value, not a string), but
    // searching for the known-value-pred form via the pattern
    // language should land on it; here we just observe that the
    // redacted envelope still has 2 outer assertions.
    const env = credential();
    const redacted = redactedCredential(env);
    expect(env.assertions().length).toBe(2);
    expect(redacted.assertions().length).toBe(2);
  });

  it("`search(node({13}))` finds the inner node (13 assertions)", () => {
    const env = credential();
    const r = parse("search(node({13}))");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(patternPaths(r.value, env).length).toBe(1);
  });

  it("non-existent predicate matches nothing (sanity)", () => {
    const env = credential();
    const r = parse('search(assertpred("nonExistent"))');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(patternMatches(r.value, env)).toBe(false);
    expect(patternPaths(r.value, env).length).toBe(0);
  });
});
