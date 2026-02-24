/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

// Ported from bc-sskr-rust/src/share.rs

import type { Secret } from "./secret.js";

/**
 * A share in the SSKR scheme.
 */
export class SSKRShare {
  private readonly _identifier: number;
  private readonly _groupIndex: number;
  private readonly _groupThreshold: number;
  private readonly _groupCount: number;
  private readonly _memberIndex: number;
  private readonly _memberThreshold: number;
  private readonly _value: Secret;

  constructor(
    identifier: number,
    groupIndex: number,
    groupThreshold: number,
    groupCount: number,
    memberIndex: number,
    memberThreshold: number,
    value: Secret,
  ) {
    this._identifier = identifier;
    this._groupIndex = groupIndex;
    this._groupThreshold = groupThreshold;
    this._groupCount = groupCount;
    this._memberIndex = memberIndex;
    this._memberThreshold = memberThreshold;
    this._value = value;
  }

  identifier(): number {
    return this._identifier;
  }

  groupIndex(): number {
    return this._groupIndex;
  }

  groupThreshold(): number {
    return this._groupThreshold;
  }

  groupCount(): number {
    return this._groupCount;
  }

  memberIndex(): number {
    return this._memberIndex;
  }

  memberThreshold(): number {
    return this._memberThreshold;
  }

  value(): Secret {
    return this._value;
  }
}
