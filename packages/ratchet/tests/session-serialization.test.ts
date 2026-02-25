import { describe, it, expect } from "vitest";
import { SessionState } from "../src/session/session-state.js";
import { SessionRecord } from "../src/session/session-record.js";
import { PreKeyRecord, SignedPreKeyRecord } from "../src/keys/pre-key.js";
import { KyberPreKeyRecord } from "../src/kem/kyber-pre-key.js";
import { IdentityKeyPair } from "../src/keys/identity-key.js";
import { KeyPair } from "../src/keys/key-pair.js";
import { ChainKey } from "../src/ratchet/chain-key.js";
import { RootKey } from "../src/ratchet/root-key.js";
import { PqRatchetState } from "../src/ratchet/pq-ratchet.js";
import {
  encodeSessionStructure,
  decodeSessionStructure,
  encodeMessageKey,
  decodeMessageKey,
  type SessionStructureProto,
  type MessageKeyProto,
  parseProtoFields,
  encodeBytesField,
  encodeUint32Field,
  encodeUint64Field,
  concatProtoFields,
} from "../src/protocol/proto.js";
import { SenderCertificate } from "../src/sealed-sender/sender-certificate.js";
import { ServerCertificate } from "../src/sealed-sender/server-certificate.js";
import { createTestRng } from "./test-utils.js";

const rng = createTestRng();

function randomBytes(n: number): Uint8Array {
  return rng.randomData(n);
}

describe("SessionState serialization", () => {
  it("round-trips a basic session state", () => {
    const idKeyPair = IdentityKeyPair.generate(rng);
    const remoteIdKeyPair = IdentityKeyPair.generate(rng);
    const rootKey = new RootKey(randomBytes(32));

    const state = new SessionState({
      sessionVersion: 4,
      localIdentityKey: idKeyPair.identityKey,
      remoteIdentityKey: remoteIdKeyPair.identityKey,
      rootKey,
    });
    state.setLocalRegistrationId(12345);
    state.setRemoteRegistrationId(67890);

    const serialized = state.serialize();
    const restored = SessionState.deserialize(serialized);

    expect(restored.sessionVersion()).toBe(4);
    expect(restored.localRegistrationId()).toBe(12345);
    expect(restored.remoteRegistrationId()).toBe(67890);
    expect(restored.localIdentityKey().equals(idKeyPair.identityKey)).toBe(true);
    expect(restored.remoteIdentityKey()!.equals(remoteIdKeyPair.identityKey)).toBe(true);
    expect(restored.rootKey().key).toEqual(rootKey.key);
  });

  it("round-trips with sender chain", () => {
    const idKeyPair = IdentityKeyPair.generate(rng);
    const rootKey = new RootKey(randomBytes(32));
    const state = new SessionState({
      sessionVersion: 3,
      localIdentityKey: idKeyPair.identityKey,
      rootKey,
    });

    const senderKp = KeyPair.generate(rng);
    const senderChainKey = new ChainKey(randomBytes(32), 5);
    state.setSenderChain(senderKp, senderChainKey);

    const serialized = state.serialize();
    const restored = SessionState.deserialize(serialized);

    expect(restored.hasSenderChain()).toBe(true);
    expect(restored.senderRatchetKey()).toEqual(senderKp.publicKey);
    expect(restored.getSenderChainKey().index).toBe(5);
  });

  it("round-trips with receiver chains", () => {
    const idKeyPair = IdentityKeyPair.generate(rng);
    const rootKey = new RootKey(randomBytes(32));
    const state = new SessionState({
      sessionVersion: 3,
      localIdentityKey: idKeyPair.identityKey,
      rootKey,
    });

    const ratchetKey1 = randomBytes(32);
    const chainKey1 = new ChainKey(randomBytes(32), 10);
    state.addReceiverChain(ratchetKey1, chainKey1);

    const serialized = state.serialize();
    const restored = SessionState.deserialize(serialized);
    expect(restored.getReceiverChainKey(ratchetKey1)).toBeDefined();
    expect(restored.getReceiverChainKey(ratchetKey1)!.index).toBe(10);
  });

  it("round-trips with pending pre-key", () => {
    const idKeyPair = IdentityKeyPair.generate(rng);
    const rootKey = new RootKey(randomBytes(32));
    const state = new SessionState({
      sessionVersion: 4,
      localIdentityKey: idKeyPair.identityKey,
      rootKey,
    });

    state.setPendingPreKey({
      preKeyId: 42,
      signedPreKeyId: 7,
      baseKey: randomBytes(32),
      timestamp: Date.now(),
    });

    const serialized = state.serialize();
    const restored = SessionState.deserialize(serialized);
    const ppk = restored.pendingPreKey();
    expect(ppk).toBeDefined();
    expect(ppk!.preKeyId).toBe(42);
    expect(ppk!.signedPreKeyId).toBe(7);
  });
});

