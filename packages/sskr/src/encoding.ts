// Ported from bc-sskr-rust/src/encoding.rs

import type { RandomNumberGenerator } from "@blockchain-commons/rand";
import { SecureRandomNumberGenerator } from "@blockchain-commons/rand";
import { splitSecret, recoverSecret, ShamirError } from "@blockchain-commons/shamir";

import { SSKRError, SSKRErrorType } from "./error.js";
import { Secret } from "./secret.js";
import { Spec } from "./spec.js";
import { SSKRShare } from "./share.js";
import { METADATA_SIZE_BYTES } from "./index.js";

/**
 * Generates SSKR shares for the given Spec and Secret.
 *
 * @param spec - The Spec instance that defines the group and member thresholds.
 * @param masterSecret - The Secret instance to be split into shares.
 * @returns A vector of groups, each containing a vector of shares,
 *   each of which is a Uint8Array.
 */
export function sskrGenerate(
  spec: Spec,
  masterSecret: Secret,
): Uint8Array[][] {
  const rng = new SecureRandomNumberGenerator();
  return sskrGenerateUsing(spec, masterSecret, rng);
}

/**
 * Generates SSKR shares for the given Spec and Secret using the provided
 * random number generator.
 *
 * @param spec - The Spec instance that defines the group and member thresholds.
 * @param masterSecret - The Secret instance to be split into shares.
 * @param randomGenerator - The random number generator to use for generating
 *   shares.
 * @returns A vector of groups, each containing a vector of shares,
 *   each of which is a Uint8Array.
 */
export function sskrGenerateUsing(
  spec: Spec,
  masterSecret: Secret,
  randomGenerator: RandomNumberGenerator,
): Uint8Array[][] {
  const groupsShares = generateShares(spec, masterSecret, randomGenerator);

  const result: Uint8Array[][] = groupsShares.map((group) =>
    group.map(serializeShare)
  );

  return result;
}

/**
 * Combines the given SSKR shares into a Secret.
 *
 * @param shares - A array of SSKR shares to be combined.
 * @returns The reconstructed Secret.
 * @throws SSKRError if the shares do not meet the necessary quorum of groups
 *   and member shares within each group.
 */
export function sskrCombine(shares: Uint8Array[]): Secret {
  const sskrShares: SSKRShare[] = [];

  for (const share of shares) {
    const sskrShare = deserializeShare(share);
    sskrShares.push(sskrShare);
  }

  return combineShares(sskrShares);
}

function serializeShare(share: SSKRShare): Uint8Array {
  // pack the id, group and member data into 5 bytes:
  // 76543210        76543210        76543210
  //         76543210        76543210
  // ----------------====----====----====----
  // identifier: 16
  //                 group-threshold: 4
  //                     group-count: 4
  //                         group-index: 4
  //                             member-threshold: 4
  //                                 reserved (MUST be zero): 4
  //                                     member-index: 4

  const valueData = share.value().getData();
  const result = new Uint8Array(valueData.length + METADATA_SIZE_BYTES);

  const id = share.identifier();
  const gt = (share.groupThreshold() - 1) & 0xf;
  const gc = (share.groupCount() - 1) & 0xf;
  const gi = share.groupIndex() & 0xf;
  const mt = (share.memberThreshold() - 1) & 0xf;
  const mi = share.memberIndex() & 0xf;

  const id1 = id >> 8;
  const id2 = id & 0xff;

  result[0] = id1;
  result[1] = id2;
  result[2] = (gt << 4) | gc;
  result[3] = (gi << 4) | mt;
  result[4] = mi;
  result.set(valueData, METADATA_SIZE_BYTES);

  return result;
}

function deserializeShare(source: Uint8Array): SSKRShare {
  if (source.length < METADATA_SIZE_BYTES) {
    throw new SSKRError(SSKRErrorType.ShareLengthInvalid);
  }

  const groupThreshold = ((source[2] >> 4) + 1);
  const groupCount = ((source[2] & 0xf) + 1);

  if (groupThreshold > groupCount) {
    throw new SSKRError(SSKRErrorType.GroupThresholdInvalid);
  }

  const identifier = (source[0] << 8) | source[1];
  const groupIndex = source[3] >> 4;
  const memberThreshold = ((source[3] & 0xf) + 1);
  const reserved = source[4] >> 4;
  if (reserved !== 0) {
    throw new SSKRError(SSKRErrorType.ShareReservedBitsInvalid);
  }
  const memberIndex = source[4] & 0xf;
  const value = Secret.new(source.subarray(METADATA_SIZE_BYTES));

  return new SSKRShare(
    identifier,
    groupIndex,
    groupThreshold,
    groupCount,
    memberIndex,
    memberThreshold,
    value,
  );
}

