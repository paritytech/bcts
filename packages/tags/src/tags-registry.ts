/**
 * CBOR Tags Registry
 *
 * This is a 1:1 port of the Rust bc-tags-rust implementation.
 *
 * @see https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2020-006-urtypes.md
 *
 * As of August 13 2022, the [IANA registry of CBOR tags](https://www.iana.org/assignments/cbor-tags/cbor-tags.xhtml)
 * has the following low-numbered values available:
 *
 * One byte encoding: 6-15, 19-20
 * Two byte encoding: 48-51, 53, 55-60, 62, 88-95, 99, 102, 105-109, 113-119,
 * 128-255
 *
 * Tags in the range 0-23 require "standards action" for the IANA to recognize.
 * Tags in the range 24-32767 require a specification to reserve.
 * Tags in the range 24-255 only require two bytes to encode.
 * Higher numbered tags are first-come, first-served.
 */

import {
  type Tag,
  createTag,
  type TagsStore,
  getGlobalTagsStore,
  registerTagsIn as registerDcborTagsIn,
} from "@bcts/dcbor";

// ============================================================================
// Standard IANA Tags (re-used from dcbor but defined here for completeness)
// ============================================================================

export const URI: Tag = createTag(32, "url");
export const UUID: Tag = createTag(37, "uuid");

// A previous version of the Envelope spec used tag #6.24 ("Encoded CBOR Item")
// as the header for the Envelope `leaf` case. Unfortunately, this was not a
// correct use of the tag, as the contents of #6.24 (RFC8949 §3.4.5.1) MUST
// always be a byte string, while we were simply using it as a wrapper/header
// for any dCBOR data item.
//
// https://www.rfc-editor.org/rfc/rfc8949.html#name-encoded-cbor-data-item
//
// The new leaf tag is #6.201, but we will still recognize #6.24 for backwards
// compatibility.

// The only two tags that Blockchain Commons has registered in the
// "Specification Required" range are the two tags for "Gordian Envelope"
// (#6.200) and "dCBOR/Envelope Leaf" (#6.201).

// ============================================================================
// Core Envelope tags.
// ============================================================================

export const ENCODED_CBOR: Tag = createTag(24, "encoded-cbor");
export const ENVELOPE: Tag = createTag(200, "envelope");
export const LEAF: Tag = createTag(201, "leaf"); // dCBOR data item
export const JSON: Tag = createTag(262, "json"); // bstr containing UTF-8 JSON text

// ============================================================================
// Envelope extension tags
// ============================================================================

export const KNOWN_VALUE: Tag = createTag(40000, "known-value");
export const DIGEST: Tag = createTag(40001, "digest");
export const ENCRYPTED: Tag = createTag(40002, "encrypted");
export const COMPRESSED: Tag = createTag(40003, "compressed");

// ============================================================================
// Tags for subtypes specific to Distributed Function Calls.
// ============================================================================

export const REQUEST: Tag = createTag(40004, "request");
export const RESPONSE: Tag = createTag(40005, "response");
export const FUNCTION: Tag = createTag(40006, "function");
export const PARAMETER: Tag = createTag(40007, "parameter");
export const PLACEHOLDER: Tag = createTag(40008, "placeholder");
export const REPLACEMENT: Tag = createTag(40009, "replacement");

export const X25519_PRIVATE_KEY: Tag = createTag(40010, "agreement-private-key");
export const X25519_PUBLIC_KEY: Tag = createTag(40011, "agreement-public-key");
export const ARID: Tag = createTag(40012, "arid");
export const PRIVATE_KEYS: Tag = createTag(40013, "crypto-prvkeys");
export const NONCE: Tag = createTag(40014, "nonce");
export const PASSWORD: Tag = createTag(40015, "password");
export const PRIVATE_KEY_BASE: Tag = createTag(40016, "crypto-prvkey-base");

