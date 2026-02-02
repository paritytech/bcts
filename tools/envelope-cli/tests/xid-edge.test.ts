/**
 * XID edge command tests - 1:1 port of tests/test_xid_edge.rs
 */

import { describe, it, expect } from "vitest";
import { Envelope } from "@bcts/envelope";
import { IS_A, SOURCE, TARGET } from "@bcts/known-values";
import * as xid from "../src/cmd/xid/index.js";
import * as edge from "../src/cmd/xid/edge/index.js";
import { readEnvelope } from "../src/utils.js";
import { PrivateOptions } from "../src/cmd/xid/private-options.js";
import { GeneratorOptions } from "../src/cmd/xid/generator-options.js";
import { PasswordMethod } from "../src/cmd/xid/password-args.js";
import { SigningOption } from "../src/cmd/xid/signing-args.js";
import { VerifyOption } from "../src/cmd/xid/verify-args.js";
import { defaultOutputOptions } from "../src/cmd/xid/output-options.js";
import * as format from "../src/cmd/format.js";
import { ALICE_PUBKEYS, ALICE_PRVKEYS, BOB_PUBKEYS } from "./common.js";

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

async function makeXidDocWithPrivateKeys(): Promise<string> {
  const args = xid.newCmd.defaultArgs();
  args.keyArgs.keys = ALICE_PRVKEYS;
  args.generatorOpts = GeneratorOptions.Omit;
  return xid.newCmd.exec(args);
}

async function makeXidDocForBob(): Promise<string> {
  const args = xid.newCmd.defaultArgs();
  args.keyArgs.keys = BOB_PUBKEYS;
  args.outputOpts.privateOpts = PrivateOptions.Omit;
  args.generatorOpts = GeneratorOptions.Omit;
  return xid.newCmd.exec(args);
}

function aliceXid(xidDoc: string): string {
  return xid.id.exec({
    envelope: xidDoc,
    format: [xid.IDFormat.Ur],
    verifyArgs: { verify: VerifyOption.None },
  });
}

function makeEdge(subject: string, isA: string, sourceXidUr: string, targetXidUr: string): string {
  const sourceEnvelope = readEnvelope(sourceXidUr);
  const targetEnvelope = readEnvelope(targetXidUr);
  let envelope = Envelope.new(subject);
  envelope = envelope.addAssertion(IS_A, isA);
  envelope = envelope.addAssertion(SOURCE, sourceEnvelope);
  envelope = envelope.addAssertion(TARGET, targetEnvelope);
  return envelope.urString();
}

