/**
 * Digital signatures for various cryptographic schemes.
 *
 * This module provides a unified interface for creating and verifying digital
 * signatures using different cryptographic algorithms, including:
 *
 * - **Edwards Curve Schemes**: Ed25519 signatures (RFC 8032)
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
export { SignatureScheme } from "./signature-scheme.js";
export { Signature } from "./signature.js";
export { SigningPrivateKey } from "./signing-private-key.js";
export { SigningPublicKey } from "./signing-public-key.js";
