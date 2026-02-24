/**
 * Kyber pre-key record for PQXDH v4.
 *
 * Stores a Kyber/ML-KEM key pair along with its ID, timestamp, and signature.
 * The signature is computed over the TYPE-PREFIXED public key by the identity key,
 * matching libsignal's behavior.
 */

import type { KemKeyPair } from "./kem-types.js";
import type { IdentityKeyPair } from "../keys/identity-key.js";
import { kemGenerateKeyPair, kemSerializePublicKey, kemDeserializePublicKey, DEFAULT_KEM_TYPE, type KemType } from "./kem-types.js";
import {
  encodeSignedPreKeyRecord,
  decodeSignedPreKeyRecord,
} from "../protocol/proto.js";

export class KyberPreKeyRecord {
  readonly id: number;
  readonly keyPair: KemKeyPair;
  readonly signature: Uint8Array;
  readonly timestamp: number;
  readonly kemType: KemType;

  constructor(
    id: number,
    keyPair: KemKeyPair,
    signature: Uint8Array,
    timestamp: number,
    kemType: KemType = DEFAULT_KEM_TYPE,
  ) {
    this.id = id;
    this.keyPair = keyPair;
    this.signature = signature;
    this.timestamp = timestamp;
    this.kemType = kemType;
  }

  /**
   * Generate a new Kyber pre-key, signing the type-prefixed public key
   * with the identity key (matches libsignal).
   */
  static generate(
    id: number,
    identityKeyPair: IdentityKeyPair,
    timestamp: number,
    kemType: KemType = DEFAULT_KEM_TYPE,
  ): KyberPreKeyRecord {
    const keyPair = kemGenerateKeyPair();
    // Sign the TYPE-PREFIXED public key (matches libsignal)
    const serializedPublicKey = kemSerializePublicKey(keyPair.publicKey, kemType);
    const signature = identityKeyPair.sign(serializedPublicKey);
    return new KyberPreKeyRecord(id, keyPair, signature, timestamp, kemType);
  }

  serialize(): Uint8Array {
    const serializedPublicKey = kemSerializePublicKey(this.keyPair.publicKey, this.kemType);
    return encodeSignedPreKeyRecord({
      id: this.id,
      publicKey: serializedPublicKey,
      privateKey: this.keyPair.secretKey,
      signature: this.signature,
      timestamp: this.timestamp,
    });
  }

  static deserialize(data: Uint8Array): KyberPreKeyRecord {
    const proto = decodeSignedPreKeyRecord(data);
    if (proto.id === undefined || !proto.publicKey || !proto.privateKey) {
      throw new Error("Invalid KyberPreKeyRecord protobuf");
    }
    const { kemType, publicKey } = kemDeserializePublicKey(proto.publicKey);
    return new KyberPreKeyRecord(
      proto.id,
      { publicKey, secretKey: proto.privateKey },
      proto.signature ?? new Uint8Array(0),
      proto.timestamp ?? 0,
      kemType,
    );
  }
}
