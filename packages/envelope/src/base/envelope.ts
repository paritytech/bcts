/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

import { Digest, type DigestProvider } from "./digest";
import { Assertion } from "./assertion";
import { EnvelopeError } from "./error";
import type { EnvelopeEncodableValue } from "./envelope-encodable";
import { KnownValue } from "@bcts/known-values";
import type { Cbor, CborMap } from "@bcts/dcbor";
import {
  cbor,
  cborData,
  toTaggedValue,
  TAG_ENCODED_CBOR,
  MajorType,
  asByteString,
  asCborArray,
  asCborMap,
  asTaggedValue,
  tryExpectedTaggedValue,
} from "@bcts/dcbor";
import { ENVELOPE, LEAF, ENCRYPTED, COMPRESSED } from "@bcts/components";

// Type imports for extension method declarations
// These are imported as types only to avoid circular dependencies at runtime
import type { ObscureAction, ObscureType } from "./elide";
import type { Visitor } from "./walk";
import type {
  SymmetricKey,
  SealedMessage,
  Signer,
  Verifier,
  Signature,
  SignatureMetadata,
  SigningOptions,
} from "../extension";
import type { UR } from "@bcts/uniform-resources";
import type { TreeFormatOptions } from "../format/tree";
import type { EnvelopeFormatOpts } from "../format/notation";
import type { MermaidFormatOpts } from "../format/mermaid";
import type { FormatContext } from "../format/format-context";
import type {
  KeyDerivationMethod,
  Encrypter,
  Decrypter,
  Nonce,
  SSKRSpec,
  Salt,
} from "@bcts/components";
import type { RandomNumberGenerator } from "@bcts/rand";

/// Import tag values from the tags registry
/// These match the Rust reference implementation in bc-tags-rust
const TAG_ENVELOPE = ENVELOPE.value;
const TAG_LEAF = LEAF.value;
const TAG_ENCRYPTED = ENCRYPTED.value;
const TAG_COMPRESSED = COMPRESSED.value;

/// The core structural variants of a Gordian Envelope.
///
/// Each variant represents a different structural form that an
/// envelope can take, as defined in the Gordian Envelope IETF Internet Draft.
/// The different cases provide different capabilities and serve different
/// purposes in the envelope ecosystem.
///
/// The `EnvelopeCase` is the internal representation of an envelope's
/// structure. While each case has unique properties, they all maintain a digest
/// that ensures the integrity of the envelope.
///
/// It is advised to use the other Envelope APIs for most uses. Please see the
/// queries module for more information on how to interact with envelopes.
export type EnvelopeCase =
  | {
      type: "node";
      /// The subject of the node
      subject: Envelope;
      /// The assertions attached to the subject
      assertions: Envelope[];
      /// The digest of the node
      digest: Digest;
    }
  | {
      type: "leaf";
      /// The CBOR value contained in the leaf
      cbor: Cbor;
      /// The digest of the leaf
      digest: Digest;
    }
  | {
      type: "wrapped";
      /// The envelope being wrapped
      envelope: Envelope;
      /// The digest of the wrapped envelope
      digest: Digest;
    }
  | {
      type: "assertion";
      /// The assertion
      assertion: Assertion;
    }
  | {
      type: "elided";
      /// The digest of the elided content
      digest: Digest;
    }
  | {
      type: "knownValue";
      /// The known value instance
      value: KnownValue;
      /// The digest of the known value
      digest: Digest;
    }
  | {
      type: "encrypted";
      /// The encrypted message
      message: EncryptedMessage;
    }
  | {
      type: "compressed";
      /// The compressed data
      value: Compressed;
    };

// Import types from extension modules (will be available at runtime)
import { Compressed } from "../extension/compress";
import { EncryptedMessage } from "../extension/encrypt";

/// A flexible container for structured data with built-in integrity
/// verification.
///
/// Gordian Envelope is the primary data structure of this library. It provides a
/// way to encapsulate and organize data with cryptographic integrity, privacy
/// features, and selective disclosure capabilities.
///
/// Key characteristics of envelopes:
///
/// - **Immutability**: Envelopes are immutable. Operations that appear to
///   "modify" an envelope actually create a new envelope. This immutability is
///   fundamental to maintaining the integrity of the envelope's digest tree.
///
/// - **Efficient Cloning**: Envelopes use shallow copying for efficient O(1)
///   cloning. Since they're immutable, clones share the same underlying data.
///
/// - **Semantic Structure**: Envelopes can represent various semantic
///   relationships through subjects, predicates, and objects (similar to RDF
///   triples).
///
/// - **Digest Tree**: Each envelope maintains a Merkle-like digest tree that
///   ensures the integrity of its contents and enables verification of
///   individual parts.
///
/// - **Privacy Features**: Envelopes support selective disclosure through
///   elision, encryption, and compression of specific parts, while maintaining
///   the overall integrity of the structure.
///
/// - **Deterministic Representation**: Envelopes use deterministic CBOR
///   encoding to ensure consistent serialization across platforms.
///
/// The Gordian Envelope specification is defined in an IETF Internet Draft, and
/// this implementation closely follows that specification.
///
/// @example
/// ```typescript
/// // Create an envelope representing a person
/// const person = Envelope.new("person")
///     .addAssertion("name", "Alice")
///     .addAssertion("age", 30)
///     .addAssertion("email", "alice@example.com");
///
/// // Create a partially redacted version by eliding the email
/// const redacted = person.elideRemovingTarget(
///     person.assertionWithPredicate("email")
/// );
///
/// // The digest of both envelopes remains the same
/// assert(person.digest().equals(redacted.digest()));
/// ```
export class Envelope implements DigestProvider {
  private readonly _case: EnvelopeCase;

  /// Private constructor. Use static factory methods to create envelopes.
  ///
  /// @param envelopeCase - The envelope case variant
  private constructor(envelopeCase: EnvelopeCase) {
    this._case = envelopeCase;
  }

