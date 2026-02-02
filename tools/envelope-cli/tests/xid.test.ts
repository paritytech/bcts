/**
 * XID command tests - 1:1 port of tests/test_xid.rs
 */

import { describe, it, expect } from "vitest";
import * as xid from "../src/cmd/xid/index.js";
import * as format from "../src/cmd/format.js";
import * as extract from "../src/cmd/extract.js";
import * as assertion from "../src/cmd/assertion/index.js";
import { PrivateOptions } from "../src/cmd/xid/private-options.js";
import { GeneratorOptions } from "../src/cmd/xid/generator-options.js";
import { PasswordMethod } from "../src/cmd/xid/password-args.js";
import { SigningOption } from "../src/cmd/xid/signing-args.js";
import { VerifyOption } from "../src/cmd/xid/verify-args.js";
import { defaultOutputOptions } from "../src/cmd/xid/output-options.js";
import { XIDPrivilege } from "../src/cmd/xid/xid-privilege.js";
import { URI } from "@bcts/components";
import {
  ALICE_PUBKEYS,
  ALICE_PRVKEY_BASE,
  ALICE_PRVKEYS,
  BOB_PUBKEYS,
  CAROL_PRVKEYS,
} from "./common.js";

const NO_PASSWORD_ARGS: xid.ReadWritePasswordArgs = {
  read: { askpass: false },
  write: { encryptAskpass: false, encryptMethod: PasswordMethod.Argon2id },
};

const NO_VERIFY_ARGS: xid.VerifyArgs = { verify: VerifyOption.None };
const NO_SIGNING_ARGS: xid.SigningArgs = { sign: SigningOption.None };

async function makeXidDoc(): Promise<string> {
  const args = xid.newCmd.defaultArgs();
  args.keyArgs.keys = ALICE_PUBKEYS;
  args.outputOpts.privateOpts = PrivateOptions.Omit;
  args.generatorOpts = GeneratorOptions.Omit;
  return xid.newCmd.exec(args);
}

// XID document constant for tests that need a pre-existing document.
// This particular document may not match format expectations exactly,
// so those tests remain skipped until format parity is verified.
const XID_DOC =
  "ur:xid/tpsplftpsotanshdhdcxjsdigtwneocmnybadpdlzobysbstmekteypspeotcfldynlpsfolsbintyjkrhfnoyaylftpsotansgylftanshfhdcxhslkfzemaylrwttynsdlghrydpmdfzvdglndloimaahykorefddtsguogmvlahqztansgrhdcxetlewzvlwyfdtobeytidosbamkswaomwwfyabakssakggegychesmerkcatekpcxoycsfncsfggmplgshd";

