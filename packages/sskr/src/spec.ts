/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

// Ported from bc-sskr-rust/src/spec.rs

import { MAX_SHARE_COUNT } from "@bcts/shamir";
import { SSKRError, SSKRErrorType } from "./error.js";

/**
 * A specification for a group of shares within an SSKR split.
 */
export class GroupSpec {
  private readonly _memberThreshold: number;
  private readonly _memberCount: number;

  private constructor(memberThreshold: number, memberCount: number) {
    this._memberThreshold = memberThreshold;
    this._memberCount = memberCount;
  }

  /**
   * Creates a new GroupSpec instance with the given member threshold and count.
   *
   * @param memberThreshold - The minimum number of member shares required to
   *   reconstruct the secret within the group.
   * @param memberCount - The total number of member shares in the group.
   * @returns A new GroupSpec instance.
   * @throws SSKRError if the member count is zero, if the member count is
   *   greater than the maximum share count, or if the member threshold is
   *   greater than the member count.
   */
  static new(memberThreshold: number, memberCount: number): GroupSpec {
    if (memberCount === 0) {
      throw new SSKRError(SSKRErrorType.MemberCountInvalid);
    }
    if (memberCount > MAX_SHARE_COUNT) {
      throw new SSKRError(SSKRErrorType.MemberCountInvalid);
    }
    if (memberThreshold > memberCount) {
      throw new SSKRError(SSKRErrorType.MemberThresholdInvalid);
    }
    return new GroupSpec(memberThreshold, memberCount);
  }

  /**
   * Returns the member share threshold for this group.
   */
  memberThreshold(): number {
    return this._memberThreshold;
  }

  /**
   * Returns the number of member shares in this group.
   */
  memberCount(): number {
    return this._memberCount;
  }

  /**
   * Parses a group specification from a string.
   * Format: "M-of-N" where M is the threshold and N is the count.
   */
  static parse(s: string): GroupSpec {
    const parts = s.split("-");
    if (parts.length !== 3) {
      throw new SSKRError(SSKRErrorType.GroupSpecInvalid);
    }

    const memberThreshold = parseInt(parts[0], 10);
    if (isNaN(memberThreshold)) {
      throw new SSKRError(SSKRErrorType.GroupSpecInvalid);
    }

    if (parts[1] !== "of") {
      throw new SSKRError(SSKRErrorType.GroupSpecInvalid);
    }

    const memberCount = parseInt(parts[2], 10);
    if (isNaN(memberCount)) {
      throw new SSKRError(SSKRErrorType.GroupSpecInvalid);
    }

    return GroupSpec.new(memberThreshold, memberCount);
  }

  /**
   * Creates a default GroupSpec (1-of-1).
   */
  static default(): GroupSpec {
    return GroupSpec.new(1, 1);
  }

  /**
   * Returns a string representation of the group spec.
   */
  toString(): string {
    return `${this._memberThreshold}-of-${this._memberCount}`;
  }
}

/**
 * A specification for an SSKR split.
 */
export class Spec {
  private readonly _groupThreshold: number;
  private readonly _groups: GroupSpec[];

  private constructor(groupThreshold: number, groups: GroupSpec[]) {
    this._groupThreshold = groupThreshold;
    this._groups = groups;
  }

  /**
   * Creates a new Spec instance with the given group threshold and groups.
   *
   * @param groupThreshold - The minimum number of groups required to
   *   reconstruct the secret.
   * @param groups - The list of GroupSpec instances that define the groups
   *   and their members.
   * @returns A new Spec instance.
   * @throws SSKRError if the group threshold is zero, if the group threshold
   *   is greater than the number of groups, or if the number of groups is
   *   greater than the maximum share count.
   */
  static new(groupThreshold: number, groups: GroupSpec[]): Spec {
    if (groupThreshold === 0) {
      throw new SSKRError(SSKRErrorType.GroupThresholdInvalid);
    }
    if (groupThreshold > groups.length) {
      throw new SSKRError(SSKRErrorType.GroupThresholdInvalid);
    }
    if (groups.length > MAX_SHARE_COUNT) {
      throw new SSKRError(SSKRErrorType.GroupCountInvalid);
    }
    return new Spec(groupThreshold, groups);
  }

  /**
   * Returns the group threshold.
   */
  groupThreshold(): number {
    return this._groupThreshold;
  }

  /**
   * Returns a slice of the group specifications.
   */
  groups(): GroupSpec[] {
    return this._groups;
  }

  /**
   * Returns the number of groups.
   */
  groupCount(): number {
    return this._groups.length;
  }

  /**
   * Returns the total number of shares across all groups.
   */
  shareCount(): number {
    return this._groups.reduce((sum, g) => sum + g.memberCount(), 0);
  }
}
