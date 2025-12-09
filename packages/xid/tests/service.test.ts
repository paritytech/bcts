/**
 * Service tests
 * Ported from bc-xid-rust/tests/service.rs
 */

import { PrivateKeyBase } from "@bcts/envelope";
import { Reference } from "@bcts/components";
import { Service, XIDDocument, Privilege } from "../src";

describe("Service", () => {
  it("should create service with keys, delegates, permissions, and capabilities", () => {
    const alicePrivateKeyBase = PrivateKeyBase.generate();
    const alicePublicKeys = alicePrivateKeyBase.publicKeys();

    const bobPrivateKeyBase = PrivateKeyBase.generate();
    const bobPublicKeys = bobPrivateKeyBase.publicKeys();
    const bobXidDocument = XIDDocument.new(
      { type: "publicKeyBase", publicKeyBase: bobPublicKeys },
      {
        type: "passphrase",
        passphrase: "test",
      },
    );

    const service = Service.new("https://example.com");

    // Add key reference
    const aliceKeyRef = Reference.hash(alicePublicKeys.data());
    service.addKeyReference(aliceKeyRef);
    // Adding same key again should throw
    expect(() => service.addKeyReference(aliceKeyRef)).toThrow();

    // Add delegate reference
    const bobDelegateRef = bobXidDocument.reference();
    service.addDelegateReference(bobDelegateRef);
    // Adding same delegate again should throw
    expect(() => service.addDelegateReference(bobDelegateRef)).toThrow();

    // Add permissions
    service.permissions().addAllow(Privilege.Encrypt);
    service.permissions().addAllow(Privilege.Sign);

    // Set name
    service.setName("Example Service");

    // Add capability
    service.addCapability("com.example.messaging");
    // Adding capability again should throw
    expect(() => service.addCapability("com.example.messaging")).toThrow();

    // Round-trip through envelope
    const envelope = service.intoEnvelope();
    const service2 = Service.tryFromEnvelope(envelope);
    expect(service.equals(service2)).toBe(true);
  });

  describe("Service properties", () => {
    it("should get and set URI", () => {
      const service = Service.new("https://example.com");
      expect(service.uri()).toBe("https://example.com");
    });

    it("should get and set capability", () => {
      const service = Service.new("https://example.com");
      service.addCapability("com.example.test");
      expect(service.capability()).toBe("com.example.test");
    });

    it("should get and set name", () => {
      const service = Service.new("https://example.com");
      service.setName("Test Service");
      expect(service.name()).toBe("Test Service");
    });

    it("should throw on empty capability", () => {
      const service = Service.new("https://example.com");
      expect(() => service.addCapability("")).toThrow();
    });

    it("should throw on empty name", () => {
      const service = Service.new("https://example.com");
      expect(() => service.setName("")).toThrow();
    });
  });

  describe("Key and delegate references", () => {
    it("should manage key references", () => {
      const privateKeyBase = PrivateKeyBase.generate();
      const publicKeys = privateKeyBase.publicKeys();

      const service = Service.new("https://example.com");
      const keyRef = Reference.hash(publicKeys.data());

      service.addKeyReference(keyRef);
      expect(service.keyReferences().size).toBe(1);
    });

    it("should manage delegate references", () => {
      const privateKeyBase = PrivateKeyBase.generate();
      const xidDocument = XIDDocument.new(
        { type: "publicKeyBase", publicKeyBase: privateKeyBase.publicKeys() },
        { type: "none" },
      );

      const service = Service.new("https://example.com");
      const delegateRef = xidDocument.reference();

      service.addDelegateReference(delegateRef);
      expect(service.delegateReferences().size).toBe(1);
    });
  });

  describe("Service equality and cloning", () => {
    it("should compare services by URI", () => {
      const service1 = Service.new("https://example.com");
      const service2 = Service.new("https://example.com");
      const service3 = Service.new("https://other.com");

      expect(service1.equals(service2)).toBe(true);
      expect(service1.equals(service3)).toBe(false);
    });

    it("should clone service correctly", () => {
      const privateKeyBase = PrivateKeyBase.generate();

      const service = Service.new("https://example.com");
      service.addKeyReference(Reference.hash(privateKeyBase.publicKeys().data()));
      service.permissions().addAllow(Privilege.Sign);
      service.addCapability("test");
      service.setName("Test");

      const cloned = service.clone();
      expect(cloned.equals(service)).toBe(true);
      expect(cloned.uri()).toBe(service.uri());
      expect(cloned.capability()).toBe(service.capability());
      expect(cloned.name()).toBe(service.name());
    });
  });

  describe("Service hash key", () => {
    it("should use URI as hash key", () => {
      const service = Service.new("https://example.com");
      expect(service.hashKey()).toBe("https://example.com");
    });
  });
});
