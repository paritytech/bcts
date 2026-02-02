/**
 * XID Document tests
 * Ported from bc-xid-rust/tests/test_xid_document.rs
 */

import {
  PrivateKeyBase,
  EncapsulationPrivateKey,
  PrivateKeys,
  PublicKeys,
  MLDSALevel,
  mldsaGenerateKeypair,
  MLDSAPrivateKey,
  MLDSAPublicKey,
  SigningPrivateKey,
  SigningPublicKey,
  KeyDerivationMethod,
} from "@bcts/components";
import type { Envelope } from "@bcts/envelope";
import { ProvenanceMarkResolution } from "@bcts/provenance-mark";
import {
  XIDDocument,
  Key,
  Delegate,
  Service,
  Privilege,
  XIDPrivateKeyOptions,
  XIDGeneratorOptions,
  XIDVerifySignature,
} from "../src";

describe("XIDDocument", () => {
  describe("Basic creation", () => {
    it("should create XID document from public keys", () => {
      const privateKeyBase = PrivateKeyBase.new();
      const publicKeys = privateKeyBase.ed25519PublicKeys();

      const xidDocument = XIDDocument.new(
        { type: "publicKeys", publicKeys: publicKeys },
        { type: "none" },
      );

      // Extract the XID
      const xid = xidDocument.xid();
      expect(xid).toBeDefined();

      // Round-trip through envelope
      const envelope = xidDocument.intoEnvelope();
      const xidDocument2 = XIDDocument.fromEnvelope(envelope);
      expect(xidDocument.equals(xidDocument2)).toBe(true);
    });

    it("should create XID document from private key base", () => {
      const privateKeyBase = PrivateKeyBase.new();

      const xidDocument = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase },
        { type: "none" },
      );

      const inceptionKey = xidDocument.inceptionKey();
      expect(inceptionKey).toBeDefined();
      expect(inceptionKey?.hasPrivateKeys()).toBe(true);
    });

    it("should create minimal XID document from XID only", () => {
      // Create a full XIDDocument first to get a valid XID
      const privateKeyBase = PrivateKeyBase.new();
      const fullDoc = XIDDocument.new(
        { type: "publicKeys", publicKeys: privateKeyBase.ed25519PublicKeys() },
        { type: "none" },
      );
      const xid = fullDoc.xid();
      const xidDocument = XIDDocument.fromXid(xid);

      // Should be empty (no keys, delegates, etc.)
      expect(xidDocument.isEmpty()).toBe(true);

      // Round-trip through envelope
      const envelope = xidDocument.intoEnvelope();
      const xidDocument2 = XIDDocument.fromEnvelope(envelope);
      expect(xidDocument.equals(xidDocument2)).toBe(true);
    });
  });

  describe("Resolution methods", () => {
    it("should manage resolution methods", () => {
      const privateKeyBase = PrivateKeyBase.new();

      const xidDocument = XIDDocument.new(
        { type: "publicKeys", publicKeys: privateKeyBase.ed25519PublicKeys() },
        { type: "none" },
      );

      xidDocument.addResolutionMethod("https://resolver.example.com");
      xidDocument.addResolutionMethod("btcr:01234567");

      expect(xidDocument.resolutionMethods().size).toBe(2);
      expect(xidDocument.resolutionMethods().has("https://resolver.example.com")).toBe(true);
      expect(xidDocument.resolutionMethods().has("btcr:01234567")).toBe(true);

      // Round-trip through envelope
      const envelope = xidDocument.intoEnvelope();
      const xidDocument2 = XIDDocument.fromEnvelope(envelope);
      expect(xidDocument.equals(xidDocument2)).toBe(true);
    });
  });

  describe("Keys management", () => {
    it("should manage keys", () => {
      const privateKeyBase = PrivateKeyBase.new();

      const xidDocument = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase },
        { type: "none" },
      );

      // Should have inception key
      const inceptionKey = xidDocument.inceptionKey();
      expect(inceptionKey).toBeDefined();

      // Add another key
      const privateKeyBase2 = PrivateKeyBase.new();
      const key2 = Key.newAllowAll(privateKeyBase2.ed25519PublicKeys());
      xidDocument.addKey(key2);

      expect(xidDocument.keys().length).toBe(2);
    });

    it("should find keys by public key base and reference", () => {
      const privateKeyBase = PrivateKeyBase.new();

      const xidDocument = XIDDocument.new(
        { type: "publicKeys", publicKeys: privateKeyBase.ed25519PublicKeys() },
        { type: "none" },
      );

      const foundKey = xidDocument.findKeyByPublicKeys(privateKeyBase.ed25519PublicKeys());
      expect(foundKey).toBeDefined();
      if (foundKey === undefined) throw new Error("Expected foundKey");

      const reference = foundKey.reference();
      const foundByRef = xidDocument.findKeyByReference(reference);
      expect(foundByRef).toBeDefined();
      expect(foundByRef?.equals(foundKey)).toBe(true);
    });

    it("should remove inception key", () => {
      const privateKeyBase = PrivateKeyBase.new();

      const xidDocument = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase },
        { type: "none" },
      );

      // Has inception key
      expect(xidDocument.inceptionKey()).toBeDefined();

      // Remove inception key
      const removedKey = xidDocument.removeInceptionKey();
      expect(removedKey).toBeDefined();
      expect(xidDocument.inceptionKey()).toBeUndefined();
      expect(xidDocument.isEmpty()).toBe(true);
    });

    it("should identify inception key correctly", () => {
      const privateKeyBase = PrivateKeyBase.new();

      const xidDocument = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase },
        { type: "none" },
      );

      expect(
        xidDocument.isInceptionSigningKey(privateKeyBase.schnorrPublicKeys().signingPublicKey()),
      ).toBe(true);

      // Add another key that's not inception
      const privateKeyBase2 = PrivateKeyBase.new();
      expect(
        xidDocument.isInceptionSigningKey(privateKeyBase2.schnorrPublicKeys().signingPublicKey()),
      ).toBe(false);
    });
  });

  describe("Delegates management", () => {
    it("should manage delegates", () => {
      const alicePrivateKeyBase = PrivateKeyBase.new();
      const aliceXidDocument = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase: alicePrivateKeyBase },
        { type: "none" },
      );

      const bobPrivateKeyBase = PrivateKeyBase.new();
      const bobXidDocument = XIDDocument.new(
        { type: "publicKeys", publicKeys: bobPrivateKeyBase.ed25519PublicKeys() },
        { type: "none" },
      );

      const bobDelegate = Delegate.new(bobXidDocument);
      bobDelegate.permissions().addAllow(Privilege.Sign);

      aliceXidDocument.addDelegate(bobDelegate);
      expect(aliceXidDocument.delegates().length).toBe(1);

      // Find delegate
      const found = aliceXidDocument.findDelegateByXid(bobXidDocument.xid());
      expect(found).toBeDefined();

      // Round-trip through envelope
      const envelope = aliceXidDocument.intoEnvelope();
      const aliceXidDocument2 = XIDDocument.fromEnvelope(envelope);
      expect(aliceXidDocument.equals(aliceXidDocument2)).toBe(true);
    });
  });

  describe("Services management", () => {
    it("should manage services with references", () => {
      // Create Alice with key
      const alicePrivateKeyBase = PrivateKeyBase.new();
      const aliceXidDocument = XIDDocument.new(
        {
          type: "publicKeys",
          publicKeys: alicePrivateKeyBase.ed25519PublicKeys(),
        },
        { type: "none" },
      );
      const aliceKey = aliceXidDocument.inceptionKey();
      if (aliceKey === undefined) throw new Error("Expected aliceKey");

      // Create Bob as delegate
      const bobPrivateKeyBase = PrivateKeyBase.new();
      const bobXidDocument = XIDDocument.new(
        { type: "publicKeys", publicKeys: bobPrivateKeyBase.ed25519PublicKeys() },
        { type: "none" },
      );
      const bobDelegate = Delegate.new(bobXidDocument);
      bobDelegate.permissions().addAllow(Privilege.Sign);
      bobDelegate.permissions().addAllow(Privilege.Encrypt);
      aliceXidDocument.addDelegate(bobDelegate);

      // Create service
      const service = Service.new("https://example.com");
      service.addKeyReference(aliceKey.reference());
      service.addDelegateReference(bobDelegate.reference());
      service.permissions().addAllow(Privilege.Encrypt);
      service.permissions().addAllow(Privilege.Sign);
      service.setName("Example Service");
      service.addCapability("com.example.messaging");

      aliceXidDocument.addService(service);

      // Round-trip through envelope
      const envelope = aliceXidDocument.intoEnvelope();
      const aliceXidDocument2 = XIDDocument.fromEnvelope(envelope);
      expect(aliceXidDocument.equals(aliceXidDocument2)).toBe(true);
    });

    it("should prevent removing referenced keys", () => {
      const privateKeyBase = PrivateKeyBase.new();

      const xidDocument = XIDDocument.new(
        { type: "publicKeys", publicKeys: privateKeyBase.ed25519PublicKeys() },
        { type: "none" },
      );
      const key = xidDocument.inceptionKey();
      if (key === undefined) throw new Error("Expected inception key");

      // Create service referencing the key
      const service = Service.new("https://example.com");
      service.addKeyReference(key.reference());
      service.permissions().addAllow(Privilege.Sign);
      xidDocument.addService(service);

      // Can't remove key while service references it
      expect(() => {
        xidDocument.removeKey(privateKeyBase.ed25519PublicKeys());
      }).toThrow();

      // Remove service first
      xidDocument.removeService("https://example.com");

      // Now can remove key
      xidDocument.removeKey(privateKeyBase.ed25519PublicKeys());
      expect(xidDocument.keys().length).toBe(0);
    });
  });

  describe("Provenance", () => {
    it("should create XID document with provenance", () => {
      const privateKeyBase = PrivateKeyBase.new();

      const xidDocument = XIDDocument.new(
        { type: "publicKeys", publicKeys: privateKeyBase.ed25519PublicKeys() },
        {
          type: "passphrase",
          passphrase: "test",
          resolution: ProvenanceMarkResolution.Quartile,
          date: new Date(Date.UTC(2025, 0, 1)),
        },
      );

      expect(xidDocument.provenance()).toBeDefined();
      expect(xidDocument.provenanceGenerator()).toBeDefined();
    });
  });

  describe("Private key options", () => {
    it("should omit private key by default", () => {
      const privateKeyBase = PrivateKeyBase.new();

      const xidDocument = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase },
        { type: "none" },
      );

      // Default serialization omits private key
      const envelope = xidDocument.toEnvelope();
      const xidDocument2 = XIDDocument.fromEnvelope(envelope);

      const inceptionKey = xidDocument2.inceptionKey();
      expect(inceptionKey).toBeDefined();
      expect(inceptionKey?.hasPrivateKeys()).toBe(false);
    });

    it("should include private key when specified", () => {
      const privateKeyBase = PrivateKeyBase.new();

      const xidDocument = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase },
        { type: "none" },
      );

      const envelope = xidDocument.toEnvelope(XIDPrivateKeyOptions.Include);
      const xidDocument2 = XIDDocument.fromEnvelope(envelope);

      const inceptionKey = xidDocument2.inceptionKey();
      expect(inceptionKey).toBeDefined();
      expect(inceptionKey?.hasPrivateKeys()).toBe(true);
      expect(xidDocument.equals(xidDocument2)).toBe(true);
    });

    it("should elide private key when specified", () => {
      const privateKeyBase = PrivateKeyBase.new();

      const xidDocument = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase },
        { type: "none" },
      );

      const envelopeInclude = xidDocument.toEnvelope(XIDPrivateKeyOptions.Include);
      const envelopeElide = xidDocument.toEnvelope(XIDPrivateKeyOptions.Elide);

      // Elided should be equivalent to included (same digest)
      expect(envelopeElide.digest().equals(envelopeInclude.digest())).toBe(true);

      // But restored document should not have private key
      const xidDocument2 = XIDDocument.fromEnvelope(envelopeElide);
      expect(xidDocument2.inceptionKey()?.hasPrivateKeys()).toBe(false);
    });

    it("should encrypt private key when specified", { timeout: 30_000 }, () => {
      const privateKeyBase = PrivateKeyBase.new();
      const password = new TextEncoder().encode("secure_password");

      const xidDocument = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase },
        { type: "none" },
      );

      const envelope = xidDocument.toEnvelope({
        type: XIDPrivateKeyOptions.Encrypt,
        password,
      });

      // Without password, no private key
      const xidDocNoPassword = XIDDocument.fromEnvelope(envelope);
      expect(xidDocNoPassword.inceptionKey()?.hasPrivateKeys()).toBe(false);

      // With password, private key restored
      const xidDocWithPassword = XIDDocument.fromEnvelope(
        envelope,
        password,
        XIDVerifySignature.None,
      );
      expect(xidDocWithPassword.inceptionKey()?.hasPrivateKeys()).toBe(true);
      expect(xidDocument.equals(xidDocWithPassword)).toBe(true);
    });
  });

  describe("Signing", () => {
    // Testing signing with adapters
    it("should sign with inception key", () => {
      const privateKeyBase = PrivateKeyBase.new();

      const xidDocument = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase },
        { type: "none" },
      );

      const signedEnvelope = xidDocument.toEnvelope(
        XIDPrivateKeyOptions.Omit,
        XIDGeneratorOptions.Omit,
        { type: "inception" },
      );

      // Verify signature
      const xidDocument2 = XIDDocument.fromEnvelope(
        signedEnvelope,
        undefined,
        XIDVerifySignature.Inception,
      );
      expect(xidDocument.xid().equals(xidDocument2.xid())).toBe(true);
    });

    it("should fail signing without inception key private key", () => {
      const privateKeyBase = PrivateKeyBase.new();

      const xidDocument = XIDDocument.new(
        { type: "publicKeys", publicKeys: privateKeyBase.ed25519PublicKeys() },
        { type: "none" },
      );

      expect(() => {
        xidDocument.toEnvelope(XIDPrivateKeyOptions.Omit, XIDGeneratorOptions.Omit, {
          type: "inception",
        });
      }).toThrow();
    });
  });

  describe("Document comparison", () => {
    // Testing document equality (compares by XID only)
    it("should compare documents by XID", () => {
      const privateKeyBase1 = PrivateKeyBase.new();
      const privateKeyBase2 = PrivateKeyBase.new();

      const xidDocument1 = XIDDocument.new(
        { type: "publicKeys", publicKeys: privateKeyBase1.ed25519PublicKeys() },
        { type: "none" },
      );

      const xidDocument2 = XIDDocument.fromXid(xidDocument1.xid());

      const xidDocument3 = XIDDocument.new(
        { type: "publicKeys", publicKeys: privateKeyBase2.ed25519PublicKeys() },
        { type: "none" },
      );

      // equals() compares all fields (matching Rust PartialEq)
      // xidDocument1 has a key, xidDocument2 was created from just an XID (no keys)
      expect(xidDocument1.equals(xidDocument2)).toBe(false); // Same XID but different keys
      expect(xidDocument1.equals(xidDocument3)).toBe(false); // Different XID

      // XID comparison directly
      expect(xidDocument1.xid().equals(xidDocument2.xid())).toBe(true);

      // Clone should be equal (same fields)
      expect(xidDocument1.equals(xidDocument1.clone())).toBe(true);
    });
  });

  describe("Document cloning", () => {
    it("should clone document correctly", () => {
      const privateKeyBase = PrivateKeyBase.new();

      const xidDocument = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase },
        {
          type: "passphrase",
          passphrase: "test",
        },
      );

      xidDocument.addResolutionMethod("https://resolver.example.com");

      const cloned = xidDocument.clone();
      expect(cloned.equals(xidDocument)).toBe(true);
      expect(cloned.xid().equals(xidDocument.xid())).toBe(true);
    });
  });

  describe("Encrypted generator", () => {
    it("should encrypt and decrypt generator in document", { timeout: 30_000 }, () => {
      const privateKeyBase = PrivateKeyBase.new();
      const password = new TextEncoder().encode("generator_password");

      const xidDocument = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase },
        {
          type: "passphrase",
          passphrase: "test_passphrase",
          resolution: ProvenanceMarkResolution.High,
          date: new Date(Date.UTC(2025, 0, 1)),
        },
      );

      // Has provenance and generator
      expect(xidDocument.provenance()).toBeDefined();
      expect(xidDocument.provenanceGenerator()).toBeDefined();

      // Serialize with encrypted generator
      const envelope = xidDocument.toEnvelope(
        XIDPrivateKeyOptions.Include,
        { type: XIDGeneratorOptions.Encrypt, password },
        { type: "none" },
      );

      // Deserialize without password - generator not accessible
      const xidDocNoPassword = XIDDocument.fromEnvelope(envelope);
      expect(xidDocNoPassword.provenance()?.seq()).toBe(xidDocument.provenance()?.seq());
      expect(xidDocNoPassword.provenanceGenerator()).toBeUndefined();

      // Deserialize with password - generator accessible
      const xidDocWithPassword = XIDDocument.fromEnvelope(envelope, password);
      expect(xidDocWithPassword.provenanceGenerator()).toBeDefined();
    });
  });

  describe("Changing keys", () => {
    it("should allow changing keys", () => {
      const privateKeyBase = PrivateKeyBase.new();

      const xidDocument = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase },
        { type: "none" },
      );

      // Remove inception key
      const inceptionKey = xidDocument.removeInceptionKey();
      expect(inceptionKey).toBeDefined();
      expect(xidDocument.isEmpty()).toBe(true);

      // Add new key
      const privateKeyBase2 = PrivateKeyBase.new();
      const key2 = Key.newAllowAll(privateKeyBase2.ed25519PublicKeys());
      xidDocument.addKey(key2);

      // Document still has same XID but different key
      expect(xidDocument.keys().length).toBe(1);
      expect(xidDocument.inceptionKey()).toBeUndefined(); // New key is not inception
    });
  });

  describe("Multiple keys with encryption", () => {
    it("should encrypt multiple keys", { timeout: 30_000 }, () => {
      const password = new TextEncoder().encode("multi_key_password");

      // Create document with inception key
      const inceptionBase = PrivateKeyBase.new();
      const xidDocument = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase: inceptionBase },
        { type: "none" },
      );

      // Add a second key
      const secondBase = PrivateKeyBase.new();
      const secondKey = Key.newWithPrivateKeyBase(secondBase);
      xidDocument.addKey(secondKey);

      // Encrypt all keys
      const envelope = xidDocument.toEnvelope({
        type: XIDPrivateKeyOptions.Encrypt,
        password,
      });

      // With password, both keys should have private key material
      const xidDocDecrypted = XIDDocument.fromEnvelope(envelope, password);
      expect(xidDocDecrypted.keys().length).toBe(2);
      for (const key of xidDocDecrypted.keys()) {
        expect(key.hasPrivateKeys()).toBe(true);
      }
      expect(xidDocument.equals(xidDocDecrypted)).toBe(true);
    });
  });

  describe("Mode switching", () => {
    it("should switch between storage modes", { timeout: 30_000 }, () => {
      const privateKeyBase = PrivateKeyBase.new();
      const password = new TextEncoder().encode("mode_switch_password");

      const xidDocument = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase },
        { type: "none" },
      );

      // Mode 1: Plaintext
      const envelopePlaintext = xidDocument.toEnvelope(XIDPrivateKeyOptions.Include);
      const doc1 = XIDDocument.fromEnvelope(envelopePlaintext);
      expect(doc1.equals(xidDocument)).toBe(true);

      // Mode 2: Encrypted
      const envelopeEncrypted = doc1.toEnvelope({
        type: XIDPrivateKeyOptions.Encrypt,
        password,
      });
      const doc2 = XIDDocument.fromEnvelope(envelopeEncrypted, password);
      expect(doc2.equals(xidDocument)).toBe(true);

      // Mode 3: Omitted
      const envelopeOmit = doc2.toEnvelope();
      const doc3 = XIDDocument.fromEnvelope(envelopeOmit);
      expect(doc3.inceptionKey()?.hasPrivateKeys()).toBe(false);

      // Back to plaintext from encrypted
      const envelopePlaintext2 = doc2.toEnvelope(XIDPrivateKeyOptions.Include);
      const doc4 = XIDDocument.fromEnvelope(envelopePlaintext2);
      expect(doc4.equals(xidDocument)).toBe(true);
    });
  });

  describe("Empty document", () => {
    it("should correctly identify empty documents", () => {
      // Create a full XIDDocument first to get a valid XID
      const privateKeyBase = PrivateKeyBase.new();
      const fullDoc = XIDDocument.new(
        { type: "publicKeys", publicKeys: privateKeyBase.ed25519PublicKeys() },
        { type: "none" },
      );
      const xid = fullDoc.xid();

      const xidDocument = XIDDocument.fromXid(xid);
      expect(xidDocument.isEmpty()).toBe(true);

      // Adding any content makes it non-empty
      xidDocument.addResolutionMethod("https://example.com");
      expect(xidDocument.isEmpty()).toBe(false);
    });
  });

  describe("Default document creation", () => {
    it("should create document with generated keys", () => {
      const xidDocument = XIDDocument.new({ type: "default" }, { type: "none" });

      // Should have inception key with private keys
      const inceptionKey = xidDocument.inceptionKey();
      expect(inceptionKey).toBeDefined();
      expect(inceptionKey?.hasPrivateKeys()).toBe(true);
    });
  });

  describe("Reference calculation", () => {
    it("should calculate document reference from XID", () => {
      const privateKeyBase = PrivateKeyBase.new();

      const xidDocument = XIDDocument.new(
        { type: "publicKeys", publicKeys: privateKeyBase.ed25519PublicKeys() },
        { type: "none" },
      );

      const reference = xidDocument.reference();
      expect(reference).toBeDefined();
    });
  });

  describe("Post-quantum key support", () => {
    // Tests for XID documents with ML-DSA post-quantum signing keys
    // Matches Rust test: xid_document_pq() in tests/test_xid_document.rs

    // Helper function to create ML-DSA signing keys
    function createMldsaSigningKeys(level: MLDSALevel): [SigningPrivateKey, SigningPublicKey] {
      const keypairData = mldsaGenerateKeypair(level);
      const mldsaPrivateKey = MLDSAPrivateKey.fromBytes(level, keypairData.secretKey);
      const mldsaPublicKey = MLDSAPublicKey.fromBytes(level, keypairData.publicKey);
      const signingPrivateKey = SigningPrivateKey.newMldsa(mldsaPrivateKey);
      const signingPublicKey = SigningPublicKey.fromMldsa(mldsaPublicKey);
      return [signingPrivateKey, signingPublicKey];
    }

    it("should create XID document with ML-DSA44 signing key", () => {
      // Create ML-DSA44 signing keypair
      const [signingPrivateKey, signingPublicKey] = createMldsaSigningKeys(MLDSALevel.MLDSA44);

      // Create X25519 encapsulation keypair (ML-KEM not yet implemented)
      const [encapsulationPrivateKey, encapsulationPublicKey] = EncapsulationPrivateKey.keypair();

      // Create PrivateKeys and PublicKeys containers
      const privateKeys = PrivateKeys.withKeys(signingPrivateKey, encapsulationPrivateKey);
      const publicKeys = PublicKeys.new(signingPublicKey, encapsulationPublicKey);

      // Create XID document with PQ keys
      const xidDocument = XIDDocument.new(
        { type: "privateKeys", privateKeys, publicKeys },
        { type: "none" },
      );

      // Verify document has inception key with private keys
      const inceptionKey = xidDocument.inceptionKey();
      expect(inceptionKey).toBeDefined();
      expect(inceptionKey?.hasPrivateKeys()).toBe(true);

      // Verify XID is defined
      expect(xidDocument.xid()).toBeDefined();

      // Round-trip through envelope
      const envelope = xidDocument.intoEnvelope();
      const xidDocument2 = XIDDocument.fromEnvelope(envelope);
      expect(xidDocument.xid().equals(xidDocument2.xid())).toBe(true);
    });

    it("should create XID document with ML-DSA65 signing key", () => {
      const [signingPrivateKey, signingPublicKey] = createMldsaSigningKeys(MLDSALevel.MLDSA65);
      const [encapsulationPrivateKey, encapsulationPublicKey] = EncapsulationPrivateKey.keypair();

      const privateKeys = PrivateKeys.withKeys(signingPrivateKey, encapsulationPrivateKey);
      const publicKeys = PublicKeys.new(signingPublicKey, encapsulationPublicKey);

      const xidDocument = XIDDocument.new(
        { type: "privateKeys", privateKeys, publicKeys },
        { type: "none" },
      );

      expect(xidDocument.inceptionKey()).toBeDefined();
      expect(xidDocument.inceptionKey()?.hasPrivateKeys()).toBe(true);
    });

    it("should create XID document with ML-DSA87 signing key", () => {
      const [signingPrivateKey, signingPublicKey] = createMldsaSigningKeys(MLDSALevel.MLDSA87);
      const [encapsulationPrivateKey, encapsulationPublicKey] = EncapsulationPrivateKey.keypair();

      const privateKeys = PrivateKeys.withKeys(signingPrivateKey, encapsulationPrivateKey);
      const publicKeys = PublicKeys.new(signingPublicKey, encapsulationPublicKey);

      const xidDocument = XIDDocument.new(
        { type: "privateKeys", privateKeys, publicKeys },
        { type: "none" },
      );

      expect(xidDocument.inceptionKey()).toBeDefined();
      expect(xidDocument.inceptionKey()?.hasPrivateKeys()).toBe(true);
    });

    it("should sign XID document with ML-DSA key", () => {
      // Create PQ keys
      const [signingPrivateKey, signingPublicKey] = createMldsaSigningKeys(MLDSALevel.MLDSA44);
      const [encapsulationPrivateKey, encapsulationPublicKey] = EncapsulationPrivateKey.keypair();

      const privateKeys = PrivateKeys.withKeys(signingPrivateKey, encapsulationPrivateKey);
      const publicKeys = PublicKeys.new(signingPublicKey, encapsulationPublicKey);

      // Create document with PQ keys
      const xidDocument = XIDDocument.new(
        { type: "privateKeys", privateKeys, publicKeys },
        { type: "none" },
      );

      // Sign with inception key
      const signedEnvelope = xidDocument.toEnvelope(
        XIDPrivateKeyOptions.Omit,
        XIDGeneratorOptions.Omit,
        { type: "inception" },
      );

      // Verify signature
      const xidDocument2 = XIDDocument.fromEnvelope(
        signedEnvelope,
        undefined,
        XIDVerifySignature.Inception,
      );
      expect(xidDocument.xid().equals(xidDocument2.xid())).toBe(true);
    });

    it("should add PQ key to existing document", () => {
      // Create standard document
      const privateKeyBase = PrivateKeyBase.new();
      const xidDocument = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase },
        { type: "none" },
      );

      // Create PQ keys and add as second key
      const [, signingPublicKey] = createMldsaSigningKeys(MLDSALevel.MLDSA44);
      const [, encapsulationPublicKey] = EncapsulationPrivateKey.keypair();

      const publicKeys = PublicKeys.new(signingPublicKey, encapsulationPublicKey);
      const key2 = Key.newAllowAll(publicKeys);
      xidDocument.addKey(key2);

      // Should have both keys
      expect(xidDocument.keys().length).toBe(2);

      // Find the PQ key
      const foundKey = xidDocument.findKeyByPublicKeys(publicKeys);
      expect(foundKey).toBeDefined();
    });
  });

  describe("Encrypted with different methods", () => {
    it("should encrypt with Argon2id, PBKDF2, and Scrypt", { timeout: 30_000 }, () => {
      const privateKeyBase = PrivateKeyBase.new();
      const xidDocument = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase },
        { type: "none" },
      );
      const password = new TextEncoder().encode("test_password");

      // Test Argon2id
      const envelopeArgon2id = xidDocument.toEnvelope({
        type: XIDPrivateKeyOptions.Encrypt,
        password,
        method: KeyDerivationMethod.Argon2id,
      });

      // Test PBKDF2
      const envelopePbkdf2 = xidDocument.toEnvelope({
        type: XIDPrivateKeyOptions.Encrypt,
        password,
        method: KeyDerivationMethod.PBKDF2,
      });

      // Test Scrypt
      const envelopeScrypt = xidDocument.toEnvelope({
        type: XIDPrivateKeyOptions.Encrypt,
        password,
        method: KeyDerivationMethod.Scrypt,
      });

      // All methods should be decryptable with the same password
      for (const envelope of [envelopeArgon2id, envelopePbkdf2, envelopeScrypt]) {
        const doc = XIDDocument.fromEnvelope(envelope, password, XIDVerifySignature.None);
        expect(doc.equals(xidDocument)).toBe(true);
      }
    });
  });

  describe("Re-encryption", () => {
    it("should re-encrypt with different password", { timeout: 30_000 }, () => {
      const privateKeyBase = PrivateKeyBase.new();
      const xidDocument = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase },
        { type: "none" },
      );
      const password1 = new TextEncoder().encode("first_password");
      const password2 = new TextEncoder().encode("second_password");

      // Encrypt with first password
      const envelope1 = xidDocument.toEnvelope({
        type: XIDPrivateKeyOptions.Encrypt,
        password: password1,
        method: KeyDerivationMethod.Argon2id,
      });

      // Load with first password
      const docDecrypted = XIDDocument.fromEnvelope(envelope1, password1, XIDVerifySignature.None);
      expect(docDecrypted.equals(xidDocument)).toBe(true);
      expect(docDecrypted.inceptionKey()?.hasPrivateKeys()).toBe(true);

      // Re-encrypt with second password
      const envelope2 = docDecrypted.toEnvelope({
        type: XIDPrivateKeyOptions.Encrypt,
        password: password2,
        method: KeyDerivationMethod.Argon2id,
      });

      // First password should not work on second envelope
      const docWrongPwd = XIDDocument.fromEnvelope(envelope2, password1, XIDVerifySignature.None);
      expect(docWrongPwd.inceptionKey()?.hasPrivateKeys()).toBe(false);

      // Second password should work
      const docReencrypted = XIDDocument.fromEnvelope(
        envelope2,
        password2,
        XIDVerifySignature.None,
      );
      expect(docReencrypted.equals(xidDocument)).toBe(true);
      expect(docReencrypted.inceptionKey()?.hasPrivateKeys()).toBe(true);

      // The two encrypted envelopes should be different (different passwords)
      expect(envelope1.urString()).not.toBe(envelope2.urString());
    });
  });

  describe("Change encryption method", () => {
    it("should change from Argon2id to Scrypt", { timeout: 30_000 }, () => {
      const privateKeyBase = PrivateKeyBase.new();
      const xidDocument = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase },
        { type: "none" },
      );
      const password = new TextEncoder().encode("shared_password");

      // Encrypt with Argon2id
      const envelopeArgon2id = xidDocument.toEnvelope({
        type: XIDPrivateKeyOptions.Encrypt,
        password,
        method: KeyDerivationMethod.Argon2id,
      });

      // Load and decrypt
      const docDecrypted = XIDDocument.fromEnvelope(
        envelopeArgon2id,
        password,
        XIDVerifySignature.None,
      );

      // Re-encrypt with Scrypt
      const envelopeScrypt = docDecrypted.toEnvelope({
        type: XIDPrivateKeyOptions.Encrypt,
        password,
        method: KeyDerivationMethod.Scrypt,
      });

      // Verify the method changed
      const formatArgon2id = envelopeArgon2id.format();
      const formatScrypt = envelopeScrypt.format();
      expect(formatArgon2id).toContain("Argon2id");
      expect(formatScrypt).toContain("Scrypt");

      // Both should decrypt with the same password
      const docFromScrypt = XIDDocument.fromEnvelope(
        envelopeScrypt,
        password,
        XIDVerifySignature.None,
      );
      expect(docFromScrypt.equals(xidDocument)).toBe(true);
    });
  });

  describe("Encrypt-decrypt-plaintext roundtrip", () => {
    it("should roundtrip between plaintext and encrypted", { timeout: 30_000 }, () => {
      const privateKeyBase = PrivateKeyBase.new();
      const xidDocument = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase },
        { type: "none" },
      );
      const password = new TextEncoder().encode("test_password");

      // Start with plaintext
      const envelopePlaintext = xidDocument.toEnvelope(XIDPrivateKeyOptions.Include);
      const docFromPlaintext = XIDDocument.fromEnvelope(envelopePlaintext);
      expect(docFromPlaintext.equals(xidDocument)).toBe(true);

      // Encrypt it
      const envelopeEncrypted = docFromPlaintext.toEnvelope({
        type: XIDPrivateKeyOptions.Encrypt,
        password,
        method: KeyDerivationMethod.Argon2id,
      });

      // Decrypt it
      const docDecrypted = XIDDocument.fromEnvelope(
        envelopeEncrypted,
        password,
        XIDVerifySignature.None,
      );
      expect(docDecrypted.equals(xidDocument)).toBe(true);
      expect(docDecrypted.inceptionKey()?.hasPrivateKeys()).toBe(true);

      // Convert back to plaintext
      const envelopePlaintext2 = docDecrypted.toEnvelope(XIDPrivateKeyOptions.Include);
      const docFinal = XIDDocument.fromEnvelope(envelopePlaintext2);
      expect(docFinal.equals(xidDocument)).toBe(true);
    });
  });

  describe("Preserve encrypted keys when modified", () => {
    it("should preserve encrypted keys after document modification", { timeout: 30_000 }, () => {
      const privateKeyBase = PrivateKeyBase.new();
      const xidDocument = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase },
        { type: "none" },
      );
      const password = new TextEncoder().encode("secret_password");

      // Create document with encrypted private keys
      const envelopeEncrypted = xidDocument.toEnvelope({
        type: XIDPrivateKeyOptions.Encrypt,
        password,
        method: KeyDerivationMethod.Argon2id,
      });

      // Load without password - encrypted keys are preserved but not accessible
      const docNoPassword = XIDDocument.fromEnvelope(envelopeEncrypted);
      expect(docNoPassword.inceptionKey()?.hasPrivateKeys()).toBe(false);
      expect(docNoPassword.inceptionKey()?.hasEncryptedPrivateKeys()).toBe(true);

      // Modify the document (add a resolution method)
      docNoPassword.addResolutionMethod("https://resolver.example.com");

      // Serialize with Include option - encrypted keys should be preserved
      const envelopeAfterModification = docNoPassword.toEnvelope(XIDPrivateKeyOptions.Include);
      const format = envelopeAfterModification.format();
      expect(format).toContain("ENCRYPTED");
      expect(format).toContain("hasSecret");

      // Load with password - should decrypt the keys
      const docWithPassword = XIDDocument.fromEnvelope(
        envelopeAfterModification,
        password,
        XIDVerifySignature.None,
      );
      expect(docWithPassword.resolutionMethods().has("https://resolver.example.com")).toBe(true);
      expect(docWithPassword.inceptionKey()?.hasPrivateKeys()).toBe(true);
    });
  });

  describe("Private key envelope for key", () => {
    it("should get unencrypted private key envelope", () => {
      const privateKeyBase = PrivateKeyBase.new();
      const doc = XIDDocument.new({ type: "privateKeyBase", privateKeyBase }, { type: "none" });
      const pubkeys = doc.inceptionKey()?.publicKeys();
      if (pubkeys === undefined) throw new Error("expected pubkeys");

      // Get unencrypted private key
      const envelope = doc.privateKeyEnvelopeForKey(pubkeys);
      expect(envelope).toBeDefined();

      // Should be able to extract bytes from the subject
      const bytes = (
        envelope?.subject() as unknown as { asByteString(): Uint8Array | undefined }
      ).asByteString();
      expect(bytes).toBeDefined();
    });

    it("should get encrypted private key envelope", { timeout: 30_000 }, () => {
      const privateKeyBase = PrivateKeyBase.new();
      const password = "test-password";

      // Create document with encrypted key
      const doc = XIDDocument.new({ type: "privateKeyBase", privateKeyBase }, { type: "none" });
      const envelopeEncrypted = doc.toEnvelope({
        type: XIDPrivateKeyOptions.Encrypt,
        password: new TextEncoder().encode(password),
      });

      const docEncrypted = XIDDocument.fromEnvelope(envelopeEncrypted);
      const pubkeys = docEncrypted.inceptionKey()?.publicKeys();
      if (pubkeys === undefined) throw new Error("expected pubkeys");

      // Without password - should get encrypted envelope
      const encryptedEnv = docEncrypted.privateKeyEnvelopeForKey(pubkeys);
      expect(encryptedEnv).toBeDefined();
      const formatted = encryptedEnv?.format();
      expect(formatted).toContain("ENCRYPTED");
      expect(formatted).toContain("hasSecret");

      // With correct password - should get decrypted keys
      const decryptedEnv = docEncrypted.privateKeyEnvelopeForKey(pubkeys, password);
      expect(decryptedEnv).toBeDefined();

      // With wrong password - should error
      expect(() => {
        docEncrypted.privateKeyEnvelopeForKey(pubkeys, "wrong");
      }).toThrow();
    });

    it("should return undefined for key not found", () => {
      const privateKeyBase = PrivateKeyBase.new();
      const doc = XIDDocument.new({ type: "privateKeyBase", privateKeyBase }, { type: "none" });

      // Try to get key that doesn't exist
      const otherPubkeys = PrivateKeyBase.new().schnorrPublicKeys();
      const result = doc.privateKeyEnvelopeForKey(otherPubkeys);
      expect(result).toBeUndefined();
    });

    it("should return undefined when no private key", () => {
      // Create document with public key only
      const pubkeys = PrivateKeyBase.new().ed25519PublicKeys();
      const doc = XIDDocument.new({ type: "publicKeys", publicKeys: pubkeys }, { type: "none" });

      // Should return undefined (no private key present)
      const result = doc.privateKeyEnvelopeForKey(pubkeys);
      expect(result).toBeUndefined();
    });
  });

  describe("Signing options", () => {
    it("should sign with PrivateKeys", () => {
      const privateKeyBase = PrivateKeyBase.new();
      const xidDocument = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase },
        { type: "none" },
      );

      // Create a separate signing key
      const signingKeyBase = PrivateKeyBase.new();
      const signingPrivateKeys = signingKeyBase.schnorrPrivateKeys();

      // Sign with the separate key
      const envelope = xidDocument.toEnvelope(XIDPrivateKeyOptions.Omit, XIDGeneratorOptions.Omit, {
        type: "privateKeys",
        privateKeys: signingPrivateKeys,
      });

      // The envelope should have a signature
      expect(envelope.format()).toContain("'signed': Signature");
    });

    it("should sign with SigningPrivateKey", () => {
      const privateKeyBase = PrivateKeyBase.new();
      const xidDocument = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase },
        { type: "none" },
      );

      // Create a separate signing key
      const signingKeyBase = PrivateKeyBase.new();
      const signingPrivateKey = signingKeyBase.schnorrPrivateKeys().signingPrivateKey();

      // Sign with the separate signing private key
      const envelope = xidDocument.toEnvelope(XIDPrivateKeyOptions.Omit, XIDGeneratorOptions.Omit, {
        type: "signingPrivateKey",
        signingPrivateKey,
      });

      // The envelope should have a signature
      expect(envelope.format()).toContain("'signed': Signature");
    });

    it("should sign with inception and include private keys", () => {
      const privateKeyBase = PrivateKeyBase.new();
      const xidDocument = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase },
        { type: "none" },
      );

      // Sign with inception key and include private keys
      const envelope = xidDocument.toEnvelope(
        XIDPrivateKeyOptions.Include,
        XIDGeneratorOptions.Omit,
        { type: "inception" },
      );

      // Envelope subject should be wrapped (signed)
      const subject = (envelope as unknown as { subject(): { isWrapped(): boolean } }).subject();
      expect(subject.isWrapped()).toBe(true);

      // Unwrap to get inner envelope
      const inner = (envelope as unknown as { tryUnwrap(): Envelope }).tryUnwrap();

      // Extract XIDDocument and verify it has private keys
      const xidDocument2 = XIDDocument.fromEnvelope(inner);
      expect(xidDocument2.inceptionKey()?.hasPrivateKeys()).toBe(true);
    });
  });

  describe("Backward compatibility", () => {
    it("should produce unsigned envelope by default", () => {
      const privateKeyBase = PrivateKeyBase.new();
      const xidDocument = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase },
        { type: "none" },
      );

      // Default toEnvelope should produce unsigned envelope
      const envelope = xidDocument.toEnvelope();
      const subject = (envelope as unknown as { subject(): { isWrapped(): boolean } }).subject();
      expect(subject.isWrapped()).toBe(false);
    });

    it("should produce signed envelope with toSignedEnvelope", () => {
      const privateKeyBase = PrivateKeyBase.new();
      const xidDocument = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase },
        { type: "none" },
      );

      // Use toSignedEnvelope
      const signingKey = xidDocument.inceptionKey()?.privateKeys();
      if (signingKey === undefined) throw new Error("expected signingKey");
      const envelope = xidDocument.toSignedEnvelope(signingKey);

      // Subject should be wrapped (signed)
      const subject = (envelope as unknown as { subject(): { isWrapped(): boolean } }).subject();
      expect(subject.isWrapped()).toBe(true);
    });
  });

  describe("Attachments", () => {
    it("should manage basic attachments", () => {
      const privateKeyBase = PrivateKeyBase.new();
      const xidDocument = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase },
        { type: "none" },
      );

      // Initially, the document should have no attachments
      expect(xidDocument.hasAttachments()).toBe(false);

      // Add an attachment with vendor and conformance metadata
      xidDocument.addAttachment("test_data", "com.example", "com.example.schema.v1");

      // Document should now have attachments
      expect(xidDocument.hasAttachments()).toBe(true);

      // Add another attachment
      xidDocument.addAttachment(new Uint8Array([1, 2, 3, 4, 5]), "org.test");

      // Convert to envelope and round-trip
      const envelope = xidDocument.toEnvelope(XIDPrivateKeyOptions.Include);
      const xidDocument2 = XIDDocument.fromEnvelope(envelope);

      // Verify attachments are preserved through round-trip
      expect(xidDocument.equals(xidDocument2)).toBe(true);
      expect(xidDocument2.hasAttachments()).toBe(true);

      // Test clearing attachments
      const xidDocument3 = xidDocument.clone();
      xidDocument3.clearAttachments();
      expect(xidDocument3.hasAttachments()).toBe(false);
    });

    it("should preserve attachments with encryption", { timeout: 30_000 }, () => {
      const privateKeyBase = PrivateKeyBase.new();
      const xidDocument = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase },
        { type: "none" },
      );
      const password = new TextEncoder().encode("test_password");

      // Add attachments
      xidDocument.addAttachment("metadata_value", "com.test", "schema.v1");
      xidDocument.addAttachment(42, "org.example");

      expect(xidDocument.hasAttachments()).toBe(true);

      // Encrypt private keys
      const envelope = xidDocument.toEnvelope({
        type: XIDPrivateKeyOptions.Encrypt,
        password,
        method: KeyDerivationMethod.Argon2id,
      });

      // Decrypt and verify attachments are preserved
      const xidDocument2 = XIDDocument.fromEnvelope(envelope, password, XIDVerifySignature.None);
      expect(xidDocument.equals(xidDocument2)).toBe(true);
      expect(xidDocument2.hasAttachments()).toBe(true);
    });

    it("should preserve attachments with signature", () => {
      const privateKeyBase = PrivateKeyBase.new();
      const xidDocument = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase },
        { type: "none" },
      );

      // Add attachments before signing
      xidDocument.addAttachment(
        "signed_data",
        "com.example.signed",
        "com.example.signed.schema.v1",
      );

      // Sign the document with inception key - attachments should be inside the signature
      const envelope = xidDocument.toEnvelope(
        XIDPrivateKeyOptions.Include,
        XIDGeneratorOptions.Omit,
        { type: "inception" },
      );

      // Convert back from envelope with signature verification
      const xidDocument2 = XIDDocument.fromEnvelope(
        envelope,
        undefined,
        XIDVerifySignature.Inception,
      );

      // Verify attachments are preserved and inside the signed content
      expect(xidDocument.xid().equals(xidDocument2.xid())).toBe(true);
      expect(xidDocument2.hasAttachments()).toBe(true);

      // Verify we can add more attachments and re-sign
      xidDocument2.addAttachment("additional_data", "com.example.more");

      const envelope3 = xidDocument2.toEnvelope(
        XIDPrivateKeyOptions.Include,
        XIDGeneratorOptions.Omit,
        { type: "inception" },
      );

      // Verify both attachments are present and signed
      const xidDocument4 = XIDDocument.fromEnvelope(
        envelope3,
        undefined,
        XIDVerifySignature.Inception,
      );
      expect(xidDocument2.xid().equals(xidDocument4.xid())).toBe(true);
      expect(xidDocument4.hasAttachments()).toBe(true);
    });
  });
});