  /// Returns a reference to the underlying envelope case.
  ///
  /// The `EnvelopeCase` enum represents the specific structural variant of
  /// this envelope. This method provides access to that underlying
  /// variant for operations that need to differentiate between the
  /// different envelope types.
  ///
  /// @returns The `EnvelopeCase` that defines this envelope's structure.
  case(): EnvelopeCase {
    return this._case;
  }

  /// Creates an envelope with a subject, which can be any value that
  /// can be encoded as an envelope.
  ///
  /// @param subject - The subject value
  /// @returns A new envelope containing the subject
  ///
  /// @example
  /// ```typescript
  /// const envelope = Envelope.new("Hello, world!");
  /// const numberEnvelope = Envelope.new(42);
  /// const binaryEnvelope = Envelope.new(new Uint8Array([1, 2, 3]));
  /// ```
  static new(subject: EnvelopeEncodableValue): Envelope {
    // Convert the subject to an envelope
    if (subject instanceof Envelope) {
      return subject;
    }

    // Handle KnownValue specially to create knownValue envelopes
    if (subject instanceof KnownValue) {
      return Envelope.newWithKnownValue(subject);
    }

    // If the value implements `EnvelopeEncodable`, defer to its
    // `intoEnvelope()` so structured types (e.g. `ProvenanceMarkGenerator`,
    // `Permissions`) build the same envelope shape Rust produces via
    // its `EnvelopeEncodable` blanket impl. Tagged-CBOR primitives
    // (those whose `intoEnvelope` is just `Envelope::new(self.tagged_cbor())`)
    // still resolve to the same leaf — Rust collapses the two paths
    // identically. Skip this branch for `Uint8Array`, which is a
    // built-in encodable but should produce a byte-string leaf, not be
    // confused with a class that happens to have an `intoEnvelope`.
    if (
      typeof subject === "object" &&
      subject !== null &&
      !(subject instanceof Uint8Array) &&
      "intoEnvelope" in subject &&
      typeof (subject as { intoEnvelope?: unknown }).intoEnvelope === "function"
    ) {
      return subject.intoEnvelope();
    }

    // Handle primitives and create leaf envelopes
    return Envelope.newLeaf(subject);
  }

  /// Creates an envelope with a subject, or a `null` leaf envelope if
  /// the subject is **absent** (`undefined` *or* JS `null`).
  ///
  /// **TS↔Rust note**: Rust `Envelope::new_or_null` only takes
  /// `Option<impl EnvelopeEncodable>` — the no-subject branch fires only
  /// on `None`. JavaScript collapses "no value" into two distinct values
  /// (`undefined` and `null`); we treat both as "absent" because the
  /// most common JS usage pattern is `value ?? undefined`. If you need
  /// to construct a leaf envelope whose CBOR value is JS `null`
  /// (Rust's `CBOR::null()`), use {@link Envelope.null} directly:
  ///
  /// ```ts
  /// // Equivalent to Rust `Envelope::new(CBOR::null())`:
  /// const nullLeaf = Envelope.null();
  ///
  /// // `newOrNull(null)` returns the same null leaf.
  /// const same = Envelope.newOrNull(null);
  /// ```
  ///
  /// @param subject - The optional subject value (`undefined` *or* `null`
  ///   triggers the no-subject branch).
  /// @returns A new envelope or a null leaf envelope
  static newOrNull(subject: EnvelopeEncodableValue | undefined): Envelope {
    if (subject === undefined || subject === null) {
      return Envelope.null();
    }
    return Envelope.new(subject);
  }

  /// Creates an envelope with a subject, or `undefined` if the subject is
  /// **absent** (`undefined` *or* JS `null`).
  ///
  /// **TS↔Rust note**: Rust `Envelope::new_or_none` returns
  /// `Option<Envelope>` — the `None` branch fires only on `None`. We
  /// follow the same convention as {@link Envelope.newOrNull} and treat
  /// JS `null` and `undefined` interchangeably as the absent case.
  ///
  /// @param subject - The optional subject value (`undefined` *or* `null`
  ///   triggers the absent branch).
  /// @returns A new envelope or `undefined`
  static newOrNone(subject: EnvelopeEncodableValue | undefined): Envelope | undefined {
    if (subject === undefined || subject === null) {
      return undefined;
    }
    return Envelope.new(subject);
  }

  /// Creates an envelope from an EnvelopeCase.
  ///
  /// This is an internal method used by extensions to create envelopes
  /// from custom case types like compressed or encrypted.
  ///
  /// @param envelopeCase - The envelope case to wrap
  /// @returns A new envelope with the given case
  static fromCase(envelopeCase: EnvelopeCase): Envelope {
    return new Envelope(envelopeCase);
  }

  /// Creates an assertion envelope with a predicate and object.
  ///
  /// @param predicate - The predicate of the assertion
  /// @param object - The object of the assertion
  /// @returns A new assertion envelope
  ///
  /// @example
  /// ```typescript
  /// const assertion = Envelope.newAssertion("name", "Alice");
  /// ```
  static newAssertion(predicate: EnvelopeEncodableValue, object: EnvelopeEncodableValue): Envelope {
    const predicateEnv = predicate instanceof Envelope ? predicate : Envelope.new(predicate);
    const objectEnv = object instanceof Envelope ? object : Envelope.new(object);
    return Envelope.newWithAssertion(new Assertion(predicateEnv, objectEnv));
  }

  /// Creates a null envelope (containing CBOR null).
  ///
  /// @returns A null envelope
  static null(): Envelope {
    return Envelope.newLeaf(null);
  }

  //
  // Internal constructors
  //