describe("SessionRecord serialization", () => {
  it("round-trips empty record", () => {
    const record = SessionRecord.newFresh();
    const serialized = record.serialize();
    const restored = SessionRecord.deserialize(serialized);
    expect(restored.sessionState()).toBeUndefined();
  });

  it("round-trips with current session", () => {
    const idKeyPair = IdentityKeyPair.generate(rng);
    const state = new SessionState({
      sessionVersion: 4,
      localIdentityKey: idKeyPair.identityKey,
      rootKey: new RootKey(randomBytes(32)),
    });
    state.setLocalRegistrationId(111);
    const record = new SessionRecord(state);

    const serialized = record.serialize();
    const restored = SessionRecord.deserialize(serialized);
    expect(restored.sessionState()).toBeDefined();
    expect(restored.sessionState()!.localRegistrationId()).toBe(111);
  });
});

describe("PreKeyRecord serialization", () => {
  it("round-trips", () => {
    const kp = KeyPair.generate(rng);
    const record = new PreKeyRecord(42, kp);
    const serialized = record.serialize();
    const restored = PreKeyRecord.deserialize(serialized);
    expect(restored.id).toBe(42);
    expect(restored.keyPair.publicKey).toEqual(kp.publicKey);
    expect(restored.keyPair.privateKey).toEqual(kp.privateKey);
  });
});

describe("SignedPreKeyRecord serialization", () => {
  it("round-trips", () => {
    const idKeyPair = IdentityKeyPair.generate(rng);
    const record = SignedPreKeyRecord.generate(7, idKeyPair, 1234567890, rng);
    const serialized = record.serialize();
    const restored = SignedPreKeyRecord.deserialize(serialized);
    expect(restored.id).toBe(7);
    expect(restored.keyPair.publicKey).toEqual(record.keyPair.publicKey);
    expect(restored.signature).toEqual(record.signature);
    expect(restored.timestamp).toBe(1234567890);
  });
});

describe("KyberPreKeyRecord serialization", () => {
  it("round-trips", () => {
    const idKeyPair = IdentityKeyPair.generate(rng);
    const record = KyberPreKeyRecord.generate(13, idKeyPair, 9876543210);
    const serialized = record.serialize();
    const restored = KyberPreKeyRecord.deserialize(serialized);
    expect(restored.id).toBe(13);
    expect(restored.keyPair.publicKey).toEqual(record.keyPair.publicKey);
    expect(restored.keyPair.secretKey).toEqual(record.keyPair.secretKey);
    expect(restored.signature).toEqual(record.signature);
  });
});

// ==========================================================================
// WS-7: Protobuf Completeness Tests
// ==========================================================================

