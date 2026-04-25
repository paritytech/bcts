/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Top-level keypair helpers — produce a `(PrivateKeys, PublicKeys)` bundle
 * spanning both signing and encapsulation schemes in one call.
 *
 * Ported from bc-components-rust/src/keypair.rs
 */

import type { RandomNumberGenerator } from "@bcts/rand";
import { PrivateKeys } from "./private-keys.js";
import { PublicKeys } from "./public-keys.js";
import {
  defaultSignatureScheme,
  createKeypair as createSigningKeypair,
  createKeypairUsing as createSigningKeypairUsing,
} from "./signing/signature-scheme.js";
import type { SignatureScheme } from "./signing/signature-scheme.js";
import {
  defaultEncapsulationScheme,
  createEncapsulationKeypair,
  createEncapsulationKeypairUsing,
} from "./encapsulation/encapsulation-scheme.js";
import type { EncapsulationScheme } from "./encapsulation/encapsulation-scheme.js";

/**
 * Generates a key pair using the default signature and encapsulation schemes
 * (Schnorr + X25519).
 *
 * Mirrors Rust `pub fn keypair() -> (PrivateKeys, PublicKeys)`.
 */
export function keypair(): [PrivateKeys, PublicKeys] {
  return keypairOpt(defaultSignatureScheme(), defaultEncapsulationScheme());
}

/**
 * Generates a key pair using the default schemes and a provided RNG.
 *
 * Mirrors Rust `pub fn keypair_using(rng) -> Result<(PrivateKeys, PublicKeys)>`.
 *
 * Note: ML-KEM does not support deterministic generation. This helper uses
 * the default encapsulation scheme (X25519), which does.
 */
export function keypairUsing(rng: RandomNumberGenerator): [PrivateKeys, PublicKeys] {
  return keypairOptUsing(defaultSignatureScheme(), defaultEncapsulationScheme(), rng);
}

/**
 * Generates a key pair with explicit signature and encapsulation schemes.
 *
 * Mirrors Rust `pub fn keypair_opt(sig, enc) -> (PrivateKeys, PublicKeys)`.
 */
export function keypairOpt(
  signatureScheme: SignatureScheme,
  encapsulationScheme: EncapsulationScheme,
): [PrivateKeys, PublicKeys] {
  const [signingPrivateKey, signingPublicKey] = createSigningKeypair(signatureScheme);
  const [encapsulationPrivateKey, encapsulationPublicKey] =
    createEncapsulationKeypair(encapsulationScheme);
  const privateKeys = PrivateKeys.withKeys(signingPrivateKey, encapsulationPrivateKey);
  const publicKeys = PublicKeys.new(signingPublicKey, encapsulationPublicKey);
  return [privateKeys, publicKeys];
}

/**
 * Generates a key pair with explicit schemes and a provided RNG.
 *
 * Mirrors Rust `pub fn keypair_opt_using(sig, enc, rng) ->
 *   Result<(PrivateKeys, PublicKeys)>`.
 *
 * Throws if either scheme does not support deterministic generation
 * (e.g. ML-DSA / ML-KEM, or any SSH-based signing scheme).
 */
export function keypairOptUsing(
  signatureScheme: SignatureScheme,
  encapsulationScheme: EncapsulationScheme,
  rng: RandomNumberGenerator,
): [PrivateKeys, PublicKeys] {
  const [signingPrivateKey, signingPublicKey] = createSigningKeypairUsing(
    signatureScheme,
    rng,
  );
  const [encapsulationPrivateKey, encapsulationPublicKey] = createEncapsulationKeypairUsing(
    rng,
    encapsulationScheme,
  );
  const privateKeys = PrivateKeys.withKeys(signingPrivateKey, encapsulationPrivateKey);
  const publicKeys = PublicKeys.new(signingPublicKey, encapsulationPublicKey);
  return [privateKeys, publicKeys];
}