  /// Creates an envelope with a subject and unchecked assertions.
  ///
  /// The assertions are sorted by digest and the envelope's digest is calculated.
  ///
  /// @param subject - The subject envelope
  /// @param uncheckedAssertions - The assertions to attach
  /// @returns A new node envelope
  static newWithUncheckedAssertions(subject: Envelope, uncheckedAssertions: Envelope[]): Envelope {
    if (uncheckedAssertions.length === 0) {
      throw new Error("Assertions array cannot be empty");
    }

    // Sort assertions by digest
    const sortedAssertions = [...uncheckedAssertions].sort((a, b) => {
      const aHex = a.digest().hex();
      const bHex = b.digest().hex();
      return aHex.localeCompare(bHex);
    });

    // Calculate digest from subject and all assertions
    const digests = [subject.digest(), ...sortedAssertions.map((a) => a.digest())];
    const digest = Digest.fromDigests(digests);

    return new Envelope({
      type: "node",
      subject,
      assertions: sortedAssertions,
      digest,
    });
  }

  /// Creates an envelope with a subject and validated assertions.
  ///
  /// All assertions must be assertion or obscured envelopes.
  ///
  /// @param subject - The subject envelope
  /// @param assertions - The assertions to attach
  /// @returns A new node envelope
  /// @throws {EnvelopeError} If any assertion is not valid
  static newWithAssertions(subject: Envelope, assertions: Envelope[]): Envelope {
    // Validate that all assertions are assertion or obscured envelopes
    for (const assertion of assertions) {
      if (!assertion.isSubjectAssertion() && !assertion.isSubjectObscured()) {
        throw EnvelopeError.invalidFormat();
      }
    }

    return Envelope.newWithUncheckedAssertions(subject, assertions);
  }

  /// Creates an envelope with an assertion as its subject.
  ///
  /// @param assertion - The assertion
  /// @returns A new assertion envelope
  static newWithAssertion(assertion: Assertion): Envelope {
    return new Envelope({
      type: "assertion",
      assertion,
    });
  }

  /// Creates an envelope with a known value.
  ///
  /// @param value - The known value (can be a KnownValue instance or a number/bigint)
  /// @returns A new known value envelope
  static newWithKnownValue(value: KnownValue | number | bigint): Envelope {
    const knownValue = value instanceof KnownValue ? value : new KnownValue(value);
    // Calculate digest from CBOR encoding of the known value
    const digest = Digest.fromImage(knownValue.toCborData());
    return new Envelope({
      type: "knownValue",
      value: knownValue,
      digest,
    });
  }

  /// Creates an envelope with encrypted content.
  ///
  /// Mirrors Rust `Envelope::new_with_encrypted`
  /// (`bc-envelope-rust/src/base/envelope.rs:317-324`), which returns
  /// `Err(Error::MissingDigest)` when the message has no AAD digest.
  ///
  /// @param encryptedMessage - The encrypted message
  /// @returns A new encrypted envelope
  /// @throws {EnvelopeError} If the encrypted message doesn't have a digest
  static newWithEncrypted(encryptedMessage: EncryptedMessage): Envelope {
    if (!encryptedMessage.hasDigest()) {
      throw EnvelopeError.missingDigest();
    }
    return new Envelope({
      type: "encrypted",
      message: encryptedMessage,
    });
  }

  /// Creates an envelope with compressed content.
  ///
  /// Mirrors Rust `Envelope::new_with_compressed`
  /// (`bc-envelope-rust/src/base/envelope.rs:326-332`), which returns
  /// `Err(Error::MissingDigest)` when the compressed value has no digest.
  ///
  /// @param compressed - The compressed data
  /// @returns A new compressed envelope
  /// @throws {EnvelopeError} If the compressed data doesn't have a digest
  static newWithCompressed(compressed: Compressed): Envelope {
    if (!compressed.hasDigest()) {
      throw EnvelopeError.missingDigest();
    }
    return new Envelope({
      type: "compressed",
      value: compressed,
    });
  }

  /// Creates an elided envelope containing only a digest.
  ///
  /// @param digest - The digest of the elided content
  /// @returns A new elided envelope
  static newElided(digest: Digest): Envelope {
    return new Envelope({
      type: "elided",
      digest,
    });
  }

  /// Creates a leaf envelope containing a CBOR value.
  ///
  /// @param value - The value to encode as CBOR
  /// @returns A new leaf envelope
  static newLeaf(value: unknown): Envelope {
    // Convert value to CBOR
    const cbor = Envelope.valueToCbor(value);

    // Calculate digest from CBOR bytes
    const cborBytes = Envelope.cborToBytes(cbor);
    const digest = Digest.fromImage(cborBytes);

    return new Envelope({
      type: "leaf",
      cbor,
      digest,
    });
  }

  /// Creates a wrapped envelope.
  ///
  /// @param envelope - The envelope to wrap
  /// @returns A new wrapped envelope
  static newWrapped(envelope: Envelope): Envelope {
    const digest = Digest.fromDigests([envelope.digest()]);
    return new Envelope({
      type: "wrapped",
      envelope,
      digest,
    });
  }

  /// Returns the digest of this envelope.
  ///
  /// Implementation of DigestProvider interface.
  ///
  /// @returns The envelope's digest
  digest(): Digest {
    const c = this._case;
    switch (c.type) {
      case "node":
      case "leaf":
      case "wrapped":
      case "elided":
      case "knownValue":
        return c.digest;
      case "assertion":
        return c.assertion.digest();
      case "encrypted": {
        // The AAD parses back to the plaintext envelope's digest
        // (`@bcts/components::EncryptedMessage::aadDigest()` returns
        // `null` if the AAD is absent or doesn't decode as a tagged
        // Digest — both are construction-time errors.).
        const digest = c.message.aadDigest();
        if (digest === null) {
          throw new Error("Encrypted envelope missing digest");
        }
        return digest;
      }
      case "compressed": {
        // Get digest from compressed value
        const digest = c.value.digestOpt();
        if (digest === undefined) {
          throw new Error("Compressed envelope missing digest");
        }
        return digest;
      }
    }
  }

