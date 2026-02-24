/**
 * Interoperability Tests (WS-9 Tasks 9.5-9.10)
 *
 * Validates wire-format interoperability with libsignal through:
 *   1. Known test vectors (bytes from the libsignal reference implementation)
 *   2. Round-trip validation (serialize -> deserialize -> re-use)
 *   3. Cross-implementation contract tests (field numbers, wire types, sizes)
 *
 * These tests do NOT require the native @signalapp/libsignal-client bindings.
 * Instead they verify structural correctness of all wire-format outputs against
 * the canonical protobuf schemas in libsignal.
 */

import { describe, it, expect } from "vitest";
import { IdentityKeyPair, IdentityKey } from "../src/keys/identity-key.js";
import { PreKeyRecord, SignedPreKeyRecord } from "../src/keys/pre-key.js";
import { PreKeyBundle } from "../src/keys/pre-key-bundle.js";
import { KyberPreKeyRecord } from "../src/kem/kyber-pre-key.js";
import { ProtocolAddress } from "../src/storage/interfaces.js";
import { InMemorySignalProtocolStore } from "../src/storage/in-memory-store.js";
import { processPreKeyBundle } from "../src/x3dh/process-prekey-bundle.js";
import { messageEncrypt, messageDecrypt } from "../src/session/session-cipher.js";
import { PreKeySignalMessage } from "../src/protocol/pre-key-signal-message.js";
import { SignalMessage } from "../src/protocol/signal-message.js";
import { SenderKeyMessage } from "../src/protocol/sender-key-message.js";
import { SenderKeyDistributionMessage } from "../src/protocol/sender-key-distribution-message.js";
import { SessionRecord } from "../src/session/session-record.js";
import { KeyPair } from "../src/keys/key-pair.js";
import {
  Fingerprint,
  ScannableFingerprint,
} from "../src/fingerprint/fingerprint.js";
import { ServerCertificate } from "../src/sealed-sender/server-certificate.js";
import { SenderCertificate } from "../src/sealed-sender/sender-certificate.js";
import {
  ContentHint,
  UnidentifiedSenderMessageContent,
  sealedSenderEncrypt,
  sealedSenderEncryptV2,
  sealedSenderDecrypt,
  sealedSenderDecryptToUsmc,
  sealedSenderMultiRecipientEncrypt,
  SealedSenderMultiRecipientMessage,
  serviceIdFromUuid,
} from "../src/sealed-sender/sealed-sender.js";
import { CiphertextMessageType } from "../src/protocol/ciphertext-message.js";
import {
  groupEncrypt,
  groupDecrypt,
  createSenderKeyDistributionMessage,
  processSenderKeyDistributionMessage,
} from "../src/group/group-cipher.js";
import {
  parseProtoFields,
  decodeSessionStructure,
  decodeRecordStructure,
} from "../src/protocol/proto.js";
import {
  MAC_LENGTH,
  CIPHERTEXT_MESSAGE_CURRENT_VERSION,
  CIPHERTEXT_MESSAGE_PRE_KYBER_VERSION,
  SENDERKEY_MESSAGE_CURRENT_VERSION,
  KYBER1024_CIPHERTEXT_SIZE,
  KemType,
  KEM_TYPE_PREFIX_SIZE,
} from "../src/index.js";
import { createTestRng } from "./test-utils.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function generateUUID(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Read a varint from raw bytes at a given offset. Returns [value, newOffset].
 */
function readVarint(
  data: Uint8Array,
  offset: number,
): [number, number] {
  let result = 0;
  let shift = 0;
  let pos = offset;
  while (pos < data.length) {
    const byte = data[pos];
    result |= (byte & 0x7f) << shift;
    pos++;
    if ((byte & 0x80) === 0) return [result >>> 0, pos];
    shift += 7;
    if (shift > 35) throw new Error("Varint too long");
  }
  throw new Error("Unexpected end of varint");
}

/**
 * Parse raw protobuf fields into an ordered list of {field, wireType, value}.
 */
interface RawField {
  field: number;
  wireType: number;
  value: number | Uint8Array;
}

function parseRawFields(data: Uint8Array): RawField[] {
  const fields: RawField[] = [];
  let offset = 0;
  while (offset < data.length) {
    const [tag, tagEnd] = readVarint(data, offset);
    offset = tagEnd;
    const fieldNumber = tag >>> 3;
    const wireType = tag & 0x7;
    if (wireType === 0) {
      const [value, newOffset] = readVarint(data, offset);
      offset = newOffset;
      fields.push({ field: fieldNumber, wireType, value });
    } else if (wireType === 2) {
      const [len, lenOffset] = readVarint(data, offset);
      offset = lenOffset;
      fields.push({
        field: fieldNumber,
        wireType,
        value: data.slice(offset, offset + len),
      });
      offset += len;
    } else if (wireType === 1) {
      fields.push({
        field: fieldNumber,
        wireType,
        value: data.slice(offset, offset + 8),
      });
      offset += 8;
    } else if (wireType === 5) {
      fields.push({
        field: fieldNumber,
        wireType,
        value: data.slice(offset, offset + 4),
      });
      offset += 4;
    } else {
      throw new Error(`Unknown wire type ${wireType}`);
    }
  }
  return fields;
}

function setupV4AliceAndBob(rng: ReturnType<typeof createTestRng>) {
  const aliceIdentity = IdentityKeyPair.generate(rng);
  const bobIdentity = IdentityKeyPair.generate(rng);

  const aliceStore = new InMemorySignalProtocolStore(aliceIdentity, 1);
  const bobStore = new InMemorySignalProtocolStore(bobIdentity, 2);

  const bobAddress = new ProtocolAddress("bob", 1);
  const aliceAddress = new ProtocolAddress("alice", 1);

  const bobPreKey = PreKeyRecord.generate(1, rng);
  const bobSignedPreKey = SignedPreKeyRecord.generate(
    1,
    bobIdentity,
    Date.now(),
    rng,
  );
  const bobKyberPreKey = KyberPreKeyRecord.generate(
    1,
    bobIdentity,
    Date.now(),
  );

  bobStore.storePreKey(bobPreKey.id, bobPreKey);
  bobStore.storeSignedPreKey(bobSignedPreKey.id, bobSignedPreKey);
  bobStore.storeKyberPreKey(bobKyberPreKey.id, bobKyberPreKey);

  const bobBundle = new PreKeyBundle({
    registrationId: 2,
    deviceId: 1,
    preKeyId: bobPreKey.id,
    preKey: bobPreKey.keyPair.publicKey,
    signedPreKeyId: bobSignedPreKey.id,
    signedPreKey: bobSignedPreKey.keyPair.publicKey,
    signedPreKeySignature: bobSignedPreKey.signature,
    identityKey: bobIdentity.identityKey,
    kyberPreKeyId: bobKyberPreKey.id,
    kyberPreKey: bobKyberPreKey.keyPair.publicKey,
    kyberPreKeySignature: bobKyberPreKey.signature,
  });

  return {
    aliceIdentity,
    bobIdentity,
    aliceStore,
    bobStore,
    aliceAddress,
    bobAddress,
    bobBundle,
    rng,
  };
}

// ===========================================================================
// Test Group 1: Session Establishment Interop (Task 9.5)
// ===========================================================================

