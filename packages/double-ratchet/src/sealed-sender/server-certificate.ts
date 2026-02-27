// Copyright © 2025 Signal Messenger, LLC
// Copyright © 2026 Parity Technologies

/**
 * ServerCertificate -- trust root for sealed sender.
 *
 * A server certificate binds a server key ID to a public key, signed by
 * the trust root. The certificate chain is:
 *   trust root -> server certificate -> sender certificate
 *
 * Includes known server certificates that can be referenced by ID
 * instead of embedded in the sender certificate, for space savings.
 *
 * Reference: libsignal/rust/protocol/src/sealed_sender.rs:1-188
 */

import { xeddsaSign, xeddsaVerify } from "../crypto/xeddsa.js";
import {
  InvalidSealedSenderMessageError,
  UnknownSealedSenderServerCertificateIdError,
} from "../error.js";
import { REVOKED_SERVER_CERTIFICATE_KEY_IDS } from "../constants.js";
import {
  encodeBytesField,
  encodeUint32Field,
  concatProtoFields,
  parseProtoFields,
} from "../protocol/proto.js";

// ============================================================================
// Known server certificates (Task 2.3)
// ============================================================================

/**
 * Known server certificates that can be omitted from sender certificates
 * for space savings, keyed by ID.
 *
 * Each entry: [id, trustRootPublicKey (33 bytes with 0x05 prefix), certData]
 *
 * Reference: libsignal KNOWN_SERVER_CERTIFICATES
 */
interface KnownServerCertEntry {
  id: number;
  /** Trust root public key (33 bytes, with 0x05 DJB type prefix). */
  trustRoot: Uint8Array;
  /** Serialized ServerCertificate protobuf bytes. */
  certData: Uint8Array;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Base64 to bytes decoder (for trust root public keys).
 */
function base64ToBytes(b64: string): Uint8Array {
  const binString = atob(b64);
  const bytes = new Uint8Array(binString.length);
  for (let i = 0; i < binString.length; i++) {
    bytes[i] = binString.charCodeAt(i);
  }
  return bytes;
}

const KNOWN_SERVER_CERTIFICATES: KnownServerCertEntry[] = [
  {
    // Staging trust root
    id: 2,
    trustRoot: base64ToBytes("BYhU6tPjqP46KGZEzRs1OL4U39V5dlPJ/X09ha4rErkm"),
    certData: hexToBytes(
      "0a25080212210539450d63ebd0752c0fd4038b9d07a916f5e174b756d409b5ca79f4c97400631e124064c5a38b1e927497d3d4786b101a623ab34a7da3954fae126b04dba9d7a3604ed88cdc8550950f0d4a9134ceb7e19b94139151d2c3d6e1c81e9d1128aafca806",
    ),
  },
  {
    // Production trust root
    id: 3,
    trustRoot: base64ToBytes("BUkY0I+9+oPgDCn4+Ac6Iu813yvqkDr/ga8DzLxFxuk6"),
    certData: hexToBytes(
      "0a250803122105bc9d1d290be964810dfa7e94856480a3f7060d004c9762c24c575a1522353a5a1240c11ec3c401eb0107ab38f8600e8720a63169e0e2eb8a3fae24f63099f85ea319c3c1c46d3454706ae2a679d1fee690a488adda98a2290b66c906bb60295ed781",
    ),
  },
  {
    // Test cert (0x7357C357) -- private key all zeros trust root
    id: 0x7357c357,
    trustRoot: base64ToBytes("BS/lfaNHzWJDFSjarF+7KQcw//aEr8TPwu2QmV9Yyzt0"),
    certData: hexToBytes(
      "0a2908d786df9a07122105847c0d2c375234f365e660955187a3735a0f7613d1609d3a6a4d8c53aeaa5a221240e0b9ebacdfc3aa2827f7924b697784d1c25e44ca05dd433e1a38dc6382eb2730d419ca9a250b1be9d5a9463e61efd6781777a91b83c97b844d014206e2829785",
    ),
  },
];

/** Lazy-initialized map of known server certificates. */
let knownCertsMap: Map<number, { trustRoot: Uint8Array; cert: ServerCertificate }> | null = null;

function getKnownCertsMap(): Map<number, { trustRoot: Uint8Array; cert: ServerCertificate }> {
  if (knownCertsMap != null) return knownCertsMap;
  knownCertsMap = new Map();
  for (const entry of KNOWN_SERVER_CERTIFICATES) {
    const cert = ServerCertificate.deserialize(entry.certData);
    knownCertsMap.set(entry.id, { trustRoot: entry.trustRoot, cert });
  }
  return knownCertsMap;
}

/**
 * Look up a known server certificate by ID.
 *
 * Used when a SenderCertificate references a server certificate by ID
 * instead of embedding the full certificate.
 *
 * @throws {UnknownSealedSenderServerCertificateIdError} if ID is not known
 */
export function lookupKnownServerCertificate(id: number): ServerCertificate {
  const map = getKnownCertsMap();
  const entry = map.get(id);
  if (entry == null) {
    throw new UnknownSealedSenderServerCertificateIdError(id);
  }
  return entry.cert;
}

/**
 * Check if a server certificate ID is a known certificate.
 */
export function isKnownServerCertificateId(id: number): boolean {
  return getKnownCertsMap().has(id);
}

/**
 * Get the trust root for a known server certificate.
 * Returns the 33-byte serialized public key (with 0x05 prefix).
 */
export function getKnownCertificateTrustRoot(id: number): Uint8Array | undefined {
  return getKnownCertsMap().get(id)?.trustRoot;
}

// ============================================================================
// ServerCertificate class
// ============================================================================

export class ServerCertificate {
  readonly keyId: number;
  readonly key: Uint8Array; // 32-byte X25519 public key
  readonly certificate: Uint8Array; // protobuf-encoded Certificate inner
  readonly signature: Uint8Array;
  readonly serialized: Uint8Array;

