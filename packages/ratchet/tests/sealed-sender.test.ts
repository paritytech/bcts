import { describe, it, expect } from "vitest";
import { ServerCertificate } from "../src/sealed-sender/server-certificate.js";
import {
  lookupKnownServerCertificate,
  isKnownServerCertificateId,
} from "../src/sealed-sender/server-certificate.js";
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
  sealedSenderMultiRecipientMessageForSingleRecipient,
  serviceIdFromUuid,
} from "../src/sealed-sender/sealed-sender.js";
import { CiphertextMessageType } from "../src/protocol/ciphertext-message.js";
import { aes256GcmSivEncrypt, aes256GcmSivDecrypt } from "../src/crypto/aes-gcm-siv.js";
import { IdentityKeyPair } from "../src/keys/identity-key.js";
import { KeyPair } from "../src/keys/key-pair.js";
import {
  SealedSenderSelfSendError,
  InvalidSealedSenderMessageError,
  UnknownSealedSenderVersionError,
  UnknownSealedSenderServerCertificateIdError,
} from "../src/error.js";
import { createTestRng } from "./test-utils.js";

const rng = createTestRng();

// ============================================================================
// AES-256-GCM-SIV tests
// ============================================================================

describe("AES-256-GCM-SIV", () => {
  it("encrypts and decrypts", () => {
    const key = rng.randomData(32);
    const nonce = rng.randomData(12);
    const plaintext = new TextEncoder().encode("Hello, sealed world!");
    const aad = new TextEncoder().encode("additional data");

    const ciphertext = aes256GcmSivEncrypt(key, nonce, plaintext, aad);
    expect(ciphertext.length).toBeGreaterThan(plaintext.length);

    const decrypted = aes256GcmSivDecrypt(key, nonce, ciphertext, aad);
    expect(decrypted).toEqual(plaintext);
  });

  it("encrypts and decrypts without AAD", () => {
    const key = rng.randomData(32);
    const nonce = rng.randomData(12);
    const plaintext = new TextEncoder().encode("no AAD");

    const ciphertext = aes256GcmSivEncrypt(key, nonce, plaintext);
    const decrypted = aes256GcmSivDecrypt(key, nonce, ciphertext);
    expect(decrypted).toEqual(plaintext);
  });

  it("fails with wrong key", () => {
    const key = rng.randomData(32);
    const wrongKey = rng.randomData(32);
    const nonce = rng.randomData(12);
    const plaintext = new TextEncoder().encode("test");

    const ciphertext = aes256GcmSivEncrypt(key, nonce, plaintext);
    expect(() => aes256GcmSivDecrypt(wrongKey, nonce, ciphertext)).toThrow();
  });

  it("fails with tampered ciphertext", () => {
    const key = rng.randomData(32);
    const nonce = rng.randomData(12);
    const plaintext = new TextEncoder().encode("test");

    const ciphertext = aes256GcmSivEncrypt(key, nonce, plaintext);
    const tampered = new Uint8Array(ciphertext);
    tampered[0] ^= 0xff;
    expect(() => aes256GcmSivDecrypt(key, nonce, tampered)).toThrow();
  });

  it("fails with wrong AAD", () => {
    const key = rng.randomData(32);
    const nonce = rng.randomData(12);
    const plaintext = new TextEncoder().encode("test");
    const aad = new TextEncoder().encode("correct");
    const wrongAad = new TextEncoder().encode("wrong");

    const ciphertext = aes256GcmSivEncrypt(key, nonce, plaintext, aad);
    expect(() => aes256GcmSivDecrypt(key, nonce, ciphertext, wrongAad)).toThrow();
  });
});

// ============================================================================
// ContentHint tests (Task 2.7 - test 1)
// ============================================================================

describe("ContentHint", () => {
  it("has values matching libsignal", () => {
    expect(ContentHint.Default).toBe(0);
    expect(ContentHint.Resendable).toBe(1);
    expect(ContentHint.Implicit).toBe(2);
  });
});

// ============================================================================
// UnidentifiedSenderMessageContent tests (Task 2.7 - test 2)
// ============================================================================

