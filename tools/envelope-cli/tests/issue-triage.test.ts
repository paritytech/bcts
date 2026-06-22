/**
 * Issue-triage regression tests - port of tests/test_issue_triage_repro.rs (0.35.0)
 *
 * Locks in the behavioral fixes shipped upstream in bc-envelope-cli 0.35.0:
 * - #10/#20: full XID document accepted as `ur`/`envelope` data object
 * - #11/#13: xid id / key count accept XID docs carrying custom assertions
 * - #21:     xid key commands accept elided key material
 * - #19:     assertion find object does not throw on elided assertions
 *
 * The TS suite calls each command's exec() directly (rather than spawning the
 * binary), chaining UR-string output into the next command's `envelope` arg.
 *
 * NOTE: TS `format` lacks some Rust summarizers (e.g. it renders a key bundle as
 * `Bytes(78)` rather than `PublicKeys(...)`); assertions here avoid depending on
 * those summarizers. Provenance/signing-dependent issue tests (#14/#16/#17/#18)
 * live alongside but are guarded — see notes there.
 */

import { describe, it, expect } from "vitest";
import * as subject from "../src/cmd/subject/index.js";
import * as assertion from "../src/cmd/assertion/index.js";
import * as format from "../src/cmd/format.js";
import * as xid from "../src/cmd/xid/index.js";
import { DataType } from "../src/data-types.js";
import { PrivateOptions } from "../src/cmd/xid/private-options.js";
import { GeneratorOptions } from "../src/cmd/xid/generator-options.js";
import { SigningOption } from "../src/cmd/xid/signing-args.js";
import { VerifyOption } from "../src/cmd/xid/verify-args.js";
import { PasswordMethod } from "../src/cmd/xid/password-args.js";
import { ALICE_PRVKEY_BASE } from "./common.js";

// A full XID document UR and its XID identifier (from the Rust regression test).
const XID_DOC =
  "ur:xid/tpsplftpsotanshdhdcxjsdigtwneocmnybadpdlzobysbstmekteypspeotcfldynlpsfolsbintyjkrhfnoyaylftpsotansgylftanshfhdcxhslkfzemaylrwttynsdlghrydpmdfzvdglndloimaahykorefddtsguogmvlahqztansgrhdcxetlewzvlwyfdtobeytidosbamkswaomwwfyabakssakggegychesmerkcatekpcxoycsfncsfggmplgshd";
const XID_DOC_ID =
  "ur:xid/hdcxjsdigtwneocmnybadpdlzobysbstmekteypspeotcfldynlpsfolsbintyjkrhfnvsbyrdfw";

const NO_VERIFY_ARGS: xid.VerifyArgs = { verify: VerifyOption.None };
const INCEPTION_VERIFY_ARGS: xid.VerifyArgs = { verify: VerifyOption.Inception };
const INCEPTION_SIGNING_ARGS: xid.SigningArgs = { sign: SigningOption.Inception };

function noPasswordArgs(): xid.ReadWritePasswordArgs {
  return {
    read: { askpass: false },
    write: { encryptAskpass: false, encryptMethod: PasswordMethod.Argon2id },
  };
}

/** Build a `xid new` with the given private/generator/signing options. */
function newXidArgs(opts: {
  privateOpts: PrivateOptions;
  generatorOpts: GeneratorOptions;
  sign?: boolean;
  encryptPassword?: string;
}): ReturnType<typeof xid.newCmd.defaultArgs> {
  const args = xid.newCmd.defaultArgs();
  args.keyArgs.keys = ALICE_PRVKEY_BASE;
  args.keyArgs.privateOpts = opts.privateOpts;
  args.outputOpts.privateOpts = opts.privateOpts;
  args.generatorOpts = opts.generatorOpts;
  if (opts.sign) {
    args.signingArgs = INCEPTION_SIGNING_ARGS;
  }
  if (opts.encryptPassword !== undefined) {
    args.passwordArgs.write.encryptPassword = opts.encryptPassword;
  }
  return args;
}

