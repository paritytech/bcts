/**
 * Group invite tests.
 *
 * Port of tests/group_invite.rs from frost-hubert-rust.
 */

import { describe, it, expect, beforeEach } from "vitest";

import { ARID, PrivateKeyBase, Date as BCDate } from "@bcts/components";
import { XIDDocument } from "@bcts/xid";
import { makeFakeRandomNumberGenerator, type RandomNumberGenerator } from "@bcts/rand";

import { DkgInvite, DkgInvitation, DkgInvitationResult } from "../src/dkg/index.js";
import { registerTags } from "./common/index.js";

function makeXidDocument(rng: RandomNumberGenerator, date: BCDate): XIDDocument {
  const privateKeyBase = PrivateKeyBase.newUsing(rng);

  return XIDDocument.new(
    { PrivateKeyBase: privateKeyBase },
    {
      Passphrase: {
        passphrase: "password",
        resolution: "Quartile",
        date,
        info: undefined,
      },
    },
  );
}

function makeArid(rng: RandomNumberGenerator): ARID {
  const bytes = rng.randomData(ARID.ARID_SIZE);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return ARID.fromDataRef(bytes)!;
}

describe("DKG group invite", () => {
  beforeEach(async () => {
    await registerTags();
  });

  // Skip until @bcts/components exports Date and other required types
  it.skip("test_dkg_group_invite", () => {
    const rng = makeFakeRandomNumberGenerator();

    const date = BCDate.fromYMD(2025, 12, 31);

    const coordinator = makeXidDocument(rng, date);

    const alice = makeXidDocument(rng, date);
    const bob = makeXidDocument(rng, date);
    const carol = makeXidDocument(rng, date);
    const minSigners = 2;
    const charter = "Test charter";

    const aliceUr = alice.toEnvelope({}, {}, "Inception").urString();
    const bobUr = bob.toEnvelope({}, {}, "Inception").urString();
    const carolUr = carol.toEnvelope({}, {}, "Inception").urString();

    const participants = [aliceUr, bobUr, carolUr];

    const requestId = makeArid(rng);
    const groupId = makeArid(rng);
    const expiry = date.addDays(7);
    const aliceResponseArid = makeArid(rng);
    const bobResponseArid = makeArid(rng);
    const carolResponseArid = makeArid(rng);
    const responseArids = [aliceResponseArid, bobResponseArid, carolResponseArid];

    const invite = DkgInvite.new(
      requestId,
      coordinator,
      groupId,
      date,
      expiry,
      minSigners,
      charter,
      participants,
      responseArids,
    );

    // Verify invite was created successfully
    expect(invite).toBeDefined();

    // Get the GSTP envelope
    const gstpEnvelope = invite.toEnvelope();
    expect(gstpEnvelope).toBeDefined();

    // Verify the envelope is encrypted (has recipients)
    const envelopeFormat = gstpEnvelope.format();
    expect(envelopeFormat).toContain("ENCRYPTED");
    expect(envelopeFormat).toContain("hasRecipient");

    // Alice decrypts and parses the invitation
    const aliceInvite = DkgInvitation.fromInvite(gstpEnvelope, date, coordinator, alice);

    expect(aliceInvite.sender().xid().urString()).toBe(coordinator.xid().urString());
    expect(aliceInvite.responseArid().urString()).toBe(aliceResponseArid.urString());
    expect(aliceInvite.validUntil().toString()).toBe(expiry.toString());
    expect(aliceInvite.requestId().urString()).toBe(requestId.urString());
    expect(aliceInvite.peerContinuation()).toBeDefined();
    expect(aliceInvite.minSigners()).toBe(minSigners);
    expect(aliceInvite.charter()).toBe(charter);
    expect(aliceInvite.groupId().urString()).toBe(groupId.urString());

    // Test success response
    const successResponse = aliceInvite.toResponse(DkgInvitationResult.Accepted, alice);
    const successEnvelope = successResponse.toEnvelope(undefined, undefined, undefined);

    const successFormat = successEnvelope.format();
    expect(successFormat).toContain("response");
    expect(successFormat).toContain("OK");
    expect(successFormat).toContain("sender");

    // Test decline response
    const declineResponse = aliceInvite.toResponse({ Declined: "Busy" }, alice);
    const declineEnvelope = declineResponse.toEnvelope(undefined, undefined, undefined);

    const declineFormat = declineEnvelope.format();
    expect(declineFormat).toContain("response");
    expect(declineFormat).toContain("error");
    expect(declineFormat).toContain("Busy");

    // Test encrypted responses
    const successEncrypted = aliceInvite.toEnvelope(DkgInvitationResult.Accepted, alice);
    const declineEncrypted = aliceInvite.toEnvelope({ Declined: "Busy" }, alice);

    const successEncryptedFormat = successEncrypted.format();
    const declineEncryptedFormat = declineEncrypted.format();

    expect(successEncryptedFormat).toContain("ENCRYPTED");
    expect(successEncryptedFormat).toContain("hasRecipient");
    expect(declineEncryptedFormat).toContain("ENCRYPTED");
    expect(declineEncryptedFormat).toContain("hasRecipient");
  });
});