function generateShares(
  spec: Spec,
  masterSecret: Secret,
  randomGenerator: RandomNumberGenerator,
): SSKRShare[][] {
  // assign a random identifier
  const identifierBytes = new Uint8Array(2);
  randomGenerator.fillRandomData(identifierBytes);
  const identifier = (identifierBytes[0] << 8) | identifierBytes[1];

  const groupsShares: SSKRShare[][] = [];

  let groupSecrets: Uint8Array[];
  try {
    groupSecrets = splitSecret(
      spec.groupThreshold(),
      spec.groupCount(),
      masterSecret.getData(),
      randomGenerator,
    );
  } catch (e) {
    if (e instanceof ShamirError) {
      throw SSKRError.fromShamirError(e);
    }
    throw e;
  }

  for (let groupIndex = 0; groupIndex < spec.groups().length; groupIndex++) {
    const group = spec.groups()[groupIndex];
    const groupSecret = groupSecrets[groupIndex];

    let memberSecrets: Uint8Array[];
    try {
      memberSecrets = splitSecret(
        group.memberThreshold(),
        group.memberCount(),
        groupSecret,
        randomGenerator,
      );
    } catch (e) {
      if (e instanceof ShamirError) {
        throw SSKRError.fromShamirError(e);
      }
      throw e;
    }

    const memberSSKRShares: SSKRShare[] = memberSecrets.map(
      (memberSecret, memberIndex) => {
        const secret = Secret.new(memberSecret);
        return new SSKRShare(
          identifier,
          groupIndex,
          spec.groupThreshold(),
          spec.groupCount(),
          memberIndex,
          group.memberThreshold(),
          secret,
        );
      }
    );

    groupsShares.push(memberSSKRShares);
  }

  return groupsShares;
}

interface Group {
  groupIndex: number;
  memberThreshold: number;
  memberIndexes: number[];
  memberShares: Secret[];
}

function combineShares(shares: SSKRShare[]): Secret {
  let identifier = 0;
  let groupThreshold = 0;
  let groupCount = 0;

  if (shares.length === 0) {
    throw new SSKRError(SSKRErrorType.SharesEmpty);
  }

  let nextGroup = 0;
  const groups: Group[] = [];
  let secretLen = 0;

  for (let i = 0; i < shares.length; i++) {
    const share = shares[i];

    if (i === 0) {
      // on the first one, establish expected values for common metadata
      identifier = share.identifier();
      groupCount = share.groupCount();
      groupThreshold = share.groupThreshold();
      secretLen = share.value().len();
    } else {
      // on subsequent shares, check that common metadata matches
      if (
        share.identifier() !== identifier ||
        share.groupThreshold() !== groupThreshold ||
        share.groupCount() !== groupCount ||
        share.value().len() !== secretLen
      ) {
        throw new SSKRError(SSKRErrorType.ShareSetInvalid);
      }
    }

    // sort shares into member groups
    let groupFound = false;
    for (const group of groups) {
      if (share.groupIndex() === group.groupIndex) {
        groupFound = true;
        if (share.memberThreshold() !== group.memberThreshold) {
          throw new SSKRError(SSKRErrorType.MemberThresholdInvalid);
        }
        for (let k = 0; k < group.memberIndexes.length; k++) {
          if (share.memberIndex() === group.memberIndexes[k]) {
            throw new SSKRError(SSKRErrorType.DuplicateMemberIndex);
          }
        }
        if (group.memberIndexes.length < group.memberThreshold) {
          group.memberIndexes.push(share.memberIndex());
          group.memberShares.push(share.value().clone());
        }
      }
    }

    if (!groupFound) {
      const g: Group = {
        groupIndex: share.groupIndex(),
        memberThreshold: share.memberThreshold(),
        memberIndexes: [share.memberIndex()],
        memberShares: [share.value().clone()],
      };
      groups.push(g);
      nextGroup++;
    }
  }

  // Check that we have enough groups to recover the master secret
  if (nextGroup < groupThreshold) {
    throw new SSKRError(SSKRErrorType.NotEnoughGroups);
  }

  // Here, all of the shares are unpacked into member groups. Now we go
  // through each group and recover the group secret, and then use the
  // result to recover the master secret
  const masterIndexes: number[] = [];
  const masterShares: Uint8Array[] = [];

  for (const group of groups) {
    // Only attempt to recover the group secret if we have enough shares
    if (group.memberIndexes.length < group.memberThreshold) {
      continue;
    }

    // Recover the group secret
    try {
      const memberSharesData = group.memberShares.map((s) => s.getData());
      const groupSecret = recoverSecret(group.memberIndexes, memberSharesData);
      masterIndexes.push(group.groupIndex);
      masterShares.push(groupSecret);
    } catch {
      // If we can't recover this group, just skip it
      continue;
    }

    // Stop if we have enough groups to recover the master secret
    if (masterIndexes.length === groupThreshold) {
      break;
    }
  }

  // If we don't have enough groups to recover the master secret, return an error
  if (masterIndexes.length < groupThreshold) {
    throw new SSKRError(SSKRErrorType.NotEnoughGroups);
  }

  // Recover the master secret
  let masterSecretData: Uint8Array;
  try {
    masterSecretData = recoverSecret(masterIndexes, masterShares);
  } catch (e) {
    if (e instanceof ShamirError) {
      throw SSKRError.fromShamirError(e);
    }
    throw e;
  }

  return Secret.new(masterSecretData);
}
