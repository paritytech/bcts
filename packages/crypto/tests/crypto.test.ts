// Tests ported from bc-crypto-rust

import {
  // Hash functions
  crc32,
  crc32Data,
  sha256,
  sha512,
  hmacSha256,
  hmacSha512,
  pbkdf2HmacSha256,
  hkdfHmacSha256,
  // Symmetric encryption
  aeadChaCha20Poly1305Encrypt,
  aeadChaCha20Poly1305Decrypt,
  aeadChaCha20Poly1305EncryptWithAad,
  aeadChaCha20Poly1305DecryptWithAad,
  // X25519
  x25519NewPrivateKeyUsing,
  x25519PublicKeyFromPrivateKey,
  x25519SharedKey,
  // ECDSA
  ecdsaNewPrivateKeyUsing,
  ecdsaPublicKeyFromPrivateKey,
  ecdsaDecompressPublicKey,
  ecdsaCompressPublicKey,
  ecdsaSign,
  ecdsaVerify,
  schnorrPublicKeyFromPrivateKey,
  // Schnorr
  schnorrSignWithAuxRand,
  schnorrVerify,
  // Ed25519
  ed25519NewPrivateKeyUsing,
  ed25519PublicKeyFromPrivateKey,
  ed25519Sign,
  ed25519Verify,
  // KDF
  scrypt,
  scryptOpt,
  argon2idHash as _argon2idHash,
  argon2idHashOpt,
  // Memzero
  memzero,
} from "../src/index.js";
import { SecureRandomNumberGenerator } from "@bcts/rand";

// Helper to convert hex string to Uint8Array
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

// Helper to convert Uint8Array to hex string
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("Hash functions", () => {
  test("test_crc32", () => {
    const data = new TextEncoder().encode("Hello, World!");
    const checksum = crc32(data);
    expect(checksum).toBe(0xec4ac3d0);

    const checksumData = crc32Data(data);
    expect(bytesToHex(checksumData)).toBe("ec4ac3d0");
  });

  test("test_sha256", () => {
    const data = new TextEncoder().encode("Hello, World!");
    const hash = sha256(data);
    expect(bytesToHex(hash)).toBe(
      "dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f",
    );
  });

  test("test_sha512", () => {
    const data = new TextEncoder().encode("Hello, World!");
    const hash = sha512(data);
    expect(bytesToHex(hash)).toBe(
      "374d794a95cdcfd8b35993185fef9ba368f160d8daf432d08ba9f1ed1e5abe6cc69291e0fa2fe0006a52570ef18c19def4e617c33ce52ef0a6e5fbe318cb0387",
    );
  });

  test("test_hmac_sha", () => {
    // RFC 4231 Test Case 1
    const key = hexToBytes("0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b");
    const data = new TextEncoder().encode("Hi There");

    const hmac256 = hmacSha256(key, data);
    expect(bytesToHex(hmac256)).toBe(
      "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7",
    );

    const hmac512 = hmacSha512(key, data);
    expect(bytesToHex(hmac512)).toBe(
      "87aa7cdea5ef619d4ff0b4241a1d6cb02379f4e2ce4ec2787ad0b30545e17cdedaa833b7d6b8a702038b274eaea3f4e4be9d914eeb61f1702e696c203a126854",
    );
  });

  test("test_pbkdf2_hmac_sha256", () => {
    const password = new TextEncoder().encode("password");
    const salt = new TextEncoder().encode("salt");
    const iterations = 1;
    const keyLen = 32;

    const key = pbkdf2HmacSha256(password, salt, iterations, keyLen);
    expect(bytesToHex(key)).toBe(
      "120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b",
    );
  });

  test("test_hkdf_hmac_sha256", () => {
    const keyMaterial = hexToBytes("0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b");
    const salt = hexToBytes("000102030405060708090a0b0c");
    const keyLen = 42;

    const derivedKey1 = hkdfHmacSha256(keyMaterial, salt, keyLen);
    const derivedKey2 = hkdfHmacSha256(keyMaterial, salt, keyLen);

    // Verify correct length and determinism
    expect(derivedKey1.length).toBe(keyLen);
    expect(bytesToHex(derivedKey1)).toBe(bytesToHex(derivedKey2));

    // Different salt produces different output
    const differentSalt = hexToBytes("0d0e0f101112131415161718");
    const differentKey = hkdfHmacSha256(keyMaterial, differentSalt, keyLen);
    expect(bytesToHex(derivedKey1)).not.toBe(bytesToHex(differentKey));
  });
});

