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

  loadSession(address: ProtocolAddress): Promise<SessionRecord | undefined> {
    return Promise.resolve(this.sessions.get(address.toString()));
  }

  storeSession(address: ProtocolAddress, record: SessionRecord): Promise<void> {
    this.sessions.set(address.toString(), record);
    return Promise.resolve();
  }

  // --- PreKeyStore ---

  loadPreKey(id: number): Promise<PreKeyRecord> {
    const record = this.preKeys.get(id);
    if (record == null) {
      throw new InvalidKeyError(`PreKey not found: ${id}`);
    }
    return Promise.resolve(record);
  }

  storePreKey(id: number, record: PreKeyRecord): Promise<void> {
    this.preKeys.set(id, record);
    return Promise.resolve();
  }

  removePreKey(id: number): Promise<void> {
    this.preKeys.delete(id);
    return Promise.resolve();
  }

  // --- SignedPreKeyStore ---

  loadSignedPreKey(id: number): Promise<SignedPreKeyRecord> {
    const record = this.signedPreKeys.get(id);
    if (record == null) {
      throw new InvalidKeyError(`SignedPreKey not found: ${id}`);
    }
    return Promise.resolve(record);
  }

  storeSignedPreKey(id: number, record: SignedPreKeyRecord): Promise<void> {
    this.signedPreKeys.set(id, record);
    return Promise.resolve();
  }

  // --- IdentityKeyStore ---

  getIdentityKeyPair(): Promise<IdentityKeyPair> {
    return Promise.resolve(this.identityKeyPair);
  }

  getLocalRegistrationId(): Promise<number> {
    return Promise.resolve(this.registrationId);
  }

  isTrustedIdentity(
    address: ProtocolAddress,
    identityKey: IdentityKey,
    _direction: Direction,
  ): Promise<boolean> {
    const existing = this.identities.get(address.toString());
    if (existing == null) {
      return Promise.resolve(true); // Trust on first use
    }
    return Promise.resolve(existing.equals(identityKey));
  }

  getIdentity(address: ProtocolAddress): Promise<IdentityKey | undefined> {
    return Promise.resolve(this.identities.get(address.toString()));
  }

  saveIdentity(address: ProtocolAddress, identityKey: IdentityKey): Promise<boolean> {
    const existing = this.identities.get(address.toString());
    this.identities.set(address.toString(), identityKey);
    if (existing != null) {
      return Promise.resolve(!existing.equals(identityKey)); // return true if changed
    }
    return Promise.resolve(false);
  }

  // --- SenderKeyStore ---

  storeSenderKey(
    sender: ProtocolAddress,
    distributionId: string,
    record: Uint8Array,
  ): Promise<void> {
    this.senderKeys.set(`${sender.toString()}::${distributionId}`, record);
    return Promise.resolve();
  }

  loadSenderKey(
    sender: ProtocolAddress,
    distributionId: string,
  ): Promise<Uint8Array | undefined> {
    return Promise.resolve(this.senderKeys.get(`${sender.toString()}::${distributionId}`));
  }
}
