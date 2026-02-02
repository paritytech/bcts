/**
 * Assertion command tests - 1:1 port of tests/test_assertion.rs
 */

import { describe, it, expect } from "vitest";
import * as assertion from "../src/cmd/assertion/index.js";
import * as subject from "../src/cmd/subject/index.js";
import * as format from "../src/cmd/format.js";
import * as extract from "../src/cmd/extract.js";
import { ALICE_KNOWS_BOB_EXAMPLE, CREDENTIAL_EXAMPLE, expectOutput } from "./common.js";
import { DataType } from "../src/data-types.js";

describe("assertion command", () => {
  describe("subject assertion", () => {
    it("test_assertion", () => {
      const e = subject.assertion.exec({
        predType: DataType.String,
        predValue: "Alpha",
        objType: DataType.String,
        objValue: "Beta",
      });
      expect(e).toBe("ur:envelope/oytpsoihfpjzjoishstpsoiefwihjyhsgavlfypl");

      const formatted = format.exec({
        ...format.defaultArgs(),
        envelope: e,
      });
      expect(formatted).toBe('"Alpha": "Beta"');
    });

    it("test_assertion_2", () => {
      const e = subject.assertion.exec({
        predType: DataType.Number,
        predValue: "1",
        objType: DataType.Number,
        objValue: "2",
      });
      expect(e).toBe("ur:envelope/oytpsoadtpsoaoptspcale");

      const formatted = format.exec({
        ...format.defaultArgs(),
        envelope: e,
      });
      expect(formatted).toBe("1: 2");
    });

    it("test_assertion_3", () => {
      const e = subject.assertion.exec({
        predType: DataType.Known,
        predValue: "note",
        objType: DataType.String,
        objValue: "ThisIsANote.",
      });
      expect(e).toBe("ur:envelope/oyaatpsojzghisinjkgajkfpgljljyihdmwktslkgm");

      const formatted = format.exec({
        ...format.defaultArgs(),
        envelope: e,
      });
      expect(formatted).toBe("'note': \"ThisIsANote.\"");
    });
  });

  describe("add", () => {
    it("test_assertion_add_pred_obj", () => {
      const subjectEnvelope = subject.type.exec({
        subjectType: DataType.String,
        subjectValue: "Hello",
      });

      const result = assertion.add.predObj.exec({
        salted: false,
        predType: DataType.Known,
        predValue: "note",
        objType: DataType.String,
        objValue: "This is the note.",
        envelope: subjectEnvelope,
      });

      expect(result).toBe(
        "ur:envelope/lftpsoihfdihjzjzjloyaatpsojsghisinjkcxinjkcxjyisihcxjtjljyihdmrdyasoie",
      );
    });

    it("test_assertion_add", () => {
      const subjectEnvelope = subject.type.exec({
        subjectType: DataType.String,
        subjectValue: "Alice",
      });

      const result = assertion.add.predObj.exec({
        salted: false,
        predType: DataType.String,
        predValue: "knows",
        objType: DataType.String,
        objValue: "Bob",
        envelope: subjectEnvelope,
      });

      expect(result).toBe(ALICE_KNOWS_BOB_EXAMPLE);

      const formatted = format.exec({
        ...format.defaultArgs(),
        envelope: ALICE_KNOWS_BOB_EXAMPLE,
      });

      const expected = `"Alice" [
    "knows": "Bob"
]`;
      expectOutput(formatted, expected);
    });

    it("test_assertion_add_2", () => {
      const subjectEnvelope = subject.type.exec({
        subjectType: DataType.String,
        subjectValue: "Alice",
      });

      const predicateEnvelope = subject.type.exec({
        subjectType: DataType.String,
        subjectValue: "knows",
      });

      const objectEnvelope = subject.type.exec({
        subjectType: DataType.String,
        subjectValue: "Bob",
      });

      const result = assertion.add.predObj.exec({
        salted: false,
        predType: DataType.Envelope,
        predValue: predicateEnvelope,
        objType: DataType.Envelope,
        objValue: objectEnvelope,
        envelope: subjectEnvelope,
      });

      expect(result).toBe(ALICE_KNOWS_BOB_EXAMPLE);
    });
  });

  describe("count", () => {
    it("test_assertion_count", () => {
      const result = assertion.count.exec({
        envelope: ALICE_KNOWS_BOB_EXAMPLE,
      });
      expect(result).toBe("1");
    });

    it("test_assertion_count_2", () => {
      const result = assertion.count.exec({
        envelope: CREDENTIAL_EXAMPLE,
      });
      expect(result).toBe("2");
    });

    it("test_assertion_count_3", () => {
      const wrapped = extract.exec({
        type: extract.SubjectType.Wrapped,
        envelope: CREDENTIAL_EXAMPLE,
      });
      const result = assertion.count.exec({
        envelope: wrapped,
      });
      expect(result).toBe("13");
    });
  });

  describe("at", () => {
    it("test_assertion_at", () => {
      const e = assertion.at.exec({
        index: 0,
        envelope: ALICE_KNOWS_BOB_EXAMPLE,
      });
      expect(e).toBe("ur:envelope/oytpsoihjejtjlktjktpsoiafwjlidgdvttdjn");

      const formatted = format.exec({
        ...format.defaultArgs(),
        envelope: e,
      });
      expect(formatted).toBe('"knows": "Bob"');
    });
  });

  describe("create", () => {
    it("test_assertion_create", () => {
      const assertionEnvelope = assertion.create.exec({
        salted: true,
        predType: DataType.String,
        predValue: "knows",
        objType: DataType.String,
        objValue: "Bob",
      });

      const formatted = format.exec({
        ...format.defaultArgs(),
        envelope: assertionEnvelope,
      });

      const expected = `{
    "knows": "Bob"
} [
    'salt': Salt
]`;
      expectOutput(formatted, expected);
    });
  });

  describe("remove", () => {
    it("test_assertion_remove_envelope", () => {
      const assertionEnvelope = assertion.at.exec({
        index: 0,
        envelope: ALICE_KNOWS_BOB_EXAMPLE,
      });

      const removed = assertion.remove.envelope.exec({
        assertion: assertionEnvelope,
        envelope: ALICE_KNOWS_BOB_EXAMPLE,
      });

      const formatted = format.exec({
        ...format.defaultArgs(),
        envelope: removed,
      });

      expect(formatted.trim()).toBe('"Alice"');
    });

    it("test_assertion_remove_pred_obj", () => {
      const removed = assertion.remove.predObj.exec({
        predType: DataType.String,
        predValue: "knows",
        objType: DataType.String,
        objValue: "Bob",
        envelope: ALICE_KNOWS_BOB_EXAMPLE,
      });

      const formatted = format.exec({
        ...format.defaultArgs(),
        envelope: removed,
      });

      expect(formatted.trim()).toBe('"Alice"');
    });
  });
});