describe("Session Establishment Interop (Task 9.5)", () => {
  it("should establish a v4 session and verify PreKeySignalMessage wire format", async () => {
    const rng = createTestRng();
    const { aliceStore, bobStore, aliceAddress, bobAddress, bobBundle } =
      setupV4AliceAndBob(rng);

    await processPreKeyBundle(
      bobBundle,
      bobAddress,
      aliceStore,
      aliceStore,
      rng,
    );

    const plaintext = new TextEncoder().encode("Hello Bob from Alice!");
    const encrypted = await messageEncrypt(
      plaintext,
      bobAddress,
      aliceStore,
      aliceStore,
    );

    // First message must be PreKeySignalMessage
    expect(encrypted).toBeInstanceOf(PreKeySignalMessage);
    const preKeyMsg = encrypted as PreKeySignalMessage;

    // Version byte: high nibble = message version, low nibble = CURRENT_VERSION
    const versionByte = preKeyMsg.serialized[0];
    const highNibble = versionByte >> 4;
    const lowNibble = versionByte & 0x0f;
    expect(highNibble).toBe(4); // v4 for PQXDH
    expect(lowNibble).toBe(CIPHERTEXT_MESSAGE_CURRENT_VERSION);

    // Parse inner protobuf (after version byte) to verify field numbers
    const protoBytes = preKeyMsg.serialized.slice(1);
    const fields = parseRawFields(protoBytes);
    const fieldNumbers = fields.map((f) => f.field);

    // PreKeySignalMessage proto fields per wire.proto:
    //   1=preKeyId, 2=baseKey, 3=identityKey, 4=message,
    //   5=registrationId, 6=signedPreKeyId, 7=kyberPreKeyId, 8=kyberCiphertext
    expect(fieldNumbers).toContain(2); // baseKey
    expect(fieldNumbers).toContain(3); // identityKey
    expect(fieldNumbers).toContain(4); // message (embedded SignalMessage)
    expect(fieldNumbers).toContain(5); // registrationId
    expect(fieldNumbers).toContain(6); // signedPreKeyId
    expect(fieldNumbers).toContain(7); // kyberPreKeyId
    expect(fieldNumbers).toContain(8); // kyberCiphertext

    // Verify all fields use correct wire types
    for (const f of fields) {
      if ([1, 5, 6, 7].includes(f.field)) {
        expect(f.wireType).toBe(0); // varint
      }
      if ([2, 3, 4, 8].includes(f.field)) {
        expect(f.wireType).toBe(2); // length-delimited
      }
    }

    // Bob decrypts successfully
    const decrypted = await messageDecrypt(
      encrypted,
      aliceAddress,
      bobStore,
      bobStore,
      bobStore,
      bobStore,
      rng,
      bobStore,
    );
    expect(new TextDecoder().decode(decrypted)).toBe("Hello Bob from Alice!");
  });

  it("should verify SignalMessage wire format properties", async () => {
    const rng = createTestRng();
    const { aliceStore, bobStore, aliceAddress, bobAddress, bobBundle } =
      setupV4AliceAndBob(rng);

    await processPreKeyBundle(
      bobBundle,
      bobAddress,
      aliceStore,
      aliceStore,
      rng,
    );

    // First message (PreKey)
    const first = new TextEncoder().encode("First");
    const firstEnc = await messageEncrypt(
      first,
      bobAddress,
      aliceStore,
      aliceStore,
    );
    await messageDecrypt(
      firstEnc,
      aliceAddress,
      bobStore,
      bobStore,
      bobStore,
      bobStore,
      rng,
      bobStore,
    );

    // Bob sends a regular SignalMessage
    const reply = new TextEncoder().encode("Reply");
    const replyEnc = await messageEncrypt(
      reply,
      aliceAddress,
      bobStore,
      bobStore,
    );
    expect(replyEnc).toBeInstanceOf(SignalMessage);
    const signalMsg = replyEnc as SignalMessage;

    // Version byte: 0x44 for v4 (high=4, low=4)
    const versionByte = signalMsg.serialized[0];
    expect(versionByte >> 4).toBe(4);
    expect(versionByte & 0x0f).toBe(CIPHERTEXT_MESSAGE_CURRENT_VERSION);

    // MAC tag is last 8 bytes
    expect(MAC_LENGTH).toBe(8);
    const macBytes = signalMsg.serialized.slice(
      signalMsg.serialized.length - MAC_LENGTH,
    );
    expect(macBytes.length).toBe(8);

    // Parse the protobuf body (between version byte and MAC)
    const protoBody = signalMsg.serialized.slice(
      1,
      signalMsg.serialized.length - MAC_LENGTH,
    );
    const fields = parseRawFields(protoBody);
    const fieldNumbers = fields.map((f) => f.field);

    // SignalMessage proto: 1=ratchetKey, 2=counter, 3=previousCounter, 4=ciphertext
    expect(fieldNumbers).toContain(1); // ratchetKey
    expect(fieldNumbers).toContain(2); // counter
    expect(fieldNumbers).toContain(4); // ciphertext

    // Ratchet key should be 33 bytes (0x05 prefix + 32-byte Curve25519)
    const ratchetKeyField = fields.find((f) => f.field === 1);
    expect(ratchetKeyField).toBeDefined();
    expect(ratchetKeyField!.wireType).toBe(2); // length-delimited
    const ratchetKeyBytes = ratchetKeyField!.value as Uint8Array;
    expect(ratchetKeyBytes.length).toBe(33);
    expect(ratchetKeyBytes[0]).toBe(0x05); // DJB key type prefix

    // Counter should be varint (wire type 0)
    const counterField = fields.find((f) => f.field === 2);
    expect(counterField).toBeDefined();
    expect(counterField!.wireType).toBe(0);
  });

  it("should exchange 10 messages each direction with correct counters", async () => {
    const rng = createTestRng();
    const { aliceStore, bobStore, aliceAddress, bobAddress, bobBundle } =
      setupV4AliceAndBob(rng);

    await processPreKeyBundle(
      bobBundle,
      bobAddress,
      aliceStore,
      aliceStore,
      rng,
    );

    // Alice sends first (PreKeySignalMessage), Bob responds to establish session
    const first = new TextEncoder().encode("Init");
    const firstEnc = await messageEncrypt(
      first,
      bobAddress,
      aliceStore,
      aliceStore,
    );
    expect(firstEnc).toBeInstanceOf(PreKeySignalMessage);
    await messageDecrypt(
      firstEnc,
      aliceAddress,
      bobStore,
      bobStore,
      bobStore,
      bobStore,
      rng,
      bobStore,
    );

    // Bob responds to complete the handshake
    const resp = new TextEncoder().encode("Ack");
    const respEnc = await messageEncrypt(
      resp,
      aliceAddress,
      bobStore,
      bobStore,
    );
    expect(respEnc).toBeInstanceOf(SignalMessage);
    await messageDecrypt(
      respEnc,
      bobAddress,
      aliceStore,
      aliceStore,
      aliceStore,
      aliceStore,
      rng,
    );

    // Alice sends 10 messages in the same chain
    const aliceCounters: number[] = [];
    for (let i = 0; i < 10; i++) {
      const pt = new TextEncoder().encode(`Alice msg ${i}`);
      const enc = await messageEncrypt(pt, bobAddress, aliceStore, aliceStore);
      expect(enc).toBeInstanceOf(SignalMessage);
      const sm = enc as SignalMessage;
      aliceCounters.push(sm.counter);

      const dec = await messageDecrypt(
        enc,
        aliceAddress,
        bobStore,
        bobStore,
        bobStore,
        bobStore,
        rng,
      );
      expect(new TextDecoder().decode(dec)).toBe(`Alice msg ${i}`);
    }

    // Counters should increment
    for (let i = 1; i < aliceCounters.length; i++) {
      expect(aliceCounters[i]).toBe(aliceCounters[i - 1] + 1);
    }

    // Bob sends 10 messages in the same chain
    const bobCounters: number[] = [];
    for (let i = 0; i < 10; i++) {
      const pt = new TextEncoder().encode(`Bob msg ${i}`);
      const enc = await messageEncrypt(pt, aliceAddress, bobStore, bobStore);
      expect(enc).toBeInstanceOf(SignalMessage);
      const sm = enc as SignalMessage;
      bobCounters.push(sm.counter);

      const dec = await messageDecrypt(
        enc,
        bobAddress,
        aliceStore,
        aliceStore,
        aliceStore,
        aliceStore,
        rng,
      );
      expect(new TextDecoder().decode(dec)).toBe(`Bob msg ${i}`);
    }

    for (let i = 1; i < bobCounters.length; i++) {
      expect(bobCounters[i]).toBe(bobCounters[i - 1] + 1);
    }
  });

  it("should serialize/deserialize session and continue messaging", async () => {
    const rng = createTestRng();
    const { aliceStore, bobStore, aliceAddress, bobAddress, bobBundle } =
      setupV4AliceAndBob(rng);

    await processPreKeyBundle(
      bobBundle,
      bobAddress,
      aliceStore,
      aliceStore,
      rng,
    );

    // Exchange initial messages
    const init = new TextEncoder().encode("Before serialize");
    const initEnc = await messageEncrypt(
      init,
      bobAddress,
      aliceStore,
      aliceStore,
    );
    await messageDecrypt(
      initEnc,
      aliceAddress,
      bobStore,
      bobStore,
      bobStore,
      bobStore,
      rng,
      bobStore,
    );

    const reply = new TextEncoder().encode("Reply before serialize");
    const replyEnc = await messageEncrypt(
      reply,
      aliceAddress,
      bobStore,
      bobStore,
    );
    await messageDecrypt(
      replyEnc,
      bobAddress,
      aliceStore,
      aliceStore,
      aliceStore,
      aliceStore,
      rng,
    );

    // Serialize Alice's session
    const aliceRecord = await aliceStore.loadSession(bobAddress);
    expect(aliceRecord).toBeDefined();
    const serialized = aliceRecord!.serialize();

    // Deserialize and re-store
    const restored = SessionRecord.deserialize(serialized);

    // Create a new store with restored session
    const aliceIdKp = await aliceStore.getIdentityKeyPair();
    const aliceStore2 = new InMemorySignalProtocolStore(aliceIdKp, 1);
    await aliceStore2.storeSession(bobAddress, restored);
    // Also copy identity for Bob
    await aliceStore2.saveIdentity(
      bobAddress,
      (await aliceStore.getIdentity(bobAddress))!,
    );

    // Continue messaging with restored session
    const afterMsg = new TextEncoder().encode("After serialize");
    const afterEnc = await messageEncrypt(
      afterMsg,
      bobAddress,
      aliceStore2,
      aliceStore2,
    );
    expect(afterEnc).toBeInstanceOf(SignalMessage);

    const afterDec = await messageDecrypt(
      afterEnc,
      aliceAddress,
      bobStore,
      bobStore,
      bobStore,
      bobStore,
      rng,
    );
    expect(new TextDecoder().decode(afterDec)).toBe("After serialize");
  });
});