describe("UnidentifiedSenderMessageContent", () => {
  function createSenderCert() {
    const trustRoot = KeyPair.generate(rng);
    const serverKey = KeyPair.generate(rng);
    const senderIdentity = IdentityKeyPair.generate(rng);

    const serverCert = ServerCertificate.create(
      1,
      serverKey.publicKey,
      trustRoot.privateKey,
    );
    const senderCert = SenderCertificate.create(
      "test-uuid",
      1,
      Date.now() + 86400000,
      senderIdentity.identityKey.publicKey,
      serverCert,
      serverKey.privateKey,
    );
    return { trustRoot, senderIdentity, senderCert };
  }

  it("serialize/deserialize round-trip with Default content hint", () => {
    const { senderCert } = createSenderCert();
    const content = new TextEncoder().encode("hello");

    const usmc = new UnidentifiedSenderMessageContent(
      CiphertextMessageType.Whisper,
      senderCert,
      content,
      ContentHint.Default,
      null,
    );

    const serialized = usmc.serialize();
    const restored = UnidentifiedSenderMessageContent.deserialize(serialized);

    expect(restored.msgType).toBe(CiphertextMessageType.Whisper);
    expect(restored.content).toEqual(content);
    expect(restored.contentHint).toBe(ContentHint.Default);
    expect(restored.groupId).toBeNull();
    expect(restored.senderCertificate.senderUuid).toBe("test-uuid");
  });

  it("serialize/deserialize round-trip with Resendable hint", () => {
    const { senderCert } = createSenderCert();
    const content = new TextEncoder().encode("resendable");

    const usmc = new UnidentifiedSenderMessageContent(
      CiphertextMessageType.PreKey,
      senderCert,
      content,
      ContentHint.Resendable,
      null,
    );

    const serialized = usmc.serialize();
    const restored = UnidentifiedSenderMessageContent.deserialize(serialized);

    expect(restored.msgType).toBe(CiphertextMessageType.PreKey);
    expect(restored.contentHint).toBe(ContentHint.Resendable);
    expect(restored.content).toEqual(content);
  });

  it("serialize/deserialize round-trip with groupId", () => {
    const { senderCert } = createSenderCert();
    const content = new TextEncoder().encode("group msg");
    const groupId = rng.randomData(32);

    const usmc = new UnidentifiedSenderMessageContent(
      CiphertextMessageType.SenderKey,
      senderCert,
      content,
      ContentHint.Implicit,
      groupId,
    );

    const serialized = usmc.serialize();
    const restored = UnidentifiedSenderMessageContent.deserialize(serialized);

    expect(restored.msgType).toBe(CiphertextMessageType.SenderKey);
    expect(restored.contentHint).toBe(ContentHint.Implicit);
    expect(restored.groupId).toEqual(groupId);
  });

  it("omits empty groupId", () => {
    const { senderCert } = createSenderCert();
    const content = new TextEncoder().encode("no group");

    const usmc = new UnidentifiedSenderMessageContent(
      CiphertextMessageType.Whisper,
      senderCert,
      content,
      ContentHint.Default,
      new Uint8Array(0),
    );

    const serialized = usmc.serialize();
    const restored = UnidentifiedSenderMessageContent.deserialize(serialized);

    // Empty groupId should be treated as null
    expect(restored.groupId).toBeNull();
  });

  it("round-trips all message types", () => {
    const { senderCert } = createSenderCert();
    const content = new TextEncoder().encode("test");

    for (const msgType of [
      CiphertextMessageType.Whisper,
      CiphertextMessageType.PreKey,
      CiphertextMessageType.SenderKey,
      CiphertextMessageType.Plaintext,
    ]) {
      const usmc = new UnidentifiedSenderMessageContent(
        msgType,
        senderCert,
        content,
      );
      const restored = UnidentifiedSenderMessageContent.deserialize(
        usmc.serialize(),
      );
      expect(restored.msgType).toBe(msgType);
    }
  });
});

// ============================================================================
// ServerCertificate tests
// ============================================================================

describe("ServerCertificate", () => {
  it("creates and validates", () => {
    const trustRoot = KeyPair.generate(rng);
    const serverKey = KeyPair.generate(rng);

    const cert = ServerCertificate.create(42, serverKey.publicKey, trustRoot.privateKey);
    expect(cert.keyId).toBe(42);
    expect(cert.validate(trustRoot.publicKey)).toBe(true);
  });

  it("fails validation with wrong trust root", () => {
    const trustRoot = KeyPair.generate(rng);
    const wrongRoot = KeyPair.generate(rng);
    const serverKey = KeyPair.generate(rng);

    const cert = ServerCertificate.create(42, serverKey.publicKey, trustRoot.privateKey);
    expect(cert.validate(wrongRoot.publicKey)).toBe(false);
  });

  it("round-trips through serialization", () => {
    const trustRoot = KeyPair.generate(rng);
    const serverKey = KeyPair.generate(rng);

    const cert = ServerCertificate.create(42, serverKey.publicKey, trustRoot.privateKey);
    const restored = ServerCertificate.deserialize(cert.serialized);
    expect(restored.keyId).toBe(42);
    expect(restored.key).toEqual(serverKey.publicKey);
    expect(restored.validate(trustRoot.publicKey)).toBe(true);
  });

  it("rejects revoked key ID (0xDEADC357)", () => {
    const trustRoot = KeyPair.generate(rng);
    const serverKey = KeyPair.generate(rng);

    const cert = ServerCertificate.create(0xDEADC357, serverKey.publicKey, trustRoot.privateKey);
    expect(cert.validate(trustRoot.publicKey)).toBe(false);
  });

  it("throws on invalid serialized data", () => {
    expect(() => ServerCertificate.deserialize(new Uint8Array([0]))).toThrow(
      InvalidSealedSenderMessageError,
    );
  });
});

