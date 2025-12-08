import { Envelope } from "../base/envelope";
import { EnvelopeError } from "../base/error";
import { type Digest } from "../base/digest";
import * as pako from "pako";
import { cborData, decodeCbor } from "@blockchain-commons/dcbor";

/// Extension for compressing and decompressing envelopes.
///
/// This module provides functionality for compressing envelopes to reduce their
/// size while maintaining their digests. Unlike elision, which removes content,
/// compression preserves all the information in the envelope but represents it
/// more efficiently.
///
/// Compression is implemented using the DEFLATE algorithm (via pako) and preserves
/// the envelope's digest, making it compatible with the envelope's hierarchical
/// digest tree structure.
///
/// @example
/// ```typescript
/// // Create an envelope with some larger, compressible content
/// const lorem = "Lorem ipsum dolor sit amet...".repeat(10);
/// const envelope = Envelope.new(lorem);
///
/// // Compress the envelope
/// const compressed = envelope.compress();
///
/// // The compressed envelope has the same digest as the original
/// console.log(envelope.digest().equals(compressed.digest())); // true
///
/// // But it takes up less space when serialized
/// console.log(compressed.cborBytes().length < envelope.cborBytes().length); // true
///
/// // The envelope can be decompressed to recover the original content
/// const decompressed = compressed.decompress();
/// console.log(decompressed.asText() === lorem); // true
/// ```

/// Represents compressed data with optional digest
export class Compressed {
  readonly #compressedData: Uint8Array;
  readonly #digest?: Digest;

  constructor(compressedData: Uint8Array, digest?: Digest) {
    this.#compressedData = compressedData;
    this.#digest = digest;
  }

  /// Creates a Compressed instance from decompressed data
  static fromDecompressedData(decompressedData: Uint8Array, digest?: Digest): Compressed {
    const compressed = pako.deflate(decompressedData);
    return new Compressed(compressed, digest);
  }

  /// Returns the compressed data
  compressedData(): Uint8Array {
    return this.#compressedData;
  }

  /// Returns the optional digest
  digestOpt(): Digest | undefined {
    return this.#digest;
  }

  /// Decompresses the data
  decompress(): Uint8Array {
    return pako.inflate(this.#compressedData);
  }
}

declare module "../base/envelope" {
  interface Envelope {
    /// Returns a compressed version of this envelope.
    ///
    /// This method compresses the envelope using the DEFLATE algorithm,
    /// creating a more space-efficient representation while preserving the
    /// envelope's digest and semantic content. The compressed envelope
    /// maintains the same digest as the original, ensuring compatibility
    /// with the envelope's digest tree structure.
    ///
    /// When an envelope is compressed, the entire envelope structure (including
    /// its subject and assertions) is compressed as a single unit. The
    /// compression preserves all the information but reduces the size of
    /// the serialized envelope.
    ///
    /// @returns The compressed envelope
    /// @throws {EnvelopeError} If the envelope is already encrypted or elided
    ///
    /// @example
    /// ```typescript
    /// // Create an envelope with some content
    /// const text = "This is a fairly long text that will benefit from compression.";
    /// const envelope = Envelope.new(text);
    ///
    /// // Compress the envelope
    /// const compressed = envelope.compress();
    ///
    /// // Check that the compressed version has the same digest
    /// console.log(envelope.digest().equals(compressed.digest())); // true
    ///
    /// // Verify that the compressed version takes less space
    /// console.log(compressed.cborBytes().length < envelope.cborBytes().length);
    /// ```
    compress(): Envelope;

    /// Returns the decompressed variant of this envelope.
    ///
    /// This method reverses the compression process, restoring the envelope to
    /// its original decompressed form. The decompressed envelope will have
    /// the same digest as the compressed version.
    ///
    /// @returns The decompressed envelope
    /// @throws {EnvelopeError} If the envelope is not compressed, missing digest, or has invalid digest
    ///
    /// @example
    /// ```typescript
    /// // Create and compress an envelope
    /// const original = Envelope.new("Hello, world!");
    /// const compressed = original.compress();
    ///
    /// // Decompress it
    /// const decompressed = compressed.decompress();
    ///
    /// // The decompressed envelope should match the original
    /// console.log(decompressed.asText() === "Hello, world!"); // true
    /// console.log(decompressed.digest().equals(original.digest())); // true
    /// ```
    decompress(): Envelope;

