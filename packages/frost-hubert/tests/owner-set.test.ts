/**
 * Owner set tests.
 *
 * Port of tests/owner_set.rs from frost-hubert-rust.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { OwnerRecord, OwnerOutcome, AddOutcome } from "../src/registry/index.js";
import { ownerSet } from "../src/cmd/registry/owner/set.js";
import { participantAdd } from "../src/cmd/registry/participant/add.js";
import { fixture, registryFile, registerTags } from "./common/index.js";

describe("owner set", () => {
  let tempDir: string;

  beforeEach(async () => {
    await registerTags();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "frost-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  // Skip until UR parsing is fully working in @bcts/uniform-resources
  it.skip("owner_set_with_participant_add_persists_both", () => {
    const aliceParticipant = fixture("alice_signed_xid.txt");
    const ownerUr = makeOwnerXidUr();

    // Verify the owner UR can be parsed
    OwnerRecord.fromSignedXidUr(ownerUr);

    // Set owner
    const ownerResult = ownerSet({ xidDocument: ownerUr }, tempDir);
    expect(ownerResult.outcome).toBe(OwnerOutcome.Inserted);

    // Add participant
    const participantResult = participantAdd(
      { xidDocument: aliceParticipant, petName: "Alice" },
      tempDir,
    );
    expect(participantResult.outcome).toBe(AddOutcome.Inserted);

    // Verify registry content
    const registryPath = registryFile(tempDir);
    const content = fs.readFileSync(registryPath, "utf-8");
    const actual = JSON.parse(content);

    expect(actual.groups).toEqual({});
    expect(actual.owner).toBeDefined();
    expect(actual.owner.xid_document).toBe(ownerUr);
    expect(actual.participants).toBeDefined();
    expect(Object.keys(actual.participants).length).toBe(1);

    // Check Alice's entry
    const aliceXid =
      "ur:xid/hdcxwmkbiywnmkwdlprdjliowtdkprkpbszodnlychyklapdjzrohnwpwecefglolsbsfnpkjony";
    expect(actual.participants[aliceXid]).toBeDefined();
    expect(actual.participants[aliceXid].pet_name).toBe("Alice");
  });

  // Skip until UR parsing is fully working in @bcts/uniform-resources
  it.skip("owner_set_requires_private_keys", () => {
    const unsignedOwner = fixture("alice_signed_xid.txt"); // lacks private keys

    expect(() => {
      ownerSet({ xidDocument: unsignedOwner }, tempDir);
    }).toThrow("must include private keys");

    // Registry should not exist
    expect(fs.existsSync(registryFile(tempDir))).toBe(false);
  });
});

function makeOwnerXidUr(): string {
  const urString = fixture("dan_private_xid.txt");
  OwnerRecord.fromSignedXidUr(urString);
  return urString;
}
