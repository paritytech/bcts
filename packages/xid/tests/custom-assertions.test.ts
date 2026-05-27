/**
 * Custom (extension) assertion preservation tests
 * Ported from bc-xid-rust/tests/custom_assertions.rs
 *
 * Verifies that top-level assertions which are not recognized XID document
 * fields are preserved through parse → mutate → serialize round-trips, per
 * the 0.23.0 "Preserve XID document extension assertions" change.
 */

import { PrivateKeyBase } from "@bcts/components";
import { cbor } from "@bcts/dcbor";
import { ProvenanceMarkResolution } from "@bcts/provenance-mark";
import { makeFakeRandomNumberGenerator } from "@bcts/rand";
import {
  Key,
  XIDDocument,
  XIDGeneratorOptions,
  XIDPrivateKeyOptions,
} from "../src";

/**
 * Builds a XID document, serializes it, tacks on a custom top-level
 * assertion, then re-parses — yielding a document that carries the custom
 * assertion as a preserved extension assertion.
 *
 * Mirrors Rust `xid_document_with_custom_assertion()`.
 */
function xidDocumentWithCustomAssertion(): XIDDocument {
  const rng = makeFakeRandomNumberGenerator();
  const privateKeyBase = PrivateKeyBase.newUsing(rng);
  const xidDocument = XIDDocument.new(
    { type: "publicKeys", publicKeys: privateKeyBase.schnorrPublicKeys() },
    { type: "none" },
  );
  const envelope = xidDocument
    .toEnvelope(XIDPrivateKeyOptions.Omit, XIDGeneratorOptions.Omit, { type: "none" })
    .addAssertion("customField", "customValue");

  return XIDDocument.tryFromEnvelope(envelope);
}

describe("Custom assertion preservation", () => {
  it("xid_document_parses_and_preserves_custom_assertions", () => {
    const xidDocument = xidDocumentWithCustomAssertion();
    const envelope = xidDocument.toEnvelope(
      XIDPrivateKeyOptions.Omit,
      XIDGeneratorOptions.Omit,
      { type: "none" },
    );

    const expected = [
      "XID(71274df1) [",
      '    "customField": "customValue"',
      "    'key': PublicKeys(eb9b1cae, SigningPublicKey(71274df1, SchnorrPublicKey(9022010e)), EncapsulationPublicKey(b4f7059a, X25519PublicKey(b4f7059a))) [",
      "        'allow': 'All'",
      "    ]",
      "]",
    ].join("\n");

    expect(envelope.format()).toBe(expected);
  });

  it("xid_document_key_mutation_preserves_custom_assertions", () => {
    const xidDocument = xidDocumentWithCustomAssertion();

    const rng = makeFakeRandomNumberGenerator();
    // Advance the deterministic RNG past the inception-key derivation so the
    // second key differs (mirrors Rust's `let _inception_base = ...`).
    PrivateKeyBase.newUsing(rng);
    const secondBase = PrivateKeyBase.newUsing(rng);
    xidDocument.addKey(Key.newAllowAll(secondBase.schnorrPublicKeys()));

    const envelope = xidDocument.toEnvelope(
      XIDPrivateKeyOptions.Omit,
      XIDGeneratorOptions.Omit,
      { type: "none" },
    );

    expect(envelope.format()).toContain('"customField": "customValue"');
    expect(xidDocument.keys().length).toBe(2);
  });

  it("xid_document_provenance_mutation_preserves_custom_assertions", () => {
    const rng = makeFakeRandomNumberGenerator();
    const privateKeyBase = PrivateKeyBase.newUsing(rng);
    const xidDocument = XIDDocument.new(
      { type: "publicKeys", publicKeys: privateKeyBase.schnorrPublicKeys() },
      {
        type: "passphrase",
        passphrase: "test passphrase",
        resolution: ProvenanceMarkResolution.High,
        date: new Date(Date.UTC(2024, 0, 1)),
        info: cbor("Genesis"),
      },
    );
    const envelope = xidDocument
      .toEnvelope(XIDPrivateKeyOptions.Omit, XIDGeneratorOptions.Include, { type: "none" })
      .addAssertion("customField", "customValue");

    const parsedDocument = XIDDocument.tryFromEnvelope(envelope);
    parsedDocument.nextProvenanceMarkWithEmbeddedGenerator(
      undefined,
      new Date(Date.UTC(2024, 0, 2)),
      cbor("Next"),
    );

    const advancedEnvelope = parsedDocument.toEnvelope(
      XIDPrivateKeyOptions.Omit,
      XIDGeneratorOptions.Include,
      { type: "none" },
    );

    expect(advancedEnvelope.format()).toContain('"customField": "customValue"');
    expect(parsedDocument.provenance()?.seq()).toBe(1);
  });
});