    /// Returns this envelope with its subject compressed.
    ///
    /// Unlike `compress()` which compresses the entire envelope, this method
    /// only compresses the subject of the envelope, leaving the assertions
    /// decompressed. This is useful when you want to compress a large
    /// subject while keeping the assertions readable and accessible.
    ///
    /// @returns A new envelope with a compressed subject
    ///
    /// @example
    /// ```typescript
    /// // Create an envelope with a large subject and some assertions
    /// const lorem = "Lorem ipsum dolor sit amet...";
    /// const envelope = Envelope.new(lorem)
    ///   .addAssertion("note", "This is a metadata note");
    ///
    /// // Compress just the subject
    /// const subjectCompressed = envelope.compressSubject();
    ///
    /// // The envelope's digest is preserved
    /// console.log(envelope.digest().equals(subjectCompressed.digest())); // true
    ///
    /// // The subject is now compressed
    /// console.log(subjectCompressed.subject().isCompressed()); // true
    /// ```
    compressSubject(): Envelope;

    /// Returns this envelope with its subject decompressed.
    ///
    /// This method reverses the effect of `compressSubject()`, decompressing
    /// the subject of the envelope while leaving the rest of the envelope
    /// unchanged.
    ///
    /// @returns A new envelope with a decompressed subject
    ///
    /// @example
    /// ```typescript
    /// // Create an envelope and compress its subject
    /// const original = Envelope.new("Hello, world!")
    ///   .addAssertion("note", "Test note");
    /// const compressed = original.compressSubject();
    ///
    /// // Verify the subject is compressed
    /// console.log(compressed.subject().isCompressed()); // true
    ///
    /// // Decompress the subject
    /// const decompressed = compressed.decompressSubject();
    ///
    /// // Verify the subject is now decompressed
    /// console.log(!decompressed.subject().isCompressed()); // true
    /// ```
    decompressSubject(): Envelope;

    /// Checks if this envelope is compressed
    isCompressed(): boolean;
  }
}

/// Implementation of compress()
Envelope.prototype.compress = function (this: Envelope): Envelope {
  const c = this.case();

  // If already compressed, return as-is
  if (c.type === "compressed") {
    return this;
  }

  // Can't compress encrypted or elided envelopes
  if (c.type === "encrypted") {
    throw EnvelopeError.general("Cannot compress encrypted envelope");
  }
  if (c.type === "elided") {
    throw EnvelopeError.general("Cannot compress elided envelope");
  }

  // Compress the entire envelope
  const cbor = this.taggedCbor();

  const decompressedData = cborData(cbor);

  const compressed = Compressed.fromDecompressedData(decompressedData, this.digest());

  // Create a compressed envelope case
  return Envelope.fromCase({ type: "compressed", value: compressed });
};

/// Implementation of decompress()
Envelope.prototype.decompress = function (this: Envelope): Envelope {
  const c = this.case();

  if (c.type !== "compressed") {
    throw EnvelopeError.general("Envelope is not compressed");
  }

  const compressed = c.value;
  const digest = compressed.digestOpt();

  if (digest === undefined) {
    throw EnvelopeError.general("Missing digest in compressed envelope");
  }

  // Verify the digest matches
  if (!digest.equals(this.digest())) {
    throw EnvelopeError.general("Invalid digest in compressed envelope");
  }

  // Decompress the data
  const decompressedData = compressed.decompress();

  // Parse back to envelope

  const cbor = decodeCbor(decompressedData);
  const envelope = Envelope.fromTaggedCbor(cbor);

  // Verify the decompressed envelope has the correct digest
  if (!envelope.digest().equals(digest)) {
    throw EnvelopeError.general("Invalid digest after decompression");
  }

  return envelope;
};

/// Implementation of compressSubject()
Envelope.prototype.compressSubject = function (this: Envelope): Envelope {
  if (this.subject().isCompressed()) {
    return this;
  }

  const subject = this.subject().compress();
  return this.replaceSubject(subject);
};

/// Implementation of decompressSubject()
Envelope.prototype.decompressSubject = function (this: Envelope): Envelope {
  if (this.subject().isCompressed()) {
    const subject = this.subject().decompress();
    return this.replaceSubject(subject);
  }

  return this;
};

/// Implementation of isCompressed()
Envelope.prototype.isCompressed = function (this: Envelope): boolean {
  return this.case().type === "compressed";
};