export const PUBLIC_KEYS: Tag = createTag(40017, "crypto-pubkeys");
export const SALT: Tag = createTag(40018, "salt");
export const SEALED_MESSAGE: Tag = createTag(40019, "crypto-sealed");
export const SIGNATURE: Tag = createTag(40020, "signature");
export const SIGNING_PRIVATE_KEY: Tag = createTag(40021, "signing-private-key");
export const SIGNING_PUBLIC_KEY: Tag = createTag(40022, "signing-public-key");
export const SYMMETRIC_KEY: Tag = createTag(40023, "crypto-key");
export const XID: Tag = createTag(40024, "xid");
export const REFERENCE: Tag = createTag(40025, "reference");
export const EVENT: Tag = createTag(40026, "event");

export const ENCRYPTED_KEY: Tag = createTag(40027, "encrypted-key");
export const MLKEM_PRIVATE_KEY: Tag = createTag(40100, "mlkem-private-key");
export const MLKEM_PUBLIC_KEY: Tag = createTag(40101, "mlkem-public-key");
export const MLKEM_CIPHERTEXT: Tag = createTag(40102, "mlkem-ciphertext");
export const MLDSA_PRIVATE_KEY: Tag = createTag(40103, "mldsa-private-key");
export const MLDSA_PUBLIC_KEY: Tag = createTag(40104, "mldsa-public-key");
export const MLDSA_SIGNATURE: Tag = createTag(40105, "mldsa-signature");
export const SEED: Tag = createTag(40300, "seed");
export const HDKEY: Tag = createTag(40303, "hdkey");
export const DERIVATION_PATH: Tag = createTag(40304, "keypath");

export const USE_INFO: Tag = createTag(40305, "coin-info");
export const EC_KEY: Tag = createTag(40306, "eckey");
export const ADDRESS: Tag = createTag(40307, "address");
export const OUTPUT_DESCRIPTOR: Tag = createTag(40308, "output-descriptor");
export const SSKR_SHARE: Tag = createTag(40309, "sskr");
export const PSBT: Tag = createTag(40310, "psbt");
export const ACCOUNT_DESCRIPTOR: Tag = createTag(40311, "account-descriptor");
export const SSH_TEXT_PRIVATE_KEY: Tag = createTag(40800, "ssh-private");
export const SSH_TEXT_PUBLIC_KEY: Tag = createTag(40801, "ssh-public");
export const SSH_TEXT_SIGNATURE: Tag = createTag(40802, "ssh-signature");
export const SSH_TEXT_CERTIFICATE: Tag = createTag(40803, "ssh-certificate");

export const PROVENANCE_MARK: Tag = createTag(1347571542, "provenance");

// ============================================================================
// DEPRECATED TAGS
// ============================================================================
//
// The following tags are deprecated and should not be used in new code.
// Unfortunately, they are likely to be in active use by external developers,
// but should never have been used as they are in the range of CBOR tags
// requiring "Specification" action by IANA, which requires IANA experts to
// review and approve the specification. These are harder to get approved than
// "First Come First Served" tags, and we don't want to have to do that for
// every new tag we create. Most of these tags have been replaced by "First Come
// First Served" tags in the range of 40000+.

export const SEED_V1: Tag = createTag(300, "crypto-seed");
export const EC_KEY_V1: Tag = createTag(306, "crypto-eckey");
export const SSKR_SHARE_V1: Tag = createTag(309, "crypto-sskr");

export const HDKEY_V1: Tag = createTag(303, "crypto-hdkey");
export const DERIVATION_PATH_V1: Tag = createTag(304, "crypto-keypath");
export const USE_INFO_V1: Tag = createTag(305, "crypto-coin-info");
export const OUTPUT_DESCRIPTOR_V1: Tag = createTag(307, "crypto-output");
export const PSBT_V1: Tag = createTag(310, "crypto-psbt");
export const ACCOUNT_V1: Tag = createTag(311, "crypto-account");

// ============================================================================
// Tags for subtypes specific to AccountBundle (crypto-output).
// ============================================================================

