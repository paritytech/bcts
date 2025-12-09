import * as tags from "../src/index";
import { getGlobalTagsStore } from "@bcts/dcbor";

describe("Tags Registry", () => {
  describe("Core Envelope Tags", () => {
    it("should define ENCODED_CBOR tag (24)", () => {
      expect(tags.ENCODED_CBOR.value).toBe(24);
      expect(tags.ENCODED_CBOR.name).toBe("encoded-cbor");
    });

    it("should define ENVELOPE tag (200)", () => {
      expect(tags.ENVELOPE.value).toBe(200);
      expect(tags.ENVELOPE.name).toBe("envelope");
    });

    it("should define LEAF tag (201)", () => {
      expect(tags.LEAF.value).toBe(201);
      expect(tags.LEAF.name).toBe("leaf");
    });

    it("should define JSON tag (262)", () => {
      expect(tags.JSON.value).toBe(262);
      expect(tags.JSON.name).toBe("json");
    });
  });

  describe("Envelope Extension Tags", () => {
    it("should define KNOWN_VALUE tag (40000)", () => {
      expect(tags.KNOWN_VALUE.value).toBe(40000);
      expect(tags.KNOWN_VALUE.name).toBe("known-value");
    });

    it("should define DIGEST tag (40001)", () => {
      expect(tags.DIGEST.value).toBe(40001);
      expect(tags.DIGEST.name).toBe("digest");
    });

    it("should define ENCRYPTED tag (40002)", () => {
      expect(tags.ENCRYPTED.value).toBe(40002);
      expect(tags.ENCRYPTED.name).toBe("encrypted");
    });

    it("should define COMPRESSED tag (40003)", () => {
      expect(tags.COMPRESSED.value).toBe(40003);
      expect(tags.COMPRESSED.name).toBe("compressed");
    });
  });

  describe("Distributed Function Call Tags", () => {
    it("should define REQUEST tag (40004)", () => {
      expect(tags.REQUEST.value).toBe(40004);
      expect(tags.REQUEST.name).toBe("request");
    });

    it("should define RESPONSE tag (40005)", () => {
      expect(tags.RESPONSE.value).toBe(40005);
      expect(tags.RESPONSE.name).toBe("response");
    });

    it("should define FUNCTION tag (40006)", () => {
      expect(tags.FUNCTION.value).toBe(40006);
      expect(tags.FUNCTION.name).toBe("function");
    });

    it("should define PARAMETER tag (40007)", () => {
      expect(tags.PARAMETER.value).toBe(40007);
      expect(tags.PARAMETER.name).toBe("parameter");
    });

    it("should define PLACEHOLDER tag (40008)", () => {
      expect(tags.PLACEHOLDER.value).toBe(40008);
      expect(tags.PLACEHOLDER.name).toBe("placeholder");
    });

    it("should define REPLACEMENT tag (40009)", () => {
      expect(tags.REPLACEMENT.value).toBe(40009);
      expect(tags.REPLACEMENT.name).toBe("replacement");
    });
  });

  describe("Cryptographic Tags", () => {
    it("should define X25519_PRIVATE_KEY tag (40010)", () => {
      expect(tags.X25519_PRIVATE_KEY.value).toBe(40010);
      expect(tags.X25519_PRIVATE_KEY.name).toBe("agreement-private-key");
    });

    it("should define X25519_PUBLIC_KEY tag (40011)", () => {
      expect(tags.X25519_PUBLIC_KEY.value).toBe(40011);
      expect(tags.X25519_PUBLIC_KEY.name).toBe("agreement-public-key");
    });

    it("should define ARID tag (40012)", () => {
      expect(tags.ARID.value).toBe(40012);
      expect(tags.ARID.name).toBe("arid");
    });

    it("should define PRIVATE_KEYS tag (40013)", () => {
      expect(tags.PRIVATE_KEYS.value).toBe(40013);
      expect(tags.PRIVATE_KEYS.name).toBe("crypto-prvkeys");
    });

    it("should define NONCE tag (40014)", () => {
      expect(tags.NONCE.value).toBe(40014);
      expect(tags.NONCE.name).toBe("nonce");
    });

    it("should define PASSWORD tag (40015)", () => {
      expect(tags.PASSWORD.value).toBe(40015);
      expect(tags.PASSWORD.name).toBe("password");
    });

    it("should define PRIVATE_KEY_BASE tag (40016)", () => {
      expect(tags.PRIVATE_KEY_BASE.value).toBe(40016);
      expect(tags.PRIVATE_KEY_BASE.name).toBe("crypto-prvkey-base");
    });

    it("should define PUBLIC_KEYS tag (40017)", () => {
      expect(tags.PUBLIC_KEYS.value).toBe(40017);
      expect(tags.PUBLIC_KEYS.name).toBe("crypto-pubkeys");
    });

    it("should define SALT tag (40018)", () => {
      expect(tags.SALT.value).toBe(40018);
      expect(tags.SALT.name).toBe("salt");
    });

    it("should define SEALED_MESSAGE tag (40019)", () => {
      expect(tags.SEALED_MESSAGE.value).toBe(40019);
      expect(tags.SEALED_MESSAGE.name).toBe("crypto-sealed");
    });

    it("should define SIGNATURE tag (40020)", () => {
      expect(tags.SIGNATURE.value).toBe(40020);
      expect(tags.SIGNATURE.name).toBe("signature");
    });

    it("should define SIGNING_PRIVATE_KEY tag (40021)", () => {
      expect(tags.SIGNING_PRIVATE_KEY.value).toBe(40021);
      expect(tags.SIGNING_PRIVATE_KEY.name).toBe("signing-private-key");
    });

    it("should define SIGNING_PUBLIC_KEY tag (40022)", () => {
      expect(tags.SIGNING_PUBLIC_KEY.value).toBe(40022);
      expect(tags.SIGNING_PUBLIC_KEY.name).toBe("signing-public-key");
    });

    it("should define SYMMETRIC_KEY tag (40023)", () => {
      expect(tags.SYMMETRIC_KEY.value).toBe(40023);
      expect(tags.SYMMETRIC_KEY.name).toBe("crypto-key");
    });

    it("should define XID tag (40024)", () => {
      expect(tags.XID.value).toBe(40024);
      expect(tags.XID.name).toBe("xid");
    });

    it("should define REFERENCE tag (40025)", () => {
      expect(tags.REFERENCE.value).toBe(40025);
      expect(tags.REFERENCE.name).toBe("reference");
    });

    it("should define EVENT tag (40026)", () => {
      expect(tags.EVENT.value).toBe(40026);
      expect(tags.EVENT.name).toBe("event");
    });

    it("should define ENCRYPTED_KEY tag (40027)", () => {
      expect(tags.ENCRYPTED_KEY.value).toBe(40027);
      expect(tags.ENCRYPTED_KEY.name).toBe("encrypted-key");
    });
  });

  describe("Post-Quantum Cryptographic Tags", () => {
    it("should define MLKEM_PRIVATE_KEY tag (40100)", () => {
      expect(tags.MLKEM_PRIVATE_KEY.value).toBe(40100);
      expect(tags.MLKEM_PRIVATE_KEY.name).toBe("mlkem-private-key");
    });

    it("should define MLKEM_PUBLIC_KEY tag (40101)", () => {
      expect(tags.MLKEM_PUBLIC_KEY.value).toBe(40101);
      expect(tags.MLKEM_PUBLIC_KEY.name).toBe("mlkem-public-key");
    });

    it("should define MLKEM_CIPHERTEXT tag (40102)", () => {
      expect(tags.MLKEM_CIPHERTEXT.value).toBe(40102);
      expect(tags.MLKEM_CIPHERTEXT.name).toBe("mlkem-ciphertext");
    });

    it("should define MLDSA_PRIVATE_KEY tag (40103)", () => {
      expect(tags.MLDSA_PRIVATE_KEY.value).toBe(40103);
      expect(tags.MLDSA_PRIVATE_KEY.name).toBe("mldsa-private-key");
    });

    it("should define MLDSA_PUBLIC_KEY tag (40104)", () => {
      expect(tags.MLDSA_PUBLIC_KEY.value).toBe(40104);
      expect(tags.MLDSA_PUBLIC_KEY.name).toBe("mldsa-public-key");
    });

    it("should define MLDSA_SIGNATURE tag (40105)", () => {
      expect(tags.MLDSA_SIGNATURE.value).toBe(40105);
      expect(tags.MLDSA_SIGNATURE.name).toBe("mldsa-signature");
    });
  });

  describe("Wallet and Seed Tags", () => {
    it("should define SEED tag (40300)", () => {
      expect(tags.SEED.value).toBe(40300);
      expect(tags.SEED.name).toBe("seed");
    });

    it("should define HDKEY tag (40303)", () => {
      expect(tags.HDKEY.value).toBe(40303);
      expect(tags.HDKEY.name).toBe("hdkey");
    });

    it("should define DERIVATION_PATH tag (40304)", () => {
      expect(tags.DERIVATION_PATH.value).toBe(40304);
      expect(tags.DERIVATION_PATH.name).toBe("keypath");
    });

    it("should define USE_INFO tag (40305)", () => {
      expect(tags.USE_INFO.value).toBe(40305);
      expect(tags.USE_INFO.name).toBe("coin-info");
    });

    it("should define EC_KEY tag (40306)", () => {
      expect(tags.EC_KEY.value).toBe(40306);
      expect(tags.EC_KEY.name).toBe("eckey");
    });

    it("should define ADDRESS tag (40307)", () => {
      expect(tags.ADDRESS.value).toBe(40307);
      expect(tags.ADDRESS.name).toBe("address");
    });

    it("should define OUTPUT_DESCRIPTOR tag (40308)", () => {
      expect(tags.OUTPUT_DESCRIPTOR.value).toBe(40308);
      expect(tags.OUTPUT_DESCRIPTOR.name).toBe("output-descriptor");
    });

    it("should define SSKR_SHARE tag (40309)", () => {
      expect(tags.SSKR_SHARE.value).toBe(40309);
      expect(tags.SSKR_SHARE.name).toBe("sskr");
    });

    it("should define PSBT tag (40310)", () => {
      expect(tags.PSBT.value).toBe(40310);
      expect(tags.PSBT.name).toBe("psbt");
    });

    it("should define ACCOUNT_DESCRIPTOR tag (40311)", () => {
      expect(tags.ACCOUNT_DESCRIPTOR.value).toBe(40311);
      expect(tags.ACCOUNT_DESCRIPTOR.name).toBe("account-descriptor");
    });
  });

  describe("SSH Tags", () => {
    it("should define SSH_TEXT_PRIVATE_KEY tag (40800)", () => {
      expect(tags.SSH_TEXT_PRIVATE_KEY.value).toBe(40800);
      expect(tags.SSH_TEXT_PRIVATE_KEY.name).toBe("ssh-private");
    });

    it("should define SSH_TEXT_PUBLIC_KEY tag (40801)", () => {
      expect(tags.SSH_TEXT_PUBLIC_KEY.value).toBe(40801);
      expect(tags.SSH_TEXT_PUBLIC_KEY.name).toBe("ssh-public");
    });

    it("should define SSH_TEXT_SIGNATURE tag (40802)", () => {
      expect(tags.SSH_TEXT_SIGNATURE.value).toBe(40802);
      expect(tags.SSH_TEXT_SIGNATURE.name).toBe("ssh-signature");
    });

    it("should define SSH_TEXT_CERTIFICATE tag (40803)", () => {
      expect(tags.SSH_TEXT_CERTIFICATE.value).toBe(40803);
      expect(tags.SSH_TEXT_CERTIFICATE.name).toBe("ssh-certificate");
    });
  });

  describe("Other IANA Tags", () => {
    it("should define URI tag (32)", () => {
      expect(tags.URI.value).toBe(32);
      expect(tags.URI.name).toBe("url");
    });

    it("should define UUID tag (37)", () => {
      expect(tags.UUID.value).toBe(37);
      expect(tags.UUID.name).toBe("uuid");
    });
  });

  describe("Provenance Tag", () => {
    it("should define PROVENANCE_MARK tag (1347571542)", () => {
      expect(tags.PROVENANCE_MARK.value).toBe(1347571542);
      expect(tags.PROVENANCE_MARK.name).toBe("provenance");
    });
  });

  describe("Tag Registration", () => {
    it("should register all tags in the global tags store", () => {
      // Call registerTags to ensure all tags are registered
      tags.registerTags();

      const tagsStore = getGlobalTagsStore();

      // Verify a sample of tags are registered
      expect(tagsStore.nameForValue(200)).toBe("envelope");
      expect(tagsStore.nameForValue(201)).toBe("leaf");
      expect(tagsStore.nameForValue(40000)).toBe("known-value");
      expect(tagsStore.nameForValue(40001)).toBe("digest");
      expect(tagsStore.nameForValue(40002)).toBe("encrypted");
      expect(tagsStore.nameForValue(40003)).toBe("compressed");
    });

    it("should be able to look up tags by value", () => {
      tags.registerTags();

      const tagsStore = getGlobalTagsStore();

      expect(tagsStore.nameForValue(tags.ENVELOPE.value)).toBe("envelope");
      expect(tagsStore.nameForValue(tags.LEAF.value)).toBe("leaf");
      expect(tagsStore.nameForValue(tags.KNOWN_VALUE.value)).toBe("known-value");
      expect(tagsStore.nameForValue(tags.DIGEST.value)).toBe("digest");
    });

    it("should handle tag lookup for unregistered tags", () => {
      const tagsStore = getGlobalTagsStore();

      // Non-existent tag should return the numeric value as string
      expect(tagsStore.nameForValue(999999)).toBe("999999");
    });
  });

  describe("Tag Value Consistency", () => {
    it("should have unique tag values across all non-deprecated tags", () => {
      const tagValues = new Set<number>();
      const duplicates: number[] = [];

      // Get all exported tag constants
      const tagExports = Object.values(tags).filter(
        (value): value is { value: number; name: string } =>
          typeof value === "object" && value !== null && "value" in value && "name" in value,
      );

      for (const tag of tagExports) {
        if (tagValues.has(tag.value)) {
          duplicates.push(tag.value);
        }
        tagValues.add(tag.value);
      }

      expect(duplicates).toEqual([]);
    });

    it("should have tag values that match CBOR encoding requirements", () => {
      // Test that tags are valid CBOR tag values (non-negative integers)
      const tagExports = Object.values(tags).filter(
        (value): value is { value: number; name: string } =>
          typeof value === "object" && value !== null && "value" in value && "name" in value,
      );

      for (const tag of tagExports) {
        expect(tag.value).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(tag.value)).toBe(true);
      }
    });
  });

  describe("Tag Name Consistency", () => {
    it("should have lowercase hyphenated tag names", () => {
      const tagExports = Object.values(tags).filter(
        (value): value is { value: number; name: string } =>
          typeof value === "object" && value !== null && "value" in value && "name" in value,
      );

      for (const tag of tagExports) {
        // Tag names should be lowercase and use hyphens
        expect(tag.name).toMatch(/^[a-z0-9-]+$/);
        expect(tag.name).not.toMatch(/[A-Z_]/);
      }
    });
  });
});