// ===========================================================================
// Test Group 2: Group Message Interop (Task 9.6)
// ===========================================================================

describe("Group Message Interop (Task 9.6)", () => {
  it("should verify SenderKeyDistributionMessage wire format", async () => {
    const rng = createTestRng();
    const aliceId = IdentityKeyPair.generate(rng);
    const aliceStore = new InMemorySignalProtocolStore(aliceId, 1);
    const aliceAddress = new ProtocolAddress("alice", 1);
    const distributionId = generateUUID();

    const skdm = await createSenderKeyDistributionMessage(
      aliceStore,
      aliceAddress,
      distributionId,
    );

    // Version byte
    const versionByte = skdm.serialized[0];
    const messageVersion = versionByte >> 4;
    expect(messageVersion).toBe(SENDERKEY_MESSAGE_CURRENT_VERSION);

    // Parse protobuf body (after version byte)
    const protoBody = skdm.serialized.slice(1);
    const fields = parseRawFields(protoBody);
    const fieldNumbers = fields.map((f) => f.field);

    // SKDM fields: 1=distributionId, 2=chainId, 3=iteration, 4=chainKey, 5=signingKey
    expect(fieldNumbers).toContain(1); // distributionId
    expect(fieldNumbers).toContain(2); // chainId
    expect(fieldNumbers).toContain(3); // iteration
    expect(fieldNumbers).toContain(4); // chainKey
    expect(fieldNumbers).toContain(5); // signingKey

    // Verify distributionId is 16 bytes (UUID)
    const distIdField = fields.find((f) => f.field === 1);
    expect(distIdField).toBeDefined();
    expect((distIdField!.value as Uint8Array).length).toBe(16);

    // chainKey is 32 bytes
    const chainKeyField = fields.find((f) => f.field === 4);
    expect(chainKeyField).toBeDefined();
    expect((chainKeyField!.value as Uint8Array).length).toBe(32);

    // signingKey is 33 bytes (0x05 prefix + 32-byte Ed25519 public key)
    const signingKeyField = fields.find((f) => f.field === 5);
    expect(signingKeyField).toBeDefined();
    const signingKeyBytes = signingKeyField!.value as Uint8Array;
    expect(signingKeyBytes.length).toBe(33);
    expect(signingKeyBytes[0]).toBe(0x05);

    // chainId must be 31-bit positive (< 2^31)
    expect(skdm.chainId).toBeGreaterThanOrEqual(0);
    expect(skdm.chainId).toBeLessThan(0x80000000);

    // iteration starts at 0
    expect(skdm.iteration).toBe(0);
  });

  it("should verify SenderKeyMessage wire format", async () => {
    const rng = createTestRng();
    const aliceId = IdentityKeyPair.generate(rng);
    const bobId = IdentityKeyPair.generate(rng);
    const aliceStore = new InMemorySignalProtocolStore(aliceId, 1);
    const bobStore = new InMemorySignalProtocolStore(bobId, 2);
    const aliceAddress = new ProtocolAddress("alice", 1);
    const distributionId = generateUUID();

    const skdm = await createSenderKeyDistributionMessage(
      aliceStore,
      aliceAddress,
      distributionId,
    );
    await processSenderKeyDistributionMessage(
      aliceAddress,
      distributionId,
      skdm,
      bobStore,
    );

    const plaintext = new TextEncoder().encode("Group message");
    const skm = await groupEncrypt(
      aliceStore,
      aliceAddress,
      distributionId,
      plaintext,
    );

    // Version byte
    const versionByte = skm.serialized[0];
    expect(versionByte >> 4).toBe(SENDERKEY_MESSAGE_CURRENT_VERSION);

    // Last 64 bytes are Ed25519 signature
    const signature = skm.serialized.slice(skm.serialized.length - 64);
    expect(signature.length).toBe(64);

    // Parse protobuf (between version byte and signature)
    const protoBody = skm.serialized.slice(1, skm.serialized.length - 64);
    const fields = parseRawFields(protoBody);
    const fieldNumbers = fields.map((f) => f.field);

    // SenderKeyMessage fields: 1=distributionId, 2=chainId, 3=iteration, 4=ciphertext
    expect(fieldNumbers).toContain(1); // distributionId
    expect(fieldNumbers).toContain(2); // chainId
    expect(fieldNumbers).toContain(3); // iteration
    expect(fieldNumbers).toContain(4); // ciphertext

    // distributionId is 16 bytes (UUID)
    const distIdField = fields.find((f) => f.field === 1);
    expect((distIdField!.value as Uint8Array).length).toBe(16);

    // chainId is 31-bit positive
    expect(skm.chainId).toBeGreaterThanOrEqual(0);
    expect(skm.chainId).toBeLessThan(0x80000000);

    // Bob can decrypt
    const decrypted = await groupDecrypt(
      skm.serialized,
      bobStore,
      aliceAddress,
    );
    expect(decrypted).toEqual(plaintext);
  });

  it("should distribute to multiple recipients and round-trip", async () => {
    const rng = createTestRng();
    const aliceId = IdentityKeyPair.generate(rng);
    const bobId = IdentityKeyPair.generate(rng);
    const carolId = IdentityKeyPair.generate(rng);

    const aliceStore = new InMemorySignalProtocolStore(aliceId, 1);
    const bobStore = new InMemorySignalProtocolStore(bobId, 2);
    const carolStore = new InMemorySignalProtocolStore(carolId, 3);

    const aliceAddress = new ProtocolAddress("alice", 1);
    const distributionId = generateUUID();

    const skdm = await createSenderKeyDistributionMessage(
      aliceStore,
      aliceAddress,
      distributionId,
    );

    // Distribute to both Bob and Carol
    await processSenderKeyDistributionMessage(
      aliceAddress,
      distributionId,
      skdm,
      bobStore,
    );
    await processSenderKeyDistributionMessage(
      aliceAddress,
      distributionId,
      skdm,
      carolStore,
    );

    // Encrypt multiple messages
    for (let i = 0; i < 5; i++) {
      const pt = new TextEncoder().encode(`Group msg ${i}`);
      const skm = await groupEncrypt(
        aliceStore,
        aliceAddress,
        distributionId,
        pt,
      );

      // Both can decrypt
      const bobDec = await groupDecrypt(
        skm.serialized,
        bobStore,
        aliceAddress,
      );
      expect(bobDec).toEqual(pt);

      const carolDec = await groupDecrypt(
        skm.serialized,
        carolStore,
        aliceAddress,
      );
      expect(carolDec).toEqual(pt);

      // Iteration should increment
      expect(skm.iteration).toBe(i);
    }
  });

  it("should round-trip SenderKeyDistributionMessage through serialization", async () => {
    const rng = createTestRng();
    const aliceId = IdentityKeyPair.generate(rng);
    const aliceStore = new InMemorySignalProtocolStore(aliceId, 1);
    const aliceAddress = new ProtocolAddress("alice", 1);
    const distributionId = generateUUID();

    const original = await createSenderKeyDistributionMessage(
      aliceStore,
      aliceAddress,
      distributionId,
    );

    // Serialize and deserialize
    const deserialized = SenderKeyDistributionMessage.deserialize(
      original.serialized,
    );

    expect(deserialized.messageVersion).toBe(original.messageVersion);
    expect(deserialized.chainId).toBe(original.chainId);
    expect(deserialized.iteration).toBe(original.iteration);
    expect(deserialized.chainKey).toEqual(original.chainKey);
    // Signing key after round-trip (strip 0x05 prefix in deserialization)
    expect(deserialized.signingKey.length).toBe(32);
    expect(deserialized.signingKey).toEqual(original.signingKey);
    expect(deserialized.distributionId).toEqual(original.distributionId);
  });
});

