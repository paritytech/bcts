/**
 * Sign command tests - 1:1 port of tests/test_sign.rs
 */

import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as sign from "../src/cmd/sign.js";
import * as verify from "../src/cmd/verify.js";
import * as format from "../src/cmd/format.js";
import * as generate from "../src/cmd/generate/index.js";
import * as subject from "../src/cmd/subject/index.js";
import {
  ALICE_KNOWS_BOB_EXAMPLE,
  ALICE_PRVKEYS,
  ALICE_PRVKEY_BASE,
  CAROL_PRVKEYS,
} from "./common.js";
import { DataType } from "../src/data-types.js";

describe("sign command", () => {
  it("test_sign", () => {
    const prvkeys =
      "ur:crypto-prvkeys/lftansgohdcxpfsndiahcxsfrhjoltglmebwwnnstovocffejytdbwihdkrtdykebkiebglbtteetansgehdcxvsdapeurgauovlbsvdfhvdcevywlptspfgnejpbksadehkhkfzehhfaysrsrbsdstbtagyeh";

    const signed = sign.exec({
      ...sign.defaultArgs(),
      signers: [prvkeys],
      envelope: ALICE_KNOWS_BOB_EXAMPLE,
    });

    const formatted = format.exec({
      ...format.defaultArgs(),
      envelope: signed,
    });

    // Assertion order depends on digest sort (may differ from Rust)
    expect(formatted).toContain('"Alice"');
    expect(formatted).toContain('"knows": "Bob"');
    expect(formatted).toContain("'signed': Signature");

    // Generate pubkeys and verify
    const pubkeys = generate.pubKeys.exec({
      prvKeys: prvkeys,
      comment: "",
    });

    // Verify should succeed
    const verifyResult = verify.exec({
      ...verify.defaultArgs(),
      verifiers: [pubkeys],
      envelope: signed,
    });
    expect(verifyResult).toBeTruthy();

    // Verify unsigned envelope should fail
    expect(() =>
      verify.exec({
        ...verify.defaultArgs(),
        verifiers: [pubkeys],
        envelope: ALICE_KNOWS_BOB_EXAMPLE,
      }),
    ).toThrow();

    // Verify with wrong pubkeys should fail
    const badPrvkeys = generate.prvKeys.exec({
      signing: generate.prvKeys.SigningScheme.Ed25519,
      encryption: generate.prvKeys.EncryptionScheme.X25519,
    });
    const badPubkeys = generate.pubKeys.exec({
      prvKeys: badPrvkeys,
      comment: "",
    });
    expect(() =>
      verify.exec({
        ...verify.defaultArgs(),
        verifiers: [badPubkeys],
        envelope: signed,
      }),
    ).toThrow();
  });

  it("test_sign_with_crypto_prvkeys", () => {
    const prvkeys =
      "ur:crypto-prvkeys/lftansgohdcxredidrnyhlnefzihclvepyfsvaemgsylfxamlstaprdnrsrkfmlukpaelrdtfgprtansgehdcxmybzpysoadgmcwoxlpensnfzwecspkihmkwlstvabzensbprnelssbfnqzbnfthlmycekeds";

    const signed = sign.exec({
      ...sign.defaultArgs(),
      signers: [prvkeys],
      envelope: ALICE_KNOWS_BOB_EXAMPLE,
    });

    const formatted = format.exec({
      ...format.defaultArgs(),
      envelope: signed,
    });

    // Assertion order depends on digest sort (may differ from Rust)
    expect(formatted).toContain('"Alice"');
    expect(formatted).toContain('"knows": "Bob"');
    expect(formatted).toContain("'signed': Signature");

    // Generate pubkeys and verify
    const pubkeys = generate.pubKeys.exec({
      prvKeys: prvkeys,
      comment: "",
    });

    // Verify should succeed
    const verifyResult = verify.exec({
      ...verify.defaultArgs(),
      verifiers: [pubkeys],
      envelope: signed,
    });
    expect(verifyResult).toBeTruthy();
  });

  it("test_signer_key_without_signer_flag_reports_hint", () => {
    // Passing a signer key as the positional envelope with no --signer must
    // produce a helpful hint, not a generic/opaque parse error. (upstream #9)
    expect(() =>
      sign.exec({
        ...sign.defaultArgs(),
        envelope: ALICE_PRVKEY_BASE,
      }),
    ).toThrow(
      "signer keys must be passed with --signer/-s; did you mean: envelope sign --signer <key> [ENVELOPE]?",
    );
  });

  it("test_closed_stdout_pipe_does_not_panic", async () => {
    // Closing the stdout consumer early (e.g. `| head`) must not crash the CLI
    // with an unhandled EPIPE; it should exit cleanly. (upstream #9)
    const cliPath = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
    await new Promise<void>((resolve, reject) => {
      const child = spawn("bun", [cliPath, "subject", "type", "string", "hello"], {
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stderr = "";
      child.stderr.on("data", (d: Buffer) => {
        stderr += d.toString();
      });
      // Simulate a downstream consumer that closes the pipe immediately.
      child.stdout.destroy();
      child.on("error", reject);
      child.on("close", (code) => {
        try {
          expect(stderr).not.toContain("EPIPE");
          expect(stderr.toLowerCase()).not.toContain("panic");
          expect(code).toBe(0);
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });
  }, 20000);

  it("test_sign_3", () => {
    // Create envelope from string subject
    const envelope = subject.type.exec({
      subjectType: DataType.String,
      subjectValue: "Hello.",
    });

    const signed = sign.exec({
      ...sign.defaultArgs(),
      signers: [ALICE_PRVKEYS, CAROL_PRVKEYS],
      envelope,
    });

    const formatted = format.exec({
      ...format.defaultArgs(),
      envelope: signed,
    });

    // Should have two signatures
    expect(formatted).toContain("'signed': Signature");
    const signatureCount = (formatted.match(/'signed': Signature/g) || []).length;
    expect(signatureCount).toBe(2);
  });
});
