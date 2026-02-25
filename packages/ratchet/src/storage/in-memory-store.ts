/**
 * In-memory implementation of Signal Protocol stores.
 * For testing and development purposes.
 */

import type {
  SessionStore,
  PreKeyStore,
  SignedPreKeyStore,
  IdentityKeyStore,
  SenderKeyStore,
  ProtocolAddress,
  Direction,
} from "./interfaces.js";
import type { SessionRecord } from "../session/session-record.js";
import type { PreKeyRecord, SignedPreKeyRecord } from "../keys/pre-key.js";
import { type IdentityKey, type IdentityKeyPair } from "../keys/identity-key.js";
import { InvalidKeyError } from "../error.js";

export class InMemorySignalProtocolStore
  implements SessionStore, PreKeyStore, SignedPreKeyStore, IdentityKeyStore, SenderKeyStore
{
  private readonly identityKeyPair: IdentityKeyPair;
  private readonly registrationId: number;
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly preKeys = new Map<number, PreKeyRecord>();
  private readonly signedPreKeys = new Map<number, SignedPreKeyRecord>();
  private readonly identities = new Map<string, IdentityKey>();
  private readonly senderKeys = new Map<string, Uint8Array>();

  constructor(identityKeyPair: IdentityKeyPair, registrationId: number) {
    this.identityKeyPair = identityKeyPair;
    this.registrationId = registrationId;
  }

  // --- SessionStore ---

  async loadSession(address: ProtocolAddress): Promise<SessionRecord | undefined> {
    return this.sessions.get(address.toString());
  }

  async storeSession(address: ProtocolAddress, record: SessionRecord): Promise<void> {
    this.sessions.set(address.toString(), record);
  }

  // --- PreKeyStore ---

  async loadPreKey(id: number): Promise<PreKeyRecord> {
    const record = this.preKeys.get(id);
    if (!record) {
      throw new InvalidKeyError(`PreKey not found: ${id}`);
    }
    return record;
  }

  async storePreKey(id: number, record: PreKeyRecord): Promise<void> {
    this.preKeys.set(id, record);
  }

  async removePreKey(id: number): Promise<void> {
    this.preKeys.delete(id);
  }

  // --- SignedPreKeyStore ---

  async loadSignedPreKey(id: number): Promise<SignedPreKeyRecord> {
    const record = this.signedPreKeys.get(id);
    if (!record) {
      throw new InvalidKeyError(`SignedPreKey not found: ${id}`);
    }
    return record;
  }

  async storeSignedPreKey(id: number, record: SignedPreKeyRecord): Promise<void> {
    this.signedPreKeys.set(id, record);
  }

  // --- IdentityKeyStore ---

  async getIdentityKeyPair(): Promise<IdentityKeyPair> {
    return this.identityKeyPair;
  }

  async getLocalRegistrationId(): Promise<number> {
    return this.registrationId;
  }

  async isTrustedIdentity(
    address: ProtocolAddress,
    identityKey: IdentityKey,
    _direction: Direction,
  ): Promise<boolean> {
    const existing = this.identities.get(address.toString());
    if (!existing) {
      return true; // Trust on first use
    }
    return existing.equals(identityKey);
  }

  async getIdentity(address: ProtocolAddress): Promise<IdentityKey | undefined> {
    return this.identities.get(address.toString());
  }

  async saveIdentity(address: ProtocolAddress, identityKey: IdentityKey): Promise<boolean> {
    const existing = this.identities.get(address.toString());
    this.identities.set(address.toString(), identityKey);
    if (existing) {
      return !existing.equals(identityKey); // return true if changed
    }
    return false;
  }

  // --- SenderKeyStore ---

  async storeSenderKey(
    sender: ProtocolAddress,
    distributionId: string,
    record: Uint8Array,
  ): Promise<void> {
    this.senderKeys.set(`${sender.toString()}::${distributionId}`, record);
  }

  async loadSenderKey(
    sender: ProtocolAddress,
    distributionId: string,
  ): Promise<Uint8Array | undefined> {
    return this.senderKeys.get(`${sender.toString()}::${distributionId}`);
  }
}