// ===========================================================================
// Test Group 3: Sealed Sender Interop (Task 9.7)
// ===========================================================================

describe("Sealed Sender Interop (Task 9.7)", () => {
  function createCerts(rng: ReturnType<typeof createTestRng>) {
    const trustRoot = KeyPair.generate(rng);
    const serverKey = KeyPair.generate(rng);
    const senderIdentity = IdentityKeyPair.generate(rng);
    const recipientIdentity = IdentityKeyPair.generate(rng);

    const serverCert = ServerCertificate.create(
      1,
      serverKey.publicKey,
      trustRoot.privateKey,
    );
    const senderCert = SenderCertificate.create(
      "sender-uuid",
      1,
      Date.now() + 86400000,
      senderIdentity.identityKey.publicKey,
      serverCert,
      serverKey.privateKey,
    );

    return { trustRoot, senderIdentity, recipientIdentity, senderCert };
  }

  it("V1: should encrypt/decrypt and verify version byte 0x11", () => {
    const rng = createTestRng();
    const { trustRoot, senderIdentity, recipientIdentity, senderCert } =
      createCerts(rng);
    const message = new TextEncoder().encode("V1 sealed sender");

    const sealed = sealedSenderEncrypt(
      senderIdentity,
      recipientIdentity.identityKey.publicKey,
      senderCert,
      message,
      rng,
    );

    // Version byte is 0x11 for V1
    expect(sealed[0]).toBe(0x11);

    // Verify the rest is protobuf-parseable (length-delimited fields)
    const protoBody = sealed.slice(1);
    const fields = parseRawFields(protoBody);
    const fieldNumbers = fields.map((f) => f.field);

    // V1 sealed sender protobuf: field 1 (ephemeral public), 2 (iv), 3 (ciphertext)
    expect(fieldNumbers).toContain(1);
    expect(fieldNumbers).toContain(2);
    expect(fieldNumbers).toContain(3);

    // All V1 fields should be length-delimited (wire type 2)
    for (const f of fields) {
      expect(f.wireType).toBe(2);
    }

    const result = sealedSenderDecrypt(
      sealed,
      recipientIdentity,
      trustRoot.publicKey,
      Date.now(),
    );
    expect(result.senderUuid).toBe("sender-uuid");
    expect(result.paddedMessage).toEqual(message);
  });

  it("V2: should encrypt/decrypt and verify version byte 0x22", () => {
    const rng = createTestRng();
    const { trustRoot, senderIdentity, recipientIdentity, senderCert } =
      createCerts(rng);
    const content = new TextEncoder().encode("V2 sealed sender");

    const usmc = new UnidentifiedSenderMessageContent(
      CiphertextMessageType.Whisper,
      senderCert,
      content,
      ContentHint.Default,
    );

    const sealed = sealedSenderEncryptV2(
      usmc,
      recipientIdentity.identityKey.publicKey,
      senderIdentity,
      rng,
    );

    // Version byte is 0x22 for V2
    expect(sealed[0]).toBe(0x22);

    // V2 is flat binary (NOT protobuf) after the version byte
    // It should be: version(1) + ephemeral_pub(32) + encrypted_static(48) + encrypted_message(var)
    // Minimum: 1 + 32 = 33 bytes (plus encrypted parts)
    expect(sealed.length).toBeGreaterThan(33);

    const result = sealedSenderDecrypt(
      sealed,
      recipientIdentity,
      trustRoot.publicKey,
      Date.now(),
    );
    expect(result.senderUuid).toBe("sender-uuid");
    expect(result.paddedMessage).toEqual(content);
  });

  it("V2 multi-recipient: should encrypt for 3 recipients with version byte 0x23", () => {
    const rng = createTestRng();
    const { trustRoot, senderIdentity, senderCert } = createCerts(rng);

    const r1 = IdentityKeyPair.generate(rng);
    const r2 = IdentityKeyPair.generate(rng);
    const r3 = IdentityKeyPair.generate(rng);

    const uuid1 = "aaaa1111-1111-1111-1111-111111111111";
    const uuid2 = "bbbb2222-2222-2222-2222-222222222222";
    const uuid3 = "cccc3333-3333-3333-3333-333333333333";

    const content = new TextEncoder().encode("Multi-recipient interop");

    const usmc = new UnidentifiedSenderMessageContent(
      CiphertextMessageType.Whisper,
      senderCert,
      content,
      ContentHint.Resendable,
    );

    const sentMessage = sealedSenderMultiRecipientEncrypt({
      usmc,
      recipients: [
        {
          serviceIdFixedWidthBinary: serviceIdFromUuid(uuid1),
          devices: [{ deviceId: 1, registrationId: 100 }],
          identityKey: r1.identityKey.publicKey,
        },
        {
          serviceIdFixedWidthBinary: serviceIdFromUuid(uuid2),
          devices: [{ deviceId: 1, registrationId: 200 }],
          identityKey: r2.identityKey.publicKey,
        },
        {
          serviceIdFixedWidthBinary: serviceIdFromUuid(uuid3),
          devices: [{ deviceId: 1, registrationId: 300 }],
          identityKey: r3.identityKey.publicKey,
        },
      ],
      senderIdentityKeyPair: senderIdentity,
      rng,
    });

    // Multi-recipient version byte is 0x23
    expect(sentMessage[0]).toBe(0x23);

    const parsed = SealedSenderMultiRecipientMessage.parse(sentMessage);
    expect(parsed.recipients.size).toBe(3);

    // Each recipient can decrypt their extracted message
    for (const [uuid, identity] of [
      [uuid1, r1],
      [uuid2, r2],
      [uuid3, r3],
    ] as const) {
      const recipientData = parsed.recipientsByServiceIdString().get(uuid);
      expect(recipientData).toBeDefined();

      const receivedMessage = parsed.messageForRecipient(recipientData!);
      // Extracted per-recipient message uses V2 format (0x22)
      expect(receivedMessage[0]).toBe(0x22);

      const result = sealedSenderDecrypt(
        receivedMessage,
        identity,
        trustRoot.publicKey,
        Date.now(),
      );
      expect(result.senderUuid).toBe("sender-uuid");
      expect(result.paddedMessage).toEqual(content);
      expect(result.contentHint).toBe(ContentHint.Resendable);
    }
  });

  it("V2: decryptToUsmc should extract USMC fields correctly", () => {
    const rng = createTestRng();
    const { senderIdentity, recipientIdentity, senderCert } = createCerts(rng);
    const content = new TextEncoder().encode("USMC extract test");
    const groupId = rng.randomData(32);

    const usmc = new UnidentifiedSenderMessageContent(
      CiphertextMessageType.SenderKey,
      senderCert,
      content,
      ContentHint.Implicit,
      groupId,
    );

    const sealed = sealedSenderEncryptV2(
      usmc,
      recipientIdentity.identityKey.publicKey,
      senderIdentity,
      rng,
    );

    const decryptedUsmc = sealedSenderDecryptToUsmc(sealed, recipientIdentity);
    expect(decryptedUsmc.msgType).toBe(CiphertextMessageType.SenderKey);
    expect(decryptedUsmc.content).toEqual(content);
    expect(decryptedUsmc.contentHint).toBe(ContentHint.Implicit);
    expect(decryptedUsmc.groupId).toEqual(groupId);
    expect(decryptedUsmc.senderCertificate.senderUuid).toBe("sender-uuid");
  });
});

