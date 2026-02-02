/**
 * Elide command tests - 1:1 port of tests/test_elide.rs
 */

import { describe, it, expect } from "vitest";
import * as elide from "../src/cmd/elide/index.js";
import * as digest from "../src/cmd/digest.js";
import * as extract from "../src/cmd/extract.js";
import * as assertion from "../src/cmd/assertion/index.js";
import * as subject from "../src/cmd/subject/index.js";
import * as format from "../src/cmd/format.js";
import { ALICE_KNOWS_BOB_EXAMPLE, expectOutput } from "./common.js";
import { DataType } from "../src/data-types.js";

describe("elide command", () => {
  it("test_elide_1", () => {
    const target: string[] = [];

    // Top level
    target.push(
      digest.exec({
        ...digest.defaultArgs(),
        envelope: ALICE_KNOWS_BOB_EXAMPLE,
      }),
    );

    // Subject
    const subjectEnvelope = extract.exec({
      type: extract.SubjectType.Envelope,
      envelope: ALICE_KNOWS_BOB_EXAMPLE,
    });
    target.push(
      digest.exec({
        ...digest.defaultArgs(),
        envelope: subjectEnvelope,
      }),
    );

    // Assertion
    const assertionEnvelope = assertion.at.exec({
      index: 0,
      envelope: ALICE_KNOWS_BOB_EXAMPLE,
    });
    target.push(
      digest.exec({
        ...digest.defaultArgs(),
        envelope: assertionEnvelope,
      }),
    );

    // Object
    const objectEnvelope = extract.exec({
      type: extract.SubjectType.Object,
      envelope: assertionEnvelope,
    });
    target.push(
      digest.exec({
        ...digest.defaultArgs(),
        envelope: objectEnvelope,
      }),
    );

    const digests = target.join(" ");
    const elided = elide.revealing.exec({
      target: digests,
      action: elide.Action.Elide,
      envelope: ALICE_KNOWS_BOB_EXAMPLE,
    });

    expect(elided).toBe(
      "ur:envelope/lftpsoihfpjziniaihoyhdcxuykitdcegyinqzlrlgdrcwsbbkihcemtchsntabdpldtbzjepkwsrkdrlernykrdtpsoiafwjlidgraehkfp",
    );

    const formatted = format.exec({
      ...format.defaultArgs(),
      envelope: elided,
    });

    const expected = `"Alice" [
    ELIDED: "Bob"
]`;
    expectOutput(formatted, expected);
  });

  it("test_elide_2", () => {
    // Get digest of "knows" predicate
    const knowsEnvelope = subject.type.exec({
      subjectType: DataType.String,
      subjectValue: "knows",
    });
    const knowsDigest = digest.exec({
      ...digest.defaultArgs(),
      envelope: knowsEnvelope,
    });

    const elided = elide.removing.exec({
      target: knowsDigest,
      action: elide.Action.Elide,
      envelope: ALICE_KNOWS_BOB_EXAMPLE,
    });

    expect(elided).toBe(
      "ur:envelope/lftpsoihfpjziniaihoyhdcxuykitdcegyinqzlrlgdrcwsbbkihcemtchsntabdpldtbzjepkwsrkdrlernykrdtpsoiafwjlidgraehkfp",
    );

    const formatted = format.exec({
      ...format.defaultArgs(),
      envelope: elided,
    });

    const expected = `"Alice" [
    ELIDED: "Bob"
]`;
    expectOutput(formatted, expected);
  });
});