  private constructor(
    keyId: number,
    key: Uint8Array,
    certificate: Uint8Array,
    signature: Uint8Array,
    serialized: Uint8Array,
  ) {
    this.keyId = keyId;
    this.key = key;
    this.certificate = certificate;
    this.signature = signature;
    this.serialized = serialized;
  }

  /**
   * Create a new server certificate signed by the trust root.
   *
   * @param keyId - Numeric key identifier
   * @param key - 32-byte X25519 public key for this server certificate
   * @param trustRootPrivateKey - 32-byte trust root private key for signing
   */
  static create(
    keyId: number,
    key: Uint8Array,
    trustRootPrivateKey: Uint8Array,
  ): ServerCertificate {
    const serializedKey = new Uint8Array(33);
    serializedKey[0] = 0x05;
    serializedKey.set(key, 1);

    const certificateInner = concatProtoFields(
      encodeUint32Field(1, keyId),
      encodeBytesField(2, serializedKey),
    );

    const signature = xeddsaSign(trustRootPrivateKey, certificateInner);

    const serialized = concatProtoFields(
      encodeBytesField(1, certificateInner),
      encodeBytesField(2, signature),
    );

    return new ServerCertificate(keyId, key, certificateInner, signature, serialized);
  }

  /**
   * Deserialize from protobuf bytes.
   */
  static deserialize(data: Uint8Array): ServerCertificate {
    let fields;
    try {
      fields = parseProtoFields(data);
    } catch {
      throw new InvalidSealedSenderMessageError("Invalid server certificate encoding");
    }
    const certificate = fields.bytes.get(1);
    const signature = fields.bytes.get(2);

    if (certificate == null || signature == null) {
      throw new InvalidSealedSenderMessageError("Invalid server certificate");
    }

    let certFields;
    try {
      certFields = parseProtoFields(certificate);
    } catch {
      throw new InvalidSealedSenderMessageError("Invalid server certificate inner encoding");
    }
    const keyId = certFields.varints.get(1);
    const keyBytes = certFields.bytes.get(2);

    if (keyId === undefined || keyBytes == null) {
      throw new InvalidSealedSenderMessageError("Invalid server certificate inner");
    }

    const key = keyBytes.length === 33 && keyBytes[0] === 0x05 ? keyBytes.slice(1) : keyBytes;

    return new ServerCertificate(keyId, key, certificate, signature, Uint8Array.from(data));
  }

  /**
   * Validate the certificate signature against the trust root public key.
   *
   * Returns false if:
   * - The key ID is in the revocation list
   * - The XEdDSA signature does not verify
   */
  validate(trustRootPublicKey: Uint8Array): boolean {
    if (REVOKED_SERVER_CERTIFICATE_KEY_IDS.has(this.keyId)) {
      return false;
    }
    return xeddsaVerify(trustRootPublicKey, this.certificate, this.signature);
  }
}
