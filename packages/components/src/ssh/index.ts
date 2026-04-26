/**
 * Copyright © 2025-2026 Parity Technologies
 *
 * SSH key/signature/certificate types — Ed25519 + ECDSA P-256 v1.
 * Mirrors the SSH support in Rust `bc-components-rust` feature `ssh`.
 */

export { SSHPublicKey } from "./ssh-public-key.js";
export { SSHPrivateKey } from "./ssh-private-key.js";
export { SSHSignature, type SshHashAlgorithm } from "./ssh-signature.js";
export { SSHCertificate } from "./ssh-certificate.js";
export {
  parseSshAlgorithm,
  sshAlgorithmName,
  SSH_ALGO_ED25519,
  SSH_ALGO_ECDSA_NISTP256,
  SSH_CURVE_NISTP256,
  type SshAlgorithm,
  type SshEcdsaCurve,
} from "./ssh-algorithm.js";
