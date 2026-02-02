/// SSKR-based envelope splitting and joining.
///
/// This module provides functionality for splitting encrypted envelopes
/// using SSKR (Sharded Secret Key Reconstruction), which is an implementation
/// of Shamir's Secret Sharing. SSKR allows splitting a secret (the symmetric
/// encryption key) into multiple shares, with a threshold required for
/// reconstruction.
///
/// SSKR provides social recovery for encrypted envelopes by allowing the owner
/// to distribute shares to trusted individuals or storage locations, with a
/// specified threshold required to reconstruct the original envelope.

import {
  SSKRShareCbor,
  SSKRSecret,
  SSKRSpec,
  SSKRGroupSpec,
  sskrGenerateShares,
  sskrCombineShares,
  sskrGenerateUsing,
} from "@bcts/components";
import type { RandomNumberGenerator } from "@bcts/rand";
import { SSKR_SHARE } from "@bcts/known-values";
import { Envelope } from "../base/envelope";
import { EnvelopeError } from "../base/error";
import { SymmetricKey } from "./encrypt";

// Re-export useful types
export { SSKRSpec, SSKRGroupSpec, SSKRShareCbor, SSKRSecret };

// ============================================================================
// Envelope Prototype Extensions for SSKR
// ============================================================================

declare module "@bcts/envelope" {
  interface Envelope {
    /// Split this envelope into SSKR shares.
    ///
    /// This method splits the symmetric key used to encrypt the envelope into
    /// SSKR shares, and returns multiple copies of the original envelope,
    /// each with a different SSKR share added as an assertion. The envelope
    /// subject should already be encrypted with the provided `contentKey`.
    ///
    /// The returned structure is a nested array that preserves the group
    /// structure of the SSKR shares. Each outer array represents a group,
    /// and each inner array contains the shares for that group.
    ///
    /// @param spec - The SSKR specification that defines the group structure
    /// @param contentKey - The symmetric key used to encrypt the envelope
    /// @returns A nested array of envelopes organized by groups
    sskrSplit(spec: SSKRSpec, contentKey: SymmetricKey): Envelope[][];

    /// Split this envelope into a flattened set of SSKR shares.
    ///
    /// This method works like `sskrSplit()` but returns a flat array of all
    /// shares rather than preserving the group structure. This is convenient
    /// when the group structure is not needed for distribution.
    ///
    /// @param spec - The SSKR specification that defines the group structure
    /// @param contentKey - The symmetric key used to encrypt the envelope
    /// @returns A flat array of all envelopes containing SSKR shares
    sskrSplitFlattened(spec: SSKRSpec, contentKey: SymmetricKey): Envelope[];

    /// Split this envelope into SSKR shares using a custom random number generator.
    ///
    /// This method is like `sskrSplit()` but takes a custom RNG, which is useful
    /// for testing with deterministic randomness.
    ///
    /// @param spec - The SSKR specification that defines the group structure
    /// @param contentKey - The symmetric key used to encrypt the envelope
    /// @param rng - The random number generator to use
    /// @returns A nested array of envelopes organized by groups
    sskrSplitUsing(
      spec: SSKRSpec,
      contentKey: SymmetricKey,
      rng: RandomNumberGenerator,
    ): Envelope[][];
  }

  namespace Envelope {
    /// Reconstruct the original envelope from a set of SSKR shares.
    ///
    /// Given a set of envelopes with SSKR share assertions, this method
    /// attempts to combine the shares to reconstruct the original symmetric
    /// key. If successful, it uses the key to decrypt the envelope and
    /// return the original envelope subject.
    ///
    /// @param envelopes - An array of envelopes containing SSKR shares
    /// @returns The original envelope if reconstruction is successful
    /// @throws EnvelopeError if not enough valid shares are provided
    function sskrJoin(envelopes: Envelope[]): Envelope;
  }
}

/// Helper function to add an SSKR share assertion to the envelope
const addSskrShare = (envelope: Envelope, share: SSKRShareCbor): Envelope => {
  return envelope.addAssertion(SSKR_SHARE, share);
};

