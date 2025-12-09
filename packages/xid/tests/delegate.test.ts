/**
 * Delegate tests
 * Ported from bc-xid-rust/tests/delegate.rs
 */

import { PrivateKeyBase } from "@bcts/envelope";
import { Delegate, XIDDocument, Privilege } from "../src";

describe("Delegate", () => {
  it("should create delegate with controller and permissions", () => {
    // Create Alice's XIDDocument
    const alicePrivateKeyBase = PrivateKeyBase.generate();
    const aliceXidDocument = XIDDocument.new(
      { type: "privateKeyBase", privateKeyBase: alicePrivateKeyBase },
      { type: "none" },
    );

    // Create Bob's XIDDocument
    const bobPrivateKeyBase = PrivateKeyBase.generate();
    const bobPublicKeys = bobPrivateKeyBase.publicKeys();
    const bobXidDocument = XIDDocument.new(
      { type: "publicKeyBase", publicKeyBase: bobPublicKeys },
      { type: "none" },
    );

    // Create an unresolved delegate (just XID, no full document)
    const bobUnresolvedDelegate = Delegate.new(XIDDocument.fromXid(bobXidDocument.xid()));
    bobUnresolvedDelegate.permissions().addAllow(Privilege.Encrypt);
    bobUnresolvedDelegate.permissions().addAllow(Privilege.Sign);

    // Round-trip through envelope
    const envelope = bobUnresolvedDelegate.intoEnvelope();
    const bobUnresolvedDelegate2 = Delegate.tryFromEnvelope(envelope);
    expect(bobUnresolvedDelegate.equals(bobUnresolvedDelegate2)).toBe(true);

    // Create a full delegate with full document
    const bobDelegate = Delegate.new(bobXidDocument);
    bobDelegate.permissions().addAllow(Privilege.Encrypt);
    bobDelegate.permissions().addAllow(Privilege.Sign);

    // Round-trip through envelope
    const envelope2 = bobDelegate.intoEnvelope();
    const bobDelegate2 = Delegate.tryFromEnvelope(envelope2);
    expect(bobDelegate.equals(bobDelegate2)).toBe(true);

    // Add Bob as delegate to Alice's document
    const aliceXidDocumentWithDelegate = aliceXidDocument.clone();
    aliceXidDocumentWithDelegate.addDelegate(bobDelegate);

    // Verify the delegate was added
    const delegates = aliceXidDocumentWithDelegate.delegates();
    expect(delegates.length).toBe(1);
    expect(delegates[0].xid().equals(bobXidDocument.xid())).toBe(true);
  });

  describe("Delegate properties", () => {
    it("should get controller XID", () => {
      const privateKeyBase = PrivateKeyBase.generate();
      const xidDocument = XIDDocument.new(
        { type: "publicKeyBase", publicKeyBase: privateKeyBase.publicKeys() },
        { type: "none" },
      );

      const delegate = Delegate.new(xidDocument);
      expect(delegate.xid().equals(xidDocument.xid())).toBe(true);
    });

    it("should access controller through shared reference", () => {
      const privateKeyBase = PrivateKeyBase.generate();
      const xidDocument = XIDDocument.new(
        { type: "publicKeyBase", publicKeyBase: privateKeyBase.publicKeys() },
        { type: "none" },
      );

      const delegate = Delegate.new(xidDocument);
      const controller = delegate.controller().read();
      expect(controller.xid().equals(xidDocument.xid())).toBe(true);
    });

    it("should get delegate reference", () => {
      const privateKeyBase = PrivateKeyBase.generate();
      const xidDocument = XIDDocument.new(
        { type: "publicKeyBase", publicKeyBase: privateKeyBase.publicKeys() },
        { type: "none" },
      );

      const delegate = Delegate.new(xidDocument);
      const reference = delegate.reference();
      expect(reference).toBeDefined();
    });
  });

  describe("Delegate permissions", () => {
    it("should manage delegate permissions", () => {
      const privateKeyBase = PrivateKeyBase.generate();
      const xidDocument = XIDDocument.new(
        { type: "publicKeyBase", publicKeyBase: privateKeyBase.publicKeys() },
        { type: "none" },
      );

      const delegate = Delegate.new(xidDocument);
      delegate.permissions().addAllow(Privilege.Sign);
      delegate.permissions().addAllow(Privilege.Verify);

      expect(delegate.permissions().allow.has(Privilege.Sign)).toBe(true);
      expect(delegate.permissions().allow.has(Privilege.Verify)).toBe(true);
    });
  });

  describe("Delegate equality and cloning", () => {
    it("should compare delegates by XID", () => {
      const privateKeyBase1 = PrivateKeyBase.generate();
      const xidDocument1 = XIDDocument.new(
        { type: "publicKeyBase", publicKeyBase: privateKeyBase1.publicKeys() },
        { type: "none" },
      );

      const privateKeyBase2 = PrivateKeyBase.generate();
      const xidDocument2 = XIDDocument.new(
        { type: "publicKeyBase", publicKeyBase: privateKeyBase2.publicKeys() },
        { type: "none" },
      );

      const delegate1 = Delegate.new(xidDocument1);
      const delegate1Clone = Delegate.new(XIDDocument.fromXid(xidDocument1.xid()));
      const delegate2 = Delegate.new(xidDocument2);

      expect(delegate1.equals(delegate1Clone)).toBe(true);
      expect(delegate1.equals(delegate2)).toBe(false);
    });

    it("should clone delegate correctly", () => {
      const privateKeyBase = PrivateKeyBase.generate();
      const xidDocument = XIDDocument.new(
        { type: "publicKeyBase", publicKeyBase: privateKeyBase.publicKeys() },
        { type: "none" },
      );

      const delegate = Delegate.new(xidDocument);
      delegate.permissions().addAllow(Privilege.Sign);

      const cloned = delegate.clone();
      expect(cloned.equals(delegate)).toBe(true);
      expect(cloned.permissions().allow.has(Privilege.Sign)).toBe(true);
    });
  });

  describe("Delegate hash key", () => {
    it("should use XID hex as hash key", () => {
      const privateKeyBase = PrivateKeyBase.generate();
      const xidDocument = XIDDocument.new(
        { type: "publicKeyBase", publicKeyBase: privateKeyBase.publicKeys() },
        { type: "none" },
      );

      const delegate = Delegate.new(xidDocument);
      expect(delegate.hashKey()).toBe(xidDocument.xid().toHex());
    });
  });
});
