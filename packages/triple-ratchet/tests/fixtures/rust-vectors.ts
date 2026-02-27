/**
 * Rust libsignal-compatible test vectors.
 *
 * These vectors are deterministically computed using the same HKDF-SHA256,
 * HMAC-SHA256, and protobuf encoding that Rust libsignal uses. Where a
 * vector comes directly from a Rust test, it is annotated with the source.
 *
 * Cross-validated: V2a/V2a_MAC match Rust's test_chain_key_derivation()
 * in libsignal/rust/protocol/src/ratchet/keys.rs (lines 219-265).
 */

/** Parse hex string to Uint8Array. */
export function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Encode Uint8Array to hex string. */
export function toHex(data: Uint8Array): string {
  return Array.from(data)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ===========================================================================
// V1: PQXDH deriveKeys — HKDF-SHA256(salt=None, ikm=secretInput,
//     info="WhisperText_X25519_SHA-256_CRYSTALS-KYBER-1024", len=96)
// ===========================================================================

/** V1a: secretInput = [0xFF*32] || [0x01*32] || [0x02*32] || [0x03*32] || [0x04*32] (no DH4) */
export const V1a = {
  secretInput: fromHex(
    "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" +
    "0101010101010101010101010101010101010101010101010101010101010101" +
    "0202020202020202020202020202020202020202020202020202020202020202" +
    "0303030303030303030303030303030303030303030303030303030303030303" +
    "0404040404040404040404040404040404040404040404040404040404040404",
  ),
  rootKey: fromHex("2b2ddb0c8bccc27455e2fcdbd242f1369144a43163ef2b1275f8064f9e071f67"),
  chainKey: fromHex("d0155c2a0babef1df32dca9818e55a9c5a67641e92fd66c6691670c092b72dde"),
  pqrAuthKey: fromHex("178857ce24bca65f957b6eb36c86de240847ea7ece7d7830a28a87899c269054"),
};

/** V1b: with DH4 = [0x05*32] between DH3 and KEM_SS */
export const V1b = {
  secretInput: fromHex(
    "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" +
    "0101010101010101010101010101010101010101010101010101010101010101" +
    "0202020202020202020202020202020202020202020202020202020202020202" +
    "0303030303030303030303030303030303030303030303030303030303030303" +
    "0505050505050505050505050505050505050505050505050505050505050505" +
    "0404040404040404040404040404040404040404040404040404040404040404",
  ),
  rootKey: fromHex("35f6dfbc0b3d15133d2638166e6b1332e2f7ec676287a2f6529bb2033eed4f87"),
  chainKey: fromHex("cefa2d41f121402e62976f825787df1ea3f52d5d3ec08e905df290fc67b8f32f"),
  pqrAuthKey: fromHex("4af9ffb8a51d1dd05c937a6276ff5c655bd36a5d3eab05c25a197861a614c4cc"),
};

// ===========================================================================
// V2: Message key derivation — HKDF-SHA256(salt=pqKey, ikm=seed,
//     info="WhisperMessageKeys", len=80) → cipherKey[32]+macKey[32]+iv[16]
//
// Source chain key seed: libsignal/rust/protocol/src/ratchet/keys.rs
//         test_chain_key_derivation() line 220
// ===========================================================================

/**
 * Known chain key from Rust libsignal test_chain_key_derivation().
 * This is the CHAIN KEY, not the message key seed.
 */
export const RUST_CHAIN_KEY = fromHex(
  "8ab72d6f4cc5ac0d387eaf463378ddb28edd07385b1cb01250c715982e7ad48f",
);

/**
 * Message key seed = HMAC-SHA256(RUST_CHAIN_KEY, [0x01]).
 * This is the IKM passed to HKDF for message key derivation.
 */
export const RUST_MSG_KEY_SEED = fromHex(
  "fae95235beda3d2e00b41cf2e655dada2405b4388cae0d251a51bcd2ebdd2e40",
);

/**
 * V2a: Classical mode (pqRatchetKey = null, salt = None).
 * These values match Rust's test_chain_key_derivation() EXACTLY.
 *
 * Source: libsignal/rust/protocol/src/ratchet/keys.rs lines 230-243
 */
export const V2a = {
  cipherKey: fromHex("bf51e9d75e0e31031051f82a2491ffc084fa298b7793bd9db620056febf45217"),
  macKey: fromHex("c6c77d6a73a354337a56435e34607dfe48e3ace14e77314dc6abc172e7a7030b"),
  iv: fromHex("afa8207986b692a116d4b40bbff72d6c"),
};

/** V2b: With PQ ratchet key [0xAA*32] as HKDF salt. */
export const V2b = {
  pqKey: new Uint8Array(32).fill(0xaa),
  cipherKey: fromHex("a3db89e682c02462794b013b14f395fa0c1b440f3a1a7fdd9dcc0596a8704584"),
  macKey: fromHex("a7e40837c27b48f6acd29c1378f0acc3dfb79530d3f564bc4062a7fa92fe6904"),
  iv: fromHex("c48adb546207f61318b2b37a39127823"),
};

/** V2c: With different PQ ratchet key [0xBB*32] — proves salt matters. */
export const V2c = {
  pqKey: new Uint8Array(32).fill(0xbb),
  cipherKey: fromHex("5943c5555f0ebb41599e017085174da9542a297a7ca0530a7ea50d348469adeb"),
  macKey: fromHex("bf1dbc68c1fcd4beda7014b7166cafca45d7342c568d58a73efc31ae6852859f"),
  iv: fromHex("a55a8d402b03ba0aac63c9c60585bd31"),
};

// ===========================================================================
// V3: TripleRatchetSignalMessage wire format vector
// Fields: ratchetKey(f1), counter(f2)=42, previousCounter(f3)=41,
//         ciphertext(f4)=deadbeef, pqRatchet(f5)=0102030405
// Version byte: 0x44, MAC: 8-byte HMAC-SHA256 truncation
// ===========================================================================

export const V3 = {
  ratchetKeyRaw: new Uint8Array(32).fill(0x11),
  counter: 42,
  previousCounter: 41,
  ciphertext: fromHex("deadbeef"),
  pqRatchet: fromHex("0102030405"),
  macKey: new Uint8Array(32).fill(0xcc),
  senderIdentity: (() => {
    const k = new Uint8Array(33);
    k[0] = 0x05;
    k.fill(0x22, 1);
    return k;
  })(),
  receiverIdentity: (() => {
    const k = new Uint8Array(33);
    k[0] = 0x05;
    k.fill(0x33, 1);
    return k;
  })(),
  /** Expected protobuf body (before version byte + MAC) */
  protoBody: fromHex(
    "0a21051111111111111111111111111111111111111111111111111111111111111111" +
    "102a18292204deadbeef2a050102030405",
  ),
  /** Expected 8-byte MAC */
  mac: fromHex("1d6d3b1d1aa53045"),
  /** Complete serialized message: version(1) + proto + mac(8) */
  serialized: fromHex(
    "440a21051111111111111111111111111111111111111111111111111111111111111111" +
    "102a18292204deadbeef2a0501020304051d6d3b1d1aa53045",
  ),
};

// ===========================================================================
// V4: TripleRatchetPreKeySignalMessage wire format (with Kyber fields)
// Fields: preKeyId(f1)=100, baseKey(f2), identityKey(f3), message(f4)=V3,
//         registrationId(f5)=12345, signedPreKeyId(f6)=200,
//         kyberPreKeyId(f7)=300, kyberCiphertext(f8)=0x77*10
// ===========================================================================

export const V4 = {
  preKeyId: 100,
  baseKeyRaw: new Uint8Array(32).fill(0x44),
  identityKey: (() => {
    const k = new Uint8Array(33);
    k[0] = 0x05;
    k.fill(0x55, 1);
    return k;
  })(),
  registrationId: 12345,
  signedPreKeyId: 200,
  kyberPreKeyId: 300,
  kyberCiphertext: new Uint8Array(10).fill(0x77),
  /** The embedded SignalMessage is V3.serialized */
  innerMessage: V3.serialized,
  /** Complete serialized PreKeySignalMessage: version(1) + proto */
  serialized: fromHex(
    "44086412210544444444444444444444444444444444444444444444444444444444444444441a2105555555555555555555555555555555555555555555555555555555555555555522" +
    "3d440a21051111111111111111111111111111111111111111111111111111111111111111102a18292204deadbeef2a0501020304051d6d3b1d1aa530452" +
    "8b96030c80138ac02420a77777777777777777777",
  ),
};

// ===========================================================================
// V5: KyberPreKeyRecord protobuf vector
// Protobuf schema: SignedPreKeyRecordStructure
//   field 1 (uint32):  id
//   field 2 (bytes):   publicKey  — with 0x08 KEM type prefix
//   field 3 (bytes):   secretKey  — with 0x08 KEM type prefix
//   field 4 (bytes):   signature
//   field 5 (fixed64): timestamp  — milliseconds since epoch, little-endian
// ===========================================================================

export const V5 = {
  id: 42,
  publicKey: new Uint8Array(8).fill(0xab),  // small test key
  secretKey: new Uint8Array(8).fill(0xcd),  // small test key
  signature: new Uint8Array(4).fill(0xef),
  timestamp: 1_700_000_000_000,  // 2023-11-14T22:13:20Z (milliseconds)
};