/// Implementation of sskrSplit
Envelope.prototype.sskrSplit = function (
  this: Envelope,
  spec: SSKRSpec,
  contentKey: SymmetricKey,
): Envelope[][] {
  // Convert symmetric key to SSKR secret
  const masterSecret = SSKRSecret.new(contentKey.data());

  // Generate SSKR shares with CBOR wrappers
  const shareGroups: SSKRShareCbor[][] = sskrGenerateShares(spec, masterSecret);

  // Create envelope copies with SSKR share assertions
  const result: Envelope[][] = [];
  for (const group of shareGroups) {
    const groupResult: Envelope[] = [];
    for (const share of group) {
      const shareEnvelope = addSskrShare(this, share);
      groupResult.push(shareEnvelope);
    }
    result.push(groupResult);
  }

  return result;
};

/// Implementation of sskrSplitFlattened
Envelope.prototype.sskrSplitFlattened = function (
  this: Envelope,
  spec: SSKRSpec,
  contentKey: SymmetricKey,
): Envelope[] {
  return this.sskrSplit(spec, contentKey).flat();
};

/// Implementation of sskrSplitUsing (with custom RNG)
Envelope.prototype.sskrSplitUsing = function (
  this: Envelope,
  spec: SSKRSpec,
  contentKey: SymmetricKey,
  rng: RandomNumberGenerator,
): Envelope[][] {
  // Convert symmetric key to SSKR secret
  const masterSecret = SSKRSecret.new(contentKey.data());

  // Generate SSKR shares using custom RNG
  const shareGroups = sskrGenerateUsing(spec, masterSecret, rng);

  // Convert raw bytes to SSKRShareCbor and create envelope copies
  const result: Envelope[][] = [];
  for (const group of shareGroups) {
    const groupResult: Envelope[] = [];
    for (const shareData of group) {
      const share = SSKRShareCbor.fromData(shareData);
      const shareEnvelope = addSskrShare(this, share);
      groupResult.push(shareEnvelope);
    }
    result.push(groupResult);
  }

  return result;
};

/// Helper function to extract SSKR shares from envelopes, grouped by identifier
const extractSskrSharesGrouped = (envelopes: Envelope[]): Map<number, SSKRShareCbor[]> => {
  const result = new Map<number, SSKRShareCbor[]>();

  for (const envelope of envelopes) {
    const assertions = envelope.assertionsWithPredicate(SSKR_SHARE);

    for (const assertion of assertions) {
      const obj = assertion.asObject();
      if (obj === undefined) continue;

      // Skip obscured (elided/encrypted/compressed) assertions
      if (obj.isObscured()) continue;

      try {
        // Try to extract the SSKRShareCbor
        const share = obj.extractSubject((cbor) => SSKRShareCbor.fromTaggedCbor(cbor));
        const identifier = share.identifier();

        const existing = result.get(identifier);
        if (existing !== undefined) {
          existing.push(share);
        } else {
          result.set(identifier, [share]);
        }
      } catch {
        // This assertion didn't contain a valid SSKR share, skip it
        continue;
      }
    }
  }

  return result;
};

/// Implementation of sskrJoin (static method)
(Envelope as unknown as { sskrJoin: (envelopes: Envelope[]) => Envelope }).sskrJoin = function (
  envelopes: Envelope[],
): Envelope {
  if (envelopes.length === 0) {
    throw EnvelopeError.invalidShares();
  }

  // Extract and group shares by identifier
  const groupedShares = extractSskrSharesGrouped(envelopes);

  // Try each group of shares (shares with same identifier)
  for (const shares of groupedShares.values()) {
    try {
      // Try to combine the shares
      const secret: SSKRSecret = sskrCombineShares(shares);

      // Convert secret back to symmetric key (local SymmetricKey uses `from`)
      const contentKey = SymmetricKey.from(secret.getData());

      // Try to decrypt the envelope subject
      const decrypted = envelopes[0].decryptSubject(contentKey);

      // Return the decrypted subject
      return decrypted.subject();
    } catch {
      // This group of shares didn't work, try the next one
      continue;
    }
  }

  // No valid combination found
  throw EnvelopeError.invalidShares();
};

// ============================================================================
// Module Registration
// ============================================================================

/// Register the SSKR extension
export const registerSskrExtension = (): void => {
  // Extension methods are already added to prototype above
};
