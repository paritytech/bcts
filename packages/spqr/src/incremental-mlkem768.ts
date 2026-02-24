/**
 * Copyright © 2025 Signal Messenger, LLC
 * Copyright © 2026 Parity Technologies
 *
 * True incremental ML-KEM-768 implementation.
 *
 * Implements the libcrux-compatible incremental encapsulation split:
 *
 * - generate(): Splits the ML-KEM-768 public key into:
 *     hdr (pk1, 64 bytes) = rho(32) + H(ek)(32)   -- where H = SHA3-256
 *     ek  (pk2, 1152 bytes) = ByteEncode12(tHat)   -- the NTT vector
 *
 * - encaps1(hdr, rng): Uses only rho and H(ek) from the header to produce
 *     a REAL ct1 (960 bytes), shared secret (32 bytes), and
 *     encapsulation state (2080 bytes) for encaps2.
 *
 * - encaps2(ek, es): Completes the encapsulation using the tHat from pk2
 *     and the stored NTT randomness. Returns ct2 (128 bytes).
 *
 * - decaps(dk, ct1, ct2): Standard ML-KEM-768 decapsulation.
 *
 * Wire-compatible with Signal's Rust libcrux incremental implementation.
 */

import { sha3_256, sha3_512, shake256 } from "@noble/hashes/sha3.js";
import { u32 } from "@noble/hashes/utils.js";
import { genCrystals, XOF128 } from "@noble/post-quantum/_crystals.js";
import { ml_kem768 } from "@noble/post-quantum/ml-kem.js";
import type { RandomBytes } from "./types.js";

// ---- ML-KEM-768 constants ----

const N = 256;
const Q = 3329;
const F = 3303;
const ROOT_OF_UNITY = 17;
const K = 3;
const ETA1 = 2;
const ETA2 = 2;
const DU = 10;
const DV = 4;

// ---- Size constants ----

/** Size of the public key header: rho(32) + H(ek)(32) */
export const HEADER_SIZE = 64;

/** Size of the encapsulation key: ByteEncode12(tHat) = 3 * 384 = 1152 bytes */
export const EK_SIZE = 1152;

/** Size of the decapsulation (secret) key */
export const DK_SIZE = 2400;

/** Size of the first ciphertext fragment (ct[0..960]) */
export const CT1_SIZE = 960;

/** Size of the second ciphertext fragment (ct[960..1088]) */
export const CT2_SIZE = 128;

/** Size of the KEM shared secret */
export const SS_SIZE = 32;

/** Standard ML-KEM-768 full public key size */
export const FULL_PK_SIZE = 1184;

/** Standard ML-KEM-768 full ciphertext size */
export const FULL_CT_SIZE = 1088;

/** Size of the keygen seed */
export const KEYGEN_SEED_SIZE = 64;

/** Size of the encapsulation randomness (message m) */
export const ENCAPS_SEED_SIZE = 32;

/**
 * Size of the encapsulation state:
 *   r_as_ntt: K(3) * N(256) * 2 = 1536 bytes
 *   error2:   N(256) * 2 = 512 bytes
 *   randomness: 32 bytes
 *   Total: 2080 bytes
 */
export const ES_SIZE = 2080;

// ---- Initialize crystals NTT machinery ----

const { mod, nttZetas, NTT, bitsCoder } = genCrystals({
  N,
  Q,
  F,
  ROOT_OF_UNITY,
  newPoly: (n: number): Uint16Array => new Uint16Array(n),
  brvBits: 7,
  isKyber: true,
});

// ---- Polynomial operations (copied from noble ml-kem.ts, closure-scoped) ----

type Poly = Uint16Array;

function polyAdd(a: Poly, b: Poly): void {
  for (let i = 0; i < N; i++) a[i] = mod(a[i]! + b[i]!);
}

function polySub(a: Poly, b: Poly): void {
  for (let i = 0; i < N; i++) a[i] = mod(a[i]! - b[i]!);
}

function BaseCaseMultiply(
  a0: number,
  a1: number,
  b0: number,
  b1: number,
  zeta: number,
): { c0: number; c1: number } {
  const c0 = mod(a1 * b1 * zeta + a0 * b0);
  const c1 = mod(a0 * b1 + a1 * b0);
  return { c0, c1 };
}