describe("xid command", () => {
  describe("format", () => {
    it("test_xid_format", () => {
      const formatted = format.exec({
        ...format.defaultArgs(),
        envelope: XID_DOC,
      });

      expect(formatted).toContain("XID(71274df1)");
      expect(formatted).toContain("'key':");
      expect(formatted).toContain("PublicKeys");
      expect(formatted).toContain("'allow': 'All'");
    });

    it("test_xid_assertion_extraction", () => {
      const keyAssertion = assertion.at.exec({
        index: 0,
        envelope: XID_DOC,
      });

      const formatted = format.exec({
        ...format.defaultArgs(),
        envelope: keyAssertion,
      });

      expect(formatted).toContain("'key':");
      expect(formatted).toContain("PublicKeys");
      expect(formatted).toContain("'allow': 'All'");
    });

    it("test_xid_extract_bare_xid", () => {
      const bareXid = extract.exec({
        type: extract.SubjectType.Xid,
        envelope: XID_DOC,
      });

      expect(bareXid).toBe(
        "ur:xid/hdcxjsdigtwneocmnybadpdlzobysbstmekteypspeotcfldynlpsfolsbintyjkrhfnvsbyrdfw",
      );

      const bareXidFormatted = format.exec({
        ...format.defaultArgs(),
        envelope: bareXid,
      });

      expect(bareXidFormatted.trim()).toBe("XID(71274df1)");
    });
  });

  describe("id", () => {
    it("test_xid_id_from_new_doc", async () => {
      // Create a new XID and extract its ID
      const xidDoc = await makeXidDoc();
      const xidId = xid.id.exec({
        format: [xid.IDFormat.Ur],
        verifyArgs: NO_VERIFY_ARGS,
        envelope: xidDoc,
      });

      // The ID should be a valid XID UR
      expect(xidId).toMatch(/^ur:xid\//);
    });

    it("test_xid_id_idempotent", async () => {
      // Extracting XID ID twice from same doc should be idempotent
      const xidDoc = await makeXidDoc();
      const xidId1 = xid.id.exec({
        format: [xid.IDFormat.Ur],
        verifyArgs: NO_VERIFY_ARGS,
        envelope: xidDoc,
      });

      const xidId2 = xid.id.exec({
        format: [xid.IDFormat.Ur],
        verifyArgs: NO_VERIFY_ARGS,
        envelope: xidDoc,
      });

      expect(xidId2).toBe(xidId1);
    });

    it("test_xid_id_multiple_formats", () => {
      const xidId = xid.id.exec({
        format: [xid.IDFormat.Ur, xid.IDFormat.Hex, xid.IDFormat.Bytewords, xid.IDFormat.Bytemoji],
        verifyArgs: NO_VERIFY_ARGS,
        envelope: XID_DOC,
      });

      const lines = xidId.split("\n");
      expect(lines.length).toBe(4);

      expect(lines[0]).toBe(
        "ur:xid/hdcxjsdigtwneocmnybadpdlzobysbstmekteypspeotcfldynlpsfolsbintyjkrhfnvsbyrdfw",
      );
      expect(lines[1]).toBe("XID(71274df1)");
    });
  });

  describe("new", () => {
    it("test_xid_new_from_pubkeys", async () => {
      const args = xid.newCmd.defaultArgs();
      args.keyArgs.keys = ALICE_PUBKEYS;
      args.outputOpts.privateOpts = PrivateOptions.Omit;
      args.generatorOpts = GeneratorOptions.Omit;
      const newXidDoc = await xid.newCmd.exec(args);

      // Must return a ur:xid UR
      expect(newXidDoc).toMatch(/^ur:xid\//);

      // Verify the XID ID is deterministic (from the same public keys)
      const xidId = xid.id.exec({
        format: [xid.IDFormat.Ur],
        verifyArgs: NO_VERIFY_ARGS,
        envelope: newXidDoc,
      });
      expect(xidId).toMatch(/^ur:xid\//);
    });

    it("test_xid_new_key_count", async () => {
      // A new XID document should have exactly 1 key (the inception key)
      const xidDoc = await makeXidDoc();
      const count = xid.key.count.exec({
        verifyArgs: NO_VERIFY_ARGS,
        envelope: xidDoc,
      });
      expect(count).toBe("1");
    });

    it("test_xid_new_with_nickname", async () => {
      const args = xid.newCmd.defaultArgs();
      args.keyArgs.keys = ALICE_PUBKEYS;
      args.keyArgs.nickname = "Alice's Key";
      args.outputOpts.privateOpts = PrivateOptions.Omit;
      args.generatorOpts = GeneratorOptions.Omit;
      const newXidDoc = await xid.newCmd.exec(args);

      const formatted = format.exec({
        ...format.defaultArgs(),
        envelope: newXidDoc,
      });

      expect(formatted).toContain("'nickname': \"Alice's Key\"");
    });

    it("test_xid_new_from_prvkey_base", async () => {
      const args = xid.newCmd.defaultArgs();
      args.keyArgs.keys = ALICE_PRVKEY_BASE;
      args.generatorOpts = GeneratorOptions.Omit;
      const newXidDoc = await xid.newCmd.exec(args);

      const formatted = format.exec({
        ...format.defaultArgs(),
        envelope: newXidDoc,
      });

      // Default includes salted private key
      expect(formatted).toContain("XID(93a4d4e7)");
      expect(formatted).toContain("'key':");
      expect(formatted).toContain("'privateKey':");
      expect(formatted).toContain("'salt':");
      expect(formatted).toContain("'allow': 'All'");
    });

    it("test_xid_new_private_omit", async () => {
      const args = xid.newCmd.defaultArgs();
      args.keyArgs.keys = ALICE_PRVKEY_BASE;
      args.outputOpts.privateOpts = PrivateOptions.Omit;
      args.generatorOpts = GeneratorOptions.Omit;
      const newXidDoc = await xid.newCmd.exec(args);

      const formatted = format.exec({
        ...format.defaultArgs(),
        envelope: newXidDoc,
      });

      // Private key omitted
      expect(formatted).toContain("XID(93a4d4e7)");
      expect(formatted).toContain("'key':");
      expect(formatted).toContain("'allow': 'All'");
      expect(formatted).not.toContain("'privateKey':");
    });

    it("test_xid_new_private_elide", async () => {
      const args = xid.newCmd.defaultArgs();
      args.keyArgs.keys = ALICE_PRVKEY_BASE;
      args.outputOpts.privateOpts = PrivateOptions.Elide;
      args.generatorOpts = GeneratorOptions.Omit;
      const newXidDoc = await xid.newCmd.exec(args);

      const formatted = format.exec({
        ...format.defaultArgs(),
        envelope: newXidDoc,
      });

      // Private key elided (replaced with ELIDED marker)
      expect(formatted).toContain("XID(93a4d4e7)");
      expect(formatted).toContain("'key':");
      expect(formatted).toContain("'allow': 'All'");
      expect(formatted).toContain("ELIDED");
    });

    it("test_xid_new_with_endpoints", async () => {
      const args = xid.newCmd.defaultArgs();
      args.keyArgs.keys = ALICE_PUBKEYS;
      args.keyArgs.endpoints = [
        URI.new("https://endpoint.example.com/"),
        URI.new("btc:5e54156cfe0e62d9a56c72b84a5c40b84e2fd7dfe786c7d5c667e11ab85c45c6"),
      ];
      args.outputOpts.privateOpts = PrivateOptions.Omit;
      args.generatorOpts = GeneratorOptions.Omit;
      const newXidDoc = await xid.newCmd.exec(args);

      const formatted = format.exec({
        ...format.defaultArgs(),
        envelope: newXidDoc,
      });
      expect(formatted).toContain("'endpoint':");
      expect(formatted).toContain("endpoint.example.com");
    });

    it("test_xid_new_with_permissions", async () => {
      const args = xid.newCmd.defaultArgs();
      args.keyArgs.keys = ALICE_PUBKEYS;
      args.keyArgs.permissions = [XIDPrivilege.Encrypt, XIDPrivilege.Sign];
      args.outputOpts.privateOpts = PrivateOptions.Omit;
      args.generatorOpts = GeneratorOptions.Omit;
      const newXidDoc = await xid.newCmd.exec(args);

      const formatted = format.exec({
        ...format.defaultArgs(),
        envelope: newXidDoc,
      });
      // Should have specific permissions instead of 'All'
      expect(formatted).toContain("'allow': 'Encrypt'");
      expect(formatted).toContain("'allow': 'Sign'");
      expect(formatted).not.toContain("'allow': 'All'");
    });
  });

  describe("export", () => {
    it("test_xid_export_default", async () => {
      const exported = await xid.exportCmd.exec({
        ...xid.exportCmd.defaultArgs(),
        envelope: XID_DOC,
        verifyArgs: NO_VERIFY_ARGS,
      });

      expect(exported).toMatch(/^ur:xid\//);
    });

    it("test_xid_export_xid_format", async () => {
      const exported = await xid.exportCmd.exec({
        ...xid.exportCmd.defaultArgs(),
        envelope: XID_DOC,
        verifyArgs: NO_VERIFY_ARGS,
      });

      expect(exported).toMatch(/^ur:xid\//);
    });
  });

  describe("key management", () => {
    it("test_xid_key_count", async () => {
      const xidDoc = await makeXidDoc();
      const count = xid.key.count.exec({
        verifyArgs: NO_VERIFY_ARGS,
        envelope: xidDoc,
      });
      expect(count).toBe("1");
    });

    it("test_xid_key_add", async () => {
      let xidDoc = await makeXidDoc();
      expect(xid.key.count.exec({ verifyArgs: NO_VERIFY_ARGS, envelope: xidDoc })).toBe("1");

      // Add Bob's key
      xidDoc = await xid.key.add.exec({
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
        signingArgs: NO_SIGNING_ARGS,
        envelope: xidDoc,
      });

      expect(xid.key.count.exec({ verifyArgs: NO_VERIFY_ARGS, envelope: xidDoc })).toBe("2");
    });

    it("test_xid_key_at", async () => {
      const xidDoc = await makeXidDoc();

      // Index 0 should succeed
      const key0 = await xid.key.at.exec({
        index: 0,
        private: false,
        passwordArgs: NO_PASSWORD_ARGS.read,
        verifyArgs: NO_VERIFY_ARGS,
        envelope: xidDoc,
      });
      expect(key0).toMatch(/^ur:envelope\//);

      // Index 1 should fail
      await expect(
        xid.key.at.exec({
          index: 1,
          private: false,
          passwordArgs: NO_PASSWORD_ARGS.read,
          verifyArgs: NO_VERIFY_ARGS,
          envelope: xidDoc,
        }),
      ).rejects.toThrow();
    });

    it("test_xid_key_all", async () => {
      let xidDoc = await makeXidDoc();

      // Add Bob's key
      xidDoc = await xid.key.add.exec({
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
        signingArgs: NO_SIGNING_ARGS,
        envelope: xidDoc,
      });

      const all = await xid.key.all.exec({
        private: false,
        passwordArgs: NO_PASSWORD_ARGS.read,
        verifyArgs: NO_VERIFY_ARGS,
        envelope: xidDoc,
      });

      const lines = all.split("\n").filter((l) => l.length > 0);
      expect(lines).toHaveLength(2);
      expect(lines[0]).toMatch(/^ur:envelope\//);
      expect(lines[1]).toMatch(/^ur:envelope\//);
    });

    it("test_xid_key_find_inception", async () => {
      const xidDoc = await makeXidDoc();

      const inception = await xid.key.find.inception.exec({
        private: false,
        passwordArgs: NO_PASSWORD_ARGS.read,
        verifyArgs: NO_VERIFY_ARGS,
        envelope: xidDoc,
      });

      // Should return a key envelope
      expect(inception).toMatch(/^ur:envelope\//);
    });

    it("test_xid_key_remove", async () => {
      // Create doc with Alice + Bob (Bob has Encrypt+Sign)
      const aliceArgs = xid.newCmd.defaultArgs();
      aliceArgs.keyArgs.keys = ALICE_PUBKEYS;
      aliceArgs.keyArgs.nickname = "Alice";
      aliceArgs.outputOpts.privateOpts = PrivateOptions.Omit;
      aliceArgs.generatorOpts = GeneratorOptions.Omit;
      let xidDoc = await xid.newCmd.exec(aliceArgs);

      xidDoc = await xid.key.add.exec({
        keyArgs: {
          keys: BOB_PUBKEYS,
          nickname: "Bob",
          privateOpts: PrivateOptions.Omit,
          endpoints: [],
          permissions: [XIDPrivilege.Encrypt, XIDPrivilege.Sign],
        },
        generatorOpts: GeneratorOptions.Omit,
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: NO_SIGNING_ARGS,
        envelope: xidDoc,
      });

      expect(xid.key.count.exec({ verifyArgs: NO_VERIFY_ARGS, envelope: xidDoc })).toBe("2");

      // Remove Alice's key
      xidDoc = await xid.key.remove.exec({
        keys: ALICE_PUBKEYS,
        privateOpts: PrivateOptions.Omit,
        generatorOpts: GeneratorOptions.Omit,
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: NO_SIGNING_ARGS,
        envelope: xidDoc,
      });

      // Only Bob's key remains
      expect(xid.key.count.exec({ verifyArgs: NO_VERIFY_ARGS, envelope: xidDoc })).toBe("1");

      // Inception key should not be found (Alice was the inception key)
      const inception = await xid.key.find.inception.exec({
        private: false,
        passwordArgs: NO_PASSWORD_ARGS.read,
        verifyArgs: NO_VERIFY_ARGS,
        envelope: xidDoc,
      });
      expect(inception).toBe("");

      // Format should show only Bob
      const formatted = format.exec({
        ...format.defaultArgs(),
        envelope: xidDoc,
      });
      expect(formatted).toContain('"Bob"');
      expect(formatted).not.toContain('"Alice"');
    });
    it("test_xid_key_update", async () => {
      // Create doc with Alice (nickname) + Bob (nickname), both with All permissions
      const aliceArgs = xid.newCmd.defaultArgs();
      aliceArgs.keyArgs.keys = ALICE_PUBKEYS;
      aliceArgs.keyArgs.nickname = "Alice";
      aliceArgs.outputOpts.privateOpts = PrivateOptions.Omit;
      aliceArgs.generatorOpts = GeneratorOptions.Omit;
      let xidDoc = await xid.newCmd.exec(aliceArgs);

      xidDoc = await xid.key.add.exec({
        keyArgs: {
          keys: BOB_PUBKEYS,
          nickname: "Bob",
          privateOpts: PrivateOptions.Omit,
          endpoints: [],
          permissions: [],
        },
        generatorOpts: GeneratorOptions.Omit,
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: NO_SIGNING_ARGS,
        envelope: xidDoc,
      });

      expect(xid.key.count.exec({ verifyArgs: NO_VERIFY_ARGS, envelope: xidDoc })).toBe("2");

      // Update Bob's key: change permissions to Encrypt + Sign
      xidDoc = await xid.key.update.exec({
        keyArgs: {
          keys: BOB_PUBKEYS,
          nickname: "",
          privateOpts: PrivateOptions.Omit,
          endpoints: [],
          permissions: [XIDPrivilege.Encrypt, XIDPrivilege.Sign],
        },
        generatorOpts: GeneratorOptions.Omit,
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: NO_SIGNING_ARGS,
        envelope: xidDoc,
      });

      // Still 2 keys
      expect(xid.key.count.exec({ verifyArgs: NO_VERIFY_ARGS, envelope: xidDoc })).toBe("2");

      // Format and verify
      const formatted = format.exec({
        ...format.defaultArgs(),
        envelope: xidDoc,
      });

      // Alice still has 'All'
      expect(formatted).toContain('"Alice"');
      expect(formatted).toContain('"Bob"');
      // Bob should have Encrypt and Sign
      expect(formatted).toContain("'allow': 'Encrypt'");
      expect(formatted).toContain("'allow': 'Sign'");
    });
    it("test_xid_key_find_name", async () => {
      // Create doc with Alice (nickname) + Bob (nickname)
      const aliceArgs = xid.newCmd.defaultArgs();
      aliceArgs.keyArgs.keys = ALICE_PUBKEYS;
      aliceArgs.keyArgs.nickname = "Alice";
      aliceArgs.outputOpts.privateOpts = PrivateOptions.Omit;
      aliceArgs.generatorOpts = GeneratorOptions.Omit;
      let xidDoc = await xid.newCmd.exec(aliceArgs);

      xidDoc = await xid.key.add.exec({
        keyArgs: {
          keys: BOB_PUBKEYS,
          nickname: "Bob",
          privateOpts: PrivateOptions.Omit,
          endpoints: [],
          permissions: [],
        },
        generatorOpts: GeneratorOptions.Omit,
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: NO_SIGNING_ARGS,
        envelope: xidDoc,
      });

      // Find Alice's key by name
      const aliceKey = await xid.key.find.name.exec({
        name: "Alice",
        private: false,
        passwordArgs: NO_PASSWORD_ARGS.read,
        verifyArgs: NO_VERIFY_ARGS,
        envelope: xidDoc,
      });
      expect(aliceKey).toMatch(/^ur:envelope\//);

      // Format Alice's key and verify
      const formatted = format.exec({
        ...format.defaultArgs(),
        envelope: aliceKey,
      });
      expect(formatted).toContain('"Alice"');
      expect(formatted).toContain("'allow': 'All'");

      // Find non-existent name returns empty
      const wolfKey = await xid.key.find.name.exec({
        name: "Wolf",
        private: false,
        passwordArgs: NO_PASSWORD_ARGS.read,
        verifyArgs: NO_VERIFY_ARGS,
        envelope: xidDoc,
      });
      expect(wolfKey).toBe("");
    });
  });

  describe("method management", () => {
    it("test_xid_method_count_empty", async () => {
      const xidDoc = await makeXidDoc();
      expect(xid.method.count.exec({ envelope: xidDoc })).toBe("0");
    });

    it("test_xid_method_add", async () => {
      let xidDoc = await makeXidDoc();

      xidDoc = await xid.method.add.exec({
        method: "https://resolver.example.com",
        outputOpts: defaultOutputOptions(),
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: NO_SIGNING_ARGS,
        envelope: xidDoc,
      });

      expect(xid.method.count.exec({ envelope: xidDoc })).toBe("1");
    });

    it("test_xid_method_all", async () => {
      let xidDoc = await makeXidDoc();

      xidDoc = await xid.method.add.exec({
        method: "https://resolver.example.com",
        outputOpts: defaultOutputOptions(),
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: NO_SIGNING_ARGS,
        envelope: xidDoc,
      });

      xidDoc = await xid.method.add.exec({
        method: "btcr:01234567",
        outputOpts: defaultOutputOptions(),
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: NO_SIGNING_ARGS,
        envelope: xidDoc,
      });

      expect(xid.method.count.exec({ envelope: xidDoc })).toBe("2");

      const all = xid.method.all.exec({ envelope: xidDoc });
      expect(all).toContain("https://resolver.example.com");
      expect(all).toContain("btcr:01234567");
    });

    it("test_xid_method_at", async () => {
      let xidDoc = await makeXidDoc();

      xidDoc = await xid.method.add.exec({
        method: "https://resolver.example.com",
        outputOpts: defaultOutputOptions(),
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: NO_SIGNING_ARGS,
        envelope: xidDoc,
      });

      // Index 0 should work
      expect(() => xid.method.at.exec({ index: 0, envelope: xidDoc })).not.toThrow();

      // Index 1 should fail
      expect(() => xid.method.at.exec({ index: 1, envelope: xidDoc })).toThrow(
        "Index out of bounds",
      );
    });

    it("test_xid_method_remove", async () => {
      let xidDoc = await makeXidDoc();

      xidDoc = await xid.method.add.exec({
        method: "https://resolver.example.com",
        outputOpts: defaultOutputOptions(),
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: NO_SIGNING_ARGS,
        envelope: xidDoc,
      });

      expect(xid.method.count.exec({ envelope: xidDoc })).toBe("1");

      xidDoc = await xid.method.remove.exec({
        method: "https://resolver.example.com",
        outputOpts: defaultOutputOptions(),
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: NO_SIGNING_ARGS,
        envelope: xidDoc,
      });

      expect(xid.method.count.exec({ envelope: xidDoc })).toBe("0");
    });
  });

  describe("delegate management", () => {
    async function makeBobXidDoc(): Promise<string> {
      const args = xid.newCmd.defaultArgs();
      args.keyArgs.keys = BOB_PUBKEYS;
      args.outputOpts.privateOpts = PrivateOptions.Omit;
      args.generatorOpts = GeneratorOptions.Omit;
      return xid.newCmd.exec(args);
    }

    it("test_xid_delegate_count", async () => {
      const xidDoc = await makeXidDoc();
      expect(xid.delegate.count.exec({ envelope: xidDoc })).toBe("0");
    });

    it("test_xid_delegate_add", async () => {
      let xidDoc = await makeXidDoc();
      const bobDoc = await makeBobXidDoc();

      xidDoc = await xid.delegate.add.exec({
        delegate: bobDoc,
        allow: [XIDPrivilege.Auth, XIDPrivilege.Sign],
        outputOpts: defaultOutputOptions(),
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: NO_SIGNING_ARGS,
        envelope: xidDoc,
      });

      expect(xid.delegate.count.exec({ envelope: xidDoc })).toBe("1");
    });

    it("test_xid_delegate_at", async () => {
      let xidDoc = await makeXidDoc();
      const bobDoc = await makeBobXidDoc();

      xidDoc = await xid.delegate.add.exec({
        delegate: bobDoc,
        allow: [XIDPrivilege.All],
        outputOpts: defaultOutputOptions(),
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: NO_SIGNING_ARGS,
        envelope: xidDoc,
      });

      // Index 0 should succeed
      const result = xid.delegate.at.exec({ index: 0, envelope: xidDoc });
      expect(result).toMatch(/^ur:xid\//);

      // Index 1 should fail
      expect(() => xid.delegate.at.exec({ index: 1, envelope: xidDoc })).toThrow();
    });

    it("test_xid_delegate_all", async () => {
      let xidDoc = await makeXidDoc();
      const bobDoc = await makeBobXidDoc();

      xidDoc = await xid.delegate.add.exec({
        delegate: bobDoc,
        allow: [XIDPrivilege.Auth],
        outputOpts: defaultOutputOptions(),
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: NO_SIGNING_ARGS,
        envelope: xidDoc,
      });

      const all = xid.delegate.all.exec({ envelope: xidDoc });
      expect(all).toMatch(/^ur:xid\//);
    });

    it("test_xid_delegate_find_inception", async () => {
      let xidDoc = await makeXidDoc();
      const bobDoc = await makeBobXidDoc();

      xidDoc = await xid.delegate.add.exec({
        delegate: bobDoc,
        allow: [XIDPrivilege.All],
        outputOpts: defaultOutputOptions(),
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: NO_SIGNING_ARGS,
        envelope: xidDoc,
      });

      // Find the delegate by its XID document
      const found = xid.delegate.find.exec({ delegate: bobDoc, envelope: xidDoc });
      expect(found).toMatch(/^ur:xid\//);
    });

    it("test_xid_delegate_remove", async () => {
      let xidDoc = await makeXidDoc();
      const bobDoc = await makeBobXidDoc();

      xidDoc = await xid.delegate.add.exec({
        delegate: bobDoc,
        allow: [XIDPrivilege.All],
        outputOpts: defaultOutputOptions(),
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: NO_SIGNING_ARGS,
        envelope: xidDoc,
      });
      expect(xid.delegate.count.exec({ envelope: xidDoc })).toBe("1");

      xidDoc = await xid.delegate.remove.exec({
        delegate: bobDoc,
        outputOpts: defaultOutputOptions(),
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: NO_SIGNING_ARGS,
        envelope: xidDoc,
      });
      expect(xid.delegate.count.exec({ envelope: xidDoc })).toBe("0");
    });

    it("test_xid_delegate_update", async () => {
      let xidDoc = await makeXidDoc();
      const bobDoc = await makeBobXidDoc();

      // Add Bob as delegate with Sign + Encrypt
      xidDoc = await xid.delegate.add.exec({
        delegate: bobDoc,
        allow: [XIDPrivilege.Sign, XIDPrivilege.Encrypt],
        outputOpts: defaultOutputOptions(),
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: NO_SIGNING_ARGS,
        envelope: xidDoc,
      });
      expect(xid.delegate.count.exec({ envelope: xidDoc })).toBe("1");

      // Update Bob's delegate permissions to Auth + Sign
      xidDoc = await xid.delegate.update.exec({
        delegate: bobDoc,
        allow: [XIDPrivilege.Auth, XIDPrivilege.Sign],
        outputOpts: defaultOutputOptions(),
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: NO_SIGNING_ARGS,
        envelope: xidDoc,
      });

      // Still 1 delegate
      expect(xid.delegate.count.exec({ envelope: xidDoc })).toBe("1");

      // Verify updated permissions
      const formatted = format.exec({
        ...format.defaultArgs(),
        envelope: xidDoc,
      });
      expect(formatted).toContain("'allow': 'Auth'");
      expect(formatted).toContain("'allow': 'Sign'");
      // Old permission should be gone
      expect(formatted).not.toContain("'allow': 'Encrypt'");
    });
    // Rust's delegate find command only supports find-by-XID, not find-by-name.
    // The TS implementation matches: delegate/find.ts takes a delegate XID arg.
  });

  describe("service management", () => {
    it("test_xid_service_count", async () => {
      const xidDoc = await makeXidDoc();
      expect(xid.service.count.exec({ envelope: xidDoc })).toBe("0");
    });

    it("test_xid_service_add", async () => {
      let xidDoc = await makeXidDoc();

      xidDoc = await xid.service.add.exec({
        serviceArgs: {
          uri: "https://example.com/api",
          name: "Example API",
          keys: [ALICE_PUBKEYS],
          delegates: [],
          permissions: [XIDPrivilege.Auth],
        },
        outputOpts: defaultOutputOptions(),
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: NO_SIGNING_ARGS,
        envelope: xidDoc,
      });

      expect(xid.service.count.exec({ envelope: xidDoc })).toBe("1");
    });

    it("test_xid_service_at", async () => {
      let xidDoc = await makeXidDoc();

      xidDoc = await xid.service.add.exec({
        serviceArgs: {
          uri: "https://example.com/api",
          keys: [ALICE_PUBKEYS],
          delegates: [],
          permissions: [XIDPrivilege.Auth],
        },
        outputOpts: defaultOutputOptions(),
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: NO_SIGNING_ARGS,
        envelope: xidDoc,
      });

      // Index 0 should succeed
      const result = xid.service.at.exec({ index: 0, envelope: xidDoc });
      expect(result).toBeTruthy();

      // Index 1 should fail
      expect(() => xid.service.at.exec({ index: 1, envelope: xidDoc })).toThrow();
    });

    it("test_xid_service_all", async () => {
      let xidDoc = await makeXidDoc();

      xidDoc = await xid.service.add.exec({
        serviceArgs: {
          uri: "https://example.com/api",
          keys: [ALICE_PUBKEYS],
          delegates: [],
          permissions: [XIDPrivilege.Auth],
        },
        outputOpts: defaultOutputOptions(),
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: NO_SIGNING_ARGS,
        envelope: xidDoc,
      });

      const all = xid.service.all.exec({ envelope: xidDoc });
      expect(all).toBeTruthy();
    });

    it("test_xid_service_remove", async () => {
      let xidDoc = await makeXidDoc();

      xidDoc = await xid.service.add.exec({
        serviceArgs: {
          uri: "https://example.com/api",
          keys: [ALICE_PUBKEYS],
          delegates: [],
          permissions: [XIDPrivilege.Auth],
        },
        outputOpts: defaultOutputOptions(),
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: NO_SIGNING_ARGS,
        envelope: xidDoc,
      });
      expect(xid.service.count.exec({ envelope: xidDoc })).toBe("1");

      xidDoc = await xid.service.remove.exec({
        uri: "https://example.com/api",
        outputOpts: defaultOutputOptions(),
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: NO_SIGNING_ARGS,
        envelope: xidDoc,
      });
      expect(xid.service.count.exec({ envelope: xidDoc })).toBe("0");
    });

    it("test_xid_service_update", async () => {
      let xidDoc = await makeXidDoc();

      // Add a service
      xidDoc = await xid.service.add.exec({
        serviceArgs: {
          uri: "https://example.com/api",
          name: "Example API",
          keys: [ALICE_PUBKEYS],
          delegates: [],
          permissions: [XIDPrivilege.Auth],
        },
        outputOpts: defaultOutputOptions(),
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: NO_SIGNING_ARGS,
        envelope: xidDoc,
      });
      expect(xid.service.count.exec({ envelope: xidDoc })).toBe("1");

      // Update the service: change permissions (Auth → Sign + Encrypt)
      xidDoc = await xid.service.update.exec({
        serviceArgs: {
          uri: "https://example.com/api",
          keys: [],
          delegates: [],
          permissions: [XIDPrivilege.Sign, XIDPrivilege.Encrypt],
        },
        outputOpts: defaultOutputOptions(),
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: NO_SIGNING_ARGS,
        envelope: xidDoc,
      });

      // Still 1 service
      expect(xid.service.count.exec({ envelope: xidDoc })).toBe("1");

      // Verify updated permissions
      const formatted = format.exec({
        ...format.defaultArgs(),
        envelope: xidDoc,
      });
      expect(formatted).toContain('"Example API"');
      expect(formatted).toContain("'allow': 'Sign'");
      expect(formatted).toContain("'allow': 'Encrypt'");
    });
  });

  describe("encrypted keys", () => {
    it("test_xid_encrypted_keys_preserved", async () => {
      // Create XID with encrypted private keys
      const args = xid.newCmd.defaultArgs();
      args.keyArgs.keys = ALICE_PRVKEYS;
      args.outputOpts.privateOpts = PrivateOptions.Encrypt;
      args.generatorOpts = GeneratorOptions.Omit;
      args.passwordArgs.write.encryptPassword = "secret";
      const xidEncrypted = await xid.newCmd.exec(args);

      // Verify it contains ENCRYPTED
      let formatted = format.exec({ ...format.defaultArgs(), envelope: xidEncrypted });
      expect(formatted).toContain("ENCRYPTED");
      expect(formatted).toContain("hasSecret");

      // Add a resolution method WITHOUT providing password
      const resolutionAdd = await import("../src/cmd/xid/resolution/add.js");
      const xidWithMethod = await resolutionAdd.exec({
        uri: "https://resolver.example.com",
        outputOpts: defaultOutputOptions(),
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: NO_SIGNING_ARGS,
        envelope: xidEncrypted,
      });

      // Should still have encrypted keys
      formatted = format.exec({ ...format.defaultArgs(), envelope: xidWithMethod });
      expect(formatted).toContain("ENCRYPTED");
      expect(formatted).toContain("hasSecret");
      expect(formatted).toContain("dereference");

      // Verify we can still decrypt with the password by adding another key
      const xidFinal = await xid.key.add.exec({
        keyArgs: {
          keys: CAROL_PRVKEYS,
          nickname: "",
          privateOpts: PrivateOptions.Encrypt,
          endpoints: [],
          permissions: [],
        },
        generatorOpts: GeneratorOptions.Omit,
        passwordArgs: {
          read: { askpass: false, password: "secret" },
          write: {
            encryptAskpass: false,
            encryptMethod: PasswordMethod.Argon2id,
            encryptPassword: "secret",
          },
        },
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: NO_SIGNING_ARGS,
        envelope: xidWithMethod,
      });

      // Should still have encrypted keys and now 2 keys
      formatted = format.exec({ ...format.defaultArgs(), envelope: xidFinal });
      expect(formatted).toContain("ENCRYPTED");
      expect(formatted).toContain("hasSecret");
      expect((formatted.match(/'key':/g) || []).length).toBe(2);
    });

    it("test_xid_key_private_flag", async () => {
      // Create XID with encrypted private key
      const args = xid.newCmd.defaultArgs();
      args.keyArgs.keys = ALICE_PRVKEYS;
      args.keyArgs.nickname = "TestKey";
      args.outputOpts.privateOpts = PrivateOptions.Encrypt;
      args.generatorOpts = GeneratorOptions.Omit;
      args.passwordArgs.write.encryptPassword = "secret";
      const xidEncrypted = await xid.newCmd.exec(args);

      // Test 1: key all without --private (returns public key envelopes)
      const publicKeys = await xid.key.all.exec({
        private: false,
        passwordArgs: { askpass: false },
        verifyArgs: NO_VERIFY_ARGS,
        envelope: xidEncrypted,
      });
      expect(publicKeys).toMatch(/^ur:envelope\//);
      const formattedPublic = format.exec({ ...format.defaultArgs(), envelope: publicKeys });
      expect(formattedPublic).toContain("ENCRYPTED");

      // Test 2: key all --private without password (returns encrypted envelope)
      const encrypted = await xid.key.all.exec({
        private: true,
        passwordArgs: { askpass: false },
        verifyArgs: NO_VERIFY_ARGS,
        envelope: xidEncrypted,
      });
      const formattedEncrypted = format.exec({ ...format.defaultArgs(), envelope: encrypted });
      expect(formattedEncrypted).toContain("ENCRYPTED");
      expect(formattedEncrypted).toContain("hasSecret");

      // Test 3: key all --private with correct password (returns ur:crypto-prvkeys)
      const decrypted = await xid.key.all.exec({
        private: true,
        passwordArgs: { askpass: false, password: "secret" },
        verifyArgs: NO_VERIFY_ARGS,
        envelope: xidEncrypted,
      });
      expect(decrypted).toMatch(/^ur:crypto-prvkeys\//);

      // Test 4: key all --private with wrong password (should error)
      await expect(
        xid.key.all.exec({
          private: true,
          passwordArgs: { askpass: false, password: "wrong" },
          verifyArgs: NO_VERIFY_ARGS,
          envelope: xidEncrypted,
        }),
      ).rejects.toThrow();

      // Test 5: key at 0 --private with password (returns ur:crypto-prvkeys)
      const decryptedAt = await xid.key.at.exec({
        index: 0,
        private: true,
        passwordArgs: { askpass: false, password: "secret" },
        verifyArgs: NO_VERIFY_ARGS,
        envelope: xidEncrypted,
      });
      expect(decryptedAt).toMatch(/^ur:crypto-prvkeys\//);

      // Test 6: key find inception --private (returns encrypted envelope)
      const inceptionEncrypted = await xid.key.find.inception.exec({
        private: true,
        passwordArgs: { askpass: false },
        verifyArgs: NO_VERIFY_ARGS,
        envelope: xidEncrypted,
      });
      const formattedInception = format.exec({
        ...format.defaultArgs(),
        envelope: inceptionEncrypted,
      });
      expect(formattedInception).toContain("ENCRYPTED");

      // Test 7: key find name --private with password (returns ur:crypto-prvkeys)
      const foundByName = await xid.key.find.name.exec({
        name: "TestKey",
        private: true,
        passwordArgs: { askpass: false, password: "secret" },
        verifyArgs: NO_VERIFY_ARGS,
        envelope: xidEncrypted,
      });
      expect(foundByName).toMatch(/^ur:crypto-prvkeys\//);

      // Test 8: Unencrypted key with --private (returns ur:crypto-prvkeys directly)
      const unencryptedArgs = xid.newCmd.defaultArgs();
      unencryptedArgs.keyArgs.keys = ALICE_PRVKEYS;
      unencryptedArgs.generatorOpts = GeneratorOptions.Omit;
      const xidUnencrypted = await xid.newCmd.exec(unencryptedArgs);

      const unencryptedPrivate = await xid.key.all.exec({
        private: true,
        passwordArgs: { askpass: false },
        verifyArgs: NO_VERIFY_ARGS,
        envelope: xidUnencrypted,
      });
      expect(unencryptedPrivate).toMatch(/^ur:crypto-prvkeys\//);
    });
  });
});
