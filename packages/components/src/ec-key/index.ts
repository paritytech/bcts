/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * EC key module - secp256k1 elliptic curve cryptography
 *
 * This module provides types and operations for elliptic curve cryptography
 * (ECC), specifically focusing on the secp256k1 curve used in Bitcoin and
 * other cryptocurrencies. It supports both traditional ECDSA (Elliptic Curve
 * Digital Signature Algorithm) and the newer Schnorr signature scheme
 * (BIP-340).
 *
 * The main components are:
 * - `ECPrivateKey`: A 32-byte private key for signing
 * - `ECPublicKey`: A 33-byte compressed public key for verification
 * - `ECUncompressedPublicKey`: A 65-byte uncompressed public key (legacy format)
 * - `SchnorrPublicKey`: A 32-byte x-only public key for BIP-340 Schnorr signatures
 *
 * Base interfaces (matching Rust traits):
 * - `ECKeyBase`: Base interface for all EC keys (data, hex)
 * - `ECKey`: Keys that can derive a public key
 * - `ECPublicKeyBase`: Public keys that can provide uncompressed form
 *
 * Ported from bc-components-rust/src/ec_key/mod.rs
 */

// Base interfaces (matching Rust traits)
export type { ECKeyBase, ECKey, ECPublicKeyBase } from "./ec-key-base.js";
export { isECKeyBase, isECKey, isECPublicKeyBase } from "./ec-key-base.js";

// Key classes
export { ECPrivateKey } from "./ec-private-key.js";
export { ECPublicKey } from "./ec-public-key.js";
export { ECUncompressedPublicKey } from "./ec-uncompressed-public-key.js";
export { SchnorrPublicKey } from "./schnorr-public-key.js";