describe("WS-7: SessionStructure with pq_ratchet_state (field 15)", () => {
  it("round-trips pq_ratchet_state through protobuf encode/decode", () => {
    const pqRootKey = randomBytes(32);
    const proto: SessionStructureProto = {
      sessionVersion: 4,
      localIdentityPublic: randomBytes(33),
      remoteIdentityPublic: randomBytes(33),
      rootKey: randomBytes(32),
      previousCounter: 3,
      pqRatchetState: pqRootKey,
    };

    const encoded = encodeSessionStructure(proto);
    const decoded = decodeSessionStructure(encoded);

    expect(decoded.pqRatchetState).toBeDefined();
    expect(decoded.pqRatchetState).toEqual(pqRootKey);
  });

  it("round-trips pq_ratchet_state through SessionState serialize/deserialize", () => {
    const idKeyPair = IdentityKeyPair.generate(rng);
    const rootKey = new RootKey(randomBytes(32));
    const state = new SessionState({
      sessionVersion: 4,
      localIdentityKey: idKeyPair.identityKey,
      rootKey,
    });

    const pqRoot = randomBytes(32);
    state.setPqRatchetState(new PqRatchetState(pqRoot));

    const serialized = state.serialize();
    const restored = SessionState.deserialize(serialized);

    expect(restored.pqRatchetState()).toBeDefined();
    expect(restored.pqRatchetState()!.rootKey()).toEqual(pqRoot);
  });

  it("omits pq_ratchet_state when not set", () => {
    const proto: SessionStructureProto = {
      sessionVersion: 4,
      localIdentityPublic: randomBytes(33),
      rootKey: randomBytes(32),
    };

    const encoded = encodeSessionStructure(proto);
    const decoded = decodeSessionStructure(encoded);

    expect(decoded.pqRatchetState).toBeUndefined();
  });

  it("encodes pq_ratchet_state as field 15 (bytes)", () => {
    const pqState = randomBytes(32);
    const proto: SessionStructureProto = {
      sessionVersion: 4,
      localIdentityPublic: randomBytes(33),
      rootKey: randomBytes(32),
      pqRatchetState: pqState,
    };

    const encoded = encodeSessionStructure(proto);
    const fields = parseProtoFields(encoded);
    // Field 15 should be present as bytes
    expect(fields.bytes.get(15)).toBeDefined();
    expect(fields.bytes.get(15)).toEqual(pqState);
  });
});

describe("WS-7: SessionStructure with PendingKyberPreKey (field 14)", () => {
  it("round-trips PendingKyberPreKey through protobuf encode/decode", () => {
    const proto: SessionStructureProto = {
      sessionVersion: 4,
      localIdentityPublic: randomBytes(33),
      rootKey: randomBytes(32),
      pendingKyberPreKey: {
        kyberPreKeyId: 42,
        kyberCiphertext: randomBytes(64),
      },
    };

    const encoded = encodeSessionStructure(proto);
    const decoded = decodeSessionStructure(encoded);

    expect(decoded.pendingKyberPreKey).toBeDefined();
    expect(decoded.pendingKyberPreKey!.kyberPreKeyId).toBe(42);
    expect(decoded.pendingKyberPreKey!.kyberCiphertext).toEqual(
      proto.pendingKyberPreKey!.kyberCiphertext,
    );
  });

  it("round-trips PendingKyberPreKey through SessionState", () => {
    const idKeyPair = IdentityKeyPair.generate(rng);
    const rootKey = new RootKey(randomBytes(32));
    const state = new SessionState({
      sessionVersion: 4,
      localIdentityKey: idKeyPair.identityKey,
      rootKey,
    });

    const kyberCiphertext = randomBytes(64);
    state.setPendingPreKey({
      preKeyId: 10,
      signedPreKeyId: 20,
      baseKey: randomBytes(32),
      timestamp: Date.now(),
      kyberPreKeyId: 99,
      kyberCiphertext,
    });

    const serialized = state.serialize();
    const restored = SessionState.deserialize(serialized);
    const ppk = restored.pendingPreKey();
    expect(ppk).toBeDefined();
    expect(ppk!.kyberPreKeyId).toBe(99);
    expect(ppk!.kyberCiphertext).toEqual(kyberCiphertext);
  });

  it("encodes PendingKyberPreKey as field 14 (nested)", () => {
    const proto: SessionStructureProto = {
      sessionVersion: 4,
      localIdentityPublic: randomBytes(33),
      rootKey: randomBytes(32),
      pendingKyberPreKey: {
        kyberPreKeyId: 7,
        kyberCiphertext: randomBytes(32),
      },
    };

    const encoded = encodeSessionStructure(proto);
    const fields = parseProtoFields(encoded);
    // Field 14 should be present as bytes (nested message)
    expect(fields.bytes.get(14)).toBeDefined();
  });
});

