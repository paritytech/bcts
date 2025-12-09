/**
 * @blockchain-commons/components - Cryptographic components library
 * TypeScript implementation of Blockchain Commons' cryptographic components specification
 * Ported from bc-components-rust
 */

// Error handling
export { CryptoError, isError } from "./error.js";
export type { Result } from "./error.js";

// Utility functions
export { bytesToHex, hexToBytes, toBase64, fromBase64, bytesEqual } from "./utils.js";

// Basic cryptographic primitives
export { Digest } from "./digest.js";
export { Nonce } from "./nonce.js";
export { Salt } from "./salt.js";
export { Seed } from "./seed.js";
export type { SeedMetadata } from "./seed.js";

// References
export { Reference } from "./reference.js";
export type { ReferenceEncodingFormat } from "./reference.js";

// Identifier types
export { ARID } from "./arid.js";
export { UUID } from "./uuid.js";
export { XID } from "./xid.js";
export { URI } from "./uri.js";

// Key agreement (X25519)
export { X25519PrivateKey } from "./x25519-private-key.js";
export { X25519PublicKey } from "./x25519-public-key.js";

// Digital signatures (Ed25519)
export { Ed25519PrivateKey } from "./ed25519-private-key.js";
export { Ed25519PublicKey } from "./ed25519-public-key.js";

// Symmetric encryption
export { SymmetricKey } from "./symmetric-key.js";
export { AuthenticationTag } from "./authentication-tag.js";
export { EncryptedMessage } from "./encrypted-message.js";