// ===========================================================================
// Test Group 4: Session Serialization Interop (Task 9.8)
// ===========================================================================

describe("Session Serialization Interop (Task 9.8)", () => {
  it("should verify SessionStructure protobuf field numbers match libsignal storage.proto", async () => {
    const rng = createTestRng();
    const { aliceStore, bobStore, aliceAddress, bobAddress, bobBundle } =
      setupV4AliceAndBob(rng);

    await processPreKeyBundle(
      bobBundle,
      bobAddress,
      aliceStore,
      aliceStore,
      rng,
    );

    // Alice sends, Bob decrypts to create session on both sides
    const pt = new TextEncoder().encode("Session serialization test");
    const enc = await messageEncrypt(pt, bobAddress, aliceStore, aliceStore);
    await messageDecrypt(
      enc,
      aliceAddress,
      bobStore,
      bobStore,
      bobStore,
      bobStore,
      rng,
      bobStore,
    );

    // Bob responds to complete the handshake
    const resp = new TextEncoder().encode("Response");
    const respEnc = await messageEncrypt(
      resp,
      aliceAddress,
      bobStore,
      bobStore,
    );
    await messageDecrypt(
      respEnc,
      bobAddress,
      aliceStore,
      aliceStore,
      aliceStore,
      aliceStore,
      rng,
    );

    // Serialize Alice's session
    const aliceSessionRecord = await aliceStore.loadSession(bobAddress);
    expect(aliceSessionRecord).toBeDefined();
    const aliceSessionBytes = aliceSessionRecord!.serialize();

    // Parse as RecordStructure
    const recordFields = parseProtoFields(aliceSessionBytes);

    // RecordStructure: 1=currentSession, 2=previousSessions
    expect(recordFields.bytes.has(1)).toBe(true); // currentSession

    // Parse the current session as SessionStructure
    const sessionBytes = recordFields.bytes.get(1)!;
    const sessionFields = parseProtoFields(sessionBytes);

    // SessionStructure field verification against storage.proto:
    //   1=sessionVersion, 2=localIdentityPublic, 3=remoteIdentityPublic,
    //   4=rootKey, 5=previousCounter, 6=senderChain, 7=receiverChains,
    //   9=pendingPreKey, 10=remoteRegistrationId, 11=localRegistrationId,
    //   13=aliceBaseKey, 14=pendingKyberPreKey, 15=pqRatchetState

    // session version must be 4
    expect(sessionFields.varints.get(1)).toBe(4);

    // local and remote identity public keys present
    expect(sessionFields.bytes.has(2)).toBe(true); // localIdentityPublic
    expect(sessionFields.bytes.has(3)).toBe(true); // remoteIdentityPublic

    // rootKey is 32 bytes
    expect(sessionFields.bytes.has(4)).toBe(true);
    expect(sessionFields.bytes.get(4)!.length).toBe(32);

    // senderChain present (field 6)
    expect(sessionFields.bytes.has(6)).toBe(true);

    // registration IDs present
    expect(sessionFields.varints.has(10)).toBe(true); // remoteRegistrationId
    expect(sessionFields.varints.has(11)).toBe(true); // localRegistrationId

    // Verify field values match expected registration IDs
    expect(sessionFields.varints.get(10)).toBe(2); // Bob's reg ID
    expect(sessionFields.varints.get(11)).toBe(1); // Alice's reg ID
  });

  it("should verify RecordStructure field numbers (1=current, 2=previous)", async () => {
    const rng = createTestRng();
    const { aliceStore, bobStore, aliceAddress, bobAddress, bobBundle } =
      setupV4AliceAndBob(rng);

    await processPreKeyBundle(
      bobBundle,
      bobAddress,
      aliceStore,
      aliceStore,
      rng,
    );

    const pt = new TextEncoder().encode("Record structure test");
    const enc = await messageEncrypt(pt, bobAddress, aliceStore, aliceStore);
    await messageDecrypt(
      enc,
      aliceAddress,
      bobStore,
      bobStore,
      bobStore,
      bobStore,
      rng,
      bobStore,
    );

    const sessionRecord = await aliceStore.loadSession(bobAddress);
    expect(sessionRecord).toBeDefined();
    const sessionBytes = sessionRecord!.serialize();

    // Parse at raw level
    const rawFields = parseRawFields(sessionBytes);

    // Should have field 1 (currentSession) with wire type 2 (length-delimited)
    const currentSessionField = rawFields.find((f) => f.field === 1);
    expect(currentSessionField).toBeDefined();
    expect(currentSessionField!.wireType).toBe(2);

    // Decode via our decoder
    const decoded = decodeRecordStructure(sessionBytes);
    expect(decoded.currentSession).toBeDefined();
    // previousSessions may or may not be present after first session
  });

  it("should deserialize session and continue messaging", async () => {
    const rng = createTestRng();
    const { aliceStore, bobStore, aliceAddress, bobAddress, bobBundle } =
      setupV4AliceAndBob(rng);

    await processPreKeyBundle(
      bobBundle,
      bobAddress,
      aliceStore,
      aliceStore,
      rng,
    );

    // Exchange messages to complete handshake
    const pt1 = new TextEncoder().encode("Before save");
    const enc1 = await messageEncrypt(pt1, bobAddress, aliceStore, aliceStore);
    await messageDecrypt(
      enc1,
      aliceAddress,
      bobStore,
      bobStore,
      bobStore,
      bobStore,
      rng,
      bobStore,
    );

    const resp1 = new TextEncoder().encode("Bob response");
    const respEnc1 = await messageEncrypt(
      resp1,
      aliceAddress,
      bobStore,
      bobStore,
    );
    await messageDecrypt(
      respEnc1,
      bobAddress,
      aliceStore,
      aliceStore,
      aliceStore,
      aliceStore,
      rng,
    );

    // Serialize Bob's session
    const bobSessionRecord = await bobStore.loadSession(aliceAddress);
    expect(bobSessionRecord).toBeDefined();
    const bobSessionBytes = bobSessionRecord!.serialize();

    // Decode to SessionStructure, verify fields, re-encode, and use
    const sessionProto = decodeSessionStructure(
      decodeRecordStructure(bobSessionBytes).currentSession!,
    );
    expect(sessionProto.sessionVersion).toBe(4);
    expect(sessionProto.rootKey).toBeDefined();
    expect(sessionProto.rootKey!.length).toBe(32);

    // Deserialize the full record and continue
    const restored = SessionRecord.deserialize(bobSessionBytes);

    // Create new store with restored session
    const bobIdKp = await bobStore.getIdentityKeyPair();
    const bobStore2 = new InMemorySignalProtocolStore(bobIdKp, 2);
    await bobStore2.storeSession(aliceAddress, restored);
    await bobStore2.saveIdentity(
      aliceAddress,
      (await bobStore.getIdentity(aliceAddress))!,
    );

    // Continue messaging with restored session
    const pt2 = new TextEncoder().encode("After restore");
    const enc2 = await messageEncrypt(
      pt2,
      aliceAddress,
      bobStore2,
      bobStore2,
    );
    expect(enc2).toBeInstanceOf(SignalMessage);

    const dec2 = await messageDecrypt(
      enc2,
      bobAddress,
      aliceStore,
      aliceStore,
      aliceStore,
      aliceStore,
      rng,
    );
    expect(new TextDecoder().decode(dec2)).toBe("After restore");
  });

  it("should verify chain structure fields in serialized session", async () => {
    const rng = createTestRng();
    const { aliceStore, bobStore, aliceAddress, bobAddress, bobBundle } =
      setupV4AliceAndBob(rng);

    await processPreKeyBundle(
      bobBundle,
      bobAddress,
      aliceStore,
      aliceStore,
      rng,
    );

    const pt = new TextEncoder().encode("Chain check");
    const enc = await messageEncrypt(pt, bobAddress, aliceStore, aliceStore);
    await messageDecrypt(
      enc,
      aliceAddress,
      bobStore,
      bobStore,
      bobStore,
      bobStore,
      rng,
      bobStore,
    );

    const bobSessionRecord = await bobStore.loadSession(aliceAddress);
    expect(bobSessionRecord).toBeDefined();
    const bobSessionBytes = bobSessionRecord!.serialize();
    const recordProto = decodeRecordStructure(bobSessionBytes);
    const sessionProto = decodeSessionStructure(recordProto.currentSession!);

    // After receiving a PreKeySignalMessage, Bob should have a sender chain
    expect(sessionProto.senderChain).toBeDefined();

    // Chain structure fields: 1=senderRatchetKey, 2=senderRatchetKeyPrivate, 3=chainKey
    const senderChain = sessionProto.senderChain!;
    expect(senderChain.senderRatchetKey).toBeDefined();
    expect(senderChain.senderRatchetKeyPrivate).toBeDefined();
    expect(senderChain.chainKey).toBeDefined();
    expect(senderChain.chainKey!.key).toBeDefined();
    expect(senderChain.chainKey!.key!.length).toBe(32);
  });
});