// ============================================================================
// Known server certificate tests (Task 2.7 - test 5)
// ============================================================================

describe("Known Server Certificates", () => {
  it("recognizes known certificate IDs", () => {
    expect(isKnownServerCertificateId(2)).toBe(true);
    expect(isKnownServerCertificateId(3)).toBe(true);
    expect(isKnownServerCertificateId(0x7357c357)).toBe(true);
  });

  it("does not recognize unknown certificate IDs", () => {
    expect(isKnownServerCertificateId(0)).toBe(false);
    expect(isKnownServerCertificateId(999)).toBe(false);
  });

  it("looks up known certificates by ID", () => {
    const cert2 = lookupKnownServerCertificate(2);
    expect(cert2.keyId).toBe(2);

    const cert3 = lookupKnownServerCertificate(3);
    expect(cert3.keyId).toBe(3);

    const testCert = lookupKnownServerCertificate(0x7357c357);
    expect(testCert.keyId).toBe(0x7357c357);
  });

  it("throws for unknown certificate ID lookup", () => {
    expect(() => lookupKnownServerCertificate(42)).toThrow(
      UnknownSealedSenderServerCertificateIdError,
    );
  });

  it("rejects revoked certificate ID 0xDEADC357", () => {
    const trustRoot = KeyPair.generate(rng);
    const serverKey = KeyPair.generate(rng);

    const cert = ServerCertificate.create(0xDEADC357, serverKey.publicKey, trustRoot.privateKey);
    expect(cert.validate(trustRoot.publicKey)).toBe(false);
  });
});

// ============================================================================
// SenderCertificate tests
// ============================================================================

describe("SenderCertificate", () => {
  it("creates and validates", () => {
    const trustRoot = KeyPair.generate(rng);
    const serverKey = KeyPair.generate(rng);
    const senderIdentity = IdentityKeyPair.generate(rng);

    const serverCert = ServerCertificate.create(1, serverKey.publicKey, trustRoot.privateKey);
    const senderCert = SenderCertificate.create(
      "test-uuid",
      1,
      Date.now() + 86400000,
      senderIdentity.identityKey.publicKey,
      serverCert,
      serverKey.privateKey,
    );

    expect(senderCert.senderUuid).toBe("test-uuid");
    expect(senderCert.senderDeviceId).toBe(1);
    expect(senderCert.validate(trustRoot.publicKey, Date.now())).toBe(true);
  });

  it("rejects expired certificate", () => {
    const trustRoot = KeyPair.generate(rng);
    const serverKey = KeyPair.generate(rng);
    const senderIdentity = IdentityKeyPair.generate(rng);

    const serverCert = ServerCertificate.create(1, serverKey.publicKey, trustRoot.privateKey);
    const senderCert = SenderCertificate.create(
      "test-uuid",
      1,
      1000,
      senderIdentity.identityKey.publicKey,
      serverCert,
      serverKey.privateKey,
    );

    expect(senderCert.validate(trustRoot.publicKey, Date.now())).toBe(false);
  });

  it("rejects certificate with invalid server cert", () => {
    const trustRoot = KeyPair.generate(rng);
    const wrongRoot = KeyPair.generate(rng);
    const serverKey = KeyPair.generate(rng);
    const senderIdentity = IdentityKeyPair.generate(rng);

    const serverCert = ServerCertificate.create(1, serverKey.publicKey, trustRoot.privateKey);
    const senderCert = SenderCertificate.create(
      "test-uuid",
      1,
      Date.now() + 86400000,
      senderIdentity.identityKey.publicKey,
      serverCert,
      serverKey.privateKey,
    );

    expect(senderCert.validate(wrongRoot.publicKey, Date.now())).toBe(false);
  });

  it("round-trips through serialization", () => {
    const trustRoot = KeyPair.generate(rng);
    const serverKey = KeyPair.generate(rng);
    const senderIdentity = IdentityKeyPair.generate(rng);

    const serverCert = ServerCertificate.create(1, serverKey.publicKey, trustRoot.privateKey);
    const senderCert = SenderCertificate.create(
      "sender-123",
      2,
      Date.now() + 86400000,
      senderIdentity.identityKey.publicKey,
      serverCert,
      serverKey.privateKey,
      "+15551234567",
    );

    const restored = SenderCertificate.deserialize(senderCert.serialized);
    expect(restored.senderUuid).toBe("sender-123");
    expect(restored.senderDeviceId).toBe(2);
    expect(restored.senderE164).toBe("+15551234567");
    expect(restored.identityKey).toEqual(senderIdentity.identityKey.publicKey);
    expect(restored.validate(trustRoot.publicKey, Date.now())).toBe(true);
  });

  it("round-trips without e164", () => {
    const trustRoot = KeyPair.generate(rng);
    const serverKey = KeyPair.generate(rng);
    const senderIdentity = IdentityKeyPair.generate(rng);

    const serverCert = ServerCertificate.create(1, serverKey.publicKey, trustRoot.privateKey);
    const senderCert = SenderCertificate.create(
      "no-phone",
      3,
      Date.now() + 86400000,
      senderIdentity.identityKey.publicKey,
      serverCert,
      serverKey.privateKey,
    );

    const restored = SenderCertificate.deserialize(senderCert.serialized);
    expect(restored.senderUuid).toBe("no-phone");
    expect(restored.senderE164).toBeUndefined();
  });
});

