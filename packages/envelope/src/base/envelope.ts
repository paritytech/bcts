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
  PublicKeyBase,
  PrivateKeyBase,
  Signer,
  Verifier,
  SignatureMetadata,
} from "../extension";

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
  readonly #case: EnvelopeCase;

  /// Private constructor. Use static factory methods to create envelopes.
  ///
  /// @param envelopeCase - The envelope case variant
  private constructor(envelopeCase: EnvelopeCase) {
    this.#case = envelopeCase;
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
    return this.#case;
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

    // Handle primitives and create leaf envelopes
    return Envelope.newLeaf(subject);
  }

  /// Creates an envelope with a subject, or null if subject is undefined.
  ///
  /// @param subject - The optional subject value
  /// @returns A new envelope or null envelope
  static newOrNull(subject: EnvelopeEncodableValue | undefined): Envelope {
    if (subject === undefined || subject === null) {
      return Envelope.null();
    }
    return Envelope.new(subject);
  }

  /// Creates an envelope with a subject, or undefined if subject is undefined.
  ///
  /// @param subject - The optional subject value
  /// @returns A new envelope or undefined
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
  /// @param encryptedMessage - The encrypted message
  /// @returns A new encrypted envelope
  /// @throws {EnvelopeError} If the encrypted message doesn't have a digest
  static newWithEncrypted(encryptedMessage: EncryptedMessage): Envelope {
    // TODO: Validate that encrypted message has digest
    // if (!encryptedMessage.hasDigest()) {
    //   throw EnvelopeError.missingDigest();
    // }
    return new Envelope({
      type: "encrypted",
      message: encryptedMessage,
    });
  }

  /// Creates an envelope with compressed content.
  ///
  /// @param compressed - The compressed data
  /// @returns A new compressed envelope
  /// @throws {EnvelopeError} If the compressed data doesn't have a digest
  static newWithCompressed(compressed: Compressed): Envelope {
    // TODO: Validate that compressed has digest
    // if (!compressed.hasDigest()) {
    //   throw EnvelopeError.missingDigest();
    // }
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
    const c = this.#case;
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
        // Get digest from encrypted message (AAD)
        const digest = c.message.aadDigest();
        if (digest === undefined) {
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
    const c = this.#case;
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
    return this.#case.type === "assertion";
  }

  /// Checks if the envelope's subject is obscured (elided, encrypted, or compressed).
  ///
  /// @returns `true` if the subject is obscured, `false` otherwise
  isSubjectObscured(): boolean {
    const t = this.#case.type;
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
    const c = this.#case;
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
        // TODO: Implement known value encoding
        throw new Error("Known value encoding not yet implemented");
      case "encrypted": {
        // Encrypted is tagged with TAG_ENCRYPTED (40002)
        // Contains: [ciphertext, nonce, auth, optional_aad_digest]
        // Per BCR-2023-004 and BCR-2022-001
        const message = c.message;
        const digest = message.aadDigest();
        const arr =
          digest !== undefined
            ? [message.ciphertext(), message.nonce(), message.authTag(), digest.data()]
            : [message.ciphertext(), message.nonce(), message.authTag()];
        return toTaggedValue(TAG_ENCRYPTED, Envelope.valueToCbor(arr));
      }
      case "compressed": {
        // Compressed is tagged with TAG_COMPRESSED (40003)
        // and contains an array: [compressed_data, optional_digest]
        const digest = c.value.digestOpt();
        const data = c.value.compressedData();
        const arr = digest !== undefined ? [data, digest.data()] : [data];
        return toTaggedValue(TAG_COMPRESSED, Envelope.valueToCbor(arr));
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
          // Compressed envelope: array with [compressed_data, optional_digest]
          const arr = asCborArray(item);
          if (arr === undefined || arr.length < 1 || arr.length > 2) {
            throw EnvelopeError.cbor("compressed envelope must have 1 or 2 elements");
          }
          // We've already checked arr.length >= 1 above
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const compressedData = asByteString(arr.get(0)!);
          if (compressedData === undefined) {
            throw EnvelopeError.cbor("compressed data must be byte string");
          }
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const digestBytes = arr.length === 2 ? asByteString(arr.get(1)!) : undefined;
          if (arr.length === 2 && digestBytes === undefined) {
            throw EnvelopeError.cbor("digest must be byte string");
          }
          const digest = digestBytes !== undefined ? new Digest(digestBytes) : undefined;

          // Import Compressed class at runtime to avoid circular dependency

          const compressed = new Compressed(compressedData, digest);
          return Envelope.fromCase({ type: "compressed", value: compressed });
        }
        case TAG_ENCRYPTED: {
          // Encrypted envelope: array with [ciphertext, nonce, auth, optional_aad_digest]
          // Per BCR-2023-004 and BCR-2022-001
          const arr = asCborArray(item);
          if (arr === undefined || arr.length < 3 || arr.length > 4) {
            throw EnvelopeError.cbor("encrypted envelope must have 3 or 4 elements");
          }
          // We've already checked arr.length >= 3 above
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const ciphertext = asByteString(arr.get(0)!);
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const nonce = asByteString(arr.get(1)!);
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const authTag = asByteString(arr.get(2)!);
          if (ciphertext === undefined || nonce === undefined || authTag === undefined) {
            throw EnvelopeError.cbor("ciphertext, nonce, and auth must be byte strings");
          }
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const digestBytes = arr.length === 4 ? asByteString(arr.get(3)!) : undefined;
          if (arr.length === 4 && digestBytes === undefined) {
            throw EnvelopeError.cbor("aad digest must be byte string");
          }
          const digest = digestBytes !== undefined ? new Digest(digestBytes) : undefined;

          const message = new EncryptedMessage(ciphertext, nonce, authTag, digest);
          return Envelope.fromCase({ type: "encrypted", message });
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
      return Envelope.newElided(new Digest(bytes));
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
      const knownValue = new KnownValue(cbor.value as number | bigint);
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
    const c = this.#case;

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
    return `Envelope(${this.#case.type})`;
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
  declare treeFormat: (options?: {
    hideNodes?: boolean;
    highlightDigests?: Set<string>;
    digestDisplay?: "short" | "full";
  }) => string;

  /// Returns a short identifier for this envelope based on its digest.
  ///
  /// @param format - Format for the digest ('short' or 'full')
  /// @returns A digest identifier string
  declare shortId: (format?: "short" | "full") => string;

  /// Returns a summary string for this envelope.
  ///
  /// @param maxLength - Maximum length of the summary
  /// @returns A summary string
  declare summary: (maxLength?: number) => string;

  /// Returns a hex representation of the envelope's CBOR encoding.
  ///
  /// @returns A hex string
  declare hex: () => string;

  /// Returns the CBOR-encoded bytes of the envelope.
  ///
  /// @returns The CBOR bytes
  declare cborBytes: () => Uint8Array;

  /// Returns a CBOR diagnostic notation string for the envelope.
  ///
  /// @returns A diagnostic string
  declare diagnostic: () => string;

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
  declare isIdenticalTo: (other: Envelope) => boolean;

  // From leaf.ts
  declare tryLeaf: () => Cbor;
  declare extractString: () => string;
  declare extractNumber: () => number;
  declare extractBoolean: () => boolean;
  declare extractBytes: () => Uint8Array;
  declare extractNull: () => null;

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

  // From walk.ts
  declare walk: <State>(hideNodes: boolean, state: State, visit: Visitor<State>) => void;

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

  // From recipient.ts
  declare encryptSubjectToRecipient: (recipientPublicKey: PublicKeyBase) => Envelope;
  declare encryptSubjectToRecipients: (recipients: PublicKeyBase[]) => Envelope;
  declare addRecipient: (recipientPublicKey: PublicKeyBase, contentKey: SymmetricKey) => Envelope;
  declare decryptSubjectToRecipient: (recipientPrivateKey: PrivateKeyBase) => Envelope;
  declare decryptToRecipient: (recipientPrivateKey: PrivateKeyBase) => Envelope;
  declare encryptToRecipients: (recipients: PublicKeyBase[]) => Envelope;
  declare recipients: () => SealedMessage[];

  // From salt.ts
  declare addSalt: () => Envelope;
  declare addSaltWithLength: (count: number) => Envelope;
  declare addSaltBytes: (saltBytes: Uint8Array) => Envelope;
  declare addSaltInRange: (min: number, max: number) => Envelope;

  // From signature.ts
  declare addSignature: (signer: Signer) => Envelope;
  declare addSignatureWithMetadata: (signer: Signer, metadata?: SignatureMetadata) => Envelope;
  declare addSignatures: (signers: Signer[]) => Envelope;
  declare hasSignatureFrom: (verifier: Verifier) => boolean;
  declare verifySignatureFrom: (verifier: Verifier) => Envelope;
  declare signatures: () => Envelope[];

  // From types.ts
  declare addType: (object: EnvelopeEncodableValue) => Envelope;
  declare types: () => Envelope[];
  declare getType: () => Envelope;
  declare hasType: (t: EnvelopeEncodableValue) => boolean;
  declare checkType: (t: EnvelopeEncodableValue) => void;

  // Static methods from extensions
  declare static newAttachment: (
    payload: EnvelopeEncodableValue,
    vendor: string,
    conformsTo?: string,
  ) => Envelope;
}
