// Copyright © 2025 Signal Messenger, LLC
// Copyright © 2026 Parity Technologies

/**
 * Core type definitions for the triple ratchet protocol.
 */

import type { KeyPair, IdentityKeyPair, IdentityKey } from "@bcts/double-ratchet";
import type { ChainParams } from "@bcts/spqr";

// Re-export SPQR types used in our public API
export type { ChainParams } from "@bcts/spqr";

/** Opaque serialized SPQR state (protobuf bytes). */
export type PQRatchetState = Uint8Array;

/** Opaque serialized SPQR message (protobuf bytes). */
export type PQRatchetMessage = Uint8Array;

/** 32-byte auth key derived from PQXDH for initializing SPQR. */
export type InitialPQRKey = Uint8Array;

/** ML-KEM key pair (encapsulation + decapsulation keys). */
export interface KyberKeyPair {
  readonly publicKey: Uint8Array;
  readonly secretKey: Uint8Array;
}

/** ML-KEM ciphertext (opaque bytes from encapsulation). */
export type KyberCiphertext = Uint8Array;

/** Result of PQXDH key derivation: 96 bytes split into three 32-byte keys. */
export interface PQXDHDerivedKeys {
  readonly rootKey: Uint8Array;
  readonly chainKey: Uint8Array;
  readonly pqrAuthKey: InitialPQRKey;
}

/**
 * Alice's PQXDH session initialization parameters.
 *
 * Extends X3DH with ML-KEM encapsulation.
 */
export interface AlicePQXDHParameters {
  readonly ourIdentityKeyPair: IdentityKeyPair;
  readonly ourBaseKeyPair: KeyPair;
  readonly theirIdentityKey: IdentityKey;
  readonly theirSignedPreKey: Uint8Array;
  readonly theirOneTimePreKey: Uint8Array | undefined;
  readonly theirRatchetKey: Uint8Array;
  readonly theirKyberPreKey: Uint8Array;
  readonly kyberCiphertext: KyberCiphertext;
  readonly kyberSharedSecret: Uint8Array;
}

/**
 * Bob's PQXDH session initialization parameters.
 *
 * Extends X3DH with ML-KEM decapsulation.
 */
export interface BobPQXDHParameters {
  readonly ourIdentityKeyPair: IdentityKeyPair;
  readonly ourSignedPreKeyPair: KeyPair;
  readonly ourOneTimePreKeyPair: KeyPair | undefined;
  readonly ourRatchetKeyPair: KeyPair;
  readonly ourKyberKeyPair: KyberKeyPair;
  readonly theirIdentityKey: IdentityKey;
  readonly theirBaseKey: Uint8Array;
  readonly theirKyberCiphertext: KyberCiphertext;
}

/** SPQR chain parameters with self-session awareness. */
export interface TripleRatchetChainParams extends ChainParams {
  readonly selfSession: boolean;
}

/** Kyber pre-key IDs returned after processing a prekey message. */
export interface PreKeysUsed {
  readonly oneTimeEcPreKeyId: number | undefined;
  readonly signedEcPreKeyId: number;
  readonly kyberPreKeyId: number | undefined;
}
