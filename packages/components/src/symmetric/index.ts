/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Symmetric cryptography types and operations.
 *
 * This module provides types and operations for symmetric encryption, where
 * the same key is used for both encryption and decryption. It implements the
 * ChaCha20-Poly1305 AEAD (Authenticated Encryption with Associated Data)
 * construction as specified in [RFC-8439](https://datatracker.ietf.org/doc/html/rfc8439).
 *
 * The main components are:
 *
 * - `SymmetricKey`: A 32-byte key used for both encryption and decryption
 * - `AuthenticationTag`: A 16-byte value that verifies message integrity
 * - `EncryptedMessage`: A complete encrypted message containing ciphertext,
 *   nonce, authentication tag, and optional additional authenticated data
 *   (AAD)
 *
 * Ported from bc-components-rust/src/symmetric/mod.rs
 */

export { SymmetricKey } from "./symmetric-key.js";
export { AuthenticationTag } from "./authentication-tag.js";
export { EncryptedMessage } from "./encrypted-message.js";
