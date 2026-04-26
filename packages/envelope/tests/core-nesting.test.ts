import { describe, it, expect } from "vitest";
import { Envelope } from "../src";

describe("Core Nesting Tests", () => {
  describe("Predicate Enclosures", () => {
    it("should handle various predicate and object enclosures", () => {
      const alice = Envelope.new("Alice");
      const knows = Envelope.new("knows");
      const bob = Envelope.new("Bob");

      const a = Envelope.new("A");
      const b = Envelope.new("B");

      // Simple assertion: "knows": "Bob"
      const knowsBob = Envelope.newAssertion(knows, bob);
      expect(knowsBob.format()).toBe('"knows": "Bob"');

      // Simple assertion: "A": "B"
      const ab = Envelope.newAssertion(a, b);
      expect(ab.format()).toBe('"A": "B"');

      // Assertion with predicate having assertion: "knows" ["A": "B"] : "Bob"
      const knowsAbBob = Envelope.newAssertion(knows.addAssertionEnvelope(ab), bob);
      const expectedKnowsAbBob = `"knows" [
    "A": "B"
]
: "Bob"`;
      expect(knowsAbBob.format()).toBe(expectedKnowsAbBob);

      // Assertion with object having assertion: "knows": "Bob" ["A": "B"]
      const knowsBobAb = Envelope.newAssertion(knows, bob.addAssertionEnvelope(ab));
      const expectedKnowsBobAb = `"knows": "Bob" [
    "A": "B"
]`;
      expect(knowsBobAb.format()).toBe(expectedKnowsBobAb);

      // Assertion envelope with assertion on the assertion itself
      const knowsBobEncloseAb = knowsBob.addAssertionEnvelope(ab);
      const expectedKnowsBobEncloseAb = `{
    "knows": "Bob"
} [
    "A": "B"
]`;
      expect(knowsBobEncloseAb.format()).toBe(expectedKnowsBobEncloseAb);

      // Alice with "knows": "Bob" assertion
      const aliceKnowsBob = alice.addAssertionEnvelope(knowsBob);
      const expectedAliceKnowsBob = `"Alice" [
    "knows": "Bob"
]`;
      expect(aliceKnowsBob.format()).toBe(expectedAliceKnowsBob);

      // Alice with both assertions.
      //
      // Format-output sort key: full lexicographic comparison over the
      // assertion's `EnvelopeFormatItem[]` (Rust `Vec<EnvelopeFormatItem>`
      // `Ord` impl). Both assertions start with a list item; the first
      // string in each list is the predicate's CBOR-summary form
      // (`"\"A\""` vs `"\"knows\""`). Both start with `"`, then `A` (0x41)
      // < `k` (0x6B), so `"A": "B"` sorts before `"knows": "Bob"` —
      // matching Rust's expected output in
      // `bc-envelope-rust/tests/core_nesting_tests.rs:94-99`.
      const aliceAbKnowsBob = aliceKnowsBob.addAssertionEnvelope(ab);
      const expectedAliceAbKnowsBob = `"Alice" [
    "A": "B"
    "knows": "Bob"
]`;
      expect(aliceAbKnowsBob.format()).toBe(expectedAliceAbKnowsBob);

      // Alice with assertion where predicate has assertions
      const aliceKnowsAbBob = alice.addAssertionEnvelope(
        Envelope.newAssertion(knows.addAssertionEnvelope(ab), bob),
      );
      const expectedAliceKnowsAbBob = `"Alice" [
    "knows" [
        "A": "B"
    ]
    : "Bob"
]`;
      expect(aliceKnowsAbBob.format()).toBe(expectedAliceKnowsAbBob);

      // Alice with assertion where object has assertions
      const aliceKnowsBobAb = alice.addAssertionEnvelope(
        Envelope.newAssertion(knows, bob.addAssertionEnvelope(ab)),
      );
      const expectedAliceKnowsBobAb = `"Alice" [
    "knows": "Bob" [
        "A": "B"
    ]
]`;
      expect(aliceKnowsBobAb.format()).toBe(expectedAliceKnowsBobAb);

      // Alice with assertion where both predicate and object have assertions
      const aliceKnowsAbBobAb = alice.addAssertionEnvelope(
        Envelope.newAssertion(knows.addAssertionEnvelope(ab), bob.addAssertionEnvelope(ab)),
      );
      const expectedAliceKnowsAbBobAb = `"Alice" [
    "knows" [
        "A": "B"
    ]
    : "Bob" [
        "A": "B"
    ]
]`;
      expect(aliceKnowsAbBobAb.format()).toBe(expectedAliceKnowsAbBobAb);

      // Alice with "A":"B" assertion and assertion where both predicate and object have assertions.
      //
      // Order matches Rust `bc-envelope-rust/tests/core_nesting_tests.rs:171-181`:
      // the `"A": "B"` line sorts first because the lexicographic
      // comparison over the assertion's `EnvelopeFormatItem[]` finds the
      // `"A"` < `"knows"` difference at the first item.
      const aliceAbKnowsAbBobAb = alice
        .addAssertionEnvelope(ab)
        .addAssertionEnvelope(
          Envelope.newAssertion(knows.addAssertionEnvelope(ab), bob.addAssertionEnvelope(ab)),
        );
      const expectedAliceAbKnowsAbBobAb = `"Alice" [
    "A": "B"
    "knows" [
        "A": "B"
    ]
    : "Bob" [
        "A": "B"
    ]
]`;
      expect(aliceAbKnowsAbBobAb.format()).toBe(expectedAliceAbKnowsAbBobAb);

      // Note: The most complex Rust test case that adds assertions to assertions
      // then uses the result as an assertion is not currently supported by the
      // TypeScript implementation's validation, which only accepts assertion or
      // obscured envelopes as assertions.
    });
  });

  describe("Nesting Plaintext", () => {
    it("should format plaintext envelope", () => {
      const envelope = Envelope.new("Hello.");

      const expectedFormat = '"Hello."';
      expect(envelope.format()).toBe(expectedFormat);
    });

    it("should elide plaintext envelope and preserve equivalence", () => {
      const envelope = Envelope.new("Hello.");
      const elidedEnvelope = envelope.elide();

      // Elided envelope should have same digest (equivalent)
      expect(elidedEnvelope.digest().equals(envelope.digest())).toBe(true);

      const expectedElidedFormat = "ELIDED";
      expect(elidedEnvelope.format()).toBe(expectedElidedFormat);
    });
  });

  describe("Nesting Once", () => {
    it("should format wrapped envelope", () => {
      const envelope = Envelope.new("Hello.").wrap();

      const expectedFormat = `{
    "Hello."
}`;
      expect(envelope.format()).toBe(expectedFormat);
    });

    it("should elide inner envelope and preserve equivalence", () => {
      const envelope = Envelope.new("Hello.").wrap();
      const elidedEnvelope = Envelope.new("Hello.").elide().wrap();

      // Should be equivalent (same digest)
      expect(elidedEnvelope.digest().equals(envelope.digest())).toBe(true);

      const expectedElidedFormat = `{
    ELIDED
}`;
      expect(elidedEnvelope.format()).toBe(expectedElidedFormat);
    });
  });

  describe("Nesting Twice", () => {
    it("should format double-wrapped envelope", () => {
      const envelope = Envelope.new("Hello.").wrap().wrap();

      const expectedFormat = `{
    {
        "Hello."
    }
}`;
      expect(envelope.format()).toBe(expectedFormat);
    });

    it("should elide innermost envelope and preserve equivalence", () => {
      const envelope = Envelope.new("Hello.").wrap().wrap();

      // Get the innermost envelope to elide
      const target = envelope.tryUnwrap().tryUnwrap();
      const elidedEnvelope = envelope.elideRemovingTarget(target);

      const expectedElidedFormat = `{
    {
        ELIDED
    }
}`;
      expect(elidedEnvelope.format()).toBe(expectedElidedFormat);

      // Should be equivalent (same digest)
      expect(envelope.digest().equals(elidedEnvelope.digest())).toBe(true);
    });
  });

  describe("Assertions on All Parts of Envelope", () => {
    it("should support assertions on predicate and object", () => {
      const predicate = Envelope.new("predicate").addAssertion(
        "predicate-predicate",
        "predicate-object",
      );
      const object = Envelope.new("object").addAssertion("object-predicate", "object-object");
      const envelope = Envelope.new("subject").addAssertion(predicate, object);

      const expectedFormat = `"subject" [
    "predicate" [
        "predicate-predicate": "predicate-object"
    ]
    : "object" [
        "object-predicate": "object-object"
    ]
]`;
      expect(envelope.format()).toBe(expectedFormat);
    });
  });

  describe("Assertion on Bare Assertion", () => {
    it("should wrap bare assertion when adding assertion to it", () => {
      const envelope = Envelope.newAssertion("predicate", "object").addAssertion(
        "assertion-predicate",
        "assertion-object",
      );

      const expectedFormat = `{
    "predicate": "object"
} [
    "assertion-predicate": "assertion-object"
]`;
      expect(envelope.format()).toBe(expectedFormat);
    });
  });
});