function MultiplyNTTs(f: Poly, g: Poly): Poly {
  for (let i = 0; i < N / 2; i++) {
    let z = nttZetas[64 + (i >> 1)]!;
    if (i & 1) z = -z;
    const { c0, c1 } = BaseCaseMultiply(
      f[2 * i + 0]!,
      f[2 * i + 1]!,
      g[2 * i + 0]!,
      g[2 * i + 1]!,
      z,
    );
    f[2 * i + 0] = c0;
    f[2 * i + 1] = c1;
  }
  return f;
}

type XofGet = ReturnType<ReturnType<typeof XOF128>["get"]>;

function SampleNTT(xof: XofGet): Poly {
  const r: Poly = new Uint16Array(N);
  for (let j = 0; j < N; ) {
    const b = xof();
    if (b.length % 3) throw new Error("SampleNTT: unaligned block");
    for (let i = 0; j < N && i + 3 <= b.length; i += 3) {
      const d1 = ((b[i + 0]! >> 0) | (b[i + 1]! << 8)) & 0xfff;
      const d2 = ((b[i + 1]! >> 4) | (b[i + 2]! << 4)) & 0xfff;
      if (d1 < Q) r[j++] = d1;
      if (j < N && d2 < Q) r[j++] = d2;
    }
  }
  return r;
}

function sampleCBD(seed: Uint8Array, nonce: number, eta: number): Poly {
  const len = (eta * N) / 4;
  const buf = shake256
    .create({ dkLen: len })
    .update(seed)
    .update(new Uint8Array([nonce]))
    .digest();
  const r: Poly = new Uint16Array(N);
  const b32 = u32(buf);
  let bitLen = 0;
  let p = 0;
  let bb = 0;
  let t0 = 0;
  for (let i = 0; i < b32.length; i++) {
    let b = b32[i]!;
    for (let j = 0; j < 32; j++) {
      bb += b & 1;
      b >>= 1;
      bitLen += 1;
      if (bitLen === eta) {
        t0 = bb;
        bb = 0;
      } else if (bitLen === 2 * eta) {
        r[p++] = mod(t0 - bb);
        bb = 0;
        bitLen = 0;
      }
    }
  }
  if (bitLen) throw new Error(`sampleCBD: leftover bits: ${bitLen}`);
  return r;
}

// ---- Compress/decompress coders ----

const compress = (d: number): { encode: (i: number) => number; decode: (i: number) => number } => {
  if (d >= 12) return { encode: (i: number) => i, decode: (i: number) => i };
  const a = 2 ** (d - 1);
  return {
    encode: (i: number) => ((i << d) + Q / 2) / Q,
    decode: (i: number) => (i * Q + a) >>> d,
  };
};

const polyCoder = (d: number) => bitsCoder(d, compress(d));

// Coders for encoding/decoding polynomials
const poly12 = polyCoder(12); // for tHat encoding (ByteEncode12)
const polyDU = polyCoder(DU); // for u compression (du=10)
const polyDV = polyCoder(DV); // for v compression (dv=4)
const poly1 = polyCoder(1); // for message encoding (1-bit)

// ---- Key material ----

/** Generated ML-KEM-768 key material, split for incremental protocol */
export interface Keys {
  /** Public key header: rho(32) + SHA3-256(full_pk)(32) */
  hdr: Uint8Array;
  /** Encapsulation key: ByteEncode12(tHat) = 1152 bytes */
  ek: Uint8Array;
  /** Decapsulation (secret) key: full 2400-byte ML-KEM-768 secret key */
  dk: Uint8Array;
}

/** Result of encaps1: REAL ct1, shared secret, and encapsulation state */
export interface Encaps1Result {
  /** REAL ct1 (960 bytes) */
  ct1: Uint8Array;
  /** Encapsulation state (2080 bytes): r_as_ntt(1536) + error2(512) + m(32) */
  es: Uint8Array;
  /** REAL shared secret (32 bytes) */
  sharedSecret: Uint8Array;
}

