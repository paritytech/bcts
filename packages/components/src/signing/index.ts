/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Digital signatures for various cryptographic schemes.
 *
 * This module provides a unified interface for creating and verifying digital
 * signatures using different cryptographic algorithms, including:
 *
 * - **Edwards Curve Schemes**: Ed25519 signatures (RFC 8032)
 * - **SR25519**: Schnorr over Ristretto25519 (Polkadot/Substrate)
 * - **Schnorr**: BIP-340 Schnorr signatures (secp256k1)
 * - **ECDSA**: ECDSA signatures (secp256k1)
 * - **SSH Schemes**: Ed25519, DSA, ECDSA P-256/P-384 via SSH agent (not yet fully implemented)
 *
 * The key types include:
 *
 * - `SigningPrivateKey` - Private keys for creating signatures
 * - `SigningPublicKey` - Public keys for verifying signatures
 * - `Signature` - The digital signatures themselves
 *
 * All types share a common interface through the `Signer` and `Verifier`
 * interfaces, and can be serialized to and from CBOR with appropriate tags.
 *
 * Ported from bc-components-rust/src/signing/mod.rs
 */

export type { Signer, Verifier } from "./signer.js";
export {
  SignatureScheme,
  defaultSignatureScheme,
  isSshScheme,
  createKeypair,
  createKeypairUsing,
} from "./signature-scheme.js";
export { Signature } from "./signature.js";
export { SigningPrivateKey } from "./signing-private-key.js";
export { SigningPublicKey } from "./signing-public-key.js";