// ============================================================================
// Sealed Sender V1 Encrypt/Decrypt tests
// ============================================================================

describe("Sealed Sender V1 Encrypt/Decrypt", () => {
  function setupCertificates() {
    const trustRoot = KeyPair.generate(rng);
    const serverKey = KeyPair.generate(rng);
    const senderIdentity = IdentityKeyPair.generate(rng);
    const recipientIdentity = IdentityKeyPair.generate(rng);

    const serverCert = ServerCertificate.create(1, serverKey.publicKey, trustRoot.privateKey);
    const senderCert = SenderCertificate.create(
      "sender-uuid",
      1,
      Date.now() + 86400000,
      senderIdentity.identityKey.publicKey,
      serverCert,
      serverKey.privateKey,
    );

    return { trustRoot, serverKey, senderIdentity, recipientIdentity, serverCert, senderCert };
  }

  it("encrypts and decrypts successfully", () => {
    const { trustRoot, senderIdentity, recipientIdentity, senderCert } = setupCertificates();
    const innerMessage = new TextEncoder().encode("Hello, sealed sender!");

    const sealed = sealedSenderEncrypt(
      senderIdentity,
      recipientIdentity.identityKey.publicKey,
      senderCert,
      innerMessage,
      rng,
    );

    const result = sealedSenderDecrypt(
      sealed,
      recipientIdentity,
      trustRoot.publicKey,
      Date.now(),
    );

    expect(result.senderUuid).toBe("sender-uuid");
    expect(result.senderDeviceId).toBe(1);
    expect(result.paddedMessage).toEqual(innerMessage);
  });

  it("encrypts and decrypts with e164", () => {
    const trustRoot = KeyPair.generate(rng);
    const serverKey = KeyPair.generate(rng);
    const senderIdentity = IdentityKeyPair.generate(rng);
    const recipientIdentity = IdentityKeyPair.generate(rng);

    const serverCert = ServerCertificate.create(1, serverKey.publicKey, trustRoot.privateKey);
    const senderCert = SenderCertificate.create(
      "uuid-with-phone",
      2,
      Date.now() + 86400000,
      senderIdentity.identityKey.publicKey,
      serverCert,
      serverKey.privateKey,
      "+15551234567",
    );

    const innerMessage = new TextEncoder().encode("message with phone");

    const sealed = sealedSenderEncrypt(
      senderIdentity,
      recipientIdentity.identityKey.publicKey,
      senderCert,
      innerMessage,
      rng,
    );

    const result = sealedSenderDecrypt(
      sealed,
      recipientIdentity,
      trustRoot.publicKey,
      Date.now(),
    );

    expect(result.senderUuid).toBe("uuid-with-phone");
    expect(result.senderE164).toBe("+15551234567");
    expect(result.senderDeviceId).toBe(2);
    expect(result.paddedMessage).toEqual(innerMessage);
  });

  it("rejects self-send", () => {
    const { trustRoot, senderIdentity, senderCert } = setupCertificates();
    const innerMessage = new TextEncoder().encode("self-send");

    const sealed = sealedSenderEncrypt(
      senderIdentity,
      senderIdentity.identityKey.publicKey,
      senderCert,
      innerMessage,
      rng,
    );

    expect(() =>
      sealedSenderDecrypt(sealed, senderIdentity, trustRoot.publicKey, Date.now()),
    ).toThrow(SealedSenderSelfSendError);
  });

  it("rejects unknown version", () => {
    const { recipientIdentity, trustRoot } = setupCertificates();
    const badMessage = new Uint8Array([0x31, 0x00]);

    expect(() =>
      sealedSenderDecrypt(badMessage, recipientIdentity, trustRoot.publicKey, Date.now()),
    ).toThrow(UnknownSealedSenderVersionError);
  });

  it("rejects truncated message", () => {
    const { recipientIdentity, trustRoot } = setupCertificates();

    expect(() =>
      sealedSenderDecrypt(new Uint8Array([0x11]), recipientIdentity, trustRoot.publicKey, Date.now()),
    ).toThrow(InvalidSealedSenderMessageError);
  });

  it("rejects tampered ciphertext", () => {
    const { trustRoot, senderIdentity, recipientIdentity, senderCert } = setupCertificates();
    const innerMessage = new TextEncoder().encode("tamper test");

    const sealed = sealedSenderEncrypt(
      senderIdentity,
      recipientIdentity.identityKey.publicKey,
      senderCert,
      innerMessage,
      rng,
    );

    const tampered = new Uint8Array(sealed);
    tampered[tampered.length - 5] ^= 0xff;

    expect(() =>
      sealedSenderDecrypt(tampered, recipientIdentity, trustRoot.publicKey, Date.now()),
    ).toThrow(InvalidSealedSenderMessageError);
  });

  it("rejects expired sender certificate during decrypt", () => {
    const trustRoot = KeyPair.generate(rng);
    const serverKey = KeyPair.generate(rng);
    const senderIdentity = IdentityKeyPair.generate(rng);
    const recipientIdentity = IdentityKeyPair.generate(rng);

    const serverCert = ServerCertificate.create(1, serverKey.publicKey, trustRoot.privateKey);
    const senderCert = SenderCertificate.create(
      "expiring-uuid",
      1,
      1000,
      senderIdentity.identityKey.publicKey,
      serverCert,
      serverKey.privateKey,
    );

    const innerMessage = new TextEncoder().encode("expires");

    const sealed = sealedSenderEncrypt(
      senderIdentity,
      recipientIdentity.identityKey.publicKey,
      senderCert,
      innerMessage,
      rng,
    );

    expect(() =>
      sealedSenderDecrypt(sealed, recipientIdentity, trustRoot.publicKey, Date.now()),
    ).toThrow(InvalidSealedSenderMessageError);
  });

  it("handles binary message content", () => {
    const { trustRoot, senderIdentity, recipientIdentity, senderCert } = setupCertificates();
    const innerMessage = rng.randomData(1024);

    const sealed = sealedSenderEncrypt(
      senderIdentity,
      recipientIdentity.identityKey.publicKey,
      senderCert,
      innerMessage,
      rng,
    );

    const result = sealedSenderDecrypt(
      sealed,
      recipientIdentity,
      trustRoot.publicKey,
      Date.now(),
    );

    expect(result.paddedMessage).toEqual(innerMessage);
  });

  it("handles empty message content", () => {
    const { trustRoot, senderIdentity, recipientIdentity, senderCert } = setupCertificates();
    const innerMessage = new Uint8Array(0);

    const sealed = sealedSenderEncrypt(
      senderIdentity,
      recipientIdentity.identityKey.publicKey,
      senderCert,
      innerMessage,
      rng,
    );

    const result = sealedSenderDecrypt(
      sealed,
      recipientIdentity,
      trustRoot.publicKey,
      Date.now(),
    );

    expect(result.paddedMessage).toEqual(innerMessage);
  });
});

