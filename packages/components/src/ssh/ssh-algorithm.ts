/**
 * Copyright © 2025-2026 Parity Technologies
 *
 * SSH key algorithm identifiers.
 *
 * Mirrors the relevant subset of `ssh_key::Algorithm` (Rust crate
 * `ssh-key` v0.6.7). v1.1 supports the four algorithms `bc-components-rust`
 * actually wires through `SignatureScheme`:
 *
 *   - Ed25519 (`ssh-ed25519`)
 *   - DSA (`ssh-dss`) — 1024-bit p, 160-bit q, SHA-1
 *   - ECDSA P-256 (`ecdsa-sha2-nistp256`) — SHA-256
 *   - ECDSA P-384 (`ecdsa-sha2-nistp384`) — SHA-384
 *
 * Deferred (rust upstream blockers): RSA (commented out in
 * `signature_scheme.rs:80-81`), P-521 (`ssh-key` upstream bug
 * https://github.com/RustCrypto/SSH/issues/232), encrypted private
 * keys, `cert-v01@openssh.com`. See `SSH_PLAN.md` V2.A-V2.D.
 */

export type SshAlgorithm =
  | { kind: "ed25519" }
  | { kind: "dsa" }
  | { kind: "ecdsa"; curve: SshEcdsaCurve };

export type SshEcdsaCurve = "nistp256" | "nistp384";

/** Wire-format algorithm name as it appears in OpenSSH text and in the key blob. */
export const SSH_ALGO_ED25519 = "ssh-ed25519";
export const SSH_ALGO_DSA = "ssh-dss";
export const SSH_ALGO_ECDSA_NISTP256 = "ecdsa-sha2-nistp256";
export const SSH_ALGO_ECDSA_NISTP384 = "ecdsa-sha2-nistp384";

/** OpenSSH curve identifier embedded inside ECDSA key blobs. */
export const SSH_CURVE_NISTP256 = "nistp256";
export const SSH_CURVE_NISTP384 = "nistp384";

export function sshAlgorithmName(algo: SshAlgorithm): string {
  switch (algo.kind) {
    case "ed25519":
      return SSH_ALGO_ED25519;
    case "dsa":
      return SSH_ALGO_DSA;
    case "ecdsa":
      switch (algo.curve) {
        case "nistp256":
          return SSH_ALGO_ECDSA_NISTP256;
        case "nistp384":
          return SSH_ALGO_ECDSA_NISTP384;
      }
  }
}

export function parseSshAlgorithm(name: string): SshAlgorithm {
  switch (name) {
    case SSH_ALGO_ED25519:
      return { kind: "ed25519" };
    case SSH_ALGO_DSA:
      return { kind: "dsa" };
    case SSH_ALGO_ECDSA_NISTP256:
      return { kind: "ecdsa", curve: "nistp256" };
    case SSH_ALGO_ECDSA_NISTP384:
      return { kind: "ecdsa", curve: "nistp384" };
    default:
      throw new Error(
        `Unsupported SSH algorithm '${name}'. v1.1 supports ${SSH_ALGO_ED25519}, ${SSH_ALGO_DSA}, ${SSH_ALGO_ECDSA_NISTP256}, ${SSH_ALGO_ECDSA_NISTP384} (see SSH_PLAN.md V2 for RSA / P-521).`,
      );
  }
}

/**
 * Wire-format curve name corresponding to a `SshEcdsaCurve`.
 */
export function sshCurveName(curve: SshEcdsaCurve): string {
  switch (curve) {
    case "nistp256":
      return SSH_CURVE_NISTP256;
    case "nistp384":
      return SSH_CURVE_NISTP384;
  }
}

/**
 * Byte length of an uncompressed SEC1 point (`0x04 || X || Y`) for the curve.
 */
export function sshEcdsaPointLen(curve: SshEcdsaCurve): number {
  switch (curve) {
    case "nistp256":
      return 65;
    case "nistp384":
      return 97;
  }
}

/**
 * Byte length of the canonical (no sign byte) private scalar for the curve.
 */
export function sshEcdsaScalarLen(curve: SshEcdsaCurve): number {
  switch (curve) {
    case "nistp256":
      return 32;
    case "nistp384":
      return 48;
  }
}
