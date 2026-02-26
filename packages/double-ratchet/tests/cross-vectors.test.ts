/**
 * Hardcoded cross-implementation test vectors.
 *
 * Verifies that our crypto primitives produce identical output to
 * well-known reference implementations (RFC 5869, RFC 7748, RFC 2104,
 * NIST SP 800-38A, and libsignal).
 */

import { describe, it, expect } from "vitest";
import { hkdfSha256, hmacSha256 } from "../src/crypto/kdf.js";
import { x25519RawAgreement } from "../src/crypto/agreement.js";
import { xeddsaSign, xeddsaVerify } from "../src/crypto/xeddsa.js";
import { ChainKey } from "../src/ratchet/chain-key.js";
import { RootKey } from "../src/ratchet/root-key.js";
import { MessageKeys } from "../src/ratchet/message-keys.js";
import { aes256CbcEncrypt, aes256CbcDecrypt } from "../src/crypto/aes-cbc.js";
import { KeyPair } from "../src/keys/key-pair.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// 1. HKDF-SHA256 -- RFC 5869 Test Vectors
// ---------------------------------------------------------------------------

describe("HKDF-SHA256 (RFC 5869)", () => {
  it("Test Case 1: basic extraction and expansion", () => {
    const ikm = hexToBytes("0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b");
    const salt = hexToBytes("000102030405060708090a0b0c");
    const info = hexToBytes("f0f1f2f3f4f5f6f7f8f9");
    const expectedOkm =
      "3cb25f25faacd57a90434f64d0362f2a" +
      "2d2d0a90cf1a5a4c5db02d56ecc4c5bf" +
      "34007208d5b887185865";

    const okm = hkdfSha256(ikm, salt, info, 42);
    expect(bytesToHex(okm)).toBe(expectedOkm);
  });

  it("Test Case 3: zero-length salt and info", () => {
    const ikm = hexToBytes("0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b");
    const salt = undefined;
    const info = new Uint8Array(0);
    const expectedOkm =
      "8da4e775a563c18f715f802a063c5a31" +
      "b8a11f5c5ee1879ec3454e5f3c738d2d" +
      "9d201395faa4b61a96c8";

    const okm = hkdfSha256(ikm, salt, info, 42);
    expect(bytesToHex(okm)).toBe(expectedOkm);
  });

  it("Test Case 2: longer inputs (RFC 5869)", () => {
    // RFC 5869 Test Case 2
    const ikm = hexToBytes(
      "000102030405060708090a0b0c0d0e0f" +
        "101112131415161718191a1b1c1d1e1f" +
        "202122232425262728292a2b2c2d2e2f" +
        "303132333435363738393a3b3c3d3e3f" +
        "404142434445464748494a4b4c4d4e4f",
    );
    const salt = hexToBytes(
      "606162636465666768696a6b6c6d6e6f" +
        "707172737475767778797a7b7c7d7e7f" +
        "808182838485868788898a8b8c8d8e8f" +
        "909192939495969798999a9b9c9d9e9f" +
        "a0a1a2a3a4a5a6a7a8a9aaabacadaeaf",
    );
    const info = hexToBytes(
      "b0b1b2b3b4b5b6b7b8b9babbbcbdbebf" +
        "c0c1c2c3c4c5c6c7c8c9cacbcccdcecf" +
        "d0d1d2d3d4d5d6d7d8d9dadbdcdddedf" +
        "e0e1e2e3e4e5e6e7e8e9eaebecedeeef" +
        "f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff",
    );
    const expectedOkm =
      "b11e398dc80327a1c8e7f78c596a4934" +
      "4f012eda2d4efad8a050cc4c19afa97c" +
      "59045a99cac7827271cb41c65e590e09" +
      "da3275600c2f09b8367793a9aca3db71" +
      "cc30c58179ec3e87c14c01d5c1f3434f" +
      "1d87";

    const okm = hkdfSha256(ikm, salt, info, 82);
    expect(bytesToHex(okm)).toBe(expectedOkm);
  });
});

// ---------------------------------------------------------------------------
// 2. HMAC-SHA256 -- RFC 2104 / RFC 4231 Test Vectors
// ---------------------------------------------------------------------------

