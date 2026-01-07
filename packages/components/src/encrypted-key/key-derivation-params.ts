/**
 * Key derivation parameters union type
 *
 * This type represents the derivation parameters for all supported methods.
 * It provides a unified interface for locking and unlocking keys regardless
 * of the underlying derivation method.
 *
 * Ported from bc-components-rust/src/encrypted_key/key_derivation_params.rs
 */

import { type Cbor, expectArray, expectNumber } from "@bcts/dcbor";

import type { SymmetricKey } from "../symmetric/symmetric-key.js";
import type { EncryptedMessage } from "../symmetric/encrypted-message.js";
import { KeyDerivationMethod, keyDerivationMethodFromIndex } from "./key-derivation-method.js";
import { HKDFParams } from "./hkdf-params.js";
import { PBKDF2Params } from "./pbkdf2-params.js";
import { ScryptParams } from "./scrypt-params.js";
import { Argon2idParams } from "./argon2id-params.js";
import { SSHAgentParams } from "./ssh-agent-params.js";

/**
 * Union type representing key derivation parameters.
 *
 * Use the `method()` function to get the derivation method, and
 * `lock()`/`unlock()` for key operations.
 */
export type KeyDerivationParams =
  | { type: "hkdf"; params: HKDFParams }
  | { type: "pbkdf2"; params: PBKDF2Params }
  | { type: "scrypt"; params: ScryptParams }
  | { type: "argon2id"; params: Argon2idParams }
  | { type: "sshagent"; params: SSHAgentParams };

/**
 * Create HKDF derivation parameters.
 */
export function hkdfParams(params?: HKDFParams): KeyDerivationParams {
  return { type: "hkdf", params: params ?? HKDFParams.new() };
}

/**
 * Create PBKDF2 derivation parameters.
 */
export function pbkdf2Params(params?: PBKDF2Params): KeyDerivationParams {
  return { type: "pbkdf2", params: params ?? PBKDF2Params.new() };
}

/**
 * Create Scrypt derivation parameters.
 */
export function scryptParams(params?: ScryptParams): KeyDerivationParams {
  return { type: "scrypt", params: params ?? ScryptParams.new() };
}

/**
 * Create Argon2id derivation parameters.
 */
export function argon2idParams(params?: Argon2idParams): KeyDerivationParams {
  return { type: "argon2id", params: params ?? Argon2idParams.new() };
}

/**
 * Create SSH agent derivation parameters.
 *
 * @param idOrParams - Either an SSH key identity string or SSHAgentParams instance
 */
export function sshAgentParams(idOrParams: string | SSHAgentParams): KeyDerivationParams {
  if (typeof idOrParams === "string") {
    return { type: "sshagent", params: SSHAgentParams.new(idOrParams) };
  }
  return { type: "sshagent", params: idOrParams };
}

/**
 * Create default key derivation parameters (Argon2id).
 */
export function defaultKeyDerivationParams(): KeyDerivationParams {
  return argon2idParams();
}

/**
 * Get the key derivation method for the given parameters.
 */
export function keyDerivationParamsMethod(kdp: KeyDerivationParams): KeyDerivationMethod {
  switch (kdp.type) {
    case "hkdf":
      return KeyDerivationMethod.HKDF;
    case "pbkdf2":
      return KeyDerivationMethod.PBKDF2;
    case "scrypt":
      return KeyDerivationMethod.Scrypt;
    case "argon2id":
      return KeyDerivationMethod.Argon2id;
    case "sshagent":
      return KeyDerivationMethod.SSHAgent;
  }
}

/**
 * Check if the parameters use a password-based method.
 * Password-based methods (PBKDF2, Scrypt, Argon2id) are designed for
 * low-entropy secrets like passwords.
 */
export function isPasswordBased(kdp: KeyDerivationParams): boolean {
  return kdp.type === "pbkdf2" || kdp.type === "scrypt" || kdp.type === "argon2id";
}

/**
 * Check if the parameters use SSH Agent for key derivation.
 *
 * Note: SSH Agent key derivation is not yet functional in TypeScript.
 * This function is useful for detecting envelopes locked by other
 * implementations (e.g., Rust).
 */
export function isSshAgent(kdp: KeyDerivationParams): boolean {
  return kdp.type === "sshagent";
}

/**
 * Lock (encrypt) a content key using the derived key.
 */
export function lockWithParams(
  kdp: KeyDerivationParams,
  contentKey: SymmetricKey,
  secret: Uint8Array,
): EncryptedMessage {
  switch (kdp.type) {
    case "hkdf":
      return kdp.params.lock(contentKey, secret);
    case "pbkdf2":
      return kdp.params.lock(contentKey, secret);
    case "scrypt":
      return kdp.params.lock(contentKey, secret);
    case "argon2id":
      return kdp.params.lock(contentKey, secret);
    case "sshagent":
      return kdp.params.lock(contentKey, secret);
  }
}

/**
 * Convert KeyDerivationParams to CBOR.
 */
export function keyDerivationParamsToCbor(kdp: KeyDerivationParams): Cbor {
  switch (kdp.type) {
    case "hkdf":
      return kdp.params.toCbor();
    case "pbkdf2":
      return kdp.params.toCbor();
    case "scrypt":
      return kdp.params.toCbor();
    case "argon2id":
      return kdp.params.toCbor();
    case "sshagent":
      return kdp.params.toCbor();
  }
}

/**
 * Convert KeyDerivationParams to CBOR binary data.
 */
export function keyDerivationParamsToCborData(kdp: KeyDerivationParams): Uint8Array {
  return keyDerivationParamsToCbor(kdp).toData();
}

/**
 * Get string representation of KeyDerivationParams.
 */
export function keyDerivationParamsToString(kdp: KeyDerivationParams): string {
  switch (kdp.type) {
    case "hkdf":
      return kdp.params.toString();
    case "pbkdf2":
      return kdp.params.toString();
    case "scrypt":
      return kdp.params.toString();
    case "argon2id":
      return kdp.params.toString();
    case "sshagent":
      return kdp.params.toString();
  }
}

/**
 * Parse KeyDerivationParams from CBOR.
 */
export function keyDerivationParamsFromCbor(cborValue: Cbor): KeyDerivationParams {
  const array = expectArray(cborValue);
  if (array.length === 0) {
    throw new Error("Invalid KeyDerivationParams: empty array");
  }

  const index = expectNumber(array[0]);
  const method = keyDerivationMethodFromIndex(Number(index));

  if (method === undefined) {
    throw new Error(`Invalid KeyDerivationMethod index: ${index}`);
  }

  switch (method) {
    case KeyDerivationMethod.HKDF:
      return { type: "hkdf", params: HKDFParams.fromCbor(cborValue) };
    case KeyDerivationMethod.PBKDF2:
      return { type: "pbkdf2", params: PBKDF2Params.fromCbor(cborValue) };
    case KeyDerivationMethod.Scrypt:
      return { type: "scrypt", params: ScryptParams.fromCbor(cborValue) };
    case KeyDerivationMethod.Argon2id:
      return { type: "argon2id", params: Argon2idParams.fromCbor(cborValue) };
    case KeyDerivationMethod.SSHAgent:
      return { type: "sshagent", params: SSHAgentParams.fromCbor(cborValue) };
  }
}