// ============================================================================
// Sealed Sender V2 Single-Recipient tests (Task 2.7 - test 3)
// ============================================================================

describe("Sealed Sender V2 Single-Recipient Encrypt/Decrypt", () => {
  function setupV2() {
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
      "v2-sender-uuid",
      2,
      Date.now() + 86400000,
      senderIdentity.identityKey.publicKey,
      serverCert,
      serverKey.privateKey,
    );

    return { trustRoot, serverKey, senderIdentity, recipientIdentity, serverCert, senderCert };
  }

  it("encrypts and decrypts with V2 single-recipient", () => {
    const { trustRoot, senderIdentity, recipientIdentity, senderCert } = setupV2();
    const content = new TextEncoder().encode("V2 single recipient");

    const usmc = new UnidentifiedSenderMessageContent(
      CiphertextMessageType.Whisper,
      senderCert,
      content,
      ContentHint.Resendable,
    );

    const sealed = sealedSenderEncryptV2(
      usmc,
      recipientIdentity.identityKey.publicKey,
      senderIdentity,
      rng,
    );

    // Verify version byte is 0x22
    expect(sealed[0]).toBe(0x22);

    const result = sealedSenderDecrypt(
      sealed,
      recipientIdentity,
      trustRoot.publicKey,
      Date.now(),
    );

    expect(result.senderUuid).toBe("v2-sender-uuid");
    expect(result.senderDeviceId).toBe(2);
    expect(result.paddedMessage).toEqual(content);
    expect(result.contentHint).toBe(ContentHint.Resendable);
  });

  it("V2 preserves groupId through encrypt/decrypt", () => {
    const { trustRoot, senderIdentity, recipientIdentity, senderCert } = setupV2();
    const content = new TextEncoder().encode("group message");
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

    const result = sealedSenderDecrypt(
      sealed,
      recipientIdentity,
      trustRoot.publicKey,
      Date.now(),
    );

    expect(result.groupId).toEqual(groupId);
    expect(result.contentHint).toBe(ContentHint.Implicit);
  });

  it("V2 rejects tampered ciphertext", () => {
    const { trustRoot, senderIdentity, recipientIdentity, senderCert } = setupV2();
    const content = new TextEncoder().encode("tamper test v2");

    const usmc = new UnidentifiedSenderMessageContent(
      CiphertextMessageType.Whisper,
      senderCert,
      content,
    );

    const sealed = sealedSenderEncryptV2(
      usmc,
      recipientIdentity.identityKey.publicKey,
      senderIdentity,
      rng,
    );

    const tampered = new Uint8Array(sealed);
    tampered[tampered.length - 5] ^= 0xff;

    expect(() =>
      sealedSenderDecrypt(tampered, recipientIdentity, trustRoot.publicKey, Date.now()),
    ).toThrow(InvalidSealedSenderMessageError);
  });

  it("V2 rejects wrong recipient", () => {
    const { trustRoot, senderIdentity, senderCert } = setupV2();
    const recipientIdentity = IdentityKeyPair.generate(rng);
    const wrongRecipient = IdentityKeyPair.generate(rng);
    const content = new TextEncoder().encode("wrong recipient");

    const usmc = new UnidentifiedSenderMessageContent(
      CiphertextMessageType.Whisper,
      senderCert,
      content,
    );

    const sealed = sealedSenderEncryptV2(
      usmc,
      recipientIdentity.identityKey.publicKey,
      senderIdentity,
      rng,
    );

    expect(() =>
      sealedSenderDecrypt(sealed, wrongRecipient, trustRoot.publicKey, Date.now()),
    ).toThrow(InvalidSealedSenderMessageError);
  });

  it("decryptToUsmc extracts USMC without certificate validation", () => {
    const { senderIdentity, recipientIdentity, senderCert } = setupV2();
    const content = new TextEncoder().encode("usmc test");

    const usmc = new UnidentifiedSenderMessageContent(
      CiphertextMessageType.Whisper,
      senderCert,
      content,
      ContentHint.Resendable,
    );

    const sealed = sealedSenderEncryptV2(
      usmc,
      recipientIdentity.identityKey.publicKey,
      senderIdentity,
      rng,
    );

    const decryptedUsmc = sealedSenderDecryptToUsmc(sealed, recipientIdentity);
    expect(decryptedUsmc.msgType).toBe(CiphertextMessageType.Whisper);
    expect(decryptedUsmc.content).toEqual(content);
    expect(decryptedUsmc.contentHint).toBe(ContentHint.Resendable);
    expect(decryptedUsmc.senderCertificate.senderUuid).toBe("v2-sender-uuid");
  });
});