// ---- Encapsulation state encoding ----

/**
 * Encode the encapsulation state as 2080 bytes:
 *   r_as_ntt: K polys, each 256 coefficients as uint16 LE = 1536 bytes
 *   error2: 1 poly, 256 coefficients as uint16 LE = 512 bytes
 *   randomness: 32 bytes (the message m)
 */
function encodeState(rHat: Poly[], e2: Poly, m: Uint8Array): Uint8Array {
  const state = new Uint8Array(ES_SIZE);
  let offset = 0;

  // r_as_ntt: K polynomials
  for (let k = 0; k < K; k++) {
    const poly = rHat[k]!;
    for (let i = 0; i < N; i++) {
      const val = poly[i]!;
      state[offset++] = val & 0xff;
      state[offset++] = (val >> 8) & 0xff;
    }
  }

  // error2: 1 polynomial
  for (let i = 0; i < N; i++) {
    const val = e2[i]!;
    state[offset++] = val & 0xff;
    state[offset++] = (val >> 8) & 0xff;
  }

  // randomness (message m)
  state.set(m, offset);

  return state;
}

/**
 * Decode the encapsulation state from 2080 bytes.
 * Includes the Issue 1275 endianness workaround.
 */
function decodeState(state: Uint8Array): {
  rHat: Poly[];
  e2: Poly;
  m: Uint8Array;
} {
  // Apply Issue 1275 workaround
  const fixedState = fixIssue1275(state);
  const st = fixedState ?? state;

  let offset = 0;

  // r_as_ntt: K polynomials
  const rHat: Poly[] = [];
  for (let k = 0; k < K; k++) {
    const poly = new Uint16Array(N);
    for (let i = 0; i < N; i++) {
      poly[i] = st[offset]! | (st[offset + 1]! << 8);
      offset += 2;
    }
    rHat.push(poly);
  }

  // error2: 1 polynomial
  const e2 = new Uint16Array(N);
  for (let i = 0; i < N; i++) {
    e2[i] = st[offset]! | (st[offset + 1]! << 8);
    offset += 2;
  }

  // randomness (message m)
  const m = st.slice(offset, offset + 32);

  return { rHat, e2, m };
}

// ---- Issue 1275 Endianness Workaround ----

/**
 * Port of Rust's potentially_fix_state_incorrectly_encoded_by_libcrux_issue_1275.
 *
 * Due to https://github.com/cryspen/libcrux/issues/1275, the encapsulation
 * state may contain error2 coefficients with wrong endianness.
 *
 * Error2 values should be in [-2, 2] (ETA2=2 for ML-KEM-768).
 * As uint16 LE, valid values are: 0x0000, 0x0001, 0x0002, 0xFFFF (-1), 0xFFFE (-2).
 * Bad-endian equivalents: 0x0100, 0x0200, 0xFEFF.
 *
 * Returns a fixed copy if endianness is wrong, or null if state is OK.
 */
function fixIssue1275(es: Uint8Array): Uint8Array | null {
  // error2 is at bytes [1536..2048] (after r_as_ntt, before randomness)
  const E2_START = K * N * 2; // 1536
  const E2_END = E2_START + N * 2; // 2048

  for (let i = E2_START; i < E2_END; i += 2) {
    const lo = es[i]!;
    const hi = es[i + 1]!;
    const val = lo | (hi << 8); // interpret as i16 LE

    // 0x0000 and 0xFFFF have same representation in both endiannesses
    if (val === 0x0000 || val === 0xffff) continue;

    // Good LE values: 0x0001, 0x0002, 0xFFFE
    if (val === 0x0001 || val === 0x0002 || val === 0xfffe) {
      return null; // Already correct
    }

    // Bad (big-endian) values: 0x0100, 0x0200, 0xFEFF
    if (val === 0x0100 || val === 0x0200 || val === 0xfeff) {
      return flipEndianness(es);
    }

    // Unknown value -- return null (use as-is)
    return null;
  }

  return null;
}

/**
 * Flip the endianness of all i16 values in the encapsulation state.
 * The last 32 bytes (randomness) are NOT flipped.
 */