export const OUTPUT_SCRIPT_HASH: Tag = createTag(400, "output-script-hash");
export const OUTPUT_WITNESS_SCRIPT_HASH: Tag = createTag(401, "output-witness-script-hash");
export const OUTPUT_PUBLIC_KEY: Tag = createTag(402, "output-public-key");
export const OUTPUT_PUBLIC_KEY_HASH: Tag = createTag(403, "output-public-key-hash");
export const OUTPUT_WITNESS_PUBLIC_KEY_HASH: Tag = createTag(404, "output-witness-public-key-hash");
export const OUTPUT_COMBO: Tag = createTag(405, "output-combo");
export const OUTPUT_MULTISIG: Tag = createTag(406, "output-multisig");
export const OUTPUT_SORTED_MULTISIG: Tag = createTag(407, "output-sorted-multisig");
export const OUTPUT_RAW_SCRIPT: Tag = createTag(408, "output-raw-script");
export const OUTPUT_TAPROOT: Tag = createTag(409, "output-taproot");
export const OUTPUT_COSIGNER: Tag = createTag(410, "output-cosigner");

// ============================================================================
// Registration Functions
// ============================================================================

/**
 * Register all Blockchain Commons tags in a specific tags store.
 * This matches the Rust function `register_tags_in()`.
 *
 * @param tagsStore - The tags store to register tags into
 */
export function registerTagsIn(tagsStore: TagsStore): void {
  // First register dcbor's tags
  registerDcborTagsIn(tagsStore);

  // Then register all Blockchain Commons tags
  const tags: Tag[] = [
    URI,
    UUID,
    ENCODED_CBOR,
    ENVELOPE,
    LEAF,
    JSON,
    KNOWN_VALUE,
    DIGEST,
    ENCRYPTED,
    COMPRESSED,
    REQUEST,
    RESPONSE,
    FUNCTION,
    PARAMETER,
    PLACEHOLDER,
    REPLACEMENT,
    EVENT,
    SEED_V1,
    EC_KEY_V1,
    SSKR_SHARE_V1,
    SEED,
    EC_KEY,
    SSKR_SHARE,
    X25519_PRIVATE_KEY,
    X25519_PUBLIC_KEY,
    ARID,
    PRIVATE_KEYS,
    NONCE,
    PASSWORD,
    PRIVATE_KEY_BASE,
    PUBLIC_KEYS,
    SALT,
    SEALED_MESSAGE,
    SIGNATURE,
    SIGNING_PRIVATE_KEY,
    SIGNING_PUBLIC_KEY,
    SYMMETRIC_KEY,
    XID,
    REFERENCE,
    ENCRYPTED_KEY,
    MLKEM_PRIVATE_KEY,
    MLKEM_PUBLIC_KEY,
    MLKEM_CIPHERTEXT,
    MLDSA_PRIVATE_KEY,
    MLDSA_PUBLIC_KEY,
    MLDSA_SIGNATURE,
    HDKEY_V1,
    DERIVATION_PATH_V1,
    USE_INFO_V1,
    OUTPUT_DESCRIPTOR_V1,
    PSBT_V1,
    ACCOUNT_V1,
    HDKEY,
    DERIVATION_PATH,
    USE_INFO,
    ADDRESS,
    OUTPUT_DESCRIPTOR,
    PSBT,
    ACCOUNT_DESCRIPTOR,
    SSH_TEXT_PRIVATE_KEY,
    SSH_TEXT_PUBLIC_KEY,
    SSH_TEXT_SIGNATURE,
    SSH_TEXT_CERTIFICATE,
    OUTPUT_SCRIPT_HASH,
    OUTPUT_WITNESS_SCRIPT_HASH,
    OUTPUT_PUBLIC_KEY,
    OUTPUT_PUBLIC_KEY_HASH,
    OUTPUT_WITNESS_PUBLIC_KEY_HASH,
    OUTPUT_COMBO,
    OUTPUT_MULTISIG,
    OUTPUT_SORTED_MULTISIG,
    OUTPUT_RAW_SCRIPT,
    OUTPUT_TAPROOT,
    OUTPUT_COSIGNER,
    PROVENANCE_MARK,
  ];

  tagsStore.insertAll(tags);
}

/**
 * Register all Blockchain Commons tags in the global tags store.
 * This matches the Rust function `register_tags()`.
 *
 * This function is idempotent - calling it multiple times is safe.
 */
export function registerTags(): void {
  const globalStore = getGlobalTagsStore();
  registerTagsIn(globalStore);
}