// ============================================================================
// Sealed Sender V2 Multi-Recipient tests (Task 2.7 - test 4)
// ============================================================================

describe("Sealed Sender V2 Multi-Recipient", () => {
  function setupMulti() {
    const trustRoot = KeyPair.generate(rng);
    const serverKey = KeyPair.generate(rng);
    const senderIdentity = IdentityKeyPair.generate(rng);

    const serverCert = ServerCertificate.create(
      1,
      serverKey.publicKey,
      trustRoot.privateKey,
    );
    const senderCert = SenderCertificate.create(
      "multi-sender",
      1,
      Date.now() + 86400000,
      senderIdentity.identityKey.publicKey,
      serverCert,
      serverKey.privateKey,
    );

    return { trustRoot, serverKey, senderIdentity, serverCert, senderCert };
  }

  it("encrypts for multiple recipients and each can decrypt", () => {
    const { trustRoot, senderIdentity, senderCert } = setupMulti();

    const recipient1 = IdentityKeyPair.generate(rng);
    const recipient2 = IdentityKeyPair.generate(rng);
    const recipient3 = IdentityKeyPair.generate(rng);

    const uuid1 = "aaaaaaaa-1111-1111-1111-111111111111";
    const uuid2 = "bbbbbbbb-2222-2222-2222-222222222222";
    const uuid3 = "cccccccc-3333-3333-3333-333333333333";

    const content = new TextEncoder().encode("multi-recipient message");

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
          identityKey: recipient1.identityKey.publicKey,
        },
        {
          serviceIdFixedWidthBinary: serviceIdFromUuid(uuid2),
          devices: [{ deviceId: 1, registrationId: 200 }],
          identityKey: recipient2.identityKey.publicKey,
        },
        {
          serviceIdFixedWidthBinary: serviceIdFromUuid(uuid3),
          devices: [{ deviceId: 1, registrationId: 300 }],
          identityKey: recipient3.identityKey.publicKey,
        },
      ],
      senderIdentityKeyPair: senderIdentity,
      rng,
    });

    // Verify version byte
    expect(sentMessage[0]).toBe(0x23);

    // Parse the sent message
    const parsed = SealedSenderMultiRecipientMessage.parse(sentMessage);
    expect(parsed.recipients.size).toBe(3);

    // Each recipient can extract and decrypt their message
    for (const [uuid, recipientIdentity] of [
      [uuid1, recipient1],
      [uuid2, recipient2],
      [uuid3, recipient3],
    ] as const) {
      const recipientData = parsed.recipientsByServiceIdString().get(uuid);
      expect(recipientData).toBeDefined();

      const receivedMessage = parsed.messageForRecipient(recipientData!);
      expect(receivedMessage[0]).toBe(0x22); // ReceivedMessage uses 0x22

      const result = sealedSenderDecrypt(
        receivedMessage,
        recipientIdentity,
        trustRoot.publicKey,
        Date.now(),
      );

      expect(result.senderUuid).toBe("multi-sender");
      expect(result.paddedMessage).toEqual(content);
      expect(result.contentHint).toBe(ContentHint.Resendable);
    }
  });

  it("handles single recipient for convenience", () => {
    const { trustRoot, senderIdentity, senderCert } = setupMulti();
    const recipient = IdentityKeyPair.generate(rng);
    const uuid = "dddddddd-4444-4444-4444-444444444444";
    const content = new TextEncoder().encode("single multi");

    const usmc = new UnidentifiedSenderMessageContent(
      CiphertextMessageType.Whisper,
      senderCert,
      content,
    );

    const sentMessage = sealedSenderMultiRecipientEncrypt({
      usmc,
      recipients: [
        {
          serviceIdFixedWidthBinary: serviceIdFromUuid(uuid),
          devices: [{ deviceId: 1, registrationId: 42 }],
          identityKey: recipient.identityKey.publicKey,
        },
      ],
      senderIdentityKeyPair: senderIdentity,
      rng,
    });

    const receivedMessage = sealedSenderMultiRecipientMessageForSingleRecipient(sentMessage);
    const result = sealedSenderDecrypt(
      receivedMessage,
      recipient,
      trustRoot.publicKey,
      Date.now(),
    );

    expect(result.paddedMessage).toEqual(content);
  });

  it("handles multiple devices per recipient", () => {
    const { trustRoot, senderIdentity, senderCert } = setupMulti();
    const recipient = IdentityKeyPair.generate(rng);
    const uuid = "eeeeeeee-5555-5555-5555-555555555555";
    const content = new TextEncoder().encode("multi-device");

    const usmc = new UnidentifiedSenderMessageContent(
      CiphertextMessageType.Whisper,
      senderCert,
      content,
    );

    const sentMessage = sealedSenderMultiRecipientEncrypt({
      usmc,
      recipients: [
        {
          serviceIdFixedWidthBinary: serviceIdFromUuid(uuid),
          devices: [
            { deviceId: 1, registrationId: 100 },
            { deviceId: 2, registrationId: 200 },
            { deviceId: 3, registrationId: 300 },
          ],
          identityKey: recipient.identityKey.publicKey,
        },
      ],
      senderIdentityKeyPair: senderIdentity,
      rng,
    });

    const parsed = SealedSenderMultiRecipientMessage.parse(sentMessage);
    const recipientData = parsed.recipientsByServiceIdString().get(uuid);
    expect(recipientData).toBeDefined();
    expect(recipientData!.devices.length).toBe(3);
    expect(recipientData!.devices[0].deviceId).toBe(1);
    expect(recipientData!.devices[0].registrationId).toBe(100);
    expect(recipientData!.devices[1].deviceId).toBe(2);
    expect(recipientData!.devices[1].registrationId).toBe(200);
    expect(recipientData!.devices[2].deviceId).toBe(3);
    expect(recipientData!.devices[2].registrationId).toBe(300);

    // Decrypt
    const receivedMessage = parsed.messageForRecipient(recipientData!);
    const result = sealedSenderDecrypt(
      receivedMessage,
      recipient,
      trustRoot.publicKey,
      Date.now(),
    );
    expect(result.paddedMessage).toEqual(content);
  });

  it("handles excluded recipients", () => {
    const { senderIdentity, senderCert } = setupMulti();
    const recipient = IdentityKeyPair.generate(rng);
    const uuid = "ffffffff-6666-6666-6666-666666666666";
    const excludedUuid = "00000000-7777-7777-7777-777777777777";
    const content = new TextEncoder().encode("with excluded");

    const usmc = new UnidentifiedSenderMessageContent(
      CiphertextMessageType.Whisper,
      senderCert,
      content,
    );

    const sentMessage = sealedSenderMultiRecipientEncrypt({
      usmc,
      recipients: [
        {
          serviceIdFixedWidthBinary: serviceIdFromUuid(uuid),
          devices: [{ deviceId: 1, registrationId: 42 }],
          identityKey: recipient.identityKey.publicKey,
        },
      ],
      excludedRecipients: [serviceIdFromUuid(excludedUuid)],
      senderIdentityKeyPair: senderIdentity,
      rng,
    });

    const parsed = SealedSenderMultiRecipientMessage.parse(sentMessage);
    // Total recipients = 2 (1 included + 1 excluded)
    expect(parsed.recipients.size).toBe(2);

    const included = parsed.recipientsByServiceIdString().get(uuid);
    expect(included).toBeDefined();
    expect(included!.devices.length).toBe(1);

    const excluded = parsed.recipientsByServiceIdString().get(excludedUuid);
    expect(excluded).toBeDefined();
    expect(excluded!.devices.length).toBe(0);
  });

  it("serviceIdFromUuid creates correct bytes", () => {
    const uuid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const bytes = serviceIdFromUuid(uuid);
    expect(bytes.length).toBe(17);
    expect(bytes[0]).toBe(0x01); // ACI type
    expect(bytes[1]).toBe(0xaa);
    expect(bytes[2]).toBe(0xaa);
    expect(bytes[3]).toBe(0xaa);
    expect(bytes[4]).toBe(0xaa);
    expect(bytes[5]).toBe(0xbb);
    expect(bytes[6]).toBe(0xbb);
    expect(bytes[7]).toBe(0xcc);
    expect(bytes[8]).toBe(0xcc);
    expect(bytes[9]).toBe(0xdd);
    expect(bytes[10]).toBe(0xdd);
  });

  it("rejects message with wrong recipient decrypting", () => {
    const { trustRoot, senderIdentity, senderCert } = setupMulti();
    const recipient1 = IdentityKeyPair.generate(rng);
    const recipient2 = IdentityKeyPair.generate(rng);
    const wrongRecipient = IdentityKeyPair.generate(rng);
    const uuid1 = "11111111-1111-1111-1111-111111111111";
    const uuid2 = "22222222-2222-2222-2222-222222222222";
    const content = new TextEncoder().encode("wrong recipient");

    const usmc = new UnidentifiedSenderMessageContent(
      CiphertextMessageType.Whisper,
      senderCert,
      content,
    );

    const sentMessage = sealedSenderMultiRecipientEncrypt({
      usmc,
      recipients: [
        {
          serviceIdFixedWidthBinary: serviceIdFromUuid(uuid1),
          devices: [{ deviceId: 1, registrationId: 100 }],
          identityKey: recipient1.identityKey.publicKey,
        },
        {
          serviceIdFixedWidthBinary: serviceIdFromUuid(uuid2),
          devices: [{ deviceId: 1, registrationId: 200 }],
          identityKey: recipient2.identityKey.publicKey,
        },
      ],
      senderIdentityKeyPair: senderIdentity,
      rng,
    });

    const parsed = SealedSenderMultiRecipientMessage.parse(sentMessage);
    const r1Data = parsed.recipientsByServiceIdString().get(uuid1)!;
    const receivedMessage = parsed.messageForRecipient(r1Data);

    // Wrong recipient trying to decrypt recipient1's message
    expect(() =>
      sealedSenderDecrypt(receivedMessage, wrongRecipient, trustRoot.publicKey, Date.now()),
    ).toThrow(InvalidSealedSenderMessageError);
  });

  it("14-bit registration ID encoding with has_more bit", () => {
    const { senderIdentity, senderCert } = setupMulti();
    const recipient = IdentityKeyPair.generate(rng);
    const uuid = "aaaaaaaa-0000-0000-0000-000000000000";
    const content = new TextEncoder().encode("reg id test");

    const usmc = new UnidentifiedSenderMessageContent(
      CiphertextMessageType.Whisper,
      senderCert,
      content,
    );

    // Use max 14-bit registration ID (0x3FFF = 16383)
    const sentMessage = sealedSenderMultiRecipientEncrypt({
      usmc,
      recipients: [
        {
          serviceIdFixedWidthBinary: serviceIdFromUuid(uuid),
          devices: [
            { deviceId: 1, registrationId: 0x3fff },
            { deviceId: 2, registrationId: 1 },
          ],
          identityKey: recipient.identityKey.publicKey,
        },
      ],
      senderIdentityKeyPair: senderIdentity,
      rng,
    });

    const parsed = SealedSenderMultiRecipientMessage.parse(sentMessage);
    const recipientData = parsed.recipientsByServiceIdString().get(uuid);
    expect(recipientData).toBeDefined();
    expect(recipientData!.devices[0].registrationId).toBe(0x3fff);
    expect(recipientData!.devices[1].registrationId).toBe(1);
  });
});
