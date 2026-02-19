/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

import { Envelope } from "../base/envelope";
import { EnvelopeError } from "../base/error";
import { type Digest } from "../base/digest";
import * as pako from "pako";
import { cborData, decodeCbor } from "@bcts/dcbor";

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
  private readonly _compressedData: Uint8Array;
  private readonly _digest?: Digest;

  constructor(compressedData: Uint8Array, digest?: Digest) {
    this._compressedData = compressedData;
    if (digest !== undefined) {
      this._digest = digest;
    }
  }

  /// Creates a Compressed instance from decompressed data
  static fromDecompressedData(decompressedData: Uint8Array, digest?: Digest): Compressed {
    const compressed = pako.deflate(decompressedData);
    return new Compressed(compressed, digest);
  }

  /// Returns the compressed data
  compressedData(): Uint8Array {
    return this._compressedData;
  }

  /// Returns the optional digest
  digestOpt(): Digest | undefined {
    return this._digest;
  }

  /// Decompresses the data
  decompress(): Uint8Array {
    return pako.inflate(this._compressedData);
  }
}

/// Register compression extension methods on Envelope prototype
/// This function is exported and called during module initialization
/// to ensure Envelope is fully defined before attaching methods.
export function registerCompressExtension(): void {
  if (Envelope?.prototype === undefined) {
    return;
  }

  // Skip if already registered
  if (typeof Envelope.prototype.compress === "function") {
    return;
  }

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
}

// Registration is handled by the main index.ts to avoid circular dependency issues.
// The registerCompressExtension() function is called explicitly after all modules are loaded.
