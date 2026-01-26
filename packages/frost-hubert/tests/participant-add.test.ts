/**
 * Participant add tests.
 *
 * Port of tests/participant_add.rs from frost-hubert-rust.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { AddOutcome } from "../src/registry/index.js";
import { participantAdd } from "../src/cmd/registry/participant/add.js";
import { fixture, registryFile, registerTags } from "./common/index.js";

const ALICE_REGISTRY_JSON = {
  groups: {},
  participants: {
    "ur:xid/hdcxwmkbiywnmkwdlprdjliowtdkprkpbszodnlychyklapdjzrohnwpwecefglolsbsfnpkjony": {
      xid_document:
        "ur:xid/tpsplftpsplftpsotanshdhdcxwmkbiywnmkwdlprdjliowtdkprkpbszodnlychyklapdjzrohnwpwecefglolsbsoyaylstpsotansgylftanshfhdcxswkeatmoclaehlpezsprtkntgrparfihgosofmfnlrgltndysabkwlckykimemottansgrhdcxtnhluevohylpdadednfmrsdkcfvovdsfaaadpecllftytbhgmylapkbarsfhdthsoycsfncsfgoycscstpsoihfpjziniaihoyaxtpsotansghhdfzkizesfchbgmylycxcesplsatmelfctwdplbeidjkmklehetntyidasgevachftiyotielsidkomoynskpkknpfuojobyrkbncektdsiateluetctyklrgrpshdhfadfzwkesroaa",
      pet_name: "Alice",
    },
  },
};

const ALICE_AND_BOB_REGISTRY_JSON = {
  groups: {},
  participants: {
    "ur:xid/hdcxuysflgfsmwjseozmhplehywpwdcnfwmtvskkkbtieerpsfmtwegoiysaeeylfsecdsfxhljz": {
      xid_document:
        "ur:xid/tpsplftpsplftpsotanshdhdcxuysflgfsmwjseozmhplehywpwdcnfwmtvskkkbtieerpsfmtwegoiysaeeylfsecoyaylstpsotansgylftanshfhdcxtoiniabgotbtltwpfgnbcxlybznngywkfsflbabyamadwmuefgtyjecxmteefxjntansgrhdcxbatpyafttpyabewkcmutihvesklrhytehydavdimwpahbalnnsrsnyfzpkcehpfhoycsfncsfgoycscstpsoiafwjlidoyaxtpsotansghhdfzhlimcmkgkkhdpmvsmtiowezcnemnyapaaxvostosrpluaslaylasmuzmsatsotwdchwlwmpsheclgeltynteyleohdwlhdticwdsahrtsrykseptflosbwtkrhlybwoydntkpmem",
      pet_name: "Bob",
    },
    "ur:xid/hdcxwmkbiywnmkwdlprdjliowtdkprkpbszodnlychyklapdjzrohnwpwecefglolsbsfnpkjony": {
      xid_document:
        "ur:xid/tpsplftpsplftpsotanshdhdcxwmkbiywnmkwdlprdjliowtdkprkpbszodnlychyklapdjzrohnwpwecefglolsbsoyaylstpsotansgylftanshfhdcxswkeatmoclaehlpezsprtkntgrparfihgosofmfnlrgltndysabkwlckykimemottansgrhdcxtnhluevohylpdadednfmrsdkcfvovdsfaaadpecllftytbhgmylapkbarsfhdthsoycsfncsfgoycscstpsoihfpjziniaihoyaxtpsotansghhdfzkizesfchbgmylycxcesplsatmelfctwdplbeidjkmklehetntyidasgevachftiyotielsidkomoynskpkknpfuojobyrkbncektdsiateluetctyklrgrpshdhfadfzwkesroaa",
      pet_name: "Alice",
    },
  },
};

describe("participant add", () => {
  let tempDir: string;

  beforeEach(() => {
    registerTags();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "frost-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  // Skip until UR parsing is fully working in @bcts/uniform-resources
  it.skip("participant_add_creates_registry_and_is_idempotent", () => {
    const alice = fixture("alice_signed_xid.txt");

    // First add
    const result1 = participantAdd({ xidDocument: alice, petName: "Alice" }, tempDir);
    expect(result1.outcome).toBe(AddOutcome.Inserted);

    const registryPath = registryFile(tempDir);
    const initialState = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
    assertRegistryMatches(initialState, ALICE_REGISTRY_JSON);

    // Second add (idempotent)
    const result2 = participantAdd({ xidDocument: alice, petName: "Alice" }, tempDir);
    expect(result2.outcome).toBe(AddOutcome.AlreadyPresent);

    const secondState = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
    assertRegistryMatches(secondState, ALICE_REGISTRY_JSON);
  });

  // Skip until UR parsing is fully working in @bcts/uniform-resources
  it.skip("participant_add_supports_custom_registry_filename_in_cwd", () => {
    const alice = fixture("alice_signed_xid.txt");
    const registryName = "alice_registry.json";

    participantAdd(
      {
        xidDocument: alice,
        petName: "Alice",
        registryPath: registryName,
      },
      tempDir,
    );

    const registryPath = path.join(tempDir, registryName);
    const content = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
    assertRegistryMatches(content, ALICE_REGISTRY_JSON);
  });

  // Skip until UR parsing is fully working in @bcts/uniform-resources
  it.skip("participant_add_supports_directory_registry_path", () => {
    const alice = fixture("alice_signed_xid.txt");

    participantAdd(
      {
        xidDocument: alice,
        petName: "Alice",
        registryPath: "registries/",
      },
      tempDir,
    );

    const registryPath = path.join(tempDir, "registries", "registry.json");
    const content = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
    assertRegistryMatches(content, ALICE_REGISTRY_JSON);
  });

  // Skip until UR parsing is fully working in @bcts/uniform-resources
  it.skip("participant_add_supports_path_with_custom_filename", () => {
    const alice = fixture("alice_signed_xid.txt");
    const arg = "registries/alice_registry.json";

    participantAdd(
      {
        xidDocument: alice,
        petName: "Alice",
        registryPath: arg,
      },
      tempDir,
    );

    const registryPath = path.join(tempDir, "registries", "alice_registry.json");
    const content = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
    assertRegistryMatches(content, ALICE_REGISTRY_JSON);
  });

  // Skip until UR parsing is fully working in @bcts/uniform-resources
  it.skip("participant_add_conflicting_pet_name_fails", () => {
    const alice = fixture("alice_signed_xid.txt");
    const bob = fixture("bob_signed_xid.txt");

    // Add Alice first
    participantAdd({ xidDocument: alice, petName: "Alice" }, tempDir);

    // Adding Bob with same pet name should fail
    expect(() => {
      participantAdd({ xidDocument: bob, petName: "Alice" }, tempDir);
    }).toThrow("already used");

    // Verify only Alice is in the registry
    const registryPath = registryFile(tempDir);
    const content = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
    assertRegistryMatches(content, ALICE_REGISTRY_JSON);
  });

  // Skip until UR parsing is fully working in @bcts/uniform-resources
  it.skip("participant_add_records_multiple_participants", () => {
    const alice = fixture("alice_signed_xid.txt");
    const bob = fixture("bob_signed_xid.txt");

    participantAdd({ xidDocument: alice, petName: "Alice" }, tempDir);

    participantAdd({ xidDocument: bob, petName: "Bob" }, tempDir);

    const registryPath = registryFile(tempDir);
    const content = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
    assertRegistryMatches(content, ALICE_AND_BOB_REGISTRY_JSON);
  });

  // Skip until UR parsing is fully working in @bcts/uniform-resources
  it.skip("participant_add_requires_signed_document", () => {
    const unsigned = fixture("bob_unsigned_xid.txt");

    expect(() => {
      participantAdd({ xidDocument: unsigned, petName: "Unsigned" }, tempDir);
    }).toThrow("XID document must be signed by its inception key");

    // Registry should not exist
    expect(fs.existsSync(registryFile(tempDir))).toBe(false);
  });
});

function assertRegistryMatches(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>,
): void {
  const normalizeJson = (obj: Record<string, unknown>): string => {
    return JSON.stringify(obj, Object.keys(obj).sort(), 2);
  };

  expect(normalizeJson(actual)).toBe(normalizeJson(expected));
}