function flipEndianness(es: Uint8Array): Uint8Array {
  const fixed = new Uint8Array(es);
  const coeffEnd = es.length - 32; // don't flip the last 32 bytes (randomness)
  for (let i = 0; i < coeffEnd; i += 2) {
    const tmp = fixed[i]!;
    fixed[i] = fixed[i + 1]!;
    fixed[i + 1] = tmp;
  }
  return fixed;
}

// ---- Key generation ----

/**
 * Generate an ML-KEM-768 keypair and split the public key.
 *
 * The ML-KEM-768 public key (1184 bytes) is:
 *   tHat = pk[0..1152]    (ByteEncode12 of NTT vector)
 *   rho  = pk[1152..1184]  (32-byte seed)
 *
 * The incremental split produces:
 *   hdr (pk1) = rho(32) + SHA3-256(pk)(32) = 64 bytes
 *   ek  (pk2) = tHat(1152) = ByteEncode12(tHat) = 1152 bytes
 *
 * @param rng - Random byte generator; must provide at least 64 bytes
 * @returns Split key material
 */
export function generate(rng: RandomBytes): Keys {
  const seed = rng(KEYGEN_SEED_SIZE);
  const { publicKey, secretKey } = ml_kem768.keygen(seed);

  // Standard pk layout: tHat(1152) || rho(32)
  const tHat = publicKey.slice(0, EK_SIZE); // 1152 bytes
  const rho = publicKey.slice(EK_SIZE); // 32 bytes
  const hEk = sha3_256(publicKey); // H(ek) = SHA3-256(full pk)

  // pk1 (header) = rho(32) || H(ek)(32)
  const hdr = new Uint8Array(HEADER_SIZE);
  hdr.set(rho, 0);
  hdr.set(hEk, 32);

  return {
    hdr,
    ek: tHat,
    dk: secretKey,
  };
}

// ---- Encapsulation Phase 1 ----

/**
 * Phase 1 of true incremental encapsulation.
 *
 * Uses only rho and H(ek) from the 64-byte header to produce:
 * - REAL ct1 (960 bytes): compress_du(u) where u = NTT^-1(A^T * rHat) + e1
 * - REAL shared secret: K-hat from SHA3-512(m || H(ek))
 * - Encapsulation state (2080 bytes): r_as_ntt + error2 + m
 *
 * @param hdr - The 64-byte header: rho(32) + H(ek)(32)
 * @param rng - Random byte generator
 * @returns Real ct1, encapsulation state, and real shared secret
 */
export function encaps1(hdr: Uint8Array, rng: RandomBytes): Encaps1Result {
  const rho = hdr.slice(0, 32);
  const hEk = hdr.slice(32, 64);

  // Step 1: m = random 32 bytes
  const m = rng(ENCAPS_SEED_SIZE);

  // Step 2: kr = SHA3-512(m || H(ek)) -> K-hat(32) || r(32)
  const kr = sha3_512.create().update(m).update(hEk).digest();
  const kHat = kr.slice(0, 32);
  const r = kr.slice(32, 64);

  // Step 3: Sample rHat[i] = NTT(CBD(r, i, ETA1))
  const rHat: Poly[] = [];
  for (let i = 0; i < K; i++) {
    rHat.push(NTT.encode(sampleCBD(r, i, ETA1)));
  }

  // Step 4: Generate A from rho via XOF128, compute u
  const x = XOF128(rho);
  const u: Poly[] = [];
  for (let i = 0; i < K; i++) {
    const e1 = sampleCBD(r, K + i, ETA2);
    const tmp = new Uint16Array(N);
    for (let j = 0; j < K; j++) {
      const aij = SampleNTT(x.get(i, j));
      polyAdd(tmp, MultiplyNTTs(aij, rHat[j]!.slice() as Poly));
    }
    polyAdd(e1, NTT.decode(tmp));
    u.push(e1);
  }
  x.clean();

  // Step 5: ct1 = compress_du(u) = encode each u[i] with du=10
  const ct1 = new Uint8Array(CT1_SIZE);
  for (let i = 0; i < K; i++) {
    const encoded = polyDU.encode(u[i]!);
    ct1.set(encoded, i * polyDU.bytesLen);
  }

  // Step 6: e2 = CBD(r, 2*K, ETA2)
  const e2 = sampleCBD(r, 2 * K, ETA2);

  // Step 7: Encode state
  const es = encodeState(rHat, e2, m);

  return {
    ct1,
    es,
    sharedSecret: kHat,
  };
}

