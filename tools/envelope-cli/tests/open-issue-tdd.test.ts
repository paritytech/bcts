/**
 * Open-issue TDD regression tests - port of tests/test_open_issue_tdd.rs (0.35.0)
 *
 * These lock in custom-assertion preservation through XID mutations:
 * - #12: xid key add / key remove preserve unrelated custom assertions
 * - #14: xid provenance next preserves custom assertions (and bumps next-seq)
 *
 * NOTE: TS `format` lacks some Rust key summarizers (renders a key bundle as
 * `Bytes(78)` rather than `PublicKeys(...)`), so these assertions check the
 * custom field, key nicknames, and sequence rather than the full Rust rubric.
 */

import { describe, it, expect } from "vitest";
import * as assertion from "../src/cmd/assertion/index.js";
import * as format from "../src/cmd/format.js";
import * as xid from "../src/cmd/xid/index.js";
import { DataType } from "../src/data-types.js";
import { PrivateOptions } from "../src/cmd/xid/private-options.js";
import { GeneratorOptions } from "../src/cmd/xid/generator-options.js";
import { SigningOption } from "../src/cmd/xid/signing-args.js";
import { VerifyOption } from "../src/cmd/xid/verify-args.js";
import { PasswordMethod } from "../src/cmd/xid/password-args.js";
import { ALICE_PUBKEYS, ALICE_PRVKEY_BASE, BOB_PUBKEYS } from "./common.js";

const NO_VERIFY_ARGS: xid.VerifyArgs = { verify: VerifyOption.None };
const NO_SIGNING_ARGS: xid.SigningArgs = { sign: SigningOption.None };

function noPasswordArgs(): xid.ReadWritePasswordArgs {
  return {
    read: { askpass: false },
    write: { encryptAskpass: false, encryptMethod: PasswordMethod.Argon2id },
  };
}

function keyArgs(keys: string, nickname: string) {
  return {
    nickname,
    privateOpts: PrivateOptions.Include,
    endpoints: [],
    permissions: [],
    keys,
  };
}

async function newXid(keys: string, nickname: string): Promise<string> {
  const args = xid.newCmd.defaultArgs();
  args.keyArgs = keyArgs(keys, nickname);
  args.generatorOpts = GeneratorOptions.Omit;
  return xid.newCmd.exec(args);
}

function addCustom(envelope: string): string {
  return assertion.add.predObj.exec({
    ...assertion.add.predObj.defaultArgs(),
    predType: DataType.String,
    predValue: "customField",
    objType: DataType.String,
    objValue: "customValue",
    salted: false,
    envelope,
  });
}

describe("open-issue TDD regression (0.35.0)", () => {
  it("issue_12_xid_key_add_preserves_custom_assertions", async () => {
    const alice = await newXid(ALICE_PUBKEYS, "Alice");
    const custom = addCustom(alice);

    const updated = await xid.key.add.exec({
      keyArgs: keyArgs(BOB_PUBKEYS, "Bob"),
      generatorOpts: GeneratorOptions.Omit,
      passwordArgs: noPasswordArgs(),
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: NO_SIGNING_ARGS,
      envelope: custom,
    });

    const formatted = format.exec({ ...format.defaultArgs(), envelope: updated });
    expect(formatted).toContain('"customField": "customValue"');
    expect(formatted).toContain('"Alice"');
    expect(formatted).toContain('"Bob"');
  });

  it("issue_12_xid_key_remove_preserves_custom_assertions", async () => {
    const alice = await newXid(ALICE_PUBKEYS, "Alice");
    const withBob = await xid.key.add.exec({
      keyArgs: keyArgs(BOB_PUBKEYS, "Bob"),
      generatorOpts: GeneratorOptions.Omit,
      passwordArgs: noPasswordArgs(),
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: NO_SIGNING_ARGS,
      envelope: alice,
    });
    const custom = addCustom(withBob);

    const updated = await xid.key.remove.exec({
      keys: BOB_PUBKEYS,
      privateOpts: PrivateOptions.Include,
      generatorOpts: GeneratorOptions.Omit,
      passwordArgs: noPasswordArgs(),
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: NO_SIGNING_ARGS,
      envelope: custom,
    });

    const formatted = format.exec({ ...format.defaultArgs(), envelope: updated });
    expect(formatted).toContain('"customField": "customValue"');
    expect(formatted).toContain('"Alice"');
    expect(formatted).not.toContain('"Bob"');
  });

  it("issue_14_xid_provenance_next_preserves_custom_assertions", async () => {
    const newArgs = xid.newCmd.defaultArgs();
    newArgs.keyArgs = keyArgs(ALICE_PRVKEY_BASE, "");
    newArgs.outputOpts.privateOpts = PrivateOptions.Include;
    newArgs.generatorOpts = GeneratorOptions.Include;
    const xidDoc = await xid.newCmd.exec(newArgs);
    const custom = addCustom(xidDoc);

    const updated = await xid.provenance.next.exec({
      date: "2024-01-15",
      outputOpts: { privateOpts: PrivateOptions.Include, generatorOpts: GeneratorOptions.Include },
      passwordArgs: noPasswordArgs(),
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: NO_SIGNING_ARGS,
      envelope: custom,
    });

    const formatted = format.exec({ ...format.defaultArgs(), envelope: updated });
    expect(formatted).toContain('"customField": "customValue"');
    expect(formatted).toContain('"next-seq": 2');
  });
});
