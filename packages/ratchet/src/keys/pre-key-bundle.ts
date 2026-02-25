/**
 * PreKeyBundle — published by Bob for Alice to initiate a session.
 *
 * Reference: libsignal/rust/protocol/src/state/bundle.rs
 */

import { IdentityKey } from "./identity-key.js";

export class PreKeyBundle {
  readonly registrationId: number;
  readonly deviceId: number;
  readonly preKeyId: number | undefined;
  readonly preKey: Uint8Array | undefined;
  readonly signedPreKeyId: number;
  readonly signedPreKey: Uint8Array;
  readonly signedPreKeySignature: Uint8Array;
  readonly identityKey: IdentityKey;
  readonly kyberPreKeyId: number | undefined;
  readonly kyberPreKey: Uint8Array | undefined;
  readonly kyberPreKeySignature: Uint8Array | undefined;

  constructor(params: {
    registrationId: number;
    deviceId: number;
    preKeyId?: number;
    preKey?: Uint8Array;
    signedPreKeyId: number;
    signedPreKey: Uint8Array;
    signedPreKeySignature: Uint8Array;
    identityKey: IdentityKey;
    kyberPreKeyId?: number;
    kyberPreKey?: Uint8Array;
    kyberPreKeySignature?: Uint8Array;
  }) {
    this.registrationId = params.registrationId;
    this.deviceId = params.deviceId;
    this.preKeyId = params.preKeyId;
    this.preKey = params.preKey;
    this.signedPreKeyId = params.signedPreKeyId;
    this.signedPreKey = params.signedPreKey;
    this.signedPreKeySignature = params.signedPreKeySignature;
    this.identityKey = params.identityKey;
    this.kyberPreKeyId = params.kyberPreKeyId;
    this.kyberPreKey = params.kyberPreKey;
    this.kyberPreKeySignature = params.kyberPreKeySignature;
  }

  /**
   * Validate that this bundle contains all required fields.
   *
   * Checks that core fields (identityKey, signedPreKeyId, signedPreKey,
   * signedPreKeySignature) are present. Logs a warning if Kyber fields
   * are missing, since they are required for PQXDH (protocol version 4+).
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

    // Kyber fields are required for PQXDH (v4+). Log a warning if missing.
    const hasKyberKey = this.kyberPreKey !== undefined && this.kyberPreKey.length > 0;
    const hasKyberId = this.kyberPreKeyId !== undefined;
    const hasKyberSig =
      this.kyberPreKeySignature !== undefined && this.kyberPreKeySignature.length > 0;

    if (!hasKyberId || !hasKyberKey || !hasKyberSig) {
      console.warn(
        "PreKeyBundle: Kyber pre-key fields are missing. " +
          "These are required for PQXDH (protocol version 4+). " +
          "Sessions created without Kyber will use legacy X3DH.",
      );
    }

    return true;
  }
}