// ---- Encapsulation Phase 2 ----

/**
 * Phase 2 of true incremental encapsulation.
 *
 * Uses the tHat from pk2 (ek) and the stored NTT randomness to compute ct2.
 *
 * @param ek - The 1152-byte encapsulation key (ByteEncode12(tHat))
 * @param es - The 2080-byte encapsulation state from encaps1
 * @returns ct2 (128 bytes) ONLY
 */
export function encaps2(ek: Uint8Array, es: Uint8Array): Uint8Array {
  const { rHat, e2, m } = decodeState(es);

  // Decode tHat from ek (ByteDecode12)
  const tHat: Poly[] = [];
  for (let i = 0; i < K; i++) {
    const slice = ek.subarray(i * poly12.bytesLen, (i + 1) * poly12.bytesLen);
    tHat.push(poly12.decode(slice));
  }

  // Compute v = NTT^-1(sum(tHat[i] * rHat[i])) + e2 + Decompress1(m)
  const tmp = new Uint16Array(N);
  for (let i = 0; i < K; i++) {
    polyAdd(tmp, MultiplyNTTs(tHat[i]!.slice() as Poly, rHat[i]!.slice() as Poly));
  }
  const v = NTT.decode(tmp);
  polyAdd(v, e2);

  // Decompress1(m) = decode m as 1-bit polynomial
  const mPoly = poly1.decode(m);
  polyAdd(v, mPoly);

  // ct2 = compress_dv(v)
  return polyDV.encode(v);
}

// ---- Decapsulation ----

/**
 * Decapsulate a split ciphertext using the decapsulation key.
 *
 * Concatenates ct1 (960 bytes) and ct2 (128 bytes) into a standard
 * 1088-byte ML-KEM-768 ciphertext, then performs standard decapsulation.
 *
 * @param dk - The 2400-byte decapsulation (secret) key
 * @param ct1 - First ciphertext fragment (960 bytes)
 * @param ct2 - Second ciphertext fragment (128 bytes)
 * @returns The 32-byte shared secret
 */
export function decaps(dk: Uint8Array, ct1: Uint8Array, ct2: Uint8Array): Uint8Array {
  const ct = new Uint8Array(FULL_CT_SIZE);
  ct.set(ct1.subarray(0, CT1_SIZE), 0);
  ct.set(ct2.subarray(0, CT2_SIZE), CT1_SIZE);
  return ml_kem768.decapsulate(ct, dk);
}

// ---- Validation ----

/**
 * Check whether an encapsulation key is consistent with a header.
 *
 * Reconstructs the full public key from pk2 (tHat) and pk1[0..32] (rho),
 * computes SHA3-256 of the full pk, and compares with H(ek) in the header.
 *
 * @param ek - Encapsulation key (1152 bytes = ByteEncode12(tHat))
 * @param hdr - Header (64 bytes = rho(32) + H(ek)(32))
 * @returns true if ek is consistent with the header
 */
export function ekMatchesHeader(ek: Uint8Array, hdr: Uint8Array): boolean {
  if (hdr.length < HEADER_SIZE || ek.length < EK_SIZE) {
    return false;
  }

  const rho = hdr.slice(0, 32);
  const expectedHash = hdr.slice(32, 64);

  // Reconstruct full pk: tHat(1152) || rho(32)
  const pk = new Uint8Array(FULL_PK_SIZE);
  pk.set(ek.subarray(0, EK_SIZE), 0);
  pk.set(rho, EK_SIZE);

  // Compute H(pk) and compare
  const actualHash = sha3_256(pk);

  // Constant-time comparison
  if (actualHash.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < actualHash.length; i++) {
    diff |= actualHash[i]! ^ expectedHash[i]!;
  }
  return diff === 0;
}