describe("WS-7: MessageKey with seed field (field 5)", () => {
  it("round-trips MessageKey with seed through protobuf encode/decode", () => {
    const seed = randomBytes(32);
    const mk: MessageKeyProto = {
      index: 7,
      seed,
    };

    const encoded = encodeMessageKey(mk);
    const decoded = decodeMessageKey(encoded);

    expect(decoded.index).toBe(7);
    expect(decoded.seed).toEqual(seed);
    // When seed is set, derived keys should be absent
    expect(decoded.cipherKey).toBeUndefined();
    expect(decoded.macKey).toBeUndefined();
    expect(decoded.iv).toBeUndefined();
  });

  it("round-trips MessageKey with fully derived keys", () => {
    const mk: MessageKeyProto = {
      index: 3,
      cipherKey: randomBytes(32),
      macKey: randomBytes(32),
      iv: randomBytes(16),
    };

    const encoded = encodeMessageKey(mk);
    const decoded = decodeMessageKey(encoded);

    expect(decoded.index).toBe(3);
    expect(decoded.cipherKey).toEqual(mk.cipherKey);
    expect(decoded.macKey).toEqual(mk.macKey);
    expect(decoded.iv).toEqual(mk.iv);
    expect(decoded.seed).toBeUndefined();
  });

  it("encodes seed as field 5 (bytes)", () => {
    const seed = randomBytes(32);
    const mk: MessageKeyProto = { index: 0, seed };
    const encoded = encodeMessageKey(mk);
    const fields = parseProtoFields(encoded);
    expect(fields.bytes.get(5)).toBeDefined();
    expect(fields.bytes.get(5)).toEqual(seed);
  });
});