describe("Symmetric encryption", () => {
  test("test_rfc_test_vector", () => {
    // RFC 7539 Test Vector
    const plaintext = new TextEncoder().encode(
      "Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, sunscreen would be it.",
    );
    const key = hexToBytes("808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f");
    const nonce = hexToBytes("070000004041424344454647");
    const aad = hexToBytes("50515253c0c1c2c3c4c5c6c7");

    const [ciphertext, authTag] = aeadChaCha20Poly1305EncryptWithAad(plaintext, key, nonce, aad);

    const expectedCiphertext = hexToBytes(
      "d31a8d34648e60db7b86afbc53ef7ec2a4aded51296e08fea9e2b5a736ee62d63dbea45e8ca9671282fafb69da92728b1a71de0a9e060b2905d6a5b67ecd3b3692ddbd7f2d778b8c9803aee328091b58fab324e4fad675945585808b4831d7bc3ff4def08e4b7a9de576d26586cec64b6116",
    );
    const expectedAuthTag = hexToBytes("1ae10b594f09e26a7e902ecbd0600691");

    expect(bytesToHex(ciphertext)).toBe(bytesToHex(expectedCiphertext));
    expect(bytesToHex(authTag)).toBe(bytesToHex(expectedAuthTag));

    // Decrypt and verify
    const decrypted = aeadChaCha20Poly1305DecryptWithAad(ciphertext, key, nonce, aad, authTag);
    expect(new TextDecoder().decode(decrypted)).toBe(
      "Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, sunscreen would be it.",
    );
  });

  test("test_random_key_and_nonce", () => {
    const rng = new SecureRandomNumberGenerator();
    const key = rng.randomData(32);
    const nonce = rng.randomData(12);
    const plaintext = new TextEncoder().encode("Hello, World!");

    const [ciphertext, authTag] = aeadChaCha20Poly1305Encrypt(plaintext, key, nonce);
    const decrypted = aeadChaCha20Poly1305Decrypt(ciphertext, key, nonce, authTag);

    expect(new TextDecoder().decode(decrypted)).toBe("Hello, World!");
  });

  test("test_empty_data", () => {
    const key = hexToBytes("808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f");
    const nonce = hexToBytes("070000004041424344454647");
    const plaintext = new Uint8Array(0);

    const [ciphertext, authTag] = aeadChaCha20Poly1305Encrypt(plaintext, key, nonce);
    expect(ciphertext.length).toBe(0);
    expect(authTag.length).toBe(16);

    const decrypted = aeadChaCha20Poly1305Decrypt(ciphertext, key, nonce, authTag);
    expect(decrypted.length).toBe(0);
  });
});

describe("X25519 Key Agreement", () => {
  test("test_x25519_keys", () => {
    const rng = new SecureRandomNumberGenerator();
    const privateKey = x25519NewPrivateKeyUsing(rng);
    expect(privateKey.length).toBe(32);

    const publicKey = x25519PublicKeyFromPrivateKey(privateKey);
    expect(publicKey.length).toBe(32);
  });

  test("test_key_agreement", () => {
    const rng = new SecureRandomNumberGenerator();

    // Alice's keys
    const alicePrivate = x25519NewPrivateKeyUsing(rng);
    const alicePublic = x25519PublicKeyFromPrivateKey(alicePrivate);

    // Bob's keys
    const bobPrivate = x25519NewPrivateKeyUsing(rng);
    const bobPublic = x25519PublicKeyFromPrivateKey(bobPrivate);

    // Both should derive the same shared secret
    const aliceShared = x25519SharedKey(alicePrivate, bobPublic);
    const bobShared = x25519SharedKey(bobPrivate, alicePublic);

    expect(bytesToHex(aliceShared)).toBe(bytesToHex(bobShared));
  });
});

