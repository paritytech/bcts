/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Encrypted key module - Password-based and key-based key derivation
 *
 * This module provides types and operations for encrypting symmetric keys
 * using various key derivation functions (KDFs).
 *
 * Supported key derivation methods:
 * - HKDF: For deriving keys from high-entropy inputs (not passwords)
 * - PBKDF2: Password-based, widely compatible
 * - Scrypt: Memory-hard, resistant to GPU attacks
 * - Argon2id: Most secure for passwords (default)
 * - SSHAgent: Uses SSH agent for key derivation (not yet fully implemented)
 *
 * The main components are:
 * - `EncryptedKey`: Encrypted symmetric key with derivation parameters
 * - `KeyDerivationMethod`: Enum of supported methods
 * - `KeyDerivationParams`: Union type for method-specific parameters
 * - Individual parameter types: `HKDFParams`, `PBKDF2Params`, `ScryptParams`, `Argon2idParams`, `SSHAgentParams`
 *
 * Ported from bc-components-rust/src/encrypted_key/mod.rs
 */

// Enums
export { HashType, hashTypeToString, hashTypeToCbor, hashTypeFromCbor } from "./hash-type.js";
export {
  KeyDerivationMethod,
  defaultKeyDerivationMethod,
  keyDerivationMethodIndex,
  keyDerivationMethodFromIndex,
  keyDerivationMethodToString,
  keyDerivationMethodFromCbor,
} from "./key-derivation-method.js";

// Key derivation interface
export type { KeyDerivation } from "./key-derivation.js";

// Parameter types
export { HKDFParams, SALT_LEN } from "./hkdf-params.js";
export { PBKDF2Params, DEFAULT_PBKDF2_ITERATIONS } from "./pbkdf2-params.js";
export {
  ScryptParams,
  DEFAULT_SCRYPT_LOG_N,
  DEFAULT_SCRYPT_R,
  DEFAULT_SCRYPT_P,
} from "./scrypt-params.js";
export { Argon2idParams } from "./argon2id-params.js";
export { SSHAgentParams, SALT_LEN as SSH_AGENT_SALT_LEN } from "./ssh-agent-params.js";

// Union type and helpers
export {
  type KeyDerivationParams,
  hkdfParams,
  pbkdf2Params,
  scryptParams,
  argon2idParams,
  sshAgentParams,
  defaultKeyDerivationParams,
  keyDerivationParamsMethod,
  isPasswordBased,
  isSshAgent,
  lockWithParams,
  keyDerivationParamsToCbor,
  keyDerivationParamsToCborData,
  keyDerivationParamsToString,
  keyDerivationParamsFromCbor,
} from "./key-derivation-params.js";

// Main type
export { EncryptedKey } from "./encrypted-key.js";