describe("WS-7: SenderCertificate alternatives", () => {
  it("deserializes known_server_certificate_id (field 8) with resolver", () => {
    const trustRoot = KeyPair.generate(rng);
    const serverKey = KeyPair.generate(rng);
    const senderIdentity = IdentityKeyPair.generate(rng);

    // Create a real server certificate for the resolver
    const serverCert = ServerCertificate.create(42, serverKey.publicKey, trustRoot.privateKey);

    // Build a SenderCertificate inner that uses field 8 (known cert ID) instead of field 6
    const serializedIdentityKey = new Uint8Array(33);
    serializedIdentityKey[0] = 0x05;
    serializedIdentityKey.set(senderIdentity.identityKey.publicKey, 1);

    const certInner = concatProtoFields(
      encodeBytesField(1, new TextEncoder().encode("test-uuid")),
      encodeUint32Field(3, 1),
      encodeUint64Field(4, Date.now() + 86400000),
      encodeBytesField(5, serializedIdentityKey),
      encodeUint32Field(8, 42), // known_server_certificate_id instead of field 6
    );

    // We need to sign this, but the resolver handles the cert lookup
    // For testing deserialization, we just need the structure
    const outerData = concatProtoFields(
      encodeBytesField(1, certInner),
      encodeBytesField(2, randomBytes(64)), // dummy signature
    );

    const resolver = (id: number): ServerCertificate => {
      if (id === 42) return serverCert;
      throw new Error(`Unknown cert ID: ${id}`);
    };

    const cert = SenderCertificate.deserialize(outerData, resolver);
    expect(cert.senderUuid).toBe("test-uuid");
    expect(cert.senderDeviceId).toBe(1);
    expect(cert.knownServerCertificateId).toBe(42);
    expect(cert.serverCertificate.keyId).toBe(42);
  });

  it("deserializes sender_uuid_bytes (field 7) as alternative UUID format", () => {
    const trustRoot = KeyPair.generate(rng);
    const serverKey = KeyPair.generate(rng);
    const senderIdentity = IdentityKeyPair.generate(rng);

    const serverCert = ServerCertificate.create(1, serverKey.publicKey, trustRoot.privateKey);

    const serializedIdentityKey = new Uint8Array(33);
    serializedIdentityKey[0] = 0x05;
    serializedIdentityKey.set(senderIdentity.identityKey.publicKey, 1);

    // UUID "550e8400-e29b-41d4-a716-446655440000" as raw 16 bytes
    const uuidBytes = new Uint8Array([
      0x55, 0x0e, 0x84, 0x00, 0xe2, 0x9b, 0x41, 0xd4, 0xa7, 0x16, 0x44, 0x66, 0x55, 0x44, 0x00,
      0x00,
    ]);

    const certInner = concatProtoFields(
      // No field 1 (string UUID) -- use field 7 (bytes UUID) instead
      encodeUint32Field(3, 2),
      encodeUint64Field(4, Date.now() + 86400000),
      encodeBytesField(5, serializedIdentityKey),
      encodeBytesField(6, serverCert.serialized),
      encodeBytesField(7, uuidBytes), // sender_uuid_bytes
    );

    const outerData = concatProtoFields(
      encodeBytesField(1, certInner),
      encodeBytesField(2, randomBytes(64)), // dummy signature
    );

    const cert = SenderCertificate.deserialize(outerData);
    expect(cert.senderUuid).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(cert.senderDeviceId).toBe(2);
  });

  it("prefers string UUID (field 1) over bytes UUID (field 7) when both present", () => {
    const trustRoot = KeyPair.generate(rng);
    const serverKey = KeyPair.generate(rng);
    const senderIdentity = IdentityKeyPair.generate(rng);

    const serverCert = ServerCertificate.create(1, serverKey.publicKey, trustRoot.privateKey);

    const serializedIdentityKey = new Uint8Array(33);
    serializedIdentityKey[0] = 0x05;
    serializedIdentityKey.set(senderIdentity.identityKey.publicKey, 1);

    const certInner = concatProtoFields(
      encodeBytesField(1, new TextEncoder().encode("preferred-uuid")),
      encodeUint32Field(3, 1),
      encodeUint64Field(4, Date.now() + 86400000),
      encodeBytesField(5, serializedIdentityKey),
      encodeBytesField(6, serverCert.serialized),
      encodeBytesField(7, randomBytes(16)), // also has bytes UUID
    );

    const outerData = concatProtoFields(
      encodeBytesField(1, certInner),
      encodeBytesField(2, randomBytes(64)),
    );

    const cert = SenderCertificate.deserialize(outerData);
    expect(cert.senderUuid).toBe("preferred-uuid");
  });

  it("throws when known_server_certificate_id used without resolver", () => {
    const senderIdentity = IdentityKeyPair.generate(rng);

    const serializedIdentityKey = new Uint8Array(33);
    serializedIdentityKey[0] = 0x05;
    serializedIdentityKey.set(senderIdentity.identityKey.publicKey, 1);

    const certInner = concatProtoFields(
      encodeBytesField(1, new TextEncoder().encode("test")),
      encodeUint32Field(3, 1),
      encodeUint64Field(4, Date.now() + 86400000),
      encodeBytesField(5, serializedIdentityKey),
      encodeUint32Field(8, 99), // known cert ID, no resolver
    );

    const outerData = concatProtoFields(
      encodeBytesField(1, certInner),
      encodeBytesField(2, randomBytes(64)),
    );

    expect(() => SenderCertificate.deserialize(outerData)).toThrow(/no resolver provided/);
  });
});

