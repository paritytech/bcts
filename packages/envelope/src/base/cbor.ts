import type { Cbor } from "@blockchain-commons/dcbor";
import {
  type CborTagged,
  type CborTaggedEncodable,
  type CborTaggedDecodable,
  tagsForValues,
  cborData,
  decodeCbor,
} from "@blockchain-commons/dcbor";
import { ENVELOPE } from "@blockchain-commons/tags";
import { Envelope } from "./envelope";

const TAG_ENVELOPE = ENVELOPE.value;

/// Support for CBOR encoding and decoding of `Envelope`.
///
/// All envelopes are tagged with the `envelope` tag (200). Within that tag,
/// each of the envelope cases has a unique CBOR signature:
///
/// * `.node` contains a CBOR array, the first element of which is the subject,
///   followed by one or more assertions.
/// * `.leaf` is tagged #6.24 (TAG_ENCODED_CBOR) or #6.204 (TAG_LEAF), which
///   are the IANA tag for embedded CBOR.
/// * `.wrapped` is tagged with the `envelope` tag.
/// * `.assertion` is a single-element map `{predicate: object}`.
/// * `.knownValue` is an unsigned 64-bit integer.
/// * `.encrypted` is tagged with the `crypto-msg` tag.
/// * `.elided` is a byte string of length 32 (the digest).
/// * `.compressed` is tagged with the `compressed` tag.
///
/// This module provides implementations of the CBOR encoding/decoding traits
/// for the Envelope type, matching the Rust bc-envelope implementation.

/// Implements CborTagged interface for Envelope.
///
/// Returns the tags that should be used for CBOR encoding.
export class EnvelopeCBORTagged implements CborTagged {
  static cborTags(): number[] {
    return tagsForValues([TAG_ENVELOPE]).map((tag) => tag.value);
  }
}

/// Implements CborTaggedEncodable for Envelope.
///
/// Provides the untagged CBOR representation of an envelope.
export class EnvelopeCBORTaggedEncodable implements CborTaggedEncodable {
  constructor(private readonly envelope: Envelope) {}

  untaggedCbor(): Cbor {
    return this.envelope.untaggedCbor();
  }

  taggedCbor(): Cbor {
    return this.envelope.taggedCbor();
  }
}

/// Implements CborTaggedDecodable for Envelope.
///
/// Provides the ability to decode an envelope from untagged CBOR.
export class EnvelopeCBORTaggedDecodable implements CborTaggedDecodable {
  static fromUntaggedCbor(cbor: Cbor): Envelope {
    return Envelope.fromUntaggedCbor(cbor);
  }

  static fromTaggedCbor(cbor: Cbor): Envelope {
    return Envelope.fromTaggedCbor(cbor);
  }
}

/// Convenience function to convert an Envelope to CBOR.
///
/// @param envelope - The envelope to convert
/// @returns The CBOR representation (tagged)
export function envelopeToCbor(envelope: Envelope): Cbor {
  return envelope.taggedCbor();
}

/// Convenience function to create an Envelope from CBOR.
///
/// @param cbor - The CBOR value (expected to be tagged with TAG_ENVELOPE)
/// @returns A new Envelope
export function envelopeFromCbor(cbor: Cbor): Envelope {
  return Envelope.fromTaggedCbor(cbor);
}

/// Convenience function to encode an Envelope to CBOR bytes.
///
/// @param envelope - The envelope to encode
/// @returns The CBOR bytes
export function envelopeToBytes(envelope: Envelope): Uint8Array {
  return cborData(envelope.taggedCbor());
}

/// Convenience function to decode an Envelope from CBOR bytes.
///
/// @param bytes - The CBOR bytes
/// @returns A new Envelope
export function envelopeFromBytes(bytes: Uint8Array): Envelope {
  const cbor = decodeCbor(bytes);
  return Envelope.fromTaggedCbor(cbor);
}