// ===========================================================================
// Test Group 5: Fingerprint Interop (Task 9.9)
// ===========================================================================

describe("Fingerprint Interop (Task 9.9)", () => {
  // Known test vectors from libsignal
  const ALICE_IDENTITY = hexToBytes(
    "0506863bc66d02b40d27b8d49ca7c09e9239236f9d7d25d6fcca5ce13c7064d868",
  );
  const BOB_IDENTITY = hexToBytes(
    "05f781b6fb32fed9ba1cf2de978d4d5da28dc34046ae814402b5c0dbd96fda907b",
  );
  const ALICE_STABLE_ID = "+14152222222";
  const BOB_STABLE_ID = "+14153333333";

  const KNOWN_DISPLAY_V1 =
    "300354477692869396892869876765458257569162576843440918079131";

  const aliceKey = IdentityKey.deserialize(ALICE_IDENTITY);
  const bobKey = IdentityKey.deserialize(BOB_IDENTITY);

  it("should generate displayable fingerprint in 5-digit groups", () => {
    const fp = Fingerprint.create(
      1,
      5200,
      new TextEncoder().encode(ALICE_STABLE_ID),
      aliceKey,
      new TextEncoder().encode(BOB_STABLE_ID),
      bobKey,
    );

    const display = fp.displayString();
    expect(display.length).toBe(60); // 12 groups * 5 digits = 60

    // Each 5-digit group must be a valid number (0-99999)
    for (let i = 0; i < 60; i += 5) {
      const group = display.slice(i, i + 5);
      expect(group).toMatch(/^\d{5}$/);
      const num = parseInt(group, 10);
      expect(num).toBeGreaterThanOrEqual(0);
      expect(num).toBeLessThanOrEqual(99999);
    }
  });

  it("should produce known displayable fingerprint (libsignal test vector)", () => {
    const fp = Fingerprint.create(
      1,
      5200,
      new TextEncoder().encode(ALICE_STABLE_ID),
      aliceKey,
      new TextEncoder().encode(BOB_STABLE_ID),
      bobKey,
    );

    expect(fp.displayString()).toBe(KNOWN_DISPLAY_V1);
  });

  it("should verify scannable fingerprint protobuf format", () => {
    const fp = Fingerprint.create(
      1,
      5200,
      new TextEncoder().encode(ALICE_STABLE_ID),
      aliceKey,
      new TextEncoder().encode(BOB_STABLE_ID),
      bobKey,
    );

    const scannable = fp.scannable.serialize();
    const fields = parseRawFields(scannable);
    const fieldNumbers = fields.map((f) => f.field);

    // Scannable fingerprint proto:
    //   1=version (varint)
    //   2=localFingerprint (nested: field 1=content, 32 bytes)
    //   3=remoteFingerprint (nested: field 1=content, 32 bytes)
    expect(fieldNumbers).toContain(1); // version
    expect(fieldNumbers).toContain(2); // local fingerprint
    expect(fieldNumbers).toContain(3); // remote fingerprint

    // Version should be 1
    const versionField = fields.find((f) => f.field === 1);
    expect(versionField).toBeDefined();
    expect(versionField!.wireType).toBe(0); // varint
    expect(versionField!.value).toBe(1);

    // Local and remote fingerprints are nested messages containing 32-byte hash
    const localField = fields.find((f) => f.field === 2);
    expect(localField).toBeDefined();
    expect(localField!.wireType).toBe(2); // length-delimited

    const localInner = parseRawFields(localField!.value as Uint8Array);
    const localContent = localInner.find((f) => f.field === 1);
    expect(localContent).toBeDefined();
    expect((localContent!.value as Uint8Array).length).toBe(32);
  });

  it("should cross-verify: Alice's view matches Bob's view", () => {
    const aliceFp = Fingerprint.create(
      1,
      5200,
      new TextEncoder().encode(ALICE_STABLE_ID),
      aliceKey,
      new TextEncoder().encode(BOB_STABLE_ID),
      bobKey,
    );
    const bobFp = Fingerprint.create(
      1,
      5200,
      new TextEncoder().encode(BOB_STABLE_ID),
      bobKey,
      new TextEncoder().encode(ALICE_STABLE_ID),
      aliceKey,
    );

    // Display strings are symmetric
    expect(aliceFp.displayString()).toBe(bobFp.displayString());

    // Scannable fingerprints cross-compare
    expect(aliceFp.scannable.compare(bobFp.scannable.serialize())).toBe(true);
    expect(bobFp.scannable.compare(aliceFp.scannable.serialize())).toBe(true);

    // Self-compare fails (local/remote are swapped)
    expect(
      aliceFp.scannable.compare(aliceFp.scannable.serialize()),
    ).toBe(false);
  });

  it("should verify version 2 scannable fingerprint", () => {
    const fp = Fingerprint.create(
      2,
      5200,
      new TextEncoder().encode(ALICE_STABLE_ID),
      aliceKey,
      new TextEncoder().encode(BOB_STABLE_ID),
      bobKey,
    );

    const scannable = fp.scannable.serialize();
    const fields = parseRawFields(scannable);

    // Version should be 2
    const versionField = fields.find((f) => f.field === 1);
    expect(versionField!.value).toBe(2);

    // Display string is the same between v1 and v2
    expect(fp.displayString()).toBe(KNOWN_DISPLAY_V1);
  });

  it("should round-trip scannable fingerprint through serialize/deserialize", () => {
    const fp = Fingerprint.create(
      1,
      5200,
      new TextEncoder().encode(ALICE_STABLE_ID),
      aliceKey,
      new TextEncoder().encode(BOB_STABLE_ID),
      bobKey,
    );

    const serialized = fp.scannable.serialize();
    const deserialized = ScannableFingerprint.deserialize(serialized);
    expect(deserialized.version).toBe(1);

    // Re-serialize should match
    const reserialized = deserialized.serialize();
    expect(bytesToHex(reserialized)).toBe(bytesToHex(serialized));
  });
});

