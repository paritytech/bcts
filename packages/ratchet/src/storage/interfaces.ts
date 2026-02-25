/**
 * Storage interfaces for the Signal Protocol.
 *
 * Reference: libsignal/rust/protocol/src/storage.rs
 */

import type { IdentityKey, IdentityKeyPair } from "../keys/identity-key.js";
import type { PreKeyRecord, SignedPreKeyRecord } from "../keys/pre-key.js";
import type { SessionRecord } from "../session/session-record.js";

export type Direction = "sending" | "receiving";

export class ProtocolAddress {
  readonly name: string;
  readonly deviceId: number;

  constructor(name: string, deviceId: number) {
    this.name = name;
    this.deviceId = deviceId;
  }

  toString(): string {
    return `${this.name}.${this.deviceId}`;
  }

  equals(other: ProtocolAddress): boolean {
    return this.name === other.name && this.deviceId === other.deviceId;
  }
}

export interface SessionStore {
  loadSession(address: ProtocolAddress): Promise<SessionRecord | undefined>;
  storeSession(address: ProtocolAddress, record: SessionRecord): Promise<void>;
}

export interface PreKeyStore {
  loadPreKey(id: number): Promise<PreKeyRecord>;
  storePreKey(id: number, record: PreKeyRecord): Promise<void>;
  removePreKey(id: number): Promise<void>;
}

export interface SignedPreKeyStore {
  loadSignedPreKey(id: number): Promise<SignedPreKeyRecord>;
  storeSignedPreKey(id: number, record: SignedPreKeyRecord): Promise<void>;
}

export interface IdentityKeyStore {
  getIdentityKeyPair(): Promise<IdentityKeyPair>;
  getLocalRegistrationId(): Promise<number>;
  getIdentity(address: ProtocolAddress): Promise<IdentityKey | undefined>;
  isTrustedIdentity(
    address: ProtocolAddress,
    identityKey: IdentityKey,
    direction: Direction,
  ): Promise<boolean>;
  saveIdentity(address: ProtocolAddress, identityKey: IdentityKey): Promise<boolean>;
}

export interface SenderKeyStore {
  storeSenderKey(
    sender: ProtocolAddress,
    distributionId: string,
    record: Uint8Array,
  ): Promise<void>;
  loadSenderKey(sender: ProtocolAddress, distributionId: string): Promise<Uint8Array | undefined>;
}

// ---------------------------------------------------------------------------
// DistributionId branded type
// ---------------------------------------------------------------------------

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Branded type for UUID v4 distribution IDs. */
export type DistributionId = string & { readonly __brand: unique symbol };

export function createDistributionId(uuid: string): DistributionId {
  if (!UUID_REGEX.test(uuid)) {
    throw new Error(`Invalid UUID v4 format: ${uuid}`);
  }
  return uuid as DistributionId;
}

export function generateDistributionId(): DistributionId {
  // Generate UUID v4 using crypto.getRandomValues
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Set version 4
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  // Set variant 1
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return uuid as DistributionId;
}

// ---------------------------------------------------------------------------
// ProtocolStore aggregate interface
// ---------------------------------------------------------------------------

/**
 * Aggregate store interface combining all protocol stores.
 * Reference: libsignal/rust/protocol/src/storage/traits.rs
 */
export interface ProtocolStore
  extends
    SessionStore,
    PreKeyStore,
    SignedPreKeyStore,
    IdentityKeyStore,
    SenderKeyStore {}