describe("HMAC-SHA256 (RFC 4231)", () => {
  it("Test Case 1: short key, 'Hi There'", () => {
    const key = hexToBytes("0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b");
    const data = new TextEncoder().encode("Hi There");
    const expected = "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7";

    const result = hmacSha256(key, data);
    expect(bytesToHex(result)).toBe(expected);
  });

  it("Test Case 2: 'Jefe' / 'what do ya want for nothing?'", () => {
    const key = new TextEncoder().encode("Jefe");
    const data = new TextEncoder().encode("what do ya want for nothing?");
    const expected = "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843";

    const result = hmacSha256(key, data);
    expect(bytesToHex(result)).toBe(expected);
  });

  it("Test Case 3: 20 x 0xaa key with 50 x 0xdd data", () => {
    const key = new Uint8Array(20).fill(0xaa);
    const data = new Uint8Array(50).fill(0xdd);
    const expected = "773ea91e36800e46854db8ebd09181a72959098b3ef8c122d9635514ced565fe";

    const result = hmacSha256(key, data);
    expect(bytesToHex(result)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// 3. X25519 Diffie-Hellman -- RFC 7748 Test Vectors
// ---------------------------------------------------------------------------

describe("X25519 (RFC 7748)", () => {
  const alicePrivate = "77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a";
  const alicePublic = "8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a";
  const bobPrivate = "5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb";
  const bobPublic = "de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f";
  const expectedShared = "4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742";

  it("Alice computes shared secret with Bob public key", () => {
    const shared = x25519RawAgreement(hexToBytes(alicePrivate), hexToBytes(bobPublic));
    expect(bytesToHex(shared)).toBe(expectedShared);
  });

  it("Bob computes the same shared secret with Alice public key", () => {
    const shared = x25519RawAgreement(hexToBytes(bobPrivate), hexToBytes(alicePublic));
    expect(bytesToHex(shared)).toBe(expectedShared);
  });

  it("rejects all-zero public key (low-order point)", () => {
    const zeroKey = new Uint8Array(32);
    expect(() => x25519RawAgreement(hexToBytes(alicePrivate), zeroKey)).toThrow("low-order");
  });

  it("rejects identity point (0x01 followed by zeros)", () => {
    const identityKey = new Uint8Array(32);
    identityKey[0] = 1;
    expect(() => x25519RawAgreement(hexToBytes(alicePrivate), identityKey)).toThrow("low-order");
  });
});

// ---------------------------------------------------------------------------
// 4. ChainKey Derivation Vectors
// ---------------------------------------------------------------------------

describe("ChainKey Derivation", () => {
  // Known seed from libsignal test_chain_key_derivation
  const seed = hexToBytes("8ab72d6f4cc5ac0d387eaf463378ddb28edd07385b1cb01250c715982e7ad48f");

  it("message key seed is deterministic", () => {
    const ck1 = new ChainKey(seed, 0);
    const ck2 = new ChainKey(seed, 0);
    expect(bytesToHex(ck1.messageKeySeed())).toBe(bytesToHex(ck2.messageKeySeed()));
  });

  it("next chain key is deterministic", () => {
    const ck1 = new ChainKey(seed, 0);
    const ck2 = new ChainKey(seed, 0);
    expect(bytesToHex(ck1.nextChainKey().key)).toBe(bytesToHex(ck2.nextChainKey().key));
  });

  it("next chain key matches HMAC-SHA256(seed, 0x02)", () => {
    const ck = new ChainKey(seed, 0);
    const next = ck.nextChainKey();
    const manual = hmacSha256(seed, new Uint8Array([0x02]));
    expect(bytesToHex(next.key)).toBe(bytesToHex(manual));
    expect(bytesToHex(next.key)).toBe(
      "28e8f8fee54b801eef7c5cfb2f17f32c7b334485bbb70fac6ec10342a246d15d",
    );
  });

  it("message key seed matches HMAC-SHA256(seed, 0x01)", () => {
    const ck = new ChainKey(seed, 0);
    const mks = ck.messageKeySeed();
    const manual = hmacSha256(seed, new Uint8Array([0x01]));
    expect(bytesToHex(mks)).toBe(bytesToHex(manual));
  });

  it("chaining produces distinct keys at every step", () => {
    let ck = new ChainKey(seed, 0);
    const seen = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const hex = bytesToHex(ck.key);
      expect(seen.has(hex)).toBe(false);
      seen.add(hex);
      ck = ck.nextChainKey();
    }
    expect(seen.size).toBe(10);
  });

  it("index increments correctly through chain", () => {
    let ck = new ChainKey(seed, 0);
    for (let i = 0; i < 5; i++) {
      expect(ck.index).toBe(i);
      ck = ck.nextChainKey();
    }
    expect(ck.index).toBe(5);
  });

  it("MessageKeys derivation produces correct cipher/mac/iv lengths", () => {
    const ck = new ChainKey(seed, 0);
    const mk = MessageKeys.deriveFrom(ck.messageKeySeed(), ck.index);
    expect(mk.cipherKey.length).toBe(32);
    expect(mk.macKey.length).toBe(32);
    expect(mk.iv.length).toBe(16);
    expect(mk.counter).toBe(0);
  });

  it("MessageKeys match libsignal test_chain_key_derivation", () => {
    const ck = new ChainKey(seed, 0);
    const mk = MessageKeys.deriveFrom(ck.messageKeySeed(), 0);
    expect(bytesToHex(mk.cipherKey)).toBe(
      "bf51e9d75e0e31031051f82a2491ffc084fa298b7793bd9db620056febf45217",
    );
    expect(bytesToHex(mk.macKey)).toBe(
      "c6c77d6a73a354337a56435e34607dfe48e3ace14e77314dc6abc172e7a7030b",
    );
  });
});

// ---------------------------------------------------------------------------
// 5. RootKey Ratchet Step Vector
// ---------------------------------------------------------------------------

describe("RootKey Ratchet Step", () => {
  // Deterministic root key and DH keys for reproducibility
  const rootKeyBytes = hexToBytes(
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  );
  const ourPrivateKey = hexToBytes(
    "77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a",
  );
  const theirPublicKey = hexToBytes(
    "de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f",
  );

  it("produces deterministic new root key and chain key", () => {
    const rk = new RootKey(rootKeyBytes);
    const kp = KeyPair.fromPrivateKey(ourPrivateKey);

    const [newRootKey1, newChainKey1] = rk.createChain(theirPublicKey, kp);
    const [newRootKey2, newChainKey2] = rk.createChain(theirPublicKey, kp);

    expect(bytesToHex(newRootKey1.key)).toBe(bytesToHex(newRootKey2.key));
    expect(bytesToHex(newChainKey1.key)).toBe(bytesToHex(newChainKey2.key));
  });

  it("new root key differs from original", () => {
    const rk = new RootKey(rootKeyBytes);
    const kp = KeyPair.fromPrivateKey(ourPrivateKey);
    const [newRootKey] = rk.createChain(theirPublicKey, kp);

    expect(bytesToHex(newRootKey.key)).not.toBe(bytesToHex(rootKeyBytes));
  });

  it("chain key starts at index 0", () => {
    const rk = new RootKey(rootKeyBytes);
    const kp = KeyPair.fromPrivateKey(ourPrivateKey);
    const [, chainKey] = rk.createChain(theirPublicKey, kp);

    expect(chainKey.index).toBe(0);
  });

  it("matches manual HKDF derivation", () => {
    // Manually compute: DH -> HKDF(salt=rootKey, ikm=shared, info="WhisperRatchet", len=64)
    const kp = KeyPair.fromPrivateKey(ourPrivateKey);
    const sharedSecret = kp.calculateAgreement(theirPublicKey);

    const info = new TextEncoder().encode("WhisperRatchet");
    const derived = hkdfSha256(sharedSecret, rootKeyBytes, info, 64);

    const rk = new RootKey(rootKeyBytes);
    const [newRootKey, newChainKey] = rk.createChain(theirPublicKey, kp);

    expect(bytesToHex(newRootKey.key)).toBe(bytesToHex(derived.slice(0, 32)));
    expect(bytesToHex(newChainKey.key)).toBe(bytesToHex(derived.slice(32, 64)));
  });

  it("different DH keys produce different ratchet outputs", () => {
    const rk = new RootKey(rootKeyBytes);

    const kp1 = KeyPair.fromPrivateKey(ourPrivateKey);
    const kp2 = KeyPair.fromPrivateKey(
      hexToBytes("5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb"),
    );

    const [newRk1] = rk.createChain(theirPublicKey, kp1);
    const [newRk2] = rk.createChain(theirPublicKey, kp2);

    expect(bytesToHex(newRk1.key)).not.toBe(bytesToHex(newRk2.key));
  });
});

// ---------------------------------------------------------------------------
// 6. AES-256-CBC Vectors
// ---------------------------------------------------------------------------

describe("AES-256-CBC", () => {
  describe("encrypt-then-decrypt round-trip", () => {
    it("round-trips with known key and IV", () => {
      const key = new Uint8Array(32).fill(0x01);
      const iv = new Uint8Array(16).fill(0x02);
      const plaintext = new TextEncoder().encode("Signal Protocol Test Vector");

      const ciphertext = aes256CbcEncrypt(plaintext, key, iv);
      const decrypted = aes256CbcDecrypt(ciphertext, key, iv);

      expect(bytesToHex(decrypted)).toBe(bytesToHex(plaintext));
    });

    it("ciphertext is a non-zero multiple of 16 bytes", () => {
      const key = new Uint8Array(32).fill(0x01);
      const iv = new Uint8Array(16).fill(0x02);
      const plaintext = new TextEncoder().encode("Signal Protocol Test Vector");

      const ciphertext = aes256CbcEncrypt(plaintext, key, iv);
      expect(ciphertext.length).toBeGreaterThan(0);
      expect(ciphertext.length % 16).toBe(0);
    });

    it("encrypt is deterministic (same key/iv/plaintext)", () => {
      const key = new Uint8Array(32).fill(0x01);
      const iv = new Uint8Array(16).fill(0x02);
      const plaintext = new TextEncoder().encode("Signal Protocol Test Vector");

      const ct1 = aes256CbcEncrypt(plaintext, key, iv);
      const ct2 = aes256CbcEncrypt(plaintext, key, iv);
      expect(bytesToHex(ct1)).toBe(bytesToHex(ct2));
    });
  });

  describe("NIST SP 800-38A AES-256-CBC vector (F.2.5)", () => {
    // NIST SP 800-38A, Section F.2.5: CBC-AES256.Encrypt
    // Note: NIST vectors do not use padding. Our implementation adds PKCS#7
    // padding, so we test with exactly 4 blocks (64 bytes) to verify core
    // cipher behavior, then account for the padding block.
    const key = hexToBytes("603deb1015ca71be2b73aef0857d7781" + "1f352c073b6108d72d9810a30914dff4");
    const iv = hexToBytes("000102030405060708090a0b0c0d0e0f");

    // 4 plaintext blocks from NIST
    const block1 = "6bc1bee22e409f96e93d7e117393172a";
    const block2 = "ae2d8a571e03ac9c9eb76fac45af8e51";
    const block3 = "30c81c46a35ce411e5fbc1191a0a52ef";
    const block4 = "f69f2445df4f9b17ad2b417be66c3710";
    const plaintext = hexToBytes(block1 + block2 + block3 + block4);

    // Expected ciphertext for the 4 blocks
    const expectedCt =
      "f58c4c04d6e5f1ba779eabfb5f7bfbd6" +
      "9cfc4e967edb808d679f777bc6702c7d" +
      "39f23369a9d9bacfa530e26304231461" +
      "b2eb05e2c39be9fcda6c19078c6a9d1b";

    it("first 64 bytes of ciphertext match NIST vector", () => {
      const ciphertext = aes256CbcEncrypt(plaintext, key, iv);
      // Our implementation adds a PKCS#7 padding block (16 bytes of 0x10)
      // so total ciphertext = 80 bytes. The first 64 bytes must match NIST.
      expect(ciphertext.length).toBe(80);
      expect(bytesToHex(ciphertext.slice(0, 64))).toBe(expectedCt);
    });

    it("decrypt recovers original plaintext", () => {
      const ciphertext = aes256CbcEncrypt(plaintext, key, iv);
      const decrypted = aes256CbcDecrypt(ciphertext, key, iv);
      expect(bytesToHex(decrypted)).toBe(bytesToHex(plaintext));
    });
  });

  describe("Signal aes_cbc_test vector", () => {
    const key = hexToBytes("4e22eb16d964779994222e82192ce9f747da72dc4abe49dfdeeb71d0ffe3796e");
    const iv = hexToBytes("6f8a557ddc0a140c878063a6d5f31d3d");
    const plaintext = hexToBytes("30736294a124482a4159");
    const expectedCiphertext = "dd3f573ab4508b9ed0e45e0baf5608f3";

    it("encrypt matches Signal test vector", () => {
      const ciphertext = aes256CbcEncrypt(plaintext, key, iv);
      expect(bytesToHex(ciphertext)).toBe(expectedCiphertext);
    });

    it("decrypt matches Signal test vector", () => {
      const decrypted = aes256CbcDecrypt(hexToBytes(expectedCiphertext), key, iv);
      expect(bytesToHex(decrypted)).toBe(bytesToHex(plaintext));
    });
  });

  describe("error cases", () => {
    it("rejects key of wrong length", () => {
      const badKey = new Uint8Array(16);
      const iv = new Uint8Array(16);
      const pt = new Uint8Array(16);
      expect(() => aes256CbcEncrypt(pt, badKey, iv)).toThrow("32 bytes");
    });

    it("rejects IV of wrong length", () => {
      const key = new Uint8Array(32);
      const badIv = new Uint8Array(8);
      const pt = new Uint8Array(16);
      expect(() => aes256CbcEncrypt(pt, key, badIv)).toThrow("16 bytes");
    });

    it("rejects empty ciphertext on decrypt", () => {
      const key = new Uint8Array(32);
      const iv = new Uint8Array(16);
      expect(() => aes256CbcDecrypt(new Uint8Array(0), key, iv)).toThrow("non-zero multiple");
    });

    it("rejects non-block-aligned ciphertext on decrypt", () => {
      const key = new Uint8Array(32);
      const iv = new Uint8Array(16);
      expect(() => aes256CbcDecrypt(new Uint8Array(15), key, iv)).toThrow("non-zero multiple");
    });
  });
});

// ---------------------------------------------------------------------------
// 7. XEdDSA Signature Vector
// ---------------------------------------------------------------------------

describe("XEdDSA", () => {
  // Use the RFC 7748 Alice private key as the signing key
  const privateKey = hexToBytes("77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a");
  const publicKey = hexToBytes("8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a");
  const message = new TextEncoder().encode("XEdDSA cross-vector test message");

  it("sign produces a 64-byte signature", () => {
    const sig = xeddsaSign(privateKey, message);
    expect(sig.length).toBe(64);
  });

  it("sign then verify succeeds", () => {
    const sig = xeddsaSign(privateKey, message);
    const valid = xeddsaVerify(publicKey, message, sig);
    expect(valid).toBe(true);
  });

  it("deterministic with fixed random input", () => {
    const random = new Uint8Array(64).fill(0x42);
    const sig1 = xeddsaSign(privateKey, message, random);
    const sig2 = xeddsaSign(privateKey, message, random);
    expect(bytesToHex(sig1)).toBe(bytesToHex(sig2));
  });

  it("verify fails when message is modified", () => {
    const sig = xeddsaSign(privateKey, message);
    const alteredMessage = new TextEncoder().encode("XEdDSA cross-vector test messagF");
    const valid = xeddsaVerify(publicKey, alteredMessage, sig);
    expect(valid).toBe(false);
  });

  it("verify fails when signature R byte is flipped", () => {
    const sig = xeddsaSign(privateKey, message);
    const badSig = new Uint8Array(sig);
    badSig[0] ^= 0x01; // flip one bit in R
    const valid = xeddsaVerify(publicKey, message, badSig);
    expect(valid).toBe(false);
  });

  it("verify fails when signature S byte is flipped", () => {
    const sig = xeddsaSign(privateKey, message);
    const badSig = new Uint8Array(sig);
    badSig[32] ^= 0x01; // flip one bit in S
    const valid = xeddsaVerify(publicKey, message, badSig);
    expect(valid).toBe(false);
  });

  it("verify fails with wrong public key", () => {
    const sig = xeddsaSign(privateKey, message);
    const wrongPublicKey = hexToBytes(
      "de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f",
    );
    const valid = xeddsaVerify(wrongPublicKey, message, sig);
    expect(valid).toBe(false);
  });

  it("rejects truncated signature", () => {
    const sig = xeddsaSign(privateKey, message);
    const truncated = sig.slice(0, 63);
    const valid = xeddsaVerify(publicKey, message, truncated);
    expect(valid).toBe(false);
  });

  it("signs empty message and verifies", () => {
    const empty = new Uint8Array(0);
    const sig = xeddsaSign(privateKey, empty);
    expect(xeddsaVerify(publicKey, empty, sig)).toBe(true);
  });

  it("signs large message and verifies", () => {
    const large = new Uint8Array(4096).fill(0xab);
    const sig = xeddsaSign(privateKey, large);
    expect(xeddsaVerify(publicKey, large, sig)).toBe(true);
  });
});
