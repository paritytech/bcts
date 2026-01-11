/**
 * Generate command tests - 1:1 port of tests/test_generate.rs
 */

import { describe, it, expect } from "vitest";
import * as generate from "../src/cmd/generate/index.js";

describe("generate command", () => {
  describe("arid", () => {
    it("test_generate_arid", () => {
      const output1 = generate.arid.exec({ hex: false });
      const output2 = generate.arid.exec({ hex: false });
      // Two generated ARIDs should be different (random)
      expect(output1).not.toBe(output2);
      // Both should be valid ARID URs
      expect(output1).toMatch(/^ur:arid\//);
      expect(output2).toMatch(/^ur:arid\//);
    });
  });

  describe("digest", () => {
    it("test_generate_digest_arg", () => {
      const result = generate.digest.exec({
        data: "Hello",
      });
      expect(result).toBe(
        "ur:digest/hdcxcshelgqdcpjszedaykhsolztmuludmdsfxamwpdygltngylaatttkofddsetcfinrkcltpsp",
      );
    });
  });

  describe("key", () => {
    it("test_generate_key", () => {
      const output1 = generate.key.exec({});
      const output2 = generate.key.exec({});
      // Two generated keys should be different (random)
      expect(output1).not.toBe(output2);
      // Both should be valid crypto-key URs
      expect(output1).toMatch(/^ur:crypto-key\//);
      expect(output2).toMatch(/^ur:crypto-key\//);
    });
  });

  describe("nonce", () => {
    it("test_generate_nonce", () => {
      const output1 = generate.nonce.exec({});
      const output2 = generate.nonce.exec({});
      // Two generated nonces should be different (random)
      expect(output1).not.toBe(output2);
      // Both should be valid nonce URs
      expect(output1).toMatch(/^ur:nonce\//);
      expect(output2).toMatch(/^ur:nonce\//);
    });
  });

  describe("seed", () => {
    it("test_generate_seed", () => {
      const output1 = generate.seed.exec({});
      const output2 = generate.seed.exec({});
      // Two generated seeds should be different (random)
      expect(output1).not.toBe(output2);
      // Both should be valid seed URs
      expect(output1).toMatch(/^ur:seed\//);
      expect(output2).toMatch(/^ur:seed\//);
    });

    it("test_generate_seed_with_count", () => {
      const result = generate.seed.exec({
        count: 32,
      });
      // Should be a valid seed UR
      expect(result).toMatch(/^ur:seed\//);
    });

    it("test_generate_seed_with_bad_count", () => {
      expect(() => generate.seed.exec({ count: 15 })).toThrow();
      expect(() => generate.seed.exec({ count: 257 })).toThrow();
    });

    it("test_generate_seed_with_hex", () => {
      const result = generate.seed.exec({
        hex: "7e31b2b14b895e75cdb82c22b013527c",
      });
      expect(result).toBe("ur:seed/oyadgdkbehprpagrldhykpsnrodwcppfbwgmkemtaolbdt");
    });
  });

  describe("prvkeys", () => {
    it("test_generate_prvkeys", () => {
      const output1 = generate.prvKeys.exec({
        signing: generate.prvKeys.SigningScheme.Ed25519,
        encryption: generate.prvKeys.EncryptionScheme.X25519,
      });
      const output2 = generate.prvKeys.exec({
        signing: generate.prvKeys.SigningScheme.Ed25519,
        encryption: generate.prvKeys.EncryptionScheme.X25519,
      });
      // Two generated keys should be different (random)
      expect(output1).not.toBe(output2);
      // Both should be valid crypto-prvkeys URs
      expect(output1).toMatch(/^ur:crypto-prvkeys\//);
      expect(output2).toMatch(/^ur:crypto-prvkeys\//);
    });
  });

  describe("pubkeys", () => {
    it("test_generate_pubkeys", () => {
      const prvKeys =
        "ur:crypto-prvkeys/lftansgohdcxredidrnyhlnefzihclvepyfsvaemgsylfxamlstaprdnrsrkfmlukpaelrdtfgprtansgehdcxmybzpysoadgmcwoxlpensnfzwecspkihmkwlstvabzensbprnelssbfnqzbnfthlmycekeds";
      const result = generate.pubKeys.exec({
        prvKeys,
        comment: "",
      });
      expect(result).toBe(
        "ur:crypto-pubkeys/lftanshfhdcxfpfwzcparpckfhvlidynjepsltsgjlprostpcmgehsmedtlbcktajodispgsfroytansgrhdcxenrytyrlpknyosfnfwlrwkdwsknduogwlyhdrfdrftflnnksbzsaierhbdrnrfbbfdvlwsca",
      );
    });
  });
});
