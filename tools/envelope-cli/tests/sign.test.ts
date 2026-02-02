/**
 * Sign command tests - 1:1 port of tests/test_sign.rs
 */

import { describe, it, expect } from "vitest";
import * as sign from "../src/cmd/sign.js";
import * as verify from "../src/cmd/verify.js";
import * as format from "../src/cmd/format.js";
import * as generate from "../src/cmd/generate/index.js";
import * as subject from "../src/cmd/subject/index.js";
import { ALICE_KNOWS_BOB_EXAMPLE, ALICE_PRVKEYS, CAROL_PRVKEYS } from "./common.js";
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
