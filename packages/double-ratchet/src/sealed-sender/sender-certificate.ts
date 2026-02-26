/**
 * SenderCertificate -- identifies the sender in sealed sender messages.
 *
 * Binds a sender UUID, device ID, and identity key to a server certificate.
 * The server key signs this certificate. Validation checks the full chain:
 *   trust root -> server cert -> sender cert (+ expiration)
 *
 * Reference: libsignal/rust/protocol/src/sealed_sender.rs:190-427
 */

import { xeddsaVerify } from "../crypto/xeddsa.js";
import { xeddsaSign } from "../crypto/xeddsa.js";
import { InvalidSealedSenderMessageError } from "../error.js";
import { ServerCertificate } from "./server-certificate.js";
import {
  encodeBytesField,
  encodeUint32Field,
  encodeUint64Field,
  concatProtoFields,
  parseProtoFields,
} from "../protocol/proto.js";

export class SenderCertificate {
  readonly senderUuid: string;
  readonly senderE164: string | undefined;
  readonly senderDeviceId: number;
  readonly expiration: number;
  readonly identityKey: Uint8Array; // 32-byte sender identity public key
  readonly serverCertificate: ServerCertificate;
  readonly certificate: Uint8Array; // protobuf-encoded inner
  readonly signature: Uint8Array;
  readonly serialized: Uint8Array;
  /**
   * If set, the server certificate was referenced by ID rather than
   * being embedded inline. Matches libsignal's sealed_sender.proto
   * SenderCertificate.Certificate field 8 (known_server_certificate_id).
   */
  readonly knownServerCertificateId: number | undefined;

  private constructor(params: {
    senderUuid: string;
    senderE164?: string;
    senderDeviceId: number;
    expiration: number;
    identityKey: Uint8Array;
    serverCertificate: ServerCertificate;
    certificate: Uint8Array;
    signature: Uint8Array;
    serialized: Uint8Array;
    knownServerCertificateId?: number;
  }) {
    this.senderUuid = params.senderUuid;
    this.senderE164 = params.senderE164;
    this.senderDeviceId = params.senderDeviceId;
    this.expiration = params.expiration;
    this.identityKey = params.identityKey;
    this.serverCertificate = params.serverCertificate;
    this.certificate = params.certificate;
    this.signature = params.signature;
    this.serialized = params.serialized;
    this.knownServerCertificateId = params.knownServerCertificateId;
  }

  /**
   * Create a new sender certificate signed by the server key.
   *
   * Certificate inner protobuf fields:
   *   1: sender_uuid (string as bytes)
   *   2: sender_e164 (optional string as bytes)
   *   3: sender_device_id (varint)
   *   4: expiration (varint, epoch millis)
   *   5: identity_key (33 bytes with 0x05 prefix)
   *   6: server_certificate (serialized ServerCertificate)
   *
   * @param senderUuid - Sender's UUID string
   * @param senderDeviceId - Sender's device ID
   * @param expiration - Expiration timestamp (epoch milliseconds)
   * @param identityKey - 32-byte sender identity public key
   * @param serverCertificate - The server certificate that signs this
   * @param serverPrivateKey - 32-byte server private key for signing
   * @param senderE164 - Optional phone number
   */
  static create(
    senderUuid: string,
    senderDeviceId: number,
    expiration: number,
    identityKey: Uint8Array,
    serverCertificate: ServerCertificate,
    serverPrivateKey: Uint8Array,
    senderE164?: string,
  ): SenderCertificate {
    // Serialize identity key with 0x05 prefix
    const serializedIdentityKey = new Uint8Array(33);
    serializedIdentityKey[0] = 0x05;
    serializedIdentityKey.set(identityKey, 1);

    // Certificate inner protobuf
    const parts: Uint8Array[] = [];
    parts.push(encodeBytesField(1, new TextEncoder().encode(senderUuid)));
    if (senderE164 != null && senderE164 !== "") {
      parts.push(encodeBytesField(2, new TextEncoder().encode(senderE164)));
    }
    parts.push(encodeUint32Field(3, senderDeviceId));
    parts.push(encodeUint64Field(4, expiration));
    parts.push(encodeBytesField(5, serializedIdentityKey));
    parts.push(encodeBytesField(6, serverCertificate.serialized));
    const certificateInner = concatProtoFields(...parts);

    // Sign with server key
    const signature = xeddsaSign(serverPrivateKey, certificateInner);

    // Outer: { certificate=1, signature=2 }
    const serialized = concatProtoFields(
      encodeBytesField(1, certificateInner),
      encodeBytesField(2, signature),
    );

    const certParams: {
      senderUuid: string;
      senderE164?: string;
      senderDeviceId: number;
      expiration: number;
      identityKey: Uint8Array;
      serverCertificate: ServerCertificate;
      certificate: Uint8Array;
      signature: Uint8Array;
      serialized: Uint8Array;
    } = {
      senderUuid,
      senderDeviceId,
      expiration,
      identityKey,
      serverCertificate,
      certificate: certificateInner,
      signature,
      serialized,
    };
    if (senderE164 !== undefined) certParams.senderE164 = senderE164;
    return new SenderCertificate(certParams);
  }