  /// Returns the subject of this envelope.
  ///
  /// For different envelope cases:
  /// - Node: Returns the subject envelope
  /// - Other cases: Returns the envelope itself
  ///
  /// @returns The subject envelope
  subject(): Envelope {
    const c = this._case;
    switch (c.type) {
      case "node":
        return c.subject;
      case "leaf":
      case "wrapped":
      case "assertion":
      case "elided":
      case "knownValue":
      case "encrypted":
      case "compressed":
        return this;
    }
  }

  /// Checks if the envelope's subject is an assertion.
  ///
  /// @returns `true` if the subject is an assertion, `false` otherwise
  isSubjectAssertion(): boolean {
    if (this._case.type === "assertion") return true;
    if (this._case.type === "node") return this._case.subject.isSubjectAssertion();
    return false;
  }

  /// Checks if the envelope's subject is obscured (elided, encrypted, or compressed).
  ///
  /// @returns `true` if the subject is obscured, `false` otherwise
  isSubjectObscured(): boolean {
    const t = this._case.type;
    return t === "elided" || t === "encrypted" || t === "compressed";
  }

  //
  // CBOR conversion helpers
  //

  /// Converts a value to CBOR.
  ///
  /// @param value - The value to convert
  /// @returns A CBOR representation
  private static valueToCbor(value: unknown): Cbor {
    // Import cbor function at runtime to avoid circular dependencies

    return cbor(value as Parameters<typeof cbor>[0]);
  }

  /// Converts CBOR to bytes.
  ///
  /// @param cbor - The CBOR value
  /// @returns Byte representation
  private static cborToBytes(cbor: Cbor): Uint8Array {
    // Import cborData function at runtime to avoid circular dependencies

    return cborData(cbor);
  }

  /// Returns the untagged CBOR representation of this envelope.
  ///
  /// @returns The untagged CBOR
  untaggedCbor(): Cbor {
    const c = this._case;
    switch (c.type) {
      case "node": {
        // Array with subject followed by assertions
        const result = [c.subject.untaggedCbor()];
        for (const assertion of c.assertions) {
          result.push(assertion.untaggedCbor());
        }
        return Envelope.valueToCbor(result);
      }
      case "leaf":
        // Tagged with TAG_LEAF (204)
        return toTaggedValue(TAG_LEAF, c.cbor);
      case "wrapped":
        // Wrapped envelopes are tagged with TAG_ENVELOPE
        return c.envelope.taggedCbor();
      case "assertion":
        // Assertions convert to CBOR maps
        return c.assertion.toCbor();
      case "elided":
        // Elided is just the digest bytes
        return Envelope.valueToCbor(c.digest.data());
      case "knownValue":
        // Known values are encoded as untagged unsigned integers
        // This matches Rust: value.untagged_cbor()
        return c.value.untaggedCbor();
      case "encrypted": {
        // Encrypted envelopes serialize as the canonical
        // `@bcts/components::EncryptedMessage` tagged CBOR
        // (tag 40002, array `[ciphertext, nonce, auth, ?aadBytes]`).
        // The AAD bytes are the **CBOR-encoded tagged Digest** of the
        // plaintext, matching Rust
        // `bc-components/src/symmetric/symmetric_key.rs::encrypt_with_digest`.
        return c.message.taggedCbor();
      }
      case "compressed": {
        // Compressed envelopes serialize as the canonical
        // `@bcts/components::Compressed` tagged CBOR
        // (tag 40003, array `[checksum, decompressedSize, compressedData, ?digest]`).
        // Matches Rust `bc-components/src/compressed.rs::CBORTaggedEncodable`.
        return c.value.taggedCbor();
      }
    }
  }

  /// Returns the tagged CBOR representation of this envelope.
  ///
  /// All envelopes are tagged with TAG_ENVELOPE (200).
  ///
  /// @returns The tagged CBOR
  taggedCbor(): Cbor {
    return toTaggedValue(TAG_ENVELOPE, this.untaggedCbor());
  }

  /// Creates an envelope from untagged CBOR.
  ///
  /// @param cbor - The untagged CBOR value
  /// @returns A new envelope
  static fromUntaggedCbor(cbor: Cbor): Envelope {
    // Check if it's a tagged value
    const tagged = asTaggedValue(cbor);
    if (tagged !== undefined) {
      const [tag, item] = tagged;
      switch (tag.value) {
        case TAG_LEAF:
        case TAG_ENCODED_CBOR:
          // Leaf envelope
          return Envelope.newLeaf(item);
        case TAG_ENVELOPE: {
          // Wrapped envelope
          const envelope = Envelope.fromUntaggedCbor(item);
          return Envelope.newWrapped(envelope);
        }
        case TAG_COMPRESSED: {
          // Delegate to the canonical `@bcts/components::Compressed`
          // decoder (`[checksum, decompressedSize, compressedData,
          // ?digest]`). Matches Rust
          // `bc-components/src/compressed.rs::from_untagged_cbor`.
          const compressed = Compressed.fromTaggedCbor(cbor);
          return Envelope.newWithCompressed(compressed);
        }
        case TAG_ENCRYPTED: {
          // Delegate to the canonical `@bcts/components::EncryptedMessage`
          // decoder (`[ciphertext, nonce, auth, ?aadBytes]` with `aadBytes`
          // being the CBOR-encoded tagged Digest of the plaintext).
          // Matches Rust
          // `bc-components/src/symmetric/encrypted_message.rs::from_untagged_cbor`.
          const message = EncryptedMessage.fromTaggedCbor(cbor);
          return Envelope.newWithEncrypted(message);
        }
        default:
          throw EnvelopeError.cbor(`unknown envelope tag: ${tag.value}`);
      }
    }

    // Check if it's a byte string (elided)
    const bytes = asByteString(cbor);
    if (bytes !== undefined) {
      if (bytes.length !== 32) {
        throw EnvelopeError.cbor("elided digest must be 32 bytes");
      }
      return Envelope.newElided(Digest.fromData(bytes));
    }

    // Check if it's an array (node)
    const array = asCborArray(cbor);
    if (array !== undefined) {
      if (array.length < 2) {
        throw EnvelopeError.cbor("node must have at least two elements");
      }
      const subjectCbor = array.get(0);
      if (subjectCbor === undefined) {
        throw EnvelopeError.cbor("node subject is missing");
      }
      const subject = Envelope.fromUntaggedCbor(subjectCbor);
      const assertions: Envelope[] = [];
      for (let i = 1; i < array.length; i++) {
        const assertionCbor = array.get(i);
        if (assertionCbor === undefined) {
          throw EnvelopeError.cbor(`node assertion at index ${i} is missing`);
        }
        assertions.push(Envelope.fromUntaggedCbor(assertionCbor));
      }
      return Envelope.newWithAssertions(subject, assertions);
    }

    // Check if it's a map (assertion)
    const map = asCborMap(cbor);
    if (map !== undefined) {
      const assertion = Assertion.fromCborMap(map);
      return Envelope.newWithAssertion(assertion);
    }

    // Handle known values (unsigned integers)
    if (cbor.type === MajorType.Unsigned) {
      const knownValue = new KnownValue(cbor.value);
      return Envelope.newWithKnownValue(knownValue);
    }

    throw EnvelopeError.cbor("invalid envelope format");
  }

