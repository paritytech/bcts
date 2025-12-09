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

// DigestProvider interface
export type { DigestProvider } from "./digest-provider.js";
export { digestFromBytes } from "./digest-provider.js";

// Basic cryptographic primitives
export { Digest } from "./digest.js";
export { Nonce } from "./nonce.js";
export { Salt } from "./salt.js";
export { Seed } from "./seed.js";
export type { SeedMetadata } from "./seed.js";

// References
export { Reference } from "./reference.js";
export type { ReferenceEncodingFormat } from "./reference.js";

// Identifier types (from id/ module)
export { ARID, UUID, XID, URI } from "./id/index.js";

// Key agreement - X25519 (from x25519/ module)
export { X25519PrivateKey, X25519PublicKey } from "./x25519/index.js";

// Digital signatures - Ed25519 (from ed25519/ module)
export { Ed25519PrivateKey, Ed25519PublicKey } from "./ed25519/index.js";

// Symmetric encryption (from symmetric/ module)
// Note: These will be exported once implemented
// export { SymmetricKey, AuthenticationTag, EncryptedMessage } from "./symmetric/index.js";
