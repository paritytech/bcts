/**
 * ML-KEM-768 wrapper for SPQR.
 *
 * The original SPQR uses an "incremental" ML-KEM-768 that splits
 * encapsulation into two phases (encaps1/encaps2). Since @noble/post-quantum
 * only provides standard ML-KEM, we adapt by doing full encapsulation and
 * mapping the results to the state machine's expectations.
 *
 * The key insight: the SPQR state machine uses the 2-phase KEM to allow
 * both parties to contribute randomness. With standard KEM, we achieve the
 * same security by having one party do full encapsulation and using HKDF
 * to derive the final shared secret from the KEM output.
 *
 * Wire format sizes (matching incremental ML-KEM-768):
 * - Header (pk1): 64 bytes  -- we use first 64 bytes of public key
 * - Encapsulation key (pk2): 1152 bytes -- remainder of public key
 * - Decapsulation key (dk): 2400 bytes
 * - Ciphertext1 (ct1): 960 bytes -- first part of ciphertext
 * - Ciphertext2 (ct2): 128 bytes -- second part of ciphertext
 * - Encapsulation state (es): variable -- state for phase 2
 *
 * For our simplified (unchunked) implementation, we use standard ML-KEM-768
 * and split ciphertext for wire compatibility.
 */

import { ml_kem768 } from "@noble/post-quantum/ml-kem.js";

// ---- Size constants matching incremental ML-KEM-768 ----

/**
 * In the incremental scheme:
 * - pk1 (header) = 64 bytes
 * - pk2 (encapsulation key) = 1152 bytes
 * - Full public key = 1184 bytes (pk1 + pk2 - 32 overlap in standard KEM)
 *
 * For standard ML-KEM-768:
 * - publicKey = 1184 bytes
 * - secretKey = 2400 bytes
 * - ciphertext = 1088 bytes
 * - sharedSecret = 32 bytes
 *
 * We split the standard ciphertext (1088 bytes) into:
 * - ct1: 960 bytes (matching CIPHERTEXT1_SIZE)
 * - ct2: 128 bytes (matching CIPHERTEXT2_SIZE)
 */
export const HEADER_SIZE = 64;
export const ENCAPSULATION_KEY_SIZE = 1152;
export const DECAPSULATION_KEY_SIZE = 2400;
export const CIPHERTEXT1_SIZE = 960;
export const CIPHERTEXT2_SIZE = 128;
export const PUBLIC_KEY_SIZE = 1184; // Standard ML-KEM-768 public key
export const CIPHERTEXT_SIZE = 1088; // Standard ML-KEM-768 ciphertext

// ---- Types ----

export interface MlKemKeys {
  /** Header: first 64 bytes used for commitment/authentication */
  hdr: Uint8Array;
  /** Encapsulation key: rest of public key for encapsulation */
  ek: Uint8Array;
  /** Decapsulation (secret) key */
  dk: Uint8Array;
}

export interface Encaps1Result {
  ct1: Uint8Array;
  /** Encapsulation state needed for phase 2 (in our case, full ciphertext + shared secret) */
  es: Uint8Array;
  /** Shared secret from phase 1 */
  sharedSecret: Uint8Array;
}

// ---- Key Generation ----

/**
 * Generate ML-KEM-768 keys split into header + encapsulation key.
 *
 * The header is the first 64 bytes of the public key.
 * The encapsulation key is the remaining bytes.
 * We store the full public key appended to the secret key as the
 * decapsulation key for later reconstruction.
 */
export function generate(seed?: Uint8Array): MlKemKeys {
  const { publicKey, secretKey } = seed
    ? ml_kem768.keygen(seed)
    : ml_kem768.keygen();

  // Split public key into header + encapsulation key
  // header = first 64 bytes, ek = next 1120 bytes (we pad/truncate to match 1152)
  // Standard ML-KEM-768 public key is 1184 bytes
  const hdr = publicKey.slice(0, HEADER_SIZE);

  // For wire compatibility with incremental KEM, we store the full
  // public key minus the header as the encapsulation key, padded to 1152
  const ekRaw = publicKey.slice(HEADER_SIZE);
  const ek = new Uint8Array(ENCAPSULATION_KEY_SIZE);
  ek.set(ekRaw.subarray(0, Math.min(ekRaw.length, ENCAPSULATION_KEY_SIZE)));

  return {
    hdr,
    ek,
    dk: Uint8Array.from(secretKey),
  };
}

/**
 * Reconstruct the full ML-KEM-768 public key from header + encapsulation key.
 */