  /// Creates an envelope from tagged CBOR.
  ///
  /// @param cbor - The tagged CBOR value (should have TAG_ENVELOPE)
  /// @returns A new envelope
  static fromTaggedCbor(cbor: Cbor): Envelope {
    try {
      const untagged = tryExpectedTaggedValue(cbor, TAG_ENVELOPE);
      return Envelope.fromUntaggedCbor(untagged);
    } catch (error) {
      throw EnvelopeError.cbor(
        `expected TAG_ENVELOPE (${TAG_ENVELOPE})`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /// Adds an assertion to this envelope.
  ///
  /// @param predicate - The assertion predicate
  /// @param object - The assertion object
  /// @returns A new envelope with the assertion added
  ///
  /// @example
  /// ```typescript
  /// const person = Envelope.new("Alice")
  ///     .addAssertion("age", 30)
  ///     .addAssertion("city", "Boston");
  /// ```
  addAssertion(predicate: EnvelopeEncodableValue, object: EnvelopeEncodableValue): Envelope {
    const assertion = Envelope.newAssertion(predicate, object);
    return this.addAssertionEnvelope(assertion);
  }

  /// Adds an assertion envelope to this envelope.
  ///
  /// @param assertion - The assertion envelope
  /// @returns A new envelope with the assertion added
  addAssertionEnvelope(assertion: Envelope): Envelope {
    const c = this._case;

    // If this is already a node, add to existing assertions
    if (c.type === "node") {
      return Envelope.newWithAssertions(c.subject, [...c.assertions, assertion]);
    }

    // Otherwise, create a new node with this envelope as subject
    return Envelope.newWithAssertions(this, [assertion]);
  }

  /// Creates a string representation of this envelope.
  ///
  /// @returns A string representation
  toString(): string {
    return `Envelope(${this._case.type})`;
  }

  /// Creates a shallow copy of this envelope.
  ///
  /// Since envelopes are immutable, this returns the same instance.
  ///
  /// @returns This envelope
  clone(): Envelope {
    return this;
  }

  //
  // Format methods (implemented via prototype extension in format module)
  //

  /// Returns a tree-formatted string representation of the envelope.
  ///
  /// The tree format displays the hierarchical structure of the envelope,
  /// showing subjects, assertions, and their relationships.
  ///
  /// @param options - Optional formatting options
  /// @returns A tree-formatted string
  declare treeFormat: (options?: TreeFormatOptions) => string;

  /// Returns a short identifier for this envelope based on its digest.
  ///
  /// @param format - Format for the digest ('short', 'full', or 'ur')
  /// @returns A digest identifier string
  declare shortId: (format?: "short" | "full" | "ur") => string;

  /// Returns a summary string for this envelope.
  ///
  /// @param maxLength - Maximum length of the summary
  /// @returns A summary string
  declare summary: (maxLength?: number) => string;

  /// Returns an annotated hex representation of the envelope's CBOR encoding.
  ///
  /// Default is the rich, multi-line annotated dump (tag names + per-line
  /// notes), matching Rust `Envelope::hex` /
  /// `dcbor::HexFormatOpts { annotate: true }`. Pass `false` to
  /// {@link Envelope.hexOpt} for a plain, flat hex string.
  ///
  /// @returns A multi-line annotated hex string
  declare hex: () => string;

  /// Returns the CBOR-encoded bytes of the envelope.
  ///
  /// @returns The CBOR bytes
  declare cborBytes: () => Uint8Array;

  /// Returns a hex representation with explicit annotate flag and optional
  /// {@link FormatContext} for tag-name resolution.
  ///
  /// Mirrors Rust `Envelope::hex_opt(annotate, context)`.
  ///
  /// @param annotate - When true, produce the annotated multi-line dump;
  ///   when false, produce a plain hex string (no spaces, no labels).
  /// @param context - Optional format context for resolving tag names.
  ///   Defaults to the global format context.
  /// @returns A hex string in the requested format
  declare hexOpt: (annotate: boolean, context?: FormatContext) => string;

  /// Returns a CBOR diagnostic notation string for the envelope.
  ///
  /// Mirrors Rust `Envelope::diagnostic`, which delegates to
  /// `dcbor::diagnostic_opt` with annotation on. For tag-name resolution
  /// from a custom {@link FormatContext}, use
  /// {@link Envelope.diagnosticAnnotated}.
  ///
  /// @returns A diagnostic string
  declare diagnostic: () => string;

  /// Returns a CBOR diagnostic notation string with explicit tag annotation
  /// and an optional {@link FormatContext} for tag-name resolution.
  ///
  /// Mirrors Rust `Envelope::diagnostic_annotated`.
  ///
  /// @param context - Optional format context for resolving tag names.
  ///   Defaults to the global format context.
  /// @returns An annotated diagnostic string
  declare diagnosticAnnotated: (context?: FormatContext) => string;

  //
  // Extension methods (implemented via prototype extension in extension modules)
  // These declarations ensure TypeScript recognizes the methods when consuming the package
  //

  // From assertions.ts
  declare addAssertionEnvelopes: (assertions: Envelope[]) => Envelope;
  declare addOptionalAssertionEnvelope: (assertion: Envelope | undefined) => Envelope;
  declare addOptionalAssertion: (
    predicate: EnvelopeEncodableValue,
    object: EnvelopeEncodableValue | undefined,
  ) => Envelope;
  declare addNonemptyStringAssertion: (predicate: EnvelopeEncodableValue, str: string) => Envelope;
  declare addAssertions: (envelopes: Envelope[]) => Envelope;
  declare addAssertionIf: (
    condition: boolean,
    predicate: EnvelopeEncodableValue,
    object: EnvelopeEncodableValue,
  ) => Envelope;
  declare addAssertionEnvelopeIf: (condition: boolean, assertionEnvelope: Envelope) => Envelope;
  declare removeAssertion: (target: Envelope) => Envelope;
  declare replaceAssertion: (assertion: Envelope, newAssertion: Envelope) => Envelope;
  declare replaceSubject: (subject: Envelope) => Envelope;
  // From salt.ts - assertion methods with optional salting
  declare addAssertionSalted: (
    predicate: EnvelopeEncodableValue,
    object: EnvelopeEncodableValue,
    salted: boolean,
  ) => Envelope;
  declare addAssertionEnvelopeSalted: (assertionEnvelope: Envelope, salted: boolean) => Envelope;
  declare addOptionalAssertionEnvelopeSalted: (
    assertionEnvelope: Envelope | undefined,
    salted: boolean,
  ) => Envelope;

  // From elide.ts
  declare elide: () => Envelope;
  declare elideRemovingSetWithAction: (target: Set<Digest>, action: ObscureAction) => Envelope;
  declare elideRemovingSet: (target: Set<Digest>) => Envelope;
  declare elideRemovingArrayWithAction: (
    target: DigestProvider[],
    action: ObscureAction,
  ) => Envelope;
  declare elideRemovingArray: (target: DigestProvider[]) => Envelope;
  declare elideRemovingTargetWithAction: (
    target: DigestProvider,
    action: ObscureAction,
  ) => Envelope;
  declare elideRemovingTarget: (target: DigestProvider) => Envelope;
  declare elideRevealingSetWithAction: (target: Set<Digest>, action: ObscureAction) => Envelope;
  declare elideRevealingSet: (target: Set<Digest>) => Envelope;
  declare elideRevealingArrayWithAction: (
    target: DigestProvider[],
    action: ObscureAction,
  ) => Envelope;
  declare elideRevealingArray: (target: DigestProvider[]) => Envelope;
  declare elideRevealingTargetWithAction: (
    target: DigestProvider,
    action: ObscureAction,
  ) => Envelope;
  declare elideRevealingTarget: (target: DigestProvider) => Envelope;
  declare unelide: (envelope: Envelope) => Envelope;
  declare nodesMatching: (
    targetDigests: Set<Digest> | undefined,
    obscureTypes: ObscureType[],
  ) => Set<Digest>;
  declare walkUnelide: (envelopes: Envelope[]) => Envelope;
  declare walkReplace: (target: Set<Digest>, replacement: Envelope) => Envelope;
  declare walkDecrypt: (keys: SymmetricKey[]) => Envelope;
  declare walkDecompress: (targetDigests?: Set<Digest>) => Envelope;
  declare isEquivalentTo: (other: Envelope) => boolean;
  declare isIdenticalTo: (other: Envelope) => boolean;

  // From leaf.ts
  declare tryLeaf: () => Cbor;
  declare extractString: () => string;
  declare extractNumber: () => number;
  declare extractBoolean: () => boolean;
  declare extractBytes: () => Uint8Array;
  declare extractNull: () => null;

  // Generic typed extraction methods from envelope-decodable.ts
  declare extractSubject: <T>(decoder: (cbor: Cbor) => T) => T;
  declare tryObjectForPredicate: <T>(
    predicate: EnvelopeEncodableValue,
    decoder: (cbor: Cbor) => T,
  ) => T;
  declare tryOptionalObjectForPredicate: <T>(
    predicate: EnvelopeEncodableValue,
    decoder: (cbor: Cbor) => T,
  ) => T | undefined;
  declare extractObjectForPredicateWithDefault: <T>(
    predicate: EnvelopeEncodableValue,
    decoder: (cbor: Cbor) => T,
    defaultValue: T,
  ) => T;
  declare extractObjectsForPredicate: <T>(
    predicate: EnvelopeEncodableValue,
    decoder: (cbor: Cbor) => T,
  ) => T[];
  declare tryObjectsForPredicate: <T>(
    predicate: EnvelopeEncodableValue,
    decoder: (cbor: Cbor) => T,
  ) => T[];

  // From queries.ts
  declare isFalse: () => boolean;
  declare isTrue: () => boolean;
  declare isBool: () => boolean;
  declare isNumber: () => boolean;
  declare isSubjectNumber: () => boolean;
  declare isNaN: () => boolean;
  declare isSubjectNaN: () => boolean;
  declare isNull: () => boolean;
  declare tryByteString: () => Uint8Array;
  declare asByteString: () => Uint8Array | undefined;
  declare asArray: () => readonly Cbor[] | undefined;
  declare asMap: () => CborMap | undefined;
  declare asText: () => string | undefined;
  declare asLeaf: () => Cbor | undefined;
  declare asKnownValue: () => KnownValue | undefined;
  declare tryKnownValue: () => KnownValue;
  declare isKnownValue: () => boolean;
  declare isSubjectUnit: () => boolean;
  declare checkSubjectUnit: () => Envelope;
  declare hasAssertions: () => boolean;
  declare asAssertion: () => Envelope | undefined;
  declare tryAssertion: () => Envelope;
  declare asPredicate: () => Envelope | undefined;
  declare tryPredicate: () => Envelope;
  declare asObject: () => Envelope | undefined;
  declare tryObject: () => Envelope;
  declare isAssertion: () => boolean;
  declare isElided: () => boolean;
  declare isLeaf: () => boolean;
  declare isNode: () => boolean;
  declare isWrapped: () => boolean;
  declare isInternal: () => boolean;
  declare isObscured: () => boolean;
  declare assertions: () => Envelope[];
  declare assertionsWithPredicate: (predicate: EnvelopeEncodableValue) => Envelope[];
  declare assertionWithPredicate: (predicate: EnvelopeEncodableValue) => Envelope;
  declare optionalAssertionWithPredicate: (
    predicate: EnvelopeEncodableValue,
  ) => Envelope | undefined;
  declare objectForPredicate: (predicate: EnvelopeEncodableValue) => Envelope;
  declare optionalObjectForPredicate: (predicate: EnvelopeEncodableValue) => Envelope | undefined;
  declare objectsForPredicate: (predicate: EnvelopeEncodableValue) => Envelope[];
  declare elementsCount: () => number;
  declare isSubjectEncrypted: () => boolean;
  declare isSubjectCompressed: () => boolean;
  declare isSubjectElided: () => boolean;
  declare setPosition: (position: number) => Envelope;
  declare position: () => number;
  declare removePosition: () => Envelope;

  // From walk.ts
  declare walk: <State>(hideNodes: boolean, state: State, visit: Visitor<State>) => void;

  // Digest-related methods
  declare digests: (levelLimit: number) => Set<Digest>;
  declare shallowDigests: () => Set<Digest>;
  declare deepDigests: () => Set<Digest>;
  declare structuralDigest: () => Digest;

  // Alias methods for Rust API compatibility
  declare object: () => Envelope;
  declare predicate: () => Envelope;

  // Additional elision method
  declare elideSetWithAction: (target: Set<Digest>, action: ObscureAction) => Envelope;

  // From ur.ts - UR (Uniform Resource) support
  declare urString: () => string;
  declare ur: () => UR;
  declare taggedCborData: () => Uint8Array;
  declare static fromUrString: (urString: string) => Envelope;
  declare static fromURString: (urString: string) => Envelope;
  declare static fromUR: (ur: UR) => Envelope;

  // From wrap.ts
  declare wrap: () => Envelope;
  declare tryUnwrap: () => Envelope;
  declare unwrap: () => Envelope;

  // From attachment.ts
  declare addAttachment: (
    payload: EnvelopeEncodableValue,
    vendor: string,
    conformsTo?: string,
  ) => Envelope;
  declare attachmentPayload: () => Envelope;
  declare attachmentVendor: () => string;
  declare attachmentConformsTo: () => string | undefined;
  declare attachments: () => Envelope[];
  declare attachmentsWithVendorAndConformsTo: (vendor?: string, conformsTo?: string) => Envelope[];
  declare attachmentWithVendorAndConformsTo: (vendor?: string, conformsTo?: string) => Envelope;
  declare validateAttachment: () => void;

  // From edge.ts (BCR-2026-003)
  declare addEdgeEnvelope: (edge: Envelope) => Envelope;
  declare edges: () => Envelope[];
  declare validateEdge: () => void;
  declare edgeIsA: () => Envelope;
  declare edgeSource: () => Envelope;
  declare edgeTarget: () => Envelope;
  declare edgeSubject: () => Envelope;
  declare edgesMatching: (
    isA?: Envelope,
    source?: Envelope,
    target?: Envelope,
    subject?: Envelope,
  ) => Envelope[];

  // From compress.ts
  declare compress: () => Envelope;
  declare decompress: () => Envelope;
  declare compressSubject: () => Envelope;
  declare decompressSubject: () => Envelope;
  declare isCompressed: () => boolean;

  // From encrypt.ts
  declare encryptSubject: (key: SymmetricKey) => Envelope;
  declare decryptSubject: (key: SymmetricKey) => Envelope;
  declare encrypt: (key: SymmetricKey) => Envelope;
  declare decrypt: (key: SymmetricKey) => Envelope;
  declare isEncrypted: () => boolean;

  // From proof.ts
  declare proofContainsSet: (target: Set<Digest>) => Envelope | undefined;
  declare proofContainsTarget: (target: Envelope) => Envelope | undefined;
  declare confirmContainsSet: (target: Set<Digest>, proof: Envelope) => boolean;
  declare confirmContainsTarget: (target: Envelope, proof: Envelope) => boolean;

  // From recipient.ts - uses Encrypter/Decrypter interfaces for PQ support
  declare encryptSubjectToRecipient: (recipient: Encrypter) => Envelope;
  declare encryptSubjectToRecipients: (recipients: Encrypter[]) => Envelope;
  declare addRecipient: (
    recipient: Encrypter,
    contentKey: SymmetricKey,
    testNonce?: Nonce,
  ) => Envelope;
  declare decryptSubjectToRecipient: (recipient: Decrypter) => Envelope;
  declare decryptToRecipient: (recipient: Decrypter) => Envelope;
  declare encryptToRecipients: (recipients: Encrypter[]) => Envelope;
  declare recipients: () => SealedMessage[];

  // From seal.ts
  declare encryptToRecipient: (recipient: Encrypter) => Envelope;
  declare seal: (sender: Signer, recipient: Encrypter) => Envelope;
  declare sealOpt: (sender: Signer, recipient: Encrypter, options?: SigningOptions) => Envelope;
  declare unseal: (senderPublicKey: Verifier, recipient: Decrypter) => Envelope;

  // From salt.ts
  declare addSalt: () => Envelope;
  declare addSaltInstance: (salt: Salt) => Envelope;
  declare addSaltWithLength: (count: number) => Envelope;
  declare addSaltWithLen: (count: number) => Envelope;
  declare addSaltBytes: (saltBytes: Uint8Array) => Envelope;
  declare addSaltInRange: (min: number, max: number) => Envelope;
  // Test-determinism overloads matching Rust's `*_using` variants.
  declare addSaltUsing: (rng: RandomNumberGenerator) => Envelope;
  declare addSaltWithLenUsing: (count: number, rng: RandomNumberGenerator) => Envelope;
  declare addSaltInRangeUsing: (
    min: number,
    max: number,
    rng: RandomNumberGenerator,
  ) => Envelope;

  // From signature.ts — matches bc-envelope-rust/src/extension/signature/signature_impl.rs
  declare addSignature: (signer: Signer) => Envelope;
  declare addSignatureOpt: (
    signer: Signer,
    options?: SigningOptions,
    metadata?: SignatureMetadata,
  ) => Envelope;
  declare addSignatureWithMetadata: (signer: Signer, metadata?: SignatureMetadata) => Envelope;
  declare addSignatures: (signers: Signer[]) => Envelope;
  declare addSignaturesOpt: (
    signersWithOptions: {
      signer: Signer;
      options?: SigningOptions;
      metadata?: SignatureMetadata;
    }[],
  ) => Envelope;
  declare addSignaturesWithMetadata: (
    signersWithMetadata: { signer: Signer; metadata?: SignatureMetadata }[],
  ) => Envelope;
  declare makeSignedAssertion: (signature: Signature, note?: string) => Envelope;
  declare isVerifiedSignature: (signature: Signature, verifier: Verifier) => boolean;
  declare verifySignature: (signature: Signature, verifier: Verifier) => Envelope;
  declare hasSignatureFrom: (verifier: Verifier) => boolean;
  declare hasSignatureFromReturningMetadata: (verifier: Verifier) => Envelope | undefined;
  declare verifySignatureFrom: (verifier: Verifier) => Envelope;
  declare verifySignatureFromReturningMetadata: (verifier: Verifier) => Envelope;
  declare hasSignaturesFrom: (verifiers: Verifier[]) => boolean;
  declare hasSignaturesFromThreshold: (verifiers: Verifier[], threshold?: number) => boolean;
  declare verifySignaturesFrom: (verifiers: Verifier[]) => Envelope;
  declare verifySignaturesFromThreshold: (verifiers: Verifier[], threshold?: number) => Envelope;
  declare signatures: () => Envelope[];
  declare sign: (signer: Signer) => Envelope;
  declare signOpt: (signer: Signer, options?: SigningOptions) => Envelope;
  declare signWithMetadata: (signer: Signer, metadata?: SignatureMetadata) => Envelope;
  declare verify: (verifier: Verifier) => Envelope;
  declare verifyReturningMetadata: (verifier: Verifier) => {
    envelope: Envelope;
    metadata: Envelope;
  };

  // From types.ts
  declare addType: (object: EnvelopeEncodableValue) => Envelope;
  declare types: () => Envelope[];
  declare getType: () => Envelope;
  declare hasType: (t: EnvelopeEncodableValue) => boolean;
  declare checkType: (t: EnvelopeEncodableValue) => void;
  declare hasTypeValue: (t: KnownValue) => boolean;

  // Static methods from extensions
  declare static newAttachment: (
    payload: EnvelopeEncodableValue,
    vendor: string,
    conformsTo?: string,
  ) => Envelope;

  // Static methods from leaf.ts
  declare static unit: () => Envelope;

  // From format/notation.ts
  declare format: () => string;
  declare formatOpt: (opts: EnvelopeFormatOpts) => string;
  declare formatFlat: () => string;

  // From format/mermaid.ts
  declare mermaidFormat: () => string;
  declare mermaidFormatOpt: (opts: MermaidFormatOpts) => string;

  // From format/envelope-summary.ts
  declare summaryWithContext: (maxLength: number, context: FormatContext) => string;

  // From secret.ts
  declare lockSubject: (method: KeyDerivationMethod, secret: Uint8Array) => Envelope;
  declare unlockSubject: (secret: Uint8Array) => Envelope;
  declare isLockedWithPassword: () => boolean;
  declare isLockedWithSshAgent: () => boolean;
  declare addSecret: (
    method: KeyDerivationMethod,
    secret: Uint8Array,
    contentKey: SymmetricKey,
  ) => Envelope;
  declare lock: (method: KeyDerivationMethod, secret: Uint8Array) => Envelope;
  declare unlock: (secret: Uint8Array) => Envelope;

  // From extension/sskr.ts
  declare sskrSplit: (spec: SSKRSpec, contentKey: SymmetricKey) => Envelope[][];
  declare sskrSplitFlattened: (spec: SSKRSpec, contentKey: SymmetricKey) => Envelope[];
  declare sskrSplitUsing: (
    spec: SSKRSpec,
    contentKey: SymmetricKey,
    rng: RandomNumberGenerator,
  ) => Envelope[][];
  declare static sskrJoin: (envelopes: Envelope[]) => Envelope;

  // CBOR methods
  declare toCbor: () => unknown;
  declare expectLeaf: () => unknown;
  declare checkTypeValue: (t: KnownValue) => void;
}