// ===========================================================================
// Test Group 6: PQXDH Interop (Task 9.10)
// ===========================================================================

describe("PQXDH Interop (Task 9.10)", () => {
  it("should create PreKeyBundle with Kyber and verify PreKeySignalMessage fields", async () => {
    const rng = createTestRng();
    const { aliceStore, bobStore, aliceAddress, bobAddress, bobBundle } =
      setupV4AliceAndBob(rng);

    await processPreKeyBundle(
      bobBundle,
      bobAddress,
      aliceStore,
      aliceStore,
      rng,
    );

    const pt = new TextEncoder().encode("PQXDH test");
    const enc = await messageEncrypt(pt, bobAddress, aliceStore, aliceStore);

    expect(enc).toBeInstanceOf(PreKeySignalMessage);
    const preKeyMsg = enc as PreKeySignalMessage;

    // Version must be 4 for PQXDH
    expect(preKeyMsg.messageVersion).toBe(4);

    // Version byte: high nibble=4, low nibble=CURRENT_VERSION=4 -> 0x44
    expect(preKeyMsg.serialized[0]).toBe(0x44);

    // Kyber fields must be present
    expect(preKeyMsg.kyberPreKeyId).toBe(1);
    expect(preKeyMsg.kyberCiphertext).toBeDefined();

    // Kyber ciphertext: 1-byte type prefix + raw ciphertext
    // Default KEM is Kyber1024, so raw ciphertext = 1568 bytes
    const kyberCtLen = preKeyMsg.kyberCiphertext!.length;
    expect(kyberCtLen).toBe(KEM_TYPE_PREFIX_SIZE + KYBER1024_CIPHERTEXT_SIZE);

    // First byte is the KEM type prefix (0x08 for Kyber1024)
    expect(preKeyMsg.kyberCiphertext![0]).toBe(KemType.Kyber1024);

    // Parse proto to verify field 7 (kyberPreKeyId) and field 8 (kyberCiphertext)
    const protoBytes = preKeyMsg.serialized.slice(1);
    const fields = parseRawFields(protoBytes);

    const f7 = fields.find((f) => f.field === 7);
    expect(f7).toBeDefined();
    expect(f7!.wireType).toBe(0); // varint
    expect(f7!.value).toBe(1); // kyberPreKeyId=1

    const f8 = fields.find((f) => f.field === 8);
    expect(f8).toBeDefined();
    expect(f8!.wireType).toBe(2); // length-delimited
    expect((f8!.value as Uint8Array).length).toBe(
      KEM_TYPE_PREFIX_SIZE + KYBER1024_CIPHERTEXT_SIZE,
    );

    // Bob decrypts successfully
    const dec = await messageDecrypt(
      enc,
      aliceAddress,
      bobStore,
      bobStore,
      bobStore,
      bobStore,
      rng,
      bobStore,
    );
    expect(new TextDecoder().decode(dec)).toBe("PQXDH test");
  });

  it("should complete full PQXDH handshake and exchange multiple messages", async () => {
    const rng = createTestRng();
    const { aliceStore, bobStore, aliceAddress, bobAddress, bobBundle } =
      setupV4AliceAndBob(rng);

    await processPreKeyBundle(
      bobBundle,
      bobAddress,
      aliceStore,
      aliceStore,
      rng,
    );

    // Alice -> Bob (PreKeySignalMessage with Kyber)
    const init = new TextEncoder().encode("PQXDH init");
    const initEnc = await messageEncrypt(
      init,
      bobAddress,
      aliceStore,
      aliceStore,
    );
    expect(initEnc).toBeInstanceOf(PreKeySignalMessage);
    expect((initEnc as PreKeySignalMessage).messageVersion).toBe(4);

    await messageDecrypt(
      initEnc,
      aliceAddress,
      bobStore,
      bobStore,
      bobStore,
      bobStore,
      rng,
      bobStore,
    );

    // Bob -> Alice (regular SignalMessage, completing handshake)
    const reply = new TextEncoder().encode("PQXDH reply");
    const replyEnc = await messageEncrypt(
      reply,
      aliceAddress,
      bobStore,
      bobStore,
    );
    expect(replyEnc).toBeInstanceOf(SignalMessage);
    expect((replyEnc as SignalMessage).messageVersion).toBe(4);

    const replyDec = await messageDecrypt(
      replyEnc,
      bobAddress,
      aliceStore,
      aliceStore,
      aliceStore,
      aliceStore,
      rng,
    );
    expect(new TextDecoder().decode(replyDec)).toBe("PQXDH reply");

    // Exchange 10 more messages alternating
    for (let i = 0; i < 10; i++) {
      if (i % 2 === 0) {
        const pt = new TextEncoder().encode(`Alice PQ ${i}`);
        const enc = await messageEncrypt(
          pt,
          bobAddress,
          aliceStore,
          aliceStore,
        );
        expect(enc).toBeInstanceOf(SignalMessage);
        const dec = await messageDecrypt(
          enc,
          aliceAddress,
          bobStore,
          bobStore,
          bobStore,
          bobStore,
          rng,
        );
        expect(new TextDecoder().decode(dec)).toBe(`Alice PQ ${i}`);
      } else {
        const pt = new TextEncoder().encode(`Bob PQ ${i}`);
        const enc = await messageEncrypt(
          pt,
          aliceAddress,
          bobStore,
          bobStore,
        );
        expect(enc).toBeInstanceOf(SignalMessage);
        const dec = await messageDecrypt(
          enc,
          bobAddress,
          aliceStore,
          aliceStore,
          aliceStore,
          aliceStore,
          rng,
        );
        expect(new TextDecoder().decode(dec)).toBe(`Bob PQ ${i}`);
      }
    }
  });

  it("should round-trip PreKeySignalMessage with Kyber fields", async () => {
    const rng = createTestRng();
    const { aliceStore, bobStore, aliceAddress, bobAddress, bobBundle } =
      setupV4AliceAndBob(rng);

    await processPreKeyBundle(
      bobBundle,
      bobAddress,
      aliceStore,
      aliceStore,
      rng,
    );

    const pt = new TextEncoder().encode("Round-trip Kyber");
    const enc = await messageEncrypt(pt, bobAddress, aliceStore, aliceStore);
    expect(enc).toBeInstanceOf(PreKeySignalMessage);
    const original = enc as PreKeySignalMessage;

    // Deserialize from wire bytes
    const deserialized = PreKeySignalMessage.deserialize(original.serialized);

    // All fields must match
    expect(deserialized.messageVersion).toBe(original.messageVersion);
    expect(deserialized.registrationId).toBe(original.registrationId);
    expect(deserialized.preKeyId).toBe(original.preKeyId);
    expect(deserialized.signedPreKeyId).toBe(original.signedPreKeyId);
    expect(deserialized.kyberPreKeyId).toBe(original.kyberPreKeyId);
    expect(deserialized.kyberCiphertext).toEqual(original.kyberCiphertext);
    expect(deserialized.baseKey).toEqual(original.baseKey);
    expect(
      deserialized.identityKey.serialize(),
    ).toEqual(original.identityKey.serialize());

    // The deserialized message can be decrypted
    const dec = await messageDecrypt(
      deserialized,
      aliceAddress,
      bobStore,
      bobStore,
      bobStore,
      bobStore,
      rng,
      bobStore,
    );
    expect(new TextDecoder().decode(dec)).toBe("Round-trip Kyber");
  });

  it("should verify v3 (no Kyber) PreKeySignalMessage has version byte 0x33", async () => {
    const rng = createTestRng();
    const aliceIdentity = IdentityKeyPair.generate(rng);
    const bobIdentity = IdentityKeyPair.generate(rng);

    const aliceStore = new InMemorySignalProtocolStore(aliceIdentity, 1);
    const bobAddress = new ProtocolAddress("bob", 1);

    // Create bundle WITHOUT Kyber (v3)
    const bobPreKey = PreKeyRecord.generate(1, rng);
    const bobSignedPreKey = SignedPreKeyRecord.generate(
      1,
      bobIdentity,
      Date.now(),
      rng,
    );

    const bobBundle = new PreKeyBundle({
      registrationId: 2,
      deviceId: 1,
      preKeyId: bobPreKey.id,
      preKey: bobPreKey.keyPair.publicKey,
      signedPreKeyId: bobSignedPreKey.id,
      signedPreKey: bobSignedPreKey.keyPair.publicKey,
      signedPreKeySignature: bobSignedPreKey.signature,
      identityKey: bobIdentity.identityKey,
    });

    await processPreKeyBundle(
      bobBundle,
      bobAddress,
      aliceStore,
      aliceStore,
      rng,
    );

    const pt = new TextEncoder().encode("v3 message");
    const enc = await messageEncrypt(pt, bobAddress, aliceStore, aliceStore);

    expect(enc).toBeInstanceOf(PreKeySignalMessage);
    const preKeyMsg = enc as PreKeySignalMessage;

    // Version 3
    expect(preKeyMsg.messageVersion).toBe(3);

    // Version byte: high nibble=3, low nibble=CURRENT_VERSION=4 -> 0x34
    expect(preKeyMsg.serialized[0]).toBe(0x34);

    // No Kyber fields
    expect(preKeyMsg.kyberPreKeyId).toBeUndefined();
    expect(preKeyMsg.kyberCiphertext).toBeUndefined();

    // Verify no field 7 or 8 in proto
    const protoBytes = preKeyMsg.serialized.slice(1);
    const fields = parseRawFields(protoBytes);
    const fieldNumbers = fields.map((f) => f.field);
    expect(fieldNumbers).not.toContain(7);
    expect(fieldNumbers).not.toContain(8);
  });

  it("should verify Kyber ciphertext contains type-prefixed data", async () => {
    const rng = createTestRng();
    const { aliceStore, bobAddress, bobBundle } = setupV4AliceAndBob(rng);

    await processPreKeyBundle(
      bobBundle,
      bobAddress,
      aliceStore,
      aliceStore,
      rng,
    );

    const pt = new TextEncoder().encode("Kyber ciphertext check");
    const enc = await messageEncrypt(pt, bobAddress, aliceStore, aliceStore);
    const preKeyMsg = enc as PreKeySignalMessage;

    const kyberCt = preKeyMsg.kyberCiphertext!;

    // First byte is the KEM type (0x08 for Kyber1024)
    const kemType = kyberCt[0];
    expect(kemType).toBe(KemType.Kyber1024);

    // Raw ciphertext after type prefix
    const rawCt = kyberCt.slice(1);
    expect(rawCt.length).toBe(KYBER1024_CIPHERTEXT_SIZE);
  });

  it("should handle PQXDH session without one-time prekey", async () => {
    const rng = createTestRng();
    const aliceIdentity = IdentityKeyPair.generate(rng);
    const bobIdentity = IdentityKeyPair.generate(rng);

    const aliceStore = new InMemorySignalProtocolStore(aliceIdentity, 1);
    const bobStore = new InMemorySignalProtocolStore(bobIdentity, 2);

    const bobAddress = new ProtocolAddress("bob", 1);
    const aliceAddress = new ProtocolAddress("alice", 1);

    // No one-time prekey, but with Kyber
    const bobSignedPreKey = SignedPreKeyRecord.generate(
      1,
      bobIdentity,
      Date.now(),
      rng,
    );
    const bobKyberPreKey = KyberPreKeyRecord.generate(
      1,
      bobIdentity,
      Date.now(),
    );

    await bobStore.storeSignedPreKey(bobSignedPreKey.id, bobSignedPreKey);
    await bobStore.storeKyberPreKey(bobKyberPreKey.id, bobKyberPreKey);

    const bobBundle = new PreKeyBundle({
      registrationId: 2,
      deviceId: 1,
      signedPreKeyId: bobSignedPreKey.id,
      signedPreKey: bobSignedPreKey.keyPair.publicKey,
      signedPreKeySignature: bobSignedPreKey.signature,
      identityKey: bobIdentity.identityKey,
      kyberPreKeyId: bobKyberPreKey.id,
      kyberPreKey: bobKyberPreKey.keyPair.publicKey,
      kyberPreKeySignature: bobKyberPreKey.signature,
    });

    await processPreKeyBundle(
      bobBundle,
      bobAddress,
      aliceStore,
      aliceStore,
      rng,
    );

    const pt = new TextEncoder().encode("No OTP + Kyber");
    const enc = await messageEncrypt(pt, bobAddress, aliceStore, aliceStore);

    expect(enc).toBeInstanceOf(PreKeySignalMessage);
    const msg = enc as PreKeySignalMessage;

    // Still v4
    expect(msg.messageVersion).toBe(4);

    // No one-time preKeyId
    expect(msg.preKeyId).toBeUndefined();

    // But Kyber present
    expect(msg.kyberPreKeyId).toBe(1);
    expect(msg.kyberCiphertext).toBeDefined();

    // Verify proto has field 7 but NOT field 1 (preKeyId)
    const protoBytes = msg.serialized.slice(1);
    const fields = parseRawFields(protoBytes);
    const fieldNumbers = fields.map((f) => f.field);
    expect(fieldNumbers).not.toContain(1); // no preKeyId
    expect(fieldNumbers).toContain(7); // kyberPreKeyId
    expect(fieldNumbers).toContain(8); // kyberCiphertext

    // Bob can decrypt
    const dec = await messageDecrypt(
      enc,
      aliceAddress,
      bobStore,
      bobStore,
      bobStore,
      bobStore,
      rng,
      bobStore,
    );
    expect(new TextDecoder().decode(dec)).toBe("No OTP + Kyber");
  });
});
