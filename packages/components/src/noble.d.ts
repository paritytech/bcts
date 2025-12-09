/**
 * Ambient type declarations for @noble packages
 * These declarations help TypeScript resolve the @noble/* modules
 */

declare module "@noble/hashes/sha256" {
  export function sha256(data: Uint8Array): Uint8Array;
}

declare module "@noble/curves/ed25519" {
  export const ed25519ph: {
    getPublicKey(seed: Uint8Array): Uint8Array;
    sign(message: Uint8Array, seed: Uint8Array): Uint8Array;
    verify(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): boolean;
  };
  export function x25519(privateKey: Uint8Array): Uint8Array;
  export function x25519(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array;
}

declare module "@noble/ciphers/chacha" {
  export function chacha20poly1305(key: Uint8Array): {
    encrypt(nonce: Uint8Array, plaintext: Uint8Array, associatedData?: Uint8Array): Uint8Array;
    decrypt(nonce: Uint8Array, ciphertext: Uint8Array, associatedData?: Uint8Array): Uint8Array;
  };
}