describe("xid edge", () => {
  it("test_xid_edge_count_empty", async () => {
    const xidDoc = await makeXidDoc();
    const count = edge.count.exec({ envelope: xidDoc });
    expect(count).toBe("0");
  });

  it("test_xid_edge_add_unsigned", async () => {
    let xidDoc = await makeXidDoc();
    const bobDoc = await makeXidDocForBob();
    const aliceId = aliceXid(xidDoc);
    const bobId = xid.id.exec({
      envelope: bobDoc,
      format: [xid.IDFormat.Ur],
      verifyArgs: { verify: VerifyOption.None },
    });

    const edgeUr = makeEdge("relationship", "employee", aliceId, bobId);

    xidDoc = await edge.add.exec({
      edge: edgeUr,
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: NO_SIGNING_ARGS,
      envelope: xidDoc,
    });

    expect(edge.count.exec({ envelope: xidDoc })).toBe("1");
  });

  it("test_xid_edge_all", async () => {
    let xidDoc = await makeXidDoc();
    const bobDoc = await makeXidDocForBob();
    const aliceId = aliceXid(xidDoc);
    const bobId = xid.id.exec({
      envelope: bobDoc,
      format: [xid.IDFormat.Ur],
      verifyArgs: { verify: VerifyOption.None },
    });

    const edge1 = makeEdge("relationship1", "employee", aliceId, bobId);
    const edge2 = makeEdge("relationship2", "manager", bobId, aliceId);

    xidDoc = await edge.add.exec({
      edge: edge1,
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: NO_SIGNING_ARGS,
      envelope: xidDoc,
    });

    xidDoc = await edge.add.exec({
      edge: edge2,
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: NO_SIGNING_ARGS,
      envelope: xidDoc,
    });

    expect(edge.count.exec({ envelope: xidDoc })).toBe("2");

    const all = edge.all.exec({ envelope: xidDoc });
    const lines = all.split("\n").filter((l) => l.length > 0);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^ur:envelope\//);
    expect(lines[1]).toMatch(/^ur:envelope\//);
  });

  it("test_xid_edge_at", async () => {
    let xidDoc = await makeXidDoc();
    const bobDoc = await makeXidDocForBob();
    const aliceId = aliceXid(xidDoc);
    const bobId = xid.id.exec({
      envelope: bobDoc,
      format: [xid.IDFormat.Ur],
      verifyArgs: { verify: VerifyOption.None },
    });

    const edge1 = makeEdge("rel1", "employee", aliceId, bobId);
    const edge2 = makeEdge("rel2", "manager", bobId, aliceId);

    xidDoc = await edge.add.exec({
      edge: edge1,
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: NO_SIGNING_ARGS,
      envelope: xidDoc,
    });
    xidDoc = await edge.add.exec({
      edge: edge2,
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: NO_SIGNING_ARGS,
      envelope: xidDoc,
    });

    // Index 0 and 1 should work
    expect(() => edge.at.exec({ index: 0, envelope: xidDoc })).not.toThrow();
    expect(() => edge.at.exec({ index: 1, envelope: xidDoc })).not.toThrow();

    // Index 2 should fail
    expect(() => edge.at.exec({ index: 2, envelope: xidDoc })).toThrow("Index out of bounds");
  });

  it("test_xid_edge_remove", async () => {
    let xidDoc = await makeXidDoc();
    const bobDoc = await makeXidDocForBob();
    const aliceId = aliceXid(xidDoc);
    const bobId = xid.id.exec({
      envelope: bobDoc,
      format: [xid.IDFormat.Ur],
      verifyArgs: { verify: VerifyOption.None },
    });

    const edgeUr = makeEdge("relationship", "employee", aliceId, bobId);

    xidDoc = await edge.add.exec({
      edge: edgeUr,
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: NO_SIGNING_ARGS,
      envelope: xidDoc,
    });

    expect(edge.count.exec({ envelope: xidDoc })).toBe("1");

    // Remove the edge
    xidDoc = await edge.remove.exec({
      edge: edgeUr,
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: NO_SIGNING_ARGS,
      envelope: xidDoc,
    });

    expect(edge.count.exec({ envelope: xidDoc })).toBe("0");
  });

  it("test_xid_edge_find_by_is_a", async () => {
    let xidDoc = await makeXidDoc();
    const bobDoc = await makeXidDocForBob();
    const aliceId = aliceXid(xidDoc);
    const bobId = xid.id.exec({
      envelope: bobDoc,
      format: [xid.IDFormat.Ur],
      verifyArgs: { verify: VerifyOption.None },
    });

    const edge1 = makeEdge("rel1", "employee", aliceId, bobId);
    const edge2 = makeEdge("rel2", "manager", bobId, aliceId);

    xidDoc = await edge.add.exec({
      edge: edge1,
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: NO_SIGNING_ARGS,
      envelope: xidDoc,
    });
    xidDoc = await edge.add.exec({
      edge: edge2,
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: NO_SIGNING_ARGS,
      envelope: xidDoc,
    });

    // Find by isA = "employee"
    const isAEnvelope = Envelope.new("employee").urString();
    const found = edge.find.exec({
      isA: isAEnvelope,
      envelope: xidDoc,
    });

    const lines = found.split("\n").filter((l) => l.length > 0);
    expect(lines).toHaveLength(1);
  });

  it("test_xid_edge_find_by_subject", async () => {
    let xidDoc = await makeXidDoc();
    const bobDoc = await makeXidDocForBob();
    const aliceId = aliceXid(xidDoc);
    const bobId = xid.id.exec({
      envelope: bobDoc,
      format: [xid.IDFormat.Ur],
      verifyArgs: { verify: VerifyOption.None },
    });

    const edge1 = makeEdge("rel1", "employee", aliceId, bobId);
    const edge2 = makeEdge("rel2", "manager", bobId, aliceId);

    xidDoc = await edge.add.exec({
      edge: edge1,
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: NO_SIGNING_ARGS,
      envelope: xidDoc,
    });
    xidDoc = await edge.add.exec({
      edge: edge2,
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: NO_SIGNING_ARGS,
      envelope: xidDoc,
    });

    // Find by subject = "rel1"
    const subjectEnvelope = Envelope.new("rel1").urString();
    const found = edge.find.exec({
      subject: subjectEnvelope,
      envelope: xidDoc,
    });

    const lines = found.split("\n").filter((l) => l.length > 0);
    expect(lines).toHaveLength(1);
  });

  it("test_xid_edge_persists_across_operations", async () => {
    let xidDoc = await makeXidDoc();
    const bobDoc = await makeXidDocForBob();
    const aliceId = aliceXid(xidDoc);
    const bobId = xid.id.exec({
      envelope: bobDoc,
      format: [xid.IDFormat.Ur],
      verifyArgs: { verify: VerifyOption.None },
    });

    const edgeUr = makeEdge("relationship", "employee", aliceId, bobId);

    xidDoc = await edge.add.exec({
      edge: edgeUr,
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: NO_SIGNING_ARGS,
      envelope: xidDoc,
    });

    expect(edge.count.exec({ envelope: xidDoc })).toBe("1");

    // Now add a resolution method (different operation)
    const resolutionAdd = await import("../src/cmd/xid/resolution/add.js");
    xidDoc = await resolutionAdd.exec({
      uri: "https://resolver.example.com",
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: NO_SIGNING_ARGS,
      envelope: xidDoc,
    });

    // Edge should still be present
    expect(edge.count.exec({ envelope: xidDoc })).toBe("1");
  });

  it("test_xid_edge_add_with_signing", async () => {
    let xidDoc = await makeXidDocWithPrivateKeys();
    const aliceId = aliceXid(xidDoc);

    const edgeUr = makeEdge("credential-1", "foaf:Person", aliceId, aliceId);

    xidDoc = await edge.add.exec({
      edge: edgeUr,
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: { sign: SigningOption.Inception },
      envelope: xidDoc,
    });

    expect(edge.count.exec({ envelope: xidDoc })).toBe("1");

    // Verify it's signed
    const formatted = format.exec({ ...format.defaultArgs(), envelope: xidDoc });
    expect(formatted).toContain("'signed':");
    expect(formatted).toContain("'edge': \"credential-1\"");

    // Verify signature is valid
    const id = xid.id.exec({
      envelope: xidDoc,
      format: [xid.IDFormat.Ur],
      verifyArgs: { verify: VerifyOption.Inception },
    });
    expect(id).toBeTruthy();
  });

  it("test_xid_edge_remove_with_signing", async () => {
    let xidDoc = await makeXidDocWithPrivateKeys();
    const aliceId = aliceXid(xidDoc);

    const edgeUr = makeEdge("credential-1", "foaf:Person", aliceId, aliceId);

    // Add with signing
    xidDoc = await edge.add.exec({
      edge: edgeUr,
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: { sign: SigningOption.Inception },
      envelope: xidDoc,
    });

    expect(edge.count.exec({ envelope: xidDoc })).toBe("1");

    // Remove with verify and sign
    xidDoc = await edge.remove.exec({
      edge: edgeUr,
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: { verify: VerifyOption.Inception },
      signingArgs: { sign: SigningOption.Inception },
      envelope: xidDoc,
    });

    expect(edge.count.exec({ envelope: xidDoc })).toBe("0");

    // Verify signature is still valid
    const id = xid.id.exec({
      envelope: xidDoc,
      format: [xid.IDFormat.Ur],
      verifyArgs: { verify: VerifyOption.Inception },
    });
    expect(id).toBeTruthy();
  });

  it("test_xid_edge_find_by_target", async () => {
    let xidDoc = await makeXidDoc();
    const bobDoc = await makeXidDocForBob();
    const aliceId = aliceXid(xidDoc);
    const bobId = xid.id.exec({
      envelope: bobDoc,
      format: [xid.IDFormat.Ur],
      verifyArgs: { verify: VerifyOption.None },
    });

    const edge1 = makeEdge("self-desc", "foaf:Person", aliceId, aliceId);
    const edge2 = makeEdge("knows-bob", "schema:colleague", aliceId, bobId);

    xidDoc = await edge.add.exec({
      edge: edge1,
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: NO_SIGNING_ARGS,
      envelope: xidDoc,
    });
    xidDoc = await edge.add.exec({
      edge: edge2,
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: NO_SIGNING_ARGS,
      envelope: xidDoc,
    });

    expect(edge.count.exec({ envelope: xidDoc })).toBe("2");

    // Find by Bob's target (should return only "knows-bob" edge)
    const targetEnvelope = readEnvelope(bobId);
    const targetUr = Envelope.new(targetEnvelope).urString();

    const found = edge.find.exec({
      target: targetUr,
      envelope: xidDoc,
    });

    const lines = found.split("\n").filter((l) => l.length > 0);
    expect(lines).toHaveLength(1);
  });

  it("test_xid_edge_find_combined", async () => {
    let xidDoc = await makeXidDoc();
    const aliceId = aliceXid(xidDoc);

    const edge1 = makeEdge("self-desc", "foaf:Person", aliceId, aliceId);
    const edge2 = makeEdge("self-thing", "foaf:Person", aliceId, aliceId);
    const edge3 = makeEdge("other", "schema:Thing", aliceId, aliceId);

    xidDoc = await edge.add.exec({
      edge: edge1,
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: NO_SIGNING_ARGS,
      envelope: xidDoc,
    });
    xidDoc = await edge.add.exec({
      edge: edge2,
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: NO_SIGNING_ARGS,
      envelope: xidDoc,
    });
    xidDoc = await edge.add.exec({
      edge: edge3,
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: NO_SIGNING_ARGS,
      envelope: xidDoc,
    });

    expect(edge.count.exec({ envelope: xidDoc })).toBe("3");

    // Find by combined isA "foaf:Person" AND subject "self-desc"
    const isAUr = Envelope.new("foaf:Person").urString();
    const subjectUr = Envelope.new("self-desc").urString();
    const found = edge.find.exec({
      isA: isAUr,
      subject: subjectUr,
      envelope: xidDoc,
    });

    const lines = found.split("\n").filter((l) => l.length > 0);
    expect(lines).toHaveLength(1);
  });

  it("test_xid_edge_format", async () => {
    let xidDoc = await makeXidDoc();
    const aliceId = aliceXid(xidDoc);

    const edgeUr = makeEdge("credential-1", "foaf:Person", aliceId, aliceId);
    xidDoc = await edge.add.exec({
      edge: edgeUr,
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: NO_SIGNING_ARGS,
      envelope: xidDoc,
    });

    const formatted = format.exec({ ...format.defaultArgs(), envelope: xidDoc });
    expect(formatted).toContain("XID(93a4d4e7)");
    expect(formatted).toContain("'edge': \"credential-1\"");
    expect(formatted).toContain("'isA': \"foaf:Person\"");
    expect(formatted).toContain("'source': XID(93a4d4e7)");
    expect(formatted).toContain("'target': XID(93a4d4e7)");
    expect(formatted).toContain("'key':");
  });

  it("test_xid_edge_with_signed_xid", async () => {
    let xidDoc = await makeXidDocWithPrivateKeys();
    const aliceId = aliceXid(xidDoc);

    const edgeUr = makeEdge("credential-1", "foaf:Person", aliceId, aliceId);

    // Add edge with signing
    xidDoc = await edge.add.exec({
      edge: edgeUr,
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: NO_VERIFY_ARGS,
      signingArgs: { sign: SigningOption.Inception },
      envelope: xidDoc,
    });

    // Verify inception signature
    xid.id.exec({
      envelope: xidDoc,
      format: [xid.IDFormat.Ur],
      verifyArgs: { verify: VerifyOption.Inception },
    });
    expect(edge.count.exec({ envelope: xidDoc })).toBe("1");

    // Add another operation (resolution) with verify + sign, edge should persist
    const resolution = await import("../src/cmd/xid/resolution/index.js");
    xidDoc = await resolution.add.exec({
      uri: "https://example.com/resolve",
      outputOpts: defaultOutputOptions(),
      passwordArgs: NO_PASSWORD_ARGS,
      verifyArgs: { verify: VerifyOption.Inception },
      signingArgs: { sign: SigningOption.Inception },
      envelope: xidDoc,
    });

    xid.id.exec({
      envelope: xidDoc,
      format: [xid.IDFormat.Ur],
      verifyArgs: { verify: VerifyOption.Inception },
    });
    expect(edge.count.exec({ envelope: xidDoc })).toBe("1");
  });
});