  /**
   * Deserialize from protobuf bytes.
   *
   * Outer format: { certificate=1(bytes), signature=2(bytes) }
   *
   * Certificate inner fields (BCTS layout):
   *   1: sender_uuid (string as bytes)
   *   2: sender_e164 (optional string as bytes)
   *   3: sender_device_id (varint)
   *   4: expiration (varint, epoch millis)
   *   5: identity_key (33 bytes with 0x05 prefix)
   *   6: server_certificate (serialized ServerCertificate)
   *   7: sender_uuid_bytes (optional, raw 16 bytes -- alternative to field 1)
   *   8: known_server_certificate_id (optional varint -- alternative to field 6)
   *
   * Fields 7 and 8 match libsignal's sealed_sender.proto oneof alternatives
   * for sender UUID and signer certificate, respectively.
   *
   * @param knownCertificateResolver - Optional function to resolve a server
   *   certificate from a known ID. Required if the certificate uses field 8
   *   instead of field 6.
   */
  static deserialize(
    data: Uint8Array,
    knownCertificateResolver?: (id: number) => ServerCertificate,
  ): SenderCertificate {
    const outerFields = parseProtoFields(data);
    const certificate = outerFields.bytes.get(1);
    const signature = outerFields.bytes.get(2);

    if (certificate == null || signature == null) {
      throw new InvalidSealedSenderMessageError("Invalid sender certificate");
    }

    const certFields = parseProtoFields(certificate);
    const senderUuidStringBytes = certFields.bytes.get(1);
    const senderE164Bytes = certFields.bytes.get(2);
    const senderDeviceId = certFields.varints.get(3);
    const expiration = certFields.varints.get(4);
    const identityKeyBytes = certFields.bytes.get(5);
    const serverCertBytes = certFields.bytes.get(6);
    const senderUuidRawBytes = certFields.bytes.get(7);
    const knownServerCertificateId = certFields.varints.get(8);

    // Resolve sender UUID: prefer string form (field 1), fall back to raw bytes (field 7)
    let senderUuid: string;
    if (senderUuidStringBytes != null) {
      senderUuid = new TextDecoder().decode(senderUuidStringBytes);
    } else if (senderUuidRawBytes != null) {
      // Convert 16 raw UUID bytes to standard UUID string format
      senderUuid = uuidBytesToString(senderUuidRawBytes);
    } else {
      throw new InvalidSealedSenderMessageError("Invalid sender certificate inner: no sender UUID");
    }

    if (senderDeviceId === undefined || expiration === undefined || identityKeyBytes == null) {
      throw new InvalidSealedSenderMessageError("Invalid sender certificate inner");
    }

    // Resolve server certificate: prefer embedded (field 6), fall back to known ID (field 8)
    let serverCertificate: ServerCertificate;
    if (serverCertBytes != null) {
      serverCertificate = ServerCertificate.deserialize(serverCertBytes);
    } else if (knownServerCertificateId !== undefined && knownCertificateResolver != null) {
      serverCertificate = knownCertificateResolver(knownServerCertificateId);
    } else if (knownServerCertificateId !== undefined) {
      throw new InvalidSealedSenderMessageError(
        `Known server certificate ID ${knownServerCertificateId} referenced but no resolver provided`,
      );
    } else {
      throw new InvalidSealedSenderMessageError(
        "Invalid sender certificate inner: no server certificate",
      );
    }

    const senderE164 =
      senderE164Bytes != null ? new TextDecoder().decode(senderE164Bytes) : undefined;
    const identityKey =
      identityKeyBytes.length === 33 && identityKeyBytes[0] === 0x05
        ? identityKeyBytes.slice(1)
        : identityKeyBytes;

    const deserParams: {
      senderUuid: string;
      senderE164?: string;
      senderDeviceId: number;
      expiration: number;
      identityKey: Uint8Array;
      serverCertificate: ServerCertificate;
      certificate: Uint8Array;
      signature: Uint8Array;
      serialized: Uint8Array;
      knownServerCertificateId?: number;
    } = {
      senderUuid,
      senderDeviceId,
      expiration,
      identityKey,
      serverCertificate,
      certificate,
      signature,
      serialized: Uint8Array.from(data),
    };
    if (senderE164 !== undefined) deserParams.senderE164 = senderE164;
    if (knownServerCertificateId !== undefined)
      deserParams.knownServerCertificateId = knownServerCertificateId;
    return new SenderCertificate(deserParams);
  }

  /**
   * Validate the certificate chain: trust root -> server cert -> sender cert.
   *
   * Checks:
   * 1. Certificate has not expired (expiration >= now)
   * 2. Server certificate validates against the trust root
   * 3. Sender certificate signature verifies against the server key
   *
   * @param trustRootPublicKey - 32-byte trust root public key
   * @param now - Current timestamp (epoch milliseconds) for expiration check
   */
  validate(trustRootPublicKey: Uint8Array, now: number): boolean {
    // Check expiration
    if (this.expiration < now) {
      return false;
    }

    // Validate server certificate against trust root
    if (!this.serverCertificate.validate(trustRootPublicKey)) {
      return false;
    }

    // Verify sender certificate signature by server key
    return xeddsaVerify(this.serverCertificate.key, this.certificate, this.signature);
  }
}

/**
 * Convert 16 raw UUID bytes to standard UUID string format
 * (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).
 */
function uuidBytesToString(bytes: Uint8Array): string {
  if (bytes.length !== 16) {
    throw new InvalidSealedSenderMessageError(
      `Invalid UUID bytes length: expected 16, got ${bytes.length}`,
    );
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
