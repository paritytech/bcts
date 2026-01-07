// Tests ported from bc-crypto-rust

import {
  // Hash functions
  crc32,
  crc32Data,
  crc32DataOpt,
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
  deriveAgreementPrivateKey,
  deriveSigningPrivateKey,
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
  argon2idHashOpt,
  // Memzero
  memzero,
} from "../src/index.js";
import { SecureRandomNumberGenerator, makeFakeRandomNumberGenerator } from "@bcts/rand";

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
  // CRC32 test - matches Rust test vector exactly (lowercase "world")
  test("test_crc32", () => {
    const data = new TextEncoder().encode("Hello, world!");
    const checksum = crc32(data);
    expect(checksum).toBe(0xebe6c6e6);

    const checksumData = crc32Data(data);
    expect(bytesToHex(checksumData)).toBe("ebe6c6e6");

    // Little-endian variant - matches Rust crc32_data_opt(input, true)
    const checksumLittleEndian = crc32DataOpt(data, true);
    expect(bytesToHex(checksumLittleEndian)).toBe("e6c6e6eb");
  });

  // SHA-256 test - matches Rust test vector exactly
  test("test_sha256", () => {
    const data = new TextEncoder().encode(
      "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
    );
    const hash = sha256(data);
    expect(bytesToHex(hash)).toBe(
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    );
  });

  // SHA-512 test - matches Rust test vector exactly
  test("test_sha512", () => {
    const data = new TextEncoder().encode(
      "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
    );
    const hash = sha512(data);
    expect(bytesToHex(hash)).toBe(
      "204a8fc6dda82f0a0ced7beb8e08a41657c16ef468b228a8279be331a703c33596fd15c13b1b07f9aa1d3bea57789ca031ad85c7a71dd70354ec631238ca3445",
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

  // HKDF test - matches Rust test vector exactly
  test("test_hkdf_hmac_sha256", () => {
    const keyMaterial = new TextEncoder().encode("hello");
    const salt = hexToBytes("8e94ef805b93e683ff18");
    const keyLen = 32;

    const derivedKey = hkdfHmacSha256(keyMaterial, salt, keyLen);
    expect(bytesToHex(derivedKey)).toBe(
      "13485067e21af17c0900f70d885f02593c0e61e46f86450e4a0201a54c14db76",
    );

    // Different salt produces different output
    const differentSalt = hexToBytes("0d0e0f101112131415161718");
    const differentKey = hkdfHmacSha256(keyMaterial, differentSalt, keyLen);
    expect(bytesToHex(derivedKey)).not.toBe(bytesToHex(differentKey));
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

  // Cross-platform test vector from Rust bc-crypto implementation
  test("test_key_agreement_cross_platform", () => {
    const rng = makeFakeRandomNumberGenerator();

    // Alice's keys (deterministic from fake RNG)
    const alicePrivate = x25519NewPrivateKeyUsing(rng);
    expect(bytesToHex(alicePrivate)).toBe(
      "7eb559bbbf6cce2632cf9f194aeb50943de7e1cbad54dcfab27a42759f5e2fed",
    );
    const alicePublic = x25519PublicKeyFromPrivateKey(alicePrivate);
    expect(bytesToHex(alicePublic)).toBe(
      "f1bd7a7e118ea461eba95126a3efef543ebb78439d1574bedcbe7d89174cf025",
    );

    // Bob's keys (deterministic from fake RNG)
    const bobPrivate = x25519NewPrivateKeyUsing(rng);
    const bobPublic = x25519PublicKeyFromPrivateKey(bobPrivate);

    // Both should derive the same shared key
    const aliceShared = x25519SharedKey(alicePrivate, bobPublic);
    const bobShared = x25519SharedKey(bobPrivate, alicePublic);

    expect(bytesToHex(aliceShared)).toBe(bytesToHex(bobShared));

    // Verify exact value matches Rust implementation
    expect(bytesToHex(aliceShared)).toBe(
      "1e9040d1ff45df4bfca7ef2b4dd2b11101b40d91bf5bf83f8c83d53f0fbb6c23",
    );
  });

  // Test derive key functions with exact Rust test vectors
  test("test_derive_keys", () => {
    const password = new TextEncoder().encode("password");

    // Test deriveAgreementPrivateKey - matches Rust exactly
    const derivedAgreementKey = deriveAgreementPrivateKey(password);
    expect(bytesToHex(derivedAgreementKey)).toBe(
      "7b19769132648ff43ae60cbaa696d5be3f6d53e6645db72e2d37516f0729619f",
    );

    // Test deriveSigningPrivateKey - matches Rust exactly
    const derivedSigningKey = deriveSigningPrivateKey(password);
    expect(bytesToHex(derivedSigningKey)).toBe(
      "05cc550daa75058e613e606d9898fedf029e395911c43273a208b7e0e88e271b",
    );
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

  // ECDSA signature determinism test - matches Rust exactly
  test("test_ecdsa_signing_deterministic", () => {
    const MESSAGE = new TextEncoder().encode(
      "Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, sunscreen would be it.",
    );

    const rng = makeFakeRandomNumberGenerator();
    const privateKey = ecdsaNewPrivateKeyUsing(rng);
    const publicKey = ecdsaPublicKeyFromPrivateKey(privateKey);
    const signature = ecdsaSign(privateKey, MESSAGE);

    // Verify exact signature matches Rust implementation
    expect(bytesToHex(signature)).toBe(
      "e75702ed8f645ce7fe510507b2403029e461ef4570d12aa440e4f81385546a13740b7d16878ff0b46b1cbe08bc218ccb0b00937b61c4707de2ca6148508e51fb",
    );

    expect(ecdsaVerify(publicKey, signature, MESSAGE)).toBe(true);
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

  // BIP-340 Test Vector 1
  test("test_bip340_vector_1", () => {
    const privateKey = hexToBytes(
      "B7E151628AED2A6ABF7158809CF4F3C762E7160F38B4DA56A784D9045190CFEF",
    );
    const publicKey = schnorrPublicKeyFromPrivateKey(privateKey);
    expect(bytesToHex(publicKey).toLowerCase()).toBe(
      "dff1d77f2a671c5f36183726db2341be58feae1da2deced843240f7b502ba659",
    );

    const message = hexToBytes("243F6A8885A308D313198A2E03707344A4093822299F31D0082EFA98EC4E6C89");
    const auxRand = hexToBytes("0000000000000000000000000000000000000000000000000000000000000001");

    const signature = schnorrSignWithAuxRand(privateKey, message, auxRand);
    expect(bytesToHex(signature).toLowerCase()).toBe(
      "6896bd60eeae296db48a229ff71dfe071bde413e6d43f917dc8dcf8c78de33418906d11ac976abccb20b091292bff4ea897efcb639ea871cfa95f6de339e4b0a",
    );

    const isValid = schnorrVerify(publicKey, signature, message);
    expect(isValid).toBe(true);
  });

  // BIP-340 Test Vector 2
  test("test_bip340_vector_2", () => {
    const privateKey = hexToBytes(
      "C90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B14E5C9",
    );
    const publicKey = schnorrPublicKeyFromPrivateKey(privateKey);
    expect(bytesToHex(publicKey).toLowerCase()).toBe(
      "dd308afec5777e13121fa72b9cc1b7cc0139715309b086c960e18fd969774eb8",
    );

    const message = hexToBytes("7E2D58D8B3BCDF1ABADEC7829054F90DDA9805AAB56C77333024B9D0A508B75C");
    const auxRand = hexToBytes("C87AA53824B4D7AE2EB035A2B5BBBCCC080E76CDC6D1692C4B0B62D798E6D906");

    const signature = schnorrSignWithAuxRand(privateKey, message, auxRand);
    expect(bytesToHex(signature).toLowerCase()).toBe(
      "5831aaeed7b44bb74e5eab94ba9d4294c49bcf2a60728d8b4c200f50dd313c1bab745879a5ad954a72c45a91c3a51d3c7adea98d82f8481e0e1e03674a6f3fb7",
    );

    const isValid = schnorrVerify(publicKey, signature, message);
    expect(isValid).toBe(true);
  });

  // BIP-340 Test Vector 3
  test("test_bip340_vector_3", () => {
    const privateKey = hexToBytes(
      "0B432B2677937381AEF05BB02A66ECD012773062CF3FA2549E44F58ED2401710",
    );
    const publicKey = schnorrPublicKeyFromPrivateKey(privateKey);
    expect(bytesToHex(publicKey).toLowerCase()).toBe(
      "25d1dff95105f5253c4022f628a996ad3a0d95fbf21d468a1b33f8c160d8f517",
    );

    const message = hexToBytes("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");
    const auxRand = hexToBytes("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");

    const signature = schnorrSignWithAuxRand(privateKey, message, auxRand);
    expect(bytesToHex(signature).toLowerCase()).toBe(
      "7eb0509757e246f19449885651611cb965ecc1a187dd51b64fda1edc9637d5ec97582b9cb13db3933705b32ba982af5af25fd78881ebb32771fc5922efc66ea3",
    );

    const isValid = schnorrVerify(publicKey, signature, message);
    expect(isValid).toBe(true);
  });

  // BIP-340 Test Vector 4 (verification only)
  test("test_bip340_vector_4", () => {
    const publicKey = hexToBytes(
      "D69C3509BB99E412E68B0FE8544E72837DFA30746D8BE2AA65975F29D22DC7B9",
    );
    const message = hexToBytes("4DF3C3F68FCC83B27E9D42C90431A72499F17875C81A599B566C9889B9696703");
    const signature = hexToBytes(
      "00000000000000000000003B78CE563F89A0ED9414F5AA28AD0D96D6795F9C6376AFB1548AF603B3EB45C9F8207DEE1060CB71C04E80F593060B07D28308D7F4",
    );

    const isValid = schnorrVerify(publicKey, signature, message);
    expect(isValid).toBe(true);
  });

  // BIP-340 Test Vector 5 - public key not on the curve (should fail/throw)
  test("test_bip340_vector_5", () => {
    const publicKey = hexToBytes(
      "EEFDEA4CDB677750A420FEE807EACF21EB9898AE79B9768766E4FAA04A2D4A34",
    );
    const message = hexToBytes("243F6A8885A308D313198A2E03707344A4093822299F31D0082EFA98EC4E6C89");
    const signature = hexToBytes(
      "6CFF5C3BA86C69EA4B7376F31A9BCB4F74C1976089B2D9963DA2E5543E17776969E89B4C5564D00349106B8497785DD7D1D713A8AE82B32FA79D5F7FC407D39B",
    );

    // This should either throw or return false
    let result: boolean;
    try {
      result = schnorrVerify(publicKey, signature, message);
    } catch {
      result = false;
    }
    expect(result).toBe(false);
  });

  // BIP-340 Test Vector 6 - has_even_y(R) is false
  test("test_bip340_vector_6", () => {
    const publicKey = hexToBytes(
      "DFF1D77F2A671C5F36183726DB2341BE58FEAE1DA2DECED843240F7B502BA659",
    );
    const message = hexToBytes("243F6A8885A308D313198A2E03707344A4093822299F31D0082EFA98EC4E6C89");
    const signature = hexToBytes(
      "FFF97BD5755EEEA420453A14355235D382F6472F8568A18B2F057A14602975563CC27944640AC607CD107AE10923D9EF7A73C643E166BE5EBEAFA34B1AC553E2",
    );

    const isValid = schnorrVerify(publicKey, signature, message);
    expect(isValid).toBe(false);
  });

  // BIP-340 Test Vector 7 - negated message
  test("test_bip340_vector_7", () => {
    const publicKey = hexToBytes(
      "DFF1D77F2A671C5F36183726DB2341BE58FEAE1DA2DECED843240F7B502BA659",
    );
    const message = hexToBytes("243F6A8885A308D313198A2E03707344A4093822299F31D0082EFA98EC4E6C89");
    const signature = hexToBytes(
      "1FA62E331EDBC21C394792D2AB1100A7B432B013DF3F6FF4F99FCB33E0E1515F28890B3EDB6E7189B630448B515CE4F8622A954CFE545735AAEA5134FCCDB2BD",
    );

    const isValid = schnorrVerify(publicKey, signature, message);
    expect(isValid).toBe(false);
  });

  // BIP-340 Test Vector 8 - negated s value
  test("test_bip340_vector_8", () => {
    const publicKey = hexToBytes(
      "DFF1D77F2A671C5F36183726DB2341BE58FEAE1DA2DECED843240F7B502BA659",
    );
    const message = hexToBytes("243F6A8885A308D313198A2E03707344A4093822299F31D0082EFA98EC4E6C89");
    const signature = hexToBytes(
      "6CFF5C3BA86C69EA4B7376F31A9BCB4F74C1976089B2D9963DA2E5543E177769961764B3AA9B2FFCB6EF947B6887A226E8D7C93E00C5ED0C1834FF0D0C2E6DA6",
    );

    const isValid = schnorrVerify(publicKey, signature, message);
    expect(isValid).toBe(false);
  });

  // BIP-340 Test Vector 9 - sG - eP is infinite
  test("test_bip340_vector_9", () => {
    const publicKey = hexToBytes(
      "DFF1D77F2A671C5F36183726DB2341BE58FEAE1DA2DECED843240F7B502BA659",
    );
    const message = hexToBytes("243F6A8885A308D313198A2E03707344A4093822299F31D0082EFA98EC4E6C89");
    const signature = hexToBytes(
      "0000000000000000000000000000000000000000000000000000000000000000123DDA8328AF9C23A94C1FEECFD123BA4FB73476F0D594DCB65C6425BD186051",
    );

    const isValid = schnorrVerify(publicKey, signature, message);
    expect(isValid).toBe(false);
  });

  // BIP-340 Test Vector 10 - sG - eP is infinite (variant)
  test("test_bip340_vector_10", () => {
    const publicKey = hexToBytes(
      "DFF1D77F2A671C5F36183726DB2341BE58FEAE1DA2DECED843240F7B502BA659",
    );
    const message = hexToBytes("243F6A8885A308D313198A2E03707344A4093822299F31D0082EFA98EC4E6C89");
    const signature = hexToBytes(
      "00000000000000000000000000000000000000000000000000000000000000017615FBAF5AE28864013C099742DEADB4DBA87F11AC6754F93780D5A1837CF197",
    );

    const isValid = schnorrVerify(publicKey, signature, message);
    expect(isValid).toBe(false);
  });

  // BIP-340 Test Vector 11 - sig[0:32] is not an X coordinate on the curve
  test("test_bip340_vector_11", () => {
    const publicKey = hexToBytes(
      "DFF1D77F2A671C5F36183726DB2341BE58FEAE1DA2DECED843240F7B502BA659",
    );
    const message = hexToBytes("243F6A8885A308D313198A2E03707344A4093822299F31D0082EFA98EC4E6C89");
    const signature = hexToBytes(
      "4A298DACAE57395A15D0795DDBFD1DCB564DA82B0F269BC70A74F8220429BA1D69E89B4C5564D00349106B8497785DD7D1D713A8AE82B32FA79D5F7FC407D39B",
    );

    const isValid = schnorrVerify(publicKey, signature, message);
    expect(isValid).toBe(false);
  });

  // BIP-340 Test Vector 12 - sig[0:32] is equal to field size
  test("test_bip340_vector_12", () => {
    const publicKey = hexToBytes(
      "DFF1D77F2A671C5F36183726DB2341BE58FEAE1DA2DECED843240F7B502BA659",
    );
    const message = hexToBytes("243F6A8885A308D313198A2E03707344A4093822299F31D0082EFA98EC4E6C89");
    const signature = hexToBytes(
      "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F69E89B4C5564D00349106B8497785DD7D1D713A8AE82B32FA79D5F7FC407D39B",
    );

    const isValid = schnorrVerify(publicKey, signature, message);
    expect(isValid).toBe(false);
  });

  // BIP-340 Test Vector 13 - sig[32:64] is equal to curve order
  test("test_bip340_vector_13", () => {
    const publicKey = hexToBytes(
      "DFF1D77F2A671C5F36183726DB2341BE58FEAE1DA2DECED843240F7B502BA659",
    );
    const message = hexToBytes("243F6A8885A308D313198A2E03707344A4093822299F31D0082EFA98EC4E6C89");
    const signature = hexToBytes(
      "6CFF5C3BA86C69EA4B7376F31A9BCB4F74C1976089B2D9963DA2E5543E177769FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141",
    );

    const isValid = schnorrVerify(publicKey, signature, message);
    expect(isValid).toBe(false);
  });

  // BIP-340 Test Vector 14 - public key is not a valid X coordinate (should fail/throw)
  test("test_bip340_vector_14", () => {
    const publicKey = hexToBytes(
      "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC30",
    );
    const message = hexToBytes("243F6A8885A308D313198A2E03707344A4093822299F31D0082EFA98EC4E6C89");
    const signature = hexToBytes(
      "6CFF5C3BA86C69EA4B7376F31A9BCB4F74C1976089B2D9963DA2E5543E17776969E89B4C5564D00349106B8497785DD7D1D713A8AE82B32FA79D5F7FC407D39B",
    );

    // This should either throw or return false
    let result: boolean;
    try {
      result = schnorrVerify(publicKey, signature, message);
    } catch {
      result = false;
    }
    expect(result).toBe(false);
  });

  // BIP-340 Test Vector 15 - empty message
  test("test_bip340_vector_15", () => {
    const privateKey = hexToBytes(
      "0340034003400340034003400340034003400340034003400340034003400340",
    );
    const publicKey = schnorrPublicKeyFromPrivateKey(privateKey);
    expect(bytesToHex(publicKey).toLowerCase()).toBe(
      "778caa53b4393ac467774d09497a87224bf9fab6f6e68b23086497324d6fd117",
    );

    const message = hexToBytes("");
    const auxRand = hexToBytes("0000000000000000000000000000000000000000000000000000000000000000");

    const signature = schnorrSignWithAuxRand(privateKey, message, auxRand);
    expect(bytesToHex(signature).toLowerCase()).toBe(
      "71535db165ecd9fbbc046e5ffaea61186bb6ad436732fccc25291a55895464cf6069ce26bf03466228f19a3a62db8a649f2d560fac652827d1af0574e427ab63",
    );

    const isValid = schnorrVerify(publicKey, signature, message);
    expect(isValid).toBe(true);
  });

  // BIP-340 Test Vector 16 - 1 byte message
  test("test_bip340_vector_16", () => {
    const privateKey = hexToBytes(
      "0340034003400340034003400340034003400340034003400340034003400340",
    );
    const publicKey = schnorrPublicKeyFromPrivateKey(privateKey);

    const message = hexToBytes("11");
    const auxRand = hexToBytes("0000000000000000000000000000000000000000000000000000000000000000");

    const signature = schnorrSignWithAuxRand(privateKey, message, auxRand);
    expect(bytesToHex(signature).toLowerCase()).toBe(
      "08a20a0afef64124649232e0693c583ab1b9934ae63b4c3511f3ae1134c6a303ea3173bfea6683bd101fa5aa5dbc1996fe7cacfc5a577d33ec14564cec2bacbf",
    );

    const isValid = schnorrVerify(publicKey, signature, message);
    expect(isValid).toBe(true);
  });

  // BIP-340 Test Vector 17 - 17 byte message
  test("test_bip340_vector_17", () => {
    const privateKey = hexToBytes(
      "0340034003400340034003400340034003400340034003400340034003400340",
    );
    const publicKey = schnorrPublicKeyFromPrivateKey(privateKey);

    const message = hexToBytes("0102030405060708090A0B0C0D0E0F1011");
    const auxRand = hexToBytes("0000000000000000000000000000000000000000000000000000000000000000");

    const signature = schnorrSignWithAuxRand(privateKey, message, auxRand);
    expect(bytesToHex(signature).toLowerCase()).toBe(
      "5130f39a4059b43bc7cac09a19ece52b5d8699d1a71e3c52da9afdb6b50ac370c4a482b77bf960f8681540e25b6771ece1e5a37fd80e5a51897c5566a97ea5a5",
    );

    const isValid = schnorrVerify(publicKey, signature, message);
    expect(isValid).toBe(true);
  });

  // BIP-340 Test Vector 18 - 100 byte message
  test("test_bip340_vector_18", () => {
    const privateKey = hexToBytes(
      "0340034003400340034003400340034003400340034003400340034003400340",
    );
    const publicKey = schnorrPublicKeyFromPrivateKey(privateKey);

    const message = hexToBytes(
      "99999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999",
    );
    const auxRand = hexToBytes("0000000000000000000000000000000000000000000000000000000000000000");

    const signature = schnorrSignWithAuxRand(privateKey, message, auxRand);
    expect(bytesToHex(signature).toLowerCase()).toBe(
      "403b12b0d8555a344175ea7ec746566303321e5dbfa8be6f091635163eca79a8585ed3e3170807e7c03b720fc54c7b23897fcba0e9d0b4a06894cfd249f22367",
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

  // RFC 8032 Test Vector 2 - 1 byte message
  test("test_ed25519_vector_2", () => {
    const privateKey = hexToBytes(
      "4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb",
    );
    const expectedPublicKey = hexToBytes(
      "3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c",
    );
    const message = hexToBytes("72");
    const expectedSignature = hexToBytes(
      "92a009a9f0d4cab8720e820b5f642540a2b27b5416503f8fb3762223ebdb69da085ac1e43e15996e458f3613d0f11d8c387b2eaeb4302aeeb00d291612bb0c00",
    );

    const publicKey = ed25519PublicKeyFromPrivateKey(privateKey);
    expect(bytesToHex(publicKey)).toBe(bytesToHex(expectedPublicKey));

    const signature = ed25519Sign(privateKey, message);
    expect(bytesToHex(signature)).toBe(bytesToHex(expectedSignature));

    const isValid = ed25519Verify(publicKey, message, signature);
    expect(isValid).toBe(true);
  });

  // RFC 8032 Test Vector 3 - 2 byte message
  test("test_ed25519_vector_3", () => {
    const privateKey = hexToBytes(
      "c5aa8df43f9f837bedb7442f31dcb7b166d38535076f094b85ce3a2e0b4458f7",
    );
    const expectedPublicKey = hexToBytes(
      "fc51cd8e6218a1a38da47ed00230f0580816ed13ba3303ac5deb911548908025",
    );
    const message = hexToBytes("af82");
    const expectedSignature = hexToBytes(
      "6291d657deec24024827e69c3abe01a30ce548a284743a445e3680d7db5ac3ac18ff9b538d16f290ae67f760984dc6594a7c15e9716ed28dc027beceea1ec40a",
    );

    const publicKey = ed25519PublicKeyFromPrivateKey(privateKey);
    expect(bytesToHex(publicKey)).toBe(bytesToHex(expectedPublicKey));

    const signature = ed25519Sign(privateKey, message);
    expect(bytesToHex(signature)).toBe(bytesToHex(expectedSignature));

    const isValid = ed25519Verify(publicKey, message, signature);
    expect(isValid).toBe(true);
  });

  // RFC 8032 Test Vector 4 - 1023 byte message
  test("test_ed25519_vector_4", () => {
    const privateKey = hexToBytes(
      "f5e5767cf153319517630f226876b86c8160cc583bc013744c6bf255f5cc0ee5",
    );
    const expectedPublicKey = hexToBytes(
      "278117fc144c72340f67d0f2316e8386ceffbf2b2428c9c51fef7c597f1d426e",
    );
    const message = hexToBytes(
      "08b8b2b733424243760fe426a4b54908632110a66c2f6591eabd3345e3e4eb98fa6e264bf09efe12ee50f8f54e9f77b1e355f6c50544e23fb1433ddf73be84d879de7c0046dc4996d9e773f4bc9efe5738829adb26c81b37c93a1b270b20329d658675fc6ea534e0810a4432826bf58c941efb65d57a338bbd2e26640f89ffbc1a858efcb8550ee3a5e1998bd177e93a7363c344fe6b199ee5d02e82d522c4feba15452f80288a821a579116ec6dad2b3b310da903401aa62100ab5d1a36553e06203b33890cc9b832f79ef80560ccb9a39ce767967ed628c6ad573cb116dbefefd75499da96bd68a8a97b928a8bbc103b6621fcde2beca1231d206be6cd9ec7aff6f6c94fcd7204ed3455c68c83f4a41da4af2b74ef5c53f1d8ac70bdcb7ed185ce81bd84359d44254d95629e9855a94a7c1958d1f8ada5d0532ed8a5aa3fb2d17ba70eb6248e594e1a2297acbbb39d502f1a8c6eb6f1ce22b3de1a1f40cc24554119a831a9aad6079cad88425de6bde1a9187ebb6092cf67bf2b13fd65f27088d78b7e883c8759d2c4f5c65adb7553878ad575f9fad878e80a0c9ba63bcbcc2732e69485bbc9c90bfbd62481d9089beccf80cfe2df16a2cf65bd92dd597b0707e0917af48bbb75fed413d238f5555a7a569d80c3414a8d0859dc65a46128bab27af87a71314f318c782b23ebfe808b82b0ce26401d2e22f04d83d1255dc51addd3b75a2b1ae0784504df543af8969be3ea7082ff7fc9888c144da2af58429ec96031dbcad3dad9af0dcbaaaf268cb8fcffead94f3c7ca495e056a9b47acdb751fb73e666c6c655ade8297297d07ad1ba5e43f1bca32301651339e22904cc8c42f58c30c04aafdb038dda0847dd988dcda6f3bfd15c4b4c4525004aa06eeff8ca61783aacec57fb3d1f92b0fe2fd1a85f6724517b65e614ad6808d6f6ee34dff7310fdc82aebfd904b01e1dc54b2927094b2db68d6f903b68401adebf5a7e08d78ff4ef5d63653a65040cf9bfd4aca7984a74d37145986780fc0b16ac451649de6188a7dbdf191f64b5fc5e2ab47b57f7f7276cd419c17a3ca8e1b939ae49e488acba6b965610b5480109c8b17b80e1b7b750dfc7598d5d5011fd2dcc5600a32ef5b52a1ecc820e308aa342721aac0943bf6686b64b2579376504ccc493d97e6aed3fb0f9cd71a43dd497f01f17c0e2cb3797aa2a2f256656168e6c496afc5fb93246f6b1116398a346f1a641f3b041e989f7914f90cc2c7fff357876e506b50d334ba77c225bc307ba537152f3f1610e4eafe595f6d9d90d11faa933a15ef1369546868a7f3a45a96768d40fd9d03412c091c6315cf4fde7cb68606937380db2eaaa707b4c4185c32eddcdd306705e4dc1ffc872eeee475a64dfac86aba41c0618983f8741c5ef68d3a101e8a3b8cac60c905c15fc910840b94c00a0b9d0",
    );
    const expectedSignature = hexToBytes(
      "0aab4c900501b3e24d7cdf4663326a3a87df5e4843b2cbdb67cbf6e460fec350aa5371b1508f9f4528ecea23c436d94b5e8fcd4f681e30a6ac00a9704a188a03",
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

  // Test various output lengths - matches Rust test_scrypt_output_length
  test("test_scrypt_output_length", () => {
    const password = new TextEncoder().encode("password");
    const salt = new TextEncoder().encode("salt");

    for (const len of [16, 24, 32, 64]) {
      const output = scrypt(password, salt, len);
      expect(output.length).toBe(len);
    }
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
