/**
 * In-memory implementation of Signal Protocol stores.
 * For testing and development purposes.
 */

import type {
  SessionStore,
  PreKeyStore,
  SignedPreKeyStore,
  IdentityKeyStore,
  KyberPreKeyStore,
  SenderKeyStore,
  ProtocolAddress,
  Direction,
} from "./interfaces.js";
import type { SessionRecord } from "../session/session-record.js";
import type { PreKeyRecord, SignedPreKeyRecord } from "../keys/pre-key.js";
import type { KyberPreKeyRecord } from "../kem/kyber-pre-key.js";
import { IdentityKey, IdentityKeyPair } from "../keys/identity-key.js";
import { InvalidKeyError, InvalidMessageError } from "../error.js";

export class InMemorySignalProtocolStore
  implements
    SessionStore,
    PreKeyStore,
    SignedPreKeyStore,
    IdentityKeyStore,
    KyberPreKeyStore,
    SenderKeyStore
{
  private identityKeyPair: IdentityKeyPair;
  private registrationId: number;
  private sessions = new Map<string, SessionRecord>();
  private preKeys = new Map<number, PreKeyRecord>();
  private signedPreKeys = new Map<number, SignedPreKeyRecord>();
  private identities = new Map<string, IdentityKey>();
  private kyberPreKeys = new Map<number, KyberPreKeyRecord>();
  private senderKeys = new Map<string, Uint8Array>();
  private baseKeysSeen = new Map<string, Uint8Array[]>();

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

  // --- KyberPreKeyStore ---

  async loadKyberPreKey(id: number): Promise<KyberPreKeyRecord> {
    const record = this.kyberPreKeys.get(id);
    if (!record) {
      throw new InvalidKeyError(`KyberPreKey not found: ${id}`);
    }
    return record;
  }

  async storeKyberPreKey(id: number, record: KyberPreKeyRecord): Promise<void> {
    this.kyberPreKeys.set(id, record);
  }

  async markKyberPreKeyUsed(
    kyberPreKeyId: number,
    signedPreKeyId: number,
    baseKey: Uint8Array,
  ): Promise<void> {
    const mapKey = `${kyberPreKeyId}:${signedPreKeyId}`;
    const seen = this.baseKeysSeen.get(mapKey) ?? [];

    // Check for base key reuse
    for (const seenKey of seen) {
      if (seenKey.length === baseKey.length) {
        let equal = true;
        for (let i = 0; i < seenKey.length; i++) {
          if (seenKey[i] !== baseKey[i]) {
            equal = false;
            break;
          }
        }
        if (equal) {
          throw new InvalidMessageError("reused base key");
        }
      }
    }

    seen.push(Uint8Array.from(baseKey));
    this.baseKeysSeen.set(mapKey, seen);
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