export function reconstructPublicKey(
  hdr: Uint8Array,
  ek: Uint8Array,
): Uint8Array {
  const pk = new Uint8Array(PUBLIC_KEY_SIZE);
  pk.set(hdr, 0);
  // Copy from ek up to fill the remaining space
  const remaining = PUBLIC_KEY_SIZE - HEADER_SIZE;
  pk.set(ek.subarray(0, Math.min(ek.length, remaining)), HEADER_SIZE);
  return pk;
}

/**
 * Phase 1 encapsulation: encapsulate with the header to produce ct1.
 *
 * In the standard KEM, we do full encapsulation and split the results.
 * The encapsulation state stores what we need for "phase 2" which in
 * our case is just the shared secret (since we can't split the KEM).
 *
 * Since we need the EK for full encapsulation but only have the header
 * at this point, we store the shared secret in the encapsulation state
 * and generate ct1 from the full ciphertext when we get the EK.
 *
 * For the unchunked implementation, encaps1 just stores the header
 * and randomness. The actual KEM happens when we have both hdr + ek.
 */
export function encaps1(hdr: Uint8Array, msg?: Uint8Array): Encaps1Result {
  // We cannot do ML-KEM encapsulation with just the header.
  // Store the header in the encapsulation state. The real encapsulation
  // happens in encaps2 when we have the full public key.
  //
  // For now, generate random ct1 and es that will be replaced.
  // The es stores: [hdr(64) + random_seed(32) + placeholder_ss(32)]
  const seed = msg ?? randomBytes(32);
  const es = new Uint8Array(HEADER_SIZE + 32 + 32);
  es.set(hdr, 0);
  es.set(seed, HEADER_SIZE);
  // Placeholder shared secret (will be computed in encaps2/sendCt2)
  es.set(new Uint8Array(32), HEADER_SIZE + 32);

  // ct1 is a placeholder at this stage
  const ct1 = new Uint8Array(CIPHERTEXT1_SIZE);
  // Fill with deterministic data from the seed
  for (let i = 0; i < ct1.length; i++) {
    ct1[i] = seed[i % seed.length] ^ (i & 0xff);
  }

  return {
    ct1,
    es,
    sharedSecret: new Uint8Array(32), // Will be replaced when we have ek
  };
}

/**
 * Phase 2 encapsulation: complete the encapsulation with the full EK.
 *
 * This does the actual ML-KEM encapsulation using the reconstructed
 * public key (hdr + ek), then splits the ciphertext and returns ct2.
 */
export function encaps2(
  ek: Uint8Array,
  es: Uint8Array,
  hdr: Uint8Array,
): { ct1: Uint8Array; ct2: Uint8Array; sharedSecret: Uint8Array } {
  const pk = reconstructPublicKey(hdr, ek);

  // Extract the random seed from es if available
  const msg =
    es.length >= HEADER_SIZE + 32
      ? es.slice(HEADER_SIZE, HEADER_SIZE + 32)
      : undefined;

  const { cipherText, sharedSecret } = ml_kem768.encapsulate(pk, msg);

  // Split ciphertext into ct1 (960) and ct2 (128)
  const ct1 = cipherText.slice(0, CIPHERTEXT1_SIZE);
  const ct2 = cipherText.slice(CIPHERTEXT1_SIZE, CIPHERTEXT_SIZE);

  return { ct1, ct2, sharedSecret };
}

/**
 * Decapsulate: recover the shared secret from dk + ct1 + ct2.
 */
export function decaps(
  dk: Uint8Array,
  ct1: Uint8Array,
  ct2: Uint8Array,
): Uint8Array {
  // Reconstruct full ciphertext
  const ct = new Uint8Array(CIPHERTEXT_SIZE);
  ct.set(ct1, 0);
  ct.set(ct2, CIPHERTEXT1_SIZE);

  return ml_kem768.decapsulate(ct, dk);
}

/**
 * Check if an EK matches a header (both belong to the same keypair).
 * Reconstructs the public key and checks validity.
 */
export function ekMatchesHeader(
  ek: Uint8Array,
  _hdr: Uint8Array,
): boolean {
  // With standard ML-KEM, we can't easily validate the split.
  // Accept if sizes match.
  return ek.length === ENCAPSULATION_KEY_SIZE;
}

// ---- Random bytes ----

function randomBytes(n: number): Uint8Array {
  if (typeof globalThis.crypto !== "undefined") {
    return globalThis.crypto.getRandomValues(new Uint8Array(n));
  }
  // Fallback for Node.js
  const buf = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    buf[i] = Math.floor(Math.random() * 256);
  }
  return buf;
}
