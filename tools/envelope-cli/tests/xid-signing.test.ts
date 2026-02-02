/**
 * XID signing command tests - 1:1 port of tests/test_xid_signing.rs
 */

import { describe, it, expect } from "vitest";
import * as xid from "../src/cmd/xid/index.js";
import * as format from "../src/cmd/format.js";
import * as encrypt from "../src/cmd/encrypt.js";
import * as subject from "../src/cmd/subject/index.js";
import { Envelope } from "@bcts/envelope";
import { PrivateKeys } from "@bcts/components";
import { PrivateOptions } from "../src/cmd/xid/private-options.js";
import { GeneratorOptions } from "../src/cmd/xid/generator-options.js";
import { PasswordMethod } from "../src/cmd/xid/password-args.js";
import { SigningOption } from "../src/cmd/xid/signing-args.js";
import { VerifyOption } from "../src/cmd/xid/verify-args.js";
import { DataType } from "../src/data-types.js";
import { XIDPrivilege } from "../src/cmd/xid/xid-privilege.js";
import {
  ALICE_PRVKEYS,
  ALICE_PUBKEYS,
  BOB_PUBKEYS,
  CAROL_PRVKEYS,
  CAROL_PUBKEYS,
} from "./common.js";

const NO_PASSWORD_ARGS: xid.ReadWritePasswordArgs = {
  read: { askpass: false },
  write: { encryptAskpass: false, encryptMethod: PasswordMethod.Argon2id },
};

const NO_VERIFY_ARGS: xid.VerifyArgs = { verify: VerifyOption.None };
const INCEPTION_VERIFY_ARGS: xid.VerifyArgs = { verify: VerifyOption.Inception };
const INCEPTION_SIGNING_ARGS: xid.SigningArgs = { sign: SigningOption.Inception };

/**
 * Create a new XID document with Alice's private keys (can sign).
 * Private keys are included so subsequent operations can sign with inception key.
 */
async function makeSignableXidDoc(): Promise<string> {
  const args = xid.newCmd.defaultArgs();
  args.keyArgs.keys = ALICE_PRVKEYS;
  args.outputOpts.privateOpts = PrivateOptions.Include;
  args.generatorOpts = GeneratorOptions.Omit;
  return xid.newCmd.exec(args);
}

/**
 * Create an encrypted envelope from a PrivateKeys UR string.
 * Uses PrivateKeys API directly to avoid tags store registration issues.
 */
async function encryptPrvKeys(prvKeysUr: string, password: string): Promise<string> {
  const privateKeys = PrivateKeys.fromURString(prvKeysUr);
  const keyEnvelope = Envelope.newLeaf(privateKeys.taggedCbor());
  return encrypt.exec({
    ...encrypt.defaultArgs(),
    password,
    envelope: keyEnvelope.urString(),
  });
}

