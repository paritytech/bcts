/**
 * XID resolution command tests - 1:1 port of tests/test_xid_resolution.rs
 */

import { describe, it, expect } from "vitest";
import * as xid from "../src/cmd/xid/index.js";
import * as resolution from "../src/cmd/xid/resolution/index.js";
import { ALICE_PUBKEYS, BOB_PUBKEYS } from "./common.js";
import { PrivateOptions } from "../src/cmd/xid/private-options.js";
import { GeneratorOptions } from "../src/cmd/xid/generator-options.js";
import { PasswordMethod } from "../src/cmd/xid/password-args.js";
import { SigningOption } from "../src/cmd/xid/signing-args.js";
import { VerifyOption } from "../src/cmd/xid/verify-args.js";
import { defaultOutputOptions } from "../src/cmd/xid/output-options.js";

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

describe("xid resolution", () => {
  it("test_xid_resolution_count_empty", async () => {
    const xidDoc = await makeXidDoc();
    const count = resolution.count.exec({ envelope: xidDoc });
    expect(count).toBe("0");
  });

  it("test_xid_resolution_basic", async () => {
    let xidDoc = await makeXidDoc();
    const count0 = resolution.count.exec({ envelope: xidDoc });
    expect(count0).toBe("0");

    // Add a resolution method
    xidDoc = await resolution.add.exec({
      uri: "https://resolver.example.com",
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: NO_SIGNING_ARGS,
      envelope: xidDoc,
    });

    const count1 = resolution.count.exec({ envelope: xidDoc });
    expect(count1).toBe("1");

    // List all
    const all = resolution.all.exec({ envelope: xidDoc });
    expect(all).toContain("https://resolver.example.com");

    // Get at index 0
    const at0 = resolution.at.exec({ index: 0, envelope: xidDoc });
    expect(at0).toContain("https://resolver.example.com");
  });

  it("test_xid_resolution_multiple", async () => {
    let xidDoc = await makeXidDoc();

    // Add first method
    xidDoc = await resolution.add.exec({
      uri: "https://resolver.example.com",
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: NO_SIGNING_ARGS,
      envelope: xidDoc,
    });

    // Add second method
    xidDoc = await resolution.add.exec({
      uri: "btcr:01234567",
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: NO_SIGNING_ARGS,
      envelope: xidDoc,
    });

    const count = resolution.count.exec({ envelope: xidDoc });
    expect(count).toBe("2");

    const all = resolution.all.exec({ envelope: xidDoc });
    expect(all).toContain("https://resolver.example.com");
    expect(all).toContain("btcr:01234567");
  });

  it("test_xid_resolution_remove", async () => {
    let xidDoc = await makeXidDoc();

    // Add two methods
    xidDoc = await resolution.add.exec({
      uri: "https://resolver.example.com",
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: NO_SIGNING_ARGS,
      envelope: xidDoc,
    });
    xidDoc = await resolution.add.exec({
      uri: "btcr:01234567",
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: NO_SIGNING_ARGS,
      envelope: xidDoc,
    });

    expect(resolution.count.exec({ envelope: xidDoc })).toBe("2");

    // Remove one
    xidDoc = await resolution.remove.exec({
      uri: "btcr:01234567",
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: NO_SIGNING_ARGS,
      envelope: xidDoc,
    });

    expect(resolution.count.exec({ envelope: xidDoc })).toBe("1");

    const all = resolution.all.exec({ envelope: xidDoc });
    expect(all).toContain("https://resolver.example.com");
    expect(all).not.toContain("btcr:01234567");
  });

  it("test_xid_resolution_remove_not_found", async () => {
    let xidDoc = await makeXidDoc();

    xidDoc = await resolution.add.exec({
      uri: "https://resolver.example.com",
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: NO_SIGNING_ARGS,
      envelope: xidDoc,
    });

    await expect(
      resolution.remove.exec({
        uri: "https://nonexistent.example.com",
        outputOpts: defaultOutputOptions(),
        passwordArgs: NO_PASSWORD_ARGS,
        verifyArgs: NO_VERIFY_ARGS,
        signingArgs: NO_SIGNING_ARGS,
        envelope: xidDoc,
      }),
    ).rejects.toThrow();
  });

  it("test_xid_resolution_index_out_of_bounds", async () => {
    let xidDoc = await makeXidDoc();

    xidDoc = await resolution.add.exec({
      uri: "https://resolver.example.com",
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: NO_SIGNING_ARGS,
      envelope: xidDoc,
    });

    // Index 0 should work
    expect(() => resolution.at.exec({ index: 0, envelope: xidDoc })).not.toThrow();

    // Index 5 should fail
    expect(() => resolution.at.exec({ index: 5, envelope: xidDoc })).toThrow("Index out of bounds");
  });

  it("test_xid_resolution_empty_list", async () => {
    const xidDoc = await makeXidDoc();

    expect(resolution.count.exec({ envelope: xidDoc })).toBe("0");
    expect(resolution.all.exec({ envelope: xidDoc })).toBe("");
  });

  it("test_xid_resolution_preserved_after_other_operations", async () => {
    let xidDoc = await makeXidDoc();

    // Add a resolution method
    xidDoc = await resolution.add.exec({
      uri: "https://resolver.example.com",
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: NO_SIGNING_ARGS,
      envelope: xidDoc,
    });

    expect(resolution.count.exec({ envelope: xidDoc })).toBe("1");

    // Add a key (different operation)
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

    // Resolution should still be present
    expect(resolution.count.exec({ envelope: xidDoc })).toBe("1");
    expect(resolution.all.exec({ envelope: xidDoc })).toContain("https://resolver.example.com");
  });
});
