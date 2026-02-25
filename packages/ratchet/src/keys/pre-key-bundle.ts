/**
 * PreKeyBundle — published by Bob for Alice to initiate a session.
 *
 * Reference: libsignal/rust/protocol/src/state/bundle.rs
 */

import { type IdentityKey } from "./identity-key.js";

export class PreKeyBundle {
  readonly registrationId: number;
  readonly deviceId: number;
  readonly preKeyId: number | undefined;
  readonly preKey: Uint8Array | undefined;
  readonly signedPreKeyId: number;
  readonly signedPreKey: Uint8Array;
  readonly signedPreKeySignature: Uint8Array;
  readonly identityKey: IdentityKey;

  constructor(params: {
    registrationId: number;
    deviceId: number;
    preKeyId?: number;
    preKey?: Uint8Array;
    signedPreKeyId: number;
    signedPreKey: Uint8Array;
    signedPreKeySignature: Uint8Array;
    identityKey: IdentityKey;
  }) {
    this.registrationId = params.registrationId;
    this.deviceId = params.deviceId;
    this.preKeyId = params.preKeyId;
    this.preKey = params.preKey;
    this.signedPreKeyId = params.signedPreKeyId;
    this.signedPreKey = params.signedPreKey;
    this.signedPreKeySignature = params.signedPreKeySignature;
    this.identityKey = params.identityKey;
  }

  /**
   * Validate that this bundle contains all required fields.
   *
   * Checks that core fields (identityKey, signedPreKeyId, signedPreKey,
   * signedPreKeySignature) are present.
   *
   * @returns true if all required fields are present
   * @throws {Error} if core required fields are missing
   */
  validate(): boolean {
    // Core fields are enforced by the constructor's required params,
    // but we verify the actual values as a defensive check.
    if (!this.identityKey) {
      throw new Error("PreKeyBundle: missing identityKey");
    }
    if (this.signedPreKeyId === undefined || this.signedPreKeyId === null) {
      throw new Error("PreKeyBundle: missing signedPreKeyId");
    }
    if (!this.signedPreKey || this.signedPreKey.length === 0) {
      throw new Error("PreKeyBundle: missing signedPreKey");
    }
    if (!this.signedPreKeySignature || this.signedPreKeySignature.length === 0) {
      throw new Error("PreKeyBundle: missing signedPreKeySignature");
    }

    return true;
  }
}
