/**
 * @bcts/components - Cryptographic components library
 * TypeScript implementation of Blockchain Commons' cryptographic components specification
 * Ported from bc-components-rust
 */

// Error handling
export {
  ErrorKind,
  CryptoError,
  isError,
  isCryptoError,
  isCryptoErrorKind,
} from "./error.js";
export type {
  Result,
  ErrorData,
  InvalidSizeData,
  InvalidDataData,
  DataTooShortData,
} from "./error.js";

// PrivateKeyDataProvider interface
export type { PrivateKeyDataProvider } from "./private-key-data-provider.js";
export { isPrivateKeyDataProvider } from "./private-key-data-provider.js";

// Encrypter/Decrypter interfaces
export type { Encrypter, Decrypter } from "./encrypter.js";
export { isEncrypter, isDecrypter } from "./encrypter.js";

// JSON wrapper
export { JSON } from "./json.js";

// Compressed data
export { Compressed } from "./compressed.js";

// HKDF-based RNG
export { HKDFRng } from "./hkdf-rng.js";

// Utility functions
export { bytesToHex, hexToBytes, toBase64, fromBase64, bytesEqual } from "./utils.js";

// DigestProvider interface
export type { DigestProvider } from "./digest-provider.js";
export { digestFromBytes } from "./digest-provider.js";

// Basic cryptographic primitives
export { Digest } from "./digest.js";
export { Nonce } from "./nonce.js";
export { Salt } from "./salt.js";
export { Seed } from "./seed.js";
export type { SeedMetadata } from "./seed.js";

// References
export { Reference, isReferenceProvider } from "./reference.js";
export type { ReferenceEncodingFormat, ReferenceProvider } from "./reference.js";

// Identifier types (from id/ module)
export { ARID, UUID, XID, URI } from "./id/index.js";

// Key agreement - X25519 (from x25519/ module)
export { X25519PrivateKey, X25519PublicKey } from "./x25519/index.js";

// Digital signatures - Ed25519 (from ed25519/ module)
export { Ed25519PrivateKey, Ed25519PublicKey } from "./ed25519/index.js";

// SR25519 - Schnorr signatures over Ristretto25519 (from sr25519/ module)
// Used by Polkadot/Substrate
export {
  Sr25519PrivateKey,
  Sr25519PublicKey,
  SR25519_PRIVATE_KEY_SIZE,
  SR25519_PUBLIC_KEY_SIZE,
  SR25519_SIGNATURE_SIZE,
  SR25519_DEFAULT_CONTEXT,
} from "./sr25519/index.js";

// EC keys - secp256k1 (from ec-key/ module)
export type { ECKeyBase, ECKey, ECPublicKeyBase } from "./ec-key/index.js";
export {
  isECKeyBase,
  isECKey,
  isECPublicKeyBase,
  ECPrivateKey,
  ECPublicKey,
  ECUncompressedPublicKey,
  SchnorrPublicKey,
} from "./ec-key/index.js";

// Symmetric encryption (from symmetric/ module)
export { SymmetricKey, AuthenticationTag, EncryptedMessage } from "./symmetric/index.js";

// Digital signatures (from signing/ module)
export type { Signer, Verifier } from "./signing/index.js";
export {
  SignatureScheme,
  Signature,
  SigningPrivateKey,
  SigningPublicKey,
} from "./signing/index.js";
export {
  createKeypair,
  createKeypairUsing,
  defaultSignatureScheme,
  isSshScheme,
} from "./signing/signature-scheme.js";

// Key encapsulation (from encapsulation/ module)
export {
  EncapsulationScheme,
  EncapsulationPrivateKey,
  EncapsulationPublicKey,
  EncapsulationCiphertext,
  SealedMessage,
  defaultEncapsulationScheme,
  createEncapsulationKeypair,
  createEncapsulationKeypairUsing,
} from "./encapsulation/index.js";