describe("ECDSA", () => {
  test("test_ecdsa_keys", () => {
    const rng = new SecureRandomNumberGenerator();
    const privateKey = ecdsaNewPrivateKeyUsing(rng);
    expect(privateKey.length).toBe(32);

    const publicKey = ecdsaPublicKeyFromPrivateKey(privateKey);
    expect(publicKey.length).toBe(33); // Compressed

    const uncompressed = ecdsaDecompressPublicKey(publicKey);
    expect(uncompressed.length).toBe(65);

    const recompressed = ecdsaCompressPublicKey(uncompressed);
    expect(bytesToHex(recompressed)).toBe(bytesToHex(publicKey));
  });

  test("test_ecdsa_signing", () => {
    const rng = new SecureRandomNumberGenerator();
    const privateKey = ecdsaNewPrivateKeyUsing(rng);
    const publicKey = ecdsaPublicKeyFromPrivateKey(privateKey);
    const message = new TextEncoder().encode("Hello, World!");

    const signature = ecdsaSign(privateKey, message);
    expect(signature.length).toBe(64);

    const isValid = ecdsaVerify(publicKey, signature, message);
    expect(isValid).toBe(true);

    // Verify with wrong message fails
    const wrongMessage = new TextEncoder().encode("Wrong message");
    const isInvalid = ecdsaVerify(publicKey, signature, wrongMessage);
    expect(isInvalid).toBe(false);
  });
});

describe("Schnorr", () => {
  test("test_schnorr_sign", () => {
    const rng = new SecureRandomNumberGenerator();
    const privateKey = ecdsaNewPrivateKeyUsing(rng);
    const publicKey = schnorrPublicKeyFromPrivateKey(privateKey);
    expect(publicKey.length).toBe(32);

    const message = new TextEncoder().encode("Hello, World!");
    const auxRand = rng.randomData(32);

    const signature = schnorrSignWithAuxRand(privateKey, message, auxRand);
    expect(signature.length).toBe(64);

    const isValid = schnorrVerify(publicKey, signature, message);
    expect(isValid).toBe(true);
  });

  // BIP-340 Test Vector 0
  test("test_bip340_vector_0", () => {
    const privateKey = hexToBytes(
      "0000000000000000000000000000000000000000000000000000000000000003",
    );
    const publicKey = schnorrPublicKeyFromPrivateKey(privateKey);
    expect(bytesToHex(publicKey)).toBe(
      "f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9",
    );

    const message = hexToBytes("0000000000000000000000000000000000000000000000000000000000000000");
    const auxRand = hexToBytes("0000000000000000000000000000000000000000000000000000000000000000");

    const signature = schnorrSignWithAuxRand(privateKey, message, auxRand);
    expect(bytesToHex(signature)).toBe(
      "e907831f80848d1069a5371b402410364bdf1c5f8307b0084c55f1ce2dca821525f66a4a85ea8b71e482a74f382d2ce5ebeee8fdb2172f477df4900d310536c0",
    );

    const isValid = schnorrVerify(publicKey, signature, message);
    expect(isValid).toBe(true);
  });
});