describe("WS-7: Field number verification against libsignal proto definitions", () => {
  it("SessionStructure field numbers match storage.proto", () => {
    const proto: SessionStructureProto = {
      sessionVersion: 4, // field 1
      localIdentityPublic: randomBytes(33), // field 2
      remoteIdentityPublic: randomBytes(33), // field 3
      rootKey: randomBytes(32), // field 4
      previousCounter: 10, // field 5
      senderChain: {
        // field 6
        senderRatchetKey: randomBytes(33),
        chainKey: { index: 0, key: randomBytes(32) },
      },
      receiverChains: [
        {
          // field 7
          senderRatchetKey: randomBytes(33),
          chainKey: { index: 1, key: randomBytes(32) },
        },
      ],
      pendingPreKey: {
        // field 9
        preKeyId: 1,
        baseKey: randomBytes(33),
        signedPreKeyId: 2,
      },
      remoteRegistrationId: 100, // field 10
      localRegistrationId: 200, // field 11
      aliceBaseKey: randomBytes(33), // field 13
      pendingKyberPreKey: {
        // field 14
        kyberPreKeyId: 5,
        kyberCiphertext: randomBytes(32),
      },
      pqRatchetState: randomBytes(32), // field 15
    };

    const encoded = encodeSessionStructure(proto);
    const fields = parseProtoFields(encoded);

    // Verify each field is encoded at the correct field number
    expect(fields.varints.get(1)).toBe(4); // sessionVersion
    expect(fields.bytes.get(2)).toBeDefined(); // localIdentityPublic
    expect(fields.bytes.get(3)).toBeDefined(); // remoteIdentityPublic
    expect(fields.bytes.get(4)).toBeDefined(); // rootKey
    expect(fields.varints.get(5)).toBe(10); // previousCounter
    expect(fields.bytes.get(6)).toBeDefined(); // senderChain (nested)
    expect(fields.repeatedBytes.get(7)).toBeDefined(); // receiverChains
    // field 8 is reserved (was used, no longer)
    expect(fields.bytes.get(8)).toBeUndefined();
    expect(fields.bytes.get(9)).toBeDefined(); // pendingPreKey (nested)
    expect(fields.varints.get(10)).toBe(100); // remoteRegistrationId
    expect(fields.varints.get(11)).toBe(200); // localRegistrationId
    // field 12 is reserved
    expect(fields.bytes.get(13)).toBeDefined(); // aliceBaseKey
    expect(fields.bytes.get(14)).toBeDefined(); // pendingKyberPreKey (nested)
    expect(fields.bytes.get(15)).toBeDefined(); // pqRatchetState
  });

  it("SessionStructure decode restores correct field values", () => {
    const rootKey = randomBytes(32);
    const pqState = randomBytes(32);
    const proto: SessionStructureProto = {
      sessionVersion: 4,
      localIdentityPublic: randomBytes(33),
      rootKey,
      previousCounter: 99,
      remoteRegistrationId: 555,
      localRegistrationId: 666,
      aliceBaseKey: randomBytes(33),
      pqRatchetState: pqState,
    };

    const encoded = encodeSessionStructure(proto);
    const decoded = decodeSessionStructure(encoded);

    expect(decoded.sessionVersion).toBe(4);
    expect(decoded.rootKey).toEqual(rootKey);
    expect(decoded.previousCounter).toBe(99);
    expect(decoded.remoteRegistrationId).toBe(555);
    expect(decoded.localRegistrationId).toBe(666);
    expect(decoded.pqRatchetState).toEqual(pqState);
  });

  it("MessageKey field numbers match storage.proto (1=index, 2=cipher, 3=mac, 4=iv, 5=seed)", () => {
    const seed = randomBytes(32);
    const mk: MessageKeyProto = { index: 42, seed };
    const encoded = encodeMessageKey(mk);
    const fields = parseProtoFields(encoded);

    expect(fields.varints.get(1)).toBe(42); // index at field 1
    expect(fields.bytes.get(5)).toEqual(seed); // seed at field 5
  });
});
