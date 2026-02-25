/**
 * PreKey and SignedPreKey types for the Signal Protocol.
 *
 * Reference: libsignal/rust/protocol/src/state/prekey.rs
 */

import type { RandomNumberGenerator } from "@bcts/rand";
import { KeyPair } from "./key-pair.js";
import type { IdentityKeyPair } from "./identity-key.js";
import {
  encodePreKeyRecord,
  decodePreKeyRecord,
  encodeSignedPreKeyRecord,
  decodeSignedPreKeyRecord,
} from "../protocol/proto.js";

export class PreKeyRecord {
  readonly id: number;
  readonly keyPair: KeyPair;

  constructor(id: number, keyPair: KeyPair) {
    this.id = id;
    this.keyPair = keyPair;
  }

  static generate(id: number, rng: RandomNumberGenerator): PreKeyRecord {
    return new PreKeyRecord(id, KeyPair.generate(rng));
  }

  serialize(): Uint8Array {
    const serializedPublic = new Uint8Array(33);
    serializedPublic[0] = 0x05;
    serializedPublic.set(this.keyPair.publicKey, 1);
    return encodePreKeyRecord({
      id: this.id,
      publicKey: serializedPublic,
      privateKey: this.keyPair.privateKey,
    });
  }

  static deserialize(data: Uint8Array): PreKeyRecord {
    const proto = decodePreKeyRecord(data);
    if (proto.id === undefined || !proto.publicKey || !proto.privateKey) {
      throw new Error("Invalid PreKeyRecord protobuf");
    }
    const rawPub =
      proto.publicKey.length === 33 && proto.publicKey[0] === 0x05
        ? proto.publicKey.slice(1)
        : proto.publicKey;
    return new PreKeyRecord(proto.id, new KeyPair(proto.privateKey, rawPub));
  }
}

export class SignedPreKeyRecord {
  readonly id: number;
  readonly keyPair: KeyPair;
  readonly signature: Uint8Array;
  readonly timestamp: number;

  constructor(id: number, keyPair: KeyPair, signature: Uint8Array, timestamp: number) {
    this.id = id;
    this.keyPair = keyPair;
    this.signature = signature;
    this.timestamp = timestamp;
  }

  /**
   * Generate a new signed pre-key, signing the public key with the identity key.
   */
  static generate(
    id: number,
    identityKeyPair: IdentityKeyPair,
    timestamp: number,
    rng: RandomNumberGenerator,
  ): SignedPreKeyRecord {
    const keyPair = KeyPair.generate(rng);
    // Sign the serialized public key (33 bytes with 0x05 prefix)
    const serializedPublic = new Uint8Array(33);
    serializedPublic[0] = 0x05;
    serializedPublic.set(keyPair.publicKey, 1);
    const signature = identityKeyPair.sign(serializedPublic);
    return new SignedPreKeyRecord(id, keyPair, signature, timestamp);
  }

  serialize(): Uint8Array {
    const serializedPublic = new Uint8Array(33);
    serializedPublic[0] = 0x05;
    serializedPublic.set(this.keyPair.publicKey, 1);
    return encodeSignedPreKeyRecord({
      id: this.id,
      publicKey: serializedPublic,
      privateKey: this.keyPair.privateKey,
      signature: this.signature,
      timestamp: this.timestamp,
    });
  }

  static deserialize(data: Uint8Array): SignedPreKeyRecord {
    const proto = decodeSignedPreKeyRecord(data);
    if (proto.id === undefined || !proto.publicKey || !proto.privateKey) {
      throw new Error("Invalid SignedPreKeyRecord protobuf");
    }
    const rawPub =
      proto.publicKey.length === 33 && proto.publicKey[0] === 0x05
        ? proto.publicKey.slice(1)
        : proto.publicKey;
    return new SignedPreKeyRecord(
      proto.id,
      new KeyPair(proto.privateKey, rawPub),
      proto.signature ?? new Uint8Array(0),
      proto.timestamp ?? 0,
    );
  }
}