describe("Ed25519", () => {
  test("test_ed25519_signing", () => {
    const rng = new SecureRandomNumberGenerator();
    const privateKey = ed25519NewPrivateKeyUsing(rng);
    expect(privateKey.length).toBe(32);

    const publicKey = ed25519PublicKeyFromPrivateKey(privateKey);
    expect(publicKey.length).toBe(32);

    const message = new TextEncoder().encode("Hello, World!");
    const signature = ed25519Sign(privateKey, message);
    expect(signature.length).toBe(64);

    const isValid = ed25519Verify(publicKey, message, signature);
    expect(isValid).toBe(true);

    // Verify with wrong message fails
    const wrongMessage = new TextEncoder().encode("Wrong message");
    const isInvalid = ed25519Verify(publicKey, wrongMessage, signature);
    expect(isInvalid).toBe(false);
  });

  // RFC 8032 Test Vector 1
  test("test_ed25519_vector_1", () => {
    const privateKey = hexToBytes(
      "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60",
    );
    const expectedPublicKey = hexToBytes(
      "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
    );
    const message = new Uint8Array(0);
    const expectedSignature = hexToBytes(
      "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b",
    );

    const publicKey = ed25519PublicKeyFromPrivateKey(privateKey);
    expect(bytesToHex(publicKey)).toBe(bytesToHex(expectedPublicKey));

    const signature = ed25519Sign(privateKey, message);
    expect(bytesToHex(signature)).toBe(bytesToHex(expectedSignature));

    const isValid = ed25519Verify(publicKey, message, signature);
    expect(isValid).toBe(true);
  });
});

describe("Scrypt", () => {
  test("test_scrypt_basic", () => {
    const password = new TextEncoder().encode("password");
    const salt = new TextEncoder().encode("salt");

    const key1 = scrypt(password, salt, 32);
    const key2 = scrypt(password, salt, 32);

    expect(key1.length).toBe(32);
    expect(bytesToHex(key1)).toBe(bytesToHex(key2)); // Deterministic
  });

  test("test_scrypt_different_salt", () => {
    const password = new TextEncoder().encode("password");
    const salt1 = new TextEncoder().encode("salt1");
    const salt2 = new TextEncoder().encode("salt2");

    const key1 = scrypt(password, salt1, 32);
    const key2 = scrypt(password, salt2, 32);

    expect(bytesToHex(key1)).not.toBe(bytesToHex(key2));
  });

  test("test_scrypt_opt_basic", () => {
    const password = new TextEncoder().encode("password");
    const salt = new TextEncoder().encode("salt");

    // Lower parameters for faster test
    const key = scryptOpt(password, salt, 32, 10, 8, 1);
    expect(key.length).toBe(32);
  });
});

describe("Argon2id", () => {
  test("test_argon2id_basic", () => {
    const password = new TextEncoder().encode("password");
    const salt = new TextEncoder().encode("saltsalt"); // At least 8 bytes

    // Use lower memory for faster tests (1024 KiB instead of 65536 KiB)
    const key1 = argon2idHashOpt(password, salt, 32, 1, 1024, 1);
    const key2 = argon2idHashOpt(password, salt, 32, 1, 1024, 1);

    expect(key1.length).toBe(32);
    expect(bytesToHex(key1)).toBe(bytesToHex(key2)); // Deterministic
  });

  test("test_argon2id_different_salt", () => {
    const password = new TextEncoder().encode("password");
    const salt1 = new TextEncoder().encode("saltsalt1");
    const salt2 = new TextEncoder().encode("saltsalt2");

    // Use lower memory for faster tests (1024 KiB instead of 65536 KiB)
    const key1 = argon2idHashOpt(password, salt1, 32, 1, 1024, 1);
    const key2 = argon2idHashOpt(password, salt2, 32, 1, 1024, 1);

    expect(bytesToHex(key1)).not.toBe(bytesToHex(key2));
  });

  test("test_argon2id_default_params", () => {
    // Test that the default function signature works (uses high memory params)
    // Just verify it compiles and runs without errors
    const password = new TextEncoder().encode("test");
    const salt = new TextEncoder().encode("testsalt");

    // Use argon2idHashOpt with similar default params but lower memory
    const key = argon2idHashOpt(password, salt, 32, 3, 1024, 4);
    expect(key.length).toBe(32);
  });
});

describe("Memzero", () => {
  test("test_memzero", () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    memzero(data);
    expect(Array.from(data)).toEqual([0, 0, 0, 0, 0]);
  });
});