describe("xid signing command", () => {
  describe("signature verification", () => {
    it("test_xid_verify_signature", async () => {
      // Create a new XID document with inception key that can sign
      const xidUnsigned = await makeSignableXidDoc();

      // Verify that reading with --verify none works (default)
      const idNone = xid.id.exec({
        format: [xid.IDFormat.Ur],
        verifyArgs: NO_VERIFY_ARGS,
        envelope: xidUnsigned,
      });
      expect(idNone).toMatch(/^ur:xid\//);

      const idNoneExplicit = xid.id.exec({
        format: [xid.IDFormat.Ur],
        verifyArgs: { verify: VerifyOption.None },
        envelope: xidUnsigned,
      });
      expect(idNoneExplicit).toBe(idNone);

      // Attempting to verify inception signature on unsigned document should fail
      expect(() =>
        xid.id.exec({
          format: [xid.IDFormat.Ur],
          verifyArgs: INCEPTION_VERIFY_ARGS,
          envelope: xidUnsigned,
        }),
      ).toThrow();
    });
  });

  describe("inception signing", () => {
    it("test_xid_sign_inception", async () => {
      // Create a new XID document with inception key
      const xidDoc = await makeSignableXidDoc();

      // Sign it with the inception key when adding a key
      const signedXid = await xid.key.add.exec({
        keyArgs: {
          keys: BOB_PUBKEYS,
          nickname: "",
          privateOpts: PrivateOptions.Include,
          endpoints: [],
          permissions: [],
        },
        generatorOpts: GeneratorOptions.Omit,
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: INCEPTION_SIGNING_ARGS,
        envelope: xidDoc,
      });

      // Verify the signature
      const verifiedId = xid.id.exec({
        format: [xid.IDFormat.Ur],
        verifyArgs: INCEPTION_VERIFY_ARGS,
        envelope: signedXid,
      });
      expect(verifiedId).toMatch(/^ur:xid\//);

      // Check format includes signature
      const formatted = format.exec({
        ...format.defaultArgs(),
        envelope: signedXid,
      });
      expect(formatted).toContain("'signed': Signature");

      // Verify the document has both keys
      const keyCount = xid.key.count.exec({
        verifyArgs: NO_VERIFY_ARGS,
        envelope: signedXid,
      });
      expect(keyCount).toBe("2");

      // Verify reading without verification still works
      const idNoVerify = xid.id.exec({
        format: [xid.IDFormat.Ur],
        verifyArgs: NO_VERIFY_ARGS,
        envelope: signedXid,
      });
      expect(idNoVerify).toBe(verifiedId);
    });

    it("test_xid_sign_with_external_key", async () => {
      // Create a new XID document (public keys only, no private keys)
      const args = xid.newCmd.defaultArgs();
      args.keyArgs.keys = ALICE_PUBKEYS;
      args.outputOpts.privateOpts = PrivateOptions.Omit;
      args.generatorOpts = GeneratorOptions.Omit;
      const xidDoc = await xid.newCmd.exec(args);

      // Sign it with an external signing key (Carol's private keys)
      const signedXid = await xid.key.add.exec({
        keyArgs: {
          keys: BOB_PUBKEYS,
          nickname: "",
          privateOpts: PrivateOptions.Omit,
          endpoints: [],
          permissions: [],
        },
        generatorOpts: GeneratorOptions.Omit,
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: { sign: SigningOption.None, signingKey: CAROL_PRVKEYS },
        envelope: xidDoc,
      });

      // The document should now have a signature
      const formatted = format.exec({
        ...format.defaultArgs(),
        envelope: signedXid,
      });
      expect(formatted).toContain("'signed': Signature");

      // Can't verify as inception (Carol's key is not the inception key)
      expect(() =>
        xid.id.exec({
          format: [xid.IDFormat.Ur],
          verifyArgs: INCEPTION_VERIFY_ARGS,
          envelope: signedXid,
        }),
      ).toThrow();
    });
  });

  describe("service operations with signing", () => {
    it("test_xid_sign_service_operations", async () => {
      // Create a new XID document with Alice's keys
      const xidDoc = await makeSignableXidDoc();

      // Add a service with signing (use Alice's public keys for the service)
      const withService = await xid.service.add.exec({
        serviceArgs: {
          uri: "https://example.com/service",
          keys: [ALICE_PUBKEYS],
          delegates: [],
          permissions: [XIDPrivilege.All],
        },
        outputOpts: {
          privateOpts: PrivateOptions.Include,
          generatorOpts: GeneratorOptions.Omit,
        },
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: INCEPTION_SIGNING_ARGS,
        envelope: xidDoc,
      });

      // Verify the signature
      const verifiedId = xid.id.exec({
        format: [xid.IDFormat.Ur],
        verifyArgs: INCEPTION_VERIFY_ARGS,
        envelope: withService,
      });
      expect(verifiedId).toMatch(/^ur:xid\//);

      // Verify the service was added and document is signed
      const formatted1 = format.exec({
        ...format.defaultArgs(),
        envelope: withService,
      });
      expect(formatted1).toContain("'service':");
      expect(formatted1).toContain("'signed': Signature");

      // Remove a service with signing (verify the previous signature first)
      const withoutService = await xid.service.remove.exec({
        uri: "https://example.com/service",
        outputOpts: {
          privateOpts: PrivateOptions.Include,
          generatorOpts: GeneratorOptions.Omit,
        },
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: INCEPTION_VERIFY_ARGS,
        signingArgs: INCEPTION_SIGNING_ARGS,
        envelope: withService,
      });

      // Verify the signature on the modified document
      xid.id.exec({
        format: [xid.IDFormat.Ur],
        verifyArgs: INCEPTION_VERIFY_ARGS,
        envelope: withoutService,
      });

      // Verify the service was removed and document is still signed
      const formatted2 = format.exec({
        ...format.defaultArgs(),
        envelope: withoutService,
      });
      expect(formatted2).not.toContain("'service':");
      expect(formatted2).toContain("'signed': Signature");
    });
  });

  describe("new with signing", () => {
    it("test_xid_new_with_signing", async () => {
      // Create a new XID document and sign it immediately
      const args = xid.newCmd.defaultArgs();
      args.keyArgs.keys = ALICE_PRVKEYS;
      args.outputOpts.privateOpts = PrivateOptions.Include;
      args.generatorOpts = GeneratorOptions.Omit;
      args.signingArgs = INCEPTION_SIGNING_ARGS;
      const signedXid = await xid.newCmd.exec(args);

      // Verify the signature
      const verifiedId = xid.id.exec({
        format: [xid.IDFormat.Ur],
        verifyArgs: INCEPTION_VERIFY_ARGS,
        envelope: signedXid,
      });
      expect(verifiedId).toMatch(/^ur:xid\//);

      // Check the format includes the signature
      const formatted = format.exec({
        ...format.defaultArgs(),
        envelope: signedXid,
      });
      expect(formatted).toContain("'signed': Signature");
    });
  });

  describe("verify and sign chaining", () => {
    it("test_xid_verify_and_sign_chaining", async () => {
      // Create and sign a document
      const args = xid.newCmd.defaultArgs();
      args.keyArgs.keys = ALICE_PRVKEYS;
      args.outputOpts.privateOpts = PrivateOptions.Include;
      args.generatorOpts = GeneratorOptions.Omit;
      args.signingArgs = INCEPTION_SIGNING_ARGS;
      const xid1 = await xid.newCmd.exec(args);

      // Verify and modify with new signature
      const xid2 = await xid.key.add.exec({
        keyArgs: {
          keys: BOB_PUBKEYS,
          nickname: "",
          privateOpts: PrivateOptions.Include,
          endpoints: [],
          permissions: [],
        },
        generatorOpts: GeneratorOptions.Omit,
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: INCEPTION_VERIFY_ARGS,
        signingArgs: INCEPTION_SIGNING_ARGS,
        envelope: xid1,
      });

      // Should be verifiable
      xid.id.exec({
        format: [xid.IDFormat.Ur],
        verifyArgs: INCEPTION_VERIFY_ARGS,
        envelope: xid2,
      });

      // Add another key with verify+sign
      const xid3 = await xid.key.add.exec({
        keyArgs: {
          keys: CAROL_PUBKEYS,
          nickname: "",
          privateOpts: PrivateOptions.Include,
          endpoints: [],
          permissions: [],
        },
        generatorOpts: GeneratorOptions.Omit,
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: INCEPTION_VERIFY_ARGS,
        signingArgs: INCEPTION_SIGNING_ARGS,
        envelope: xid2,
      });

      // Still verifiable
      xid.id.exec({
        format: [xid.IDFormat.Ur],
        verifyArgs: INCEPTION_VERIFY_ARGS,
        envelope: xid3,
      });

      // Verify xid3 has 3 keys
      const count = xid.key.count.exec({
        verifyArgs: NO_VERIFY_ARGS,
        envelope: xid3,
      });
      expect(count).toBe("3");

      // Format should show signature
      const formatted = format.exec({
        ...format.defaultArgs(),
        envelope: xid3,
      });
      expect(formatted).toContain("'signed': Signature");
    });
  });

  describe("encrypted private keys", () => {
    it("test_xid_sign_with_encrypted_private_keys", { timeout: 60_000 }, async () => {
      // Create an encrypted PrivateKeys envelope
      const encryptedKeys = await encryptPrvKeys(CAROL_PRVKEYS, "testpass");
      expect(encryptedKeys).toMatch(/^ur:envelope\//);

      // Create a new XID document
      const args = xid.newCmd.defaultArgs();
      args.keyArgs.keys = ALICE_PUBKEYS;
      args.outputOpts.privateOpts = PrivateOptions.Omit;
      args.generatorOpts = GeneratorOptions.Omit;
      const xidDoc = await xid.newCmd.exec(args);

      // Sign with the encrypted key, providing password to decrypt it
      const signedXid = await xid.key.add.exec({
        keyArgs: {
          keys: BOB_PUBKEYS,
          nickname: "",
          privateOpts: PrivateOptions.Omit,
          endpoints: [],
          permissions: [],
        },
        generatorOpts: GeneratorOptions.Omit,
        passwordArgs: {
          read: { askpass: false, password: "testpass" },
          write: { encryptAskpass: false, encryptMethod: PasswordMethod.Argon2id },
        },
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: { sign: SigningOption.None, signingKey: encryptedKeys },
        envelope: xidDoc,
      });

      // The document should have a signature
      const formatted = format.exec({
        ...format.defaultArgs(),
        envelope: signedXid,
      });
      expect(formatted).toContain("'signed': Signature");
    });

    it("test_xid_sign_with_encrypted_signing_private_key", { timeout: 30_000 }, async () => {
      // Create encrypted PrivateKeys
      const encryptedKey = await encryptPrvKeys(CAROL_PRVKEYS, "mypass");
      expect(encryptedKey).toMatch(/^ur:envelope\//);

      // Create a new XID document
      const args = xid.newCmd.defaultArgs();
      args.keyArgs.keys = ALICE_PUBKEYS;
      args.outputOpts.privateOpts = PrivateOptions.Omit;
      args.generatorOpts = GeneratorOptions.Omit;
      const xidDoc = await xid.newCmd.exec(args);

      // Sign with the encrypted PrivateKeys
      const signedXid = await xid.key.add.exec({
        keyArgs: {
          keys: BOB_PUBKEYS,
          nickname: "",
          privateOpts: PrivateOptions.Omit,
          endpoints: [],
          permissions: [],
        },
        generatorOpts: GeneratorOptions.Omit,
        passwordArgs: {
          read: { askpass: false, password: "mypass" },
          write: { encryptAskpass: false, encryptMethod: PasswordMethod.Argon2id },
        },
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: { sign: SigningOption.None, signingKey: encryptedKey },
        envelope: xidDoc,
      });

      // Verify it has a signature
      const formatted = format.exec({
        ...format.defaultArgs(),
        envelope: signedXid,
      });
      expect(formatted).toContain("'signed': Signature");
    });

    it("test_xid_sign_with_encrypted_key_wrong_password", { timeout: 30_000 }, async () => {
      // Create an encrypted key
      const encryptedKeys = await encryptPrvKeys(CAROL_PRVKEYS, "correctpass");

      const args = xid.newCmd.defaultArgs();
      args.keyArgs.keys = ALICE_PUBKEYS;
      args.outputOpts.privateOpts = PrivateOptions.Omit;
      args.generatorOpts = GeneratorOptions.Omit;
      const xidDoc = await xid.newCmd.exec(args);

      // Try to sign with wrong password - should fail
      await expect(
        xid.key.add.exec({
          keyArgs: {
            keys: BOB_PUBKEYS,
            nickname: "",
            privateOpts: PrivateOptions.Omit,
            endpoints: [],
            permissions: [],
          },
          generatorOpts: GeneratorOptions.Omit,
          passwordArgs: {
            read: { askpass: false, password: "wrongpass" },
            write: { encryptAskpass: false, encryptMethod: PasswordMethod.Argon2id },
          },
          verifyArgs: NO_VERIFY_ARGS,
          signingArgs: { sign: SigningOption.None, signingKey: encryptedKeys },
          envelope: xidDoc,
        }),
      ).rejects.toThrow();
    });

    it("test_xid_sign_with_encrypted_key_no_password", { timeout: 60_000 }, async () => {
      // Create an encrypted key
      const encryptedKeys = await encryptPrvKeys(CAROL_PRVKEYS, "testpass");

      const args = xid.newCmd.defaultArgs();
      args.keyArgs.keys = ALICE_PUBKEYS;
      args.outputOpts.privateOpts = PrivateOptions.Omit;
      args.generatorOpts = GeneratorOptions.Omit;
      const xidDoc = await xid.newCmd.exec(args);

      // Try to sign without providing password - should fail
      await expect(
        xid.key.add.exec({
          keyArgs: {
            keys: BOB_PUBKEYS,
            nickname: "",
            privateOpts: PrivateOptions.Omit,
            endpoints: [],
            permissions: [],
          },
          generatorOpts: GeneratorOptions.Omit,
          passwordArgs: NO_PASSWORD_ARGS,
          verifyArgs: NO_VERIFY_ARGS,
          signingArgs: { sign: SigningOption.None, signingKey: encryptedKeys },
          envelope: xidDoc,
        }),
      ).rejects.toThrow();
    });

    it("test_xid_sign_with_invalid_encrypted_content", { timeout: 30_000 }, async () => {
      // Create an encrypted envelope that doesn't contain keys
      const helloEnvelope = subject.type.exec({
        subjectType: DataType.String,
        subjectValue: "Hello",
      });
      const notKeys = await encrypt.exec({
        ...encrypt.defaultArgs(),
        password: "testpass",
        envelope: helloEnvelope,
      });

      const args = xid.newCmd.defaultArgs();
      args.keyArgs.keys = ALICE_PUBKEYS;
      args.outputOpts.privateOpts = PrivateOptions.Omit;
      args.generatorOpts = GeneratorOptions.Omit;
      const xidDoc = await xid.newCmd.exec(args);

      // Try to sign with it - should fail with clear error
      await expect(
        xid.key.add.exec({
          keyArgs: {
            keys: BOB_PUBKEYS,
            nickname: "",
            privateOpts: PrivateOptions.Omit,
            endpoints: [],
            permissions: [],
          },
          generatorOpts: GeneratorOptions.Omit,
          passwordArgs: {
            read: { askpass: false, password: "testpass" },
            write: { encryptAskpass: false, encryptMethod: PasswordMethod.Argon2id },
          },
          verifyArgs: NO_VERIFY_ARGS,
          signingArgs: { sign: SigningOption.None, signingKey: notKeys },
          envelope: xidDoc,
        }),
      ).rejects.toThrow();
    });
  });
});
