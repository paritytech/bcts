/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * SR25519 Module - Schnorr signatures over Ristretto25519
 *
 * This module provides SR25519 implementation for digital signatures.
 * SR25519 is the signature scheme used by Polkadot/Substrate.
 *
 * Key sizes:
 * - Private key (seed): 32 bytes
 * - Public key: 32 bytes
 * - Signature: 64 bytes
 */

export {
  Sr25519PrivateKey,
  SR25519_PRIVATE_KEY_SIZE,
  SR25519_PUBLIC_KEY_SIZE,
  SR25519_SIGNATURE_SIZE,
  SR25519_DEFAULT_CONTEXT,
} from "./sr25519-private-key.js";
export { Sr25519PublicKey } from "./sr25519-public-key.js";