// Encrypted key / Key derivation (from encrypted-key/ module)
export {
  HashType,
  hashTypeToString,
  hashTypeToCbor,
  hashTypeFromCbor,
  KeyDerivationMethod,
  defaultKeyDerivationMethod,
  keyDerivationMethodIndex,
  keyDerivationMethodFromIndex,
  keyDerivationMethodToString,
  keyDerivationMethodFromCbor,
  HKDFParams,
  SALT_LEN,
  PBKDF2Params,
  DEFAULT_PBKDF2_ITERATIONS,
  ScryptParams,
  DEFAULT_SCRYPT_LOG_N,
  DEFAULT_SCRYPT_R,
  DEFAULT_SCRYPT_P,
  Argon2idParams,
  hkdfParams,
  pbkdf2Params,
  scryptParams,
  argon2idParams,
  defaultKeyDerivationParams,
  keyDerivationParamsMethod,
  isPasswordBased,
  isSshAgent,
  lockWithParams,
  keyDerivationParamsToCbor,
  keyDerivationParamsToCborData,
  keyDerivationParamsToString,
  keyDerivationParamsFromCbor,
  EncryptedKey,
} from "./encrypted-key/index.js";
export type { KeyDerivation, KeyDerivationParams } from "./encrypted-key/index.js";

// Key management containers
export { PrivateKeyBase } from "./private-key-base.js";
export { PrivateKeys } from "./private-keys.js";
export type { PrivateKeysProvider } from "./private-keys.js";
export { PublicKeys } from "./public-keys.js";
export type { PublicKeysProvider } from "./public-keys.js";

// SSKR integration with CBOR/UR serialization
export {
  // Primary API (matches Rust bc-components naming)
  SSKRShare,
  SSKRShareCbor, // Implementation class (SSKRShare is the preferred name)
  sskrGenerateShares,
  sskrGenerateSharesUsing,
  sskrCombineShares,
  // Re-exports from @bcts/sskr for raw byte operations
  sskrGenerate,
  sskrGenerateUsing,
  sskrCombine,
  SSKRSecret,
  SSKRGroupSpec,
  SSKRSpec,
} from "./sskr.js";

// Post-quantum cryptography - ML-DSA (from mldsa/ module)
export {
  MLDSALevel,
  MLDSA_KEY_SIZES,
  mldsaPrivateKeySize,
  mldsaPublicKeySize,
  mldsaSignatureSize,
  mldsaLevelToString,
  mldsaLevelFromValue,
  mldsaGenerateKeypair,
  mldsaGenerateKeypairUsing,
  mldsaSign,
  mldsaVerify,
  MLDSAPrivateKey,
  MLDSAPublicKey,
  MLDSASignature,
} from "./mldsa/index.js";
export type { MLDSAKeypairData } from "./mldsa/index.js";

// Post-quantum cryptography - ML-KEM (from mlkem/ module)
export {
  MLKEMLevel,
  MLKEM_KEY_SIZES,
  mlkemPrivateKeySize,
  mlkemPublicKeySize,
  mlkemCiphertextSize,
  mlkemSharedSecretSize,
  mlkemLevelToString,
  mlkemLevelFromValue,
  mlkemGenerateKeypair,
  mlkemGenerateKeypairUsing,
  mlkemEncapsulate,
  mlkemDecapsulate,
  MLKEMPrivateKey,
  MLKEMPublicKey,
  MLKEMCiphertext,
} from "./mlkem/index.js";
export type {
  MLKEMKeypairData,
  MLKEMEncapsulationResult,
  MLKEMEncapsulationPair,
} from "./mlkem/index.js";

// Re-export commonly used tags for higher-level packages
// This allows packages like envelope to depend on components instead of tags directly
export {
  KNOWN_VALUE,
  // Envelope-related tags
  ENVELOPE,
  LEAF,
  ENCRYPTED,
  COMPRESSED,
} from "@bcts/tags";