describe("issue triage regression (0.35.0)", () => {
  it("issue_10_full_xid_doc_can_be_added_as_ur_object", () => {
    const endorsement = subject.type.exec({
      subjectType: DataType.String,
      subjectValue: "Endorsement",
    });
    const withXid = assertion.add.predObj.exec({
      ...assertion.add.predObj.defaultArgs(),
      predType: DataType.String,
      predValue: "endorsementTarget",
      objType: DataType.Ur,
      objValue: XID_DOC,
      salted: false,
      envelope: endorsement,
    });

    const formatted = format.exec({ ...format.defaultArgs(), envelope: withXid });
    expect(formatted).not.toContain("<error:");
    expect(formatted).toContain('"endorsementTarget"');
    expect(formatted).toContain("XID(");
  });

  it("issue_20_xid_doc_can_be_added_as_envelope_object", () => {
    const overview = subject.type.exec({
      subjectType: DataType.String,
      subjectValue: "bradovc8XIDFiles",
    });
    const withXid = assertion.add.predObj.exec({
      ...assertion.add.predObj.defaultArgs(),
      predType: DataType.String,
      predValue: "xid",
      objType: DataType.Envelope,
      objValue: XID_DOC,
      salted: false,
      envelope: overview,
    });

    const formatted = format.exec({ ...format.defaultArgs(), envelope: withXid });
    expect(formatted).not.toContain("<error:");
    expect(formatted).toContain('"xid"');
    expect(formatted).toContain("XID(");
  });

  it("issue_11_xid_id_accepts_xid_document_with_custom_assertions", () => {
    const custom = assertion.add.predObj.exec({
      ...assertion.add.predObj.defaultArgs(),
      predType: DataType.String,
      predValue: "customField",
      objType: DataType.String,
      objValue: "customValue",
      salted: false,
      envelope: XID_DOC,
    });

    const id = xid.id.exec({
      format: [xid.IDFormat.Ur],
      verifyArgs: NO_VERIFY_ARGS,
      envelope: custom,
    });
    expect(id).toBe(XID_DOC_ID);
  });

  it("issue_13_xid_key_count_accepts_custom_assertions", () => {
    const custom = assertion.add.predObj.exec({
      ...assertion.add.predObj.defaultArgs(),
      predType: DataType.String,
      predValue: "customField",
      objType: DataType.String,
      objValue: "customValue",
      salted: false,
      envelope: XID_DOC,
    });

    const count = xid.key.count.exec({ verifyArgs: NO_VERIFY_ARGS, envelope: custom });
    expect(count).toBe("1");
  });

  it("issue_21_xid_key_commands_accept_elided_key_material", async () => {
    const newArgs = xid.newCmd.defaultArgs();
    newArgs.keyArgs.keys = ALICE_PRVKEY_BASE;
    newArgs.keyArgs.nickname = "Alice";
    newArgs.keyArgs.privateOpts = PrivateOptions.Elide;
    newArgs.outputOpts.privateOpts = PrivateOptions.Elide;
    const xidDoc = await xid.newCmd.exec(newArgs);

    const count = xid.key.count.exec({ verifyArgs: NO_VERIFY_ARGS, envelope: xidDoc });
    expect(count).toBe("1");

    const keys = await xid.key.all.exec({
      private: false,
      passwordArgs: { askpass: false },
      verifyArgs: NO_VERIFY_ARGS,
      envelope: xidDoc,
    });
    const formatted = format.exec({ ...format.defaultArgs(), envelope: keys });
    // The elided private-key material renders as ELIDED.
    expect(formatted).toContain("ELIDED");
  });

  it("issue_19_assertion_find_object_does_not_throw_on_elided_assertions", async () => {
    const newArgs = xid.newCmd.defaultArgs();
    newArgs.keyArgs.keys = ALICE_PRVKEY_BASE;
    newArgs.keyArgs.nickname = "contract-key";
    newArgs.keyArgs.privateOpts = PrivateOptions.Elide;
    newArgs.outputOpts.privateOpts = PrivateOptions.Elide;
    const xidDoc = await xid.newCmd.exec(newArgs);

    const key = await xid.key.all.exec({
      private: false,
      passwordArgs: { askpass: false },
      verifyArgs: NO_VERIFY_ARGS,
      envelope: xidDoc,
    });

    // Must not throw on the elided assertion(s); must still return the match.
    const found = assertion.find.object.exec({
      subjectType: DataType.String,
      subjectValue: "contract-key",
      envelope: key,
    });
    const formatted = format.exec({ ...format.defaultArgs(), envelope: found });
    expect(formatted).toContain('"contract-key"');
  });

  it("issue_14_xid_provenance_get_accepts_custom_assertions", async () => {
    const xidDoc = await xid.newCmd.exec(
      newXidArgs({ privateOpts: PrivateOptions.Include, generatorOpts: GeneratorOptions.Include }),
    );
    const custom = assertion.add.predObj.exec({
      ...assertion.add.predObj.defaultArgs(),
      predType: DataType.String,
      predValue: "customField",
      objType: DataType.String,
      objValue: "customValue",
      salted: false,
      envelope: xidDoc,
    });

    const provenance = await xid.provenance.get.exec({
      passwordArgs: noPasswordArgs(),
      verifyArgs: NO_VERIFY_ARGS,
      envelope: custom,
    });
    expect(provenance.startsWith("ur:provenance/")).toBe(true);
  });

  it("issue_17_xid_export_signs_when_requested", async () => {
    const unsigned = await xid.newCmd.exec(
      newXidArgs({ privateOpts: PrivateOptions.Include, generatorOpts: GeneratorOptions.Include }),
    );

    const exported = await xid.exportCmd.exec({
      ...xid.exportCmd.defaultArgs(),
      outputOpts: {
        ...xid.exportCmd.defaultArgs().outputOpts,
        privateOpts: PrivateOptions.Elide,
        generatorOpts: GeneratorOptions.Elide,
      },
      signingArgs: INCEPTION_SIGNING_ARGS,
      envelope: unsigned,
    });

    // Verifying with inception must succeed, proving the export was signed.
    const verified = xid.id.exec({
      format: [xid.IDFormat.Ur],
      verifyArgs: INCEPTION_VERIFY_ARGS,
      envelope: exported,
    });
    expect(verified).toBeTruthy();
  });

  it("issue_18_xid_resolution_all_reads_signed_xid_subject", async () => {
    const xidDoc = await xid.newCmd.exec(
      newXidArgs({
        privateOpts: PrivateOptions.Include,
        generatorOpts: GeneratorOptions.Include,
        sign: true,
      }),
    );
    const withResolution = await xid.resolution.add.exec({
      uri: "https://example.com/xid.txt",
      outputOpts: xid.newCmd.defaultArgs().outputOpts,
      passwordArgs: noPasswordArgs(),
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: INCEPTION_SIGNING_ARGS,
      envelope: xidDoc,
    });

    const methods = xid.resolution.all.exec({ envelope: withResolution });
    expect(methods).toBe("https://example.com/xid.txt");
  });

  it("issue_16_wrong_password_reports_decryption_failure", async () => {
    const xidDoc = await xid.newCmd.exec(
      newXidArgs({
        privateOpts: PrivateOptions.Encrypt,
        generatorOpts: GeneratorOptions.Encrypt,
        sign: true,
        encryptPassword: "correct password",
      }),
    );

    // Re-export with the WRONG decryption password while signing with inception.
    await expect(
      xid.resolution.add.exec({
        uri: "https://example.com/xid.txt",
        outputOpts: {
          ...xid.newCmd.defaultArgs().outputOpts,
          privateOpts: PrivateOptions.Encrypt,
          generatorOpts: GeneratorOptions.Encrypt,
        },
        passwordArgs: {
          read: { askpass: false, password: "wrong password" },
          write: {
            encryptAskpass: false,
            encryptMethod: PasswordMethod.Argon2id,
            encryptPassword: "correct password",
          },
        },
        verifyArgs: INCEPTION_VERIFY_ARGS,
        signingArgs: INCEPTION_SIGNING_ARGS,
        envelope: xidDoc,
      }),
    ).rejects.toThrow("could not decrypt the inception key");
  });
});
