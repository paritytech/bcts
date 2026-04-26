/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

// Ported from bc-crypto-rust/src/lib.rs.
//
// The top-level re-export list mirrors Rust's `pub use` statements exactly.
// SHA-512 hash variants and CRC-32 helpers remain accessible via the `hash`
// namespace export, matching Rust's `pub mod hash;` (where they live as
// public functions inside a public module but are not re-exported at crate
// root).

// Public hash module — mirrors Rust `pub mod hash;`
export * as hash from "./hash.js";

// Error types
export { CryptoError, AeadError, type CryptoResult } from "./error.js";

// Memory zeroing
export { memzero, memzeroVecVecU8, type NumericTypedArray } from "./memzero.js";

// Hash constants
export { CRC32_SIZE, SHA256_SIZE, SHA512_SIZE } from "./hash.js";

// Hash functions — only the SHA-256 variants and core hashes are re-exported
// at top level, matching Rust `pub use hash::{...}` in `lib.rs:35-38`.
export {
  sha256,
  doubleSha256,
  sha512,
  hmacSha256,
  hmacSha512,
  pbkdf2HmacSha256,
  hkdfHmacSha256,
} from "./hash.js";

// Symmetric encryption constants
export {
  SYMMETRIC_KEY_SIZE,
  SYMMETRIC_NONCE_SIZE,
  SYMMETRIC_AUTH_SIZE,
} from "./symmetric-encryption.js";

// Symmetric encryption functions
export {
  aeadChaCha20Poly1305Encrypt,
  aeadChaCha20Poly1305EncryptWithAad,
  aeadChaCha20Poly1305Decrypt,
  aeadChaCha20Poly1305DecryptWithAad,
} from "./symmetric-encryption.js";

// Public key encryption constants
export { X25519_PRIVATE_KEY_SIZE, X25519_PUBLIC_KEY_SIZE } from "./public-key-encryption.js";

// Public key encryption functions
export {
  deriveAgreementPrivateKey,
  deriveSigningPrivateKey,
  x25519NewPrivateKeyUsing,
  x25519PublicKeyFromPrivateKey,
  x25519SharedKey,
} from "./public-key-encryption.js";

// ECDSA key constants
export {
  ECDSA_PRIVATE_KEY_SIZE,
  ECDSA_PUBLIC_KEY_SIZE,
  ECDSA_UNCOMPRESSED_PUBLIC_KEY_SIZE,
  ECDSA_MESSAGE_HASH_SIZE,
  ECDSA_SIGNATURE_SIZE,
  SCHNORR_PUBLIC_KEY_SIZE,
} from "./ecdsa-keys.js";

// ECDSA key functions
export {
  ecdsaNewPrivateKeyUsing,
  ecdsaPublicKeyFromPrivateKey,
  ecdsaDecompressPublicKey,
  ecdsaCompressPublicKey,
  ecdsaDerivePrivateKey,
  schnorrPublicKeyFromPrivateKey,
} from "./ecdsa-keys.js";

// ECDSA signing functions
export { ecdsaSign, ecdsaVerify } from "./ecdsa-signing.js";

// Schnorr signing constants
export { SCHNORR_SIGNATURE_SIZE } from "./schnorr-signing.js";

// Schnorr signing functions
export {
  schnorrSign,
  schnorrSignUsing,
  schnorrSignWithAuxRand,
  schnorrVerify,
} from "./schnorr-signing.js";

// Ed25519 constants
export {
  ED25519_PUBLIC_KEY_SIZE,
  ED25519_PRIVATE_KEY_SIZE,
  ED25519_SIGNATURE_SIZE,
} from "./ed25519-signing.js";

// Ed25519 functions
export {
  ed25519NewPrivateKeyUsing,
  ed25519PublicKeyFromPrivateKey,
  ed25519Sign,
  ed25519Verify,
} from "./ed25519-signing.js";

// Scrypt
export { scrypt, scryptOpt } from "./scrypt.js";

// Argon2id — only the default-params variant is exposed, matching Rust
// `pub use argon::argon2id;`. Custom-params callers should reach into
// `argon2idHashOpt` (TS-specific helper) only via package-internal imports.
export { argon2id } from "./argon.js";
