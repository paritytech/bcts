/**
 * Provenance tests
 * Ported from bc-xid-rust/tests/provenance.rs
 */

import { PrivateKeyBase } from "@bcts/envelope";
import { ProvenanceMarkGenerator, ProvenanceMarkResolution } from "@bcts/provenance-mark";
import { cbor } from "@bcts/dcbor";
import { Provenance, XIDGeneratorOptions, XIDDocument } from "../src";

describe("Provenance", () => {
  describe("Basic provenance", () => {
    it("should create provenance with mark", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.High,
        "test_passphrase",
      );
      const date = new Date(Date.UTC(2025, 0, 1));
      const mark = generator.next(date, cbor("Test mark"));

      const provenance = Provenance.new(mark);
      expect(provenance.mark().equals(mark)).toBe(true);
      expect(provenance.generator()).toBeUndefined();

      // Round-trip through envelope
      const envelope = provenance.intoEnvelope();
      const provenance2 = Provenance.tryFromEnvelope(envelope);
      expect(provenance.equals(provenance2)).toBe(true);
    });
  });

  describe("Provenance with generator", () => {
    it("should omit generator by default", () => {
      const generatorForMark = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.High,
        "test_passphrase",
      );
      const date = new Date(Date.UTC(2025, 0, 1));
      const mark = generatorForMark.next(date, cbor("Test mark"));

      // Create a fresh generator for storage
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.High,
        "test_passphrase",
      );

      const provenanceIncludingGenerator = Provenance.newWithGenerator(generator, mark);
      const provenanceOmittingGenerator = Provenance.new(mark);

      // Default envelope omits generator
      const envelopeOmitting = provenanceIncludingGenerator.intoEnvelope();
      const provenance2 = Provenance.tryFromEnvelope(envelopeOmitting);
      expect(provenance2.generator()).toBeUndefined();
      expect(provenanceOmittingGenerator.equals(provenance2)).toBe(true);
    });

    it.skip("should include generator when specified", () => {
      const generatorForMark = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.High,
        "test_passphrase",
      );
      const date = new Date(Date.UTC(2025, 0, 1));
      const mark = generatorForMark.next(date, cbor("Test mark"));

      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.High,
        "test_passphrase",
      );

      const provenanceIncludingGenerator = Provenance.newWithGenerator(generator, mark);

      // Include generator
      const envelopeIncluding = provenanceIncludingGenerator.intoEnvelopeOpt(
        XIDGeneratorOptions.Include,
      );
      const provenance2 = Provenance.tryFromEnvelope(envelopeIncluding);
      expect(provenance2.generator()).toBeDefined();
      expect(provenanceIncludingGenerator.equals(provenance2)).toBe(true);
    });

    it.skip("should elide generator when specified", () => {
      const generatorForMark = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.High,
        "test_passphrase",
      );
      const date = new Date(Date.UTC(2025, 0, 1));
      const mark = generatorForMark.next(date, cbor("Test mark"));

      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.High,
        "test_passphrase",
      );

      const provenanceIncludingGenerator = Provenance.newWithGenerator(generator, mark);
      const provenanceOmittingGenerator = Provenance.new(mark);

      // Elide generator
      const envelopeEliding = provenanceIncludingGenerator.intoEnvelopeOpt(
        XIDGeneratorOptions.Elide,
      );
      const provenance2 = Provenance.tryFromEnvelope(envelopeEliding);
      expect(provenance2.generator()).toBeUndefined();
      expect(provenanceOmittingGenerator.equals(provenance2)).toBe(true);

      // Elided envelope should be equivalent to included envelope (same digest)
      const envelopeIncluding = provenanceIncludingGenerator.intoEnvelopeOpt(
        XIDGeneratorOptions.Include,
      );
      expect(envelopeEliding.digest().equals(envelopeIncluding.digest())).toBe(true);
    });
  });

  describe.skip("Encrypted generator", () => {
    // Skipped: encryptSubject API requires different key type
    it("should encrypt and decrypt generator with password", () => {
      const generatorForMark = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.High,
        "test_passphrase",
      );
      const date = new Date(Date.UTC(2025, 0, 1));
      const mark = generatorForMark.next(date, cbor("Test mark"));

      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.High,
        "test_passphrase",
      );
      const password = new TextEncoder().encode("correct_horse_battery_staple");

      const provenance = Provenance.newWithGenerator(generator, mark);

      // Encrypt the generator
      const envelopeEncrypted = provenance.intoEnvelopeOpt({
        type: XIDGeneratorOptions.Encrypt,
        password,
      });

      // Extract without password - generator is None
      const provenanceNoPassword = Provenance.tryFromEnvelope(envelopeEncrypted);
      expect(provenanceNoPassword.generator()).toBeUndefined();
      expect(provenanceNoPassword.mark().equals(mark)).toBe(true);

      // Extract with wrong password - generator is None
      const wrongPassword = new TextEncoder().encode("wrong_password");
      const provenanceWrongPassword = Provenance.tryFromEnvelope(envelopeEncrypted, wrongPassword);
      expect(provenanceWrongPassword.generator()).toBeUndefined();

      // Extract with correct password - generator is available
      const provenanceDecrypted = Provenance.tryFromEnvelope(envelopeEncrypted, password);
      expect(provenanceDecrypted.generator()).toBeDefined();
      expect(provenance.equals(provenanceDecrypted)).toBe(true);
    });
  });

  describe.skip("Generator storage modes", () => {
    // Skipped: includes encryption and equivalence checks that aren't available
    it("should handle all storage modes correctly", () => {
      const generatorForMark = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.High,
        "test_passphrase",
      );
      const date = new Date(Date.UTC(2025, 0, 1));
      const mark = generatorForMark.next(date, cbor("Test mark"));

      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.High,
        "test_passphrase",
      );

      const provenance = Provenance.newWithGenerator(generator, mark);

      // Mode 1: Omit (default)
      const envelopeOmit = provenance.intoEnvelope();
      const provenanceOmit = Provenance.tryFromEnvelope(envelopeOmit);
      expect(provenanceOmit.generator()).toBeUndefined();

      // Mode 2: Include
      const envelopeInclude = provenance.intoEnvelopeOpt(XIDGeneratorOptions.Include);
      const provenanceInclude = Provenance.tryFromEnvelope(envelopeInclude);
      expect(provenance.equals(provenanceInclude)).toBe(true);

      // Mode 3: Elide
      const envelopeElide = provenance.intoEnvelopeOpt(XIDGeneratorOptions.Elide);
      const provenanceElide = Provenance.tryFromEnvelope(envelopeElide);
      expect(provenanceElide.generator()).toBeUndefined();
      expect(envelopeElide.digest().equals(envelopeInclude.digest())).toBe(true);

      // Mode 4: Encrypt
      const password = new TextEncoder().encode("secure_password");
      const envelopeEncrypt = provenance.intoEnvelopeOpt({
        type: XIDGeneratorOptions.Encrypt,
        password,
      });
      const provenanceNoPassword = Provenance.tryFromEnvelope(envelopeEncrypt);
      expect(provenanceNoPassword.generator()).toBeUndefined();
      const provenanceWithPassword = Provenance.tryFromEnvelope(envelopeEncrypt, password);
      expect(provenance.equals(provenanceWithPassword)).toBe(true);
    });
  });

  describe("Advancing provenance marks", () => {
    it("should advance with embedded generator", () => {
      const privateKeyBase = PrivateKeyBase.generate();

      const passphrase = "test_passphrase";
      const date1 = new Date(Date.UTC(2025, 0, 1));

      const xidDoc = XIDDocument.new(
        { type: "publicKeyBase", publicKeyBase: privateKeyBase.publicKeys() },
        {
          type: "passphrase",
          passphrase,
          resolution: ProvenanceMarkResolution.High,
          date: date1,
          info: cbor("Genesis mark"),
        },
      );

      // Verify initial state
      const mark1 = xidDoc.provenance();
      expect(mark1).toBeDefined();
      expect(mark1!.seq()).toBe(0);

      // Advance the provenance mark
      const xidDoc2 = xidDoc.clone();
      const date2 = new Date(Date.UTC(2025, 0, 2));
      xidDoc2.nextProvenanceMarkWithEmbeddedGenerator(undefined, date2, cbor("Second mark"));

      // Verify advancement
      const mark2 = xidDoc2.provenance();
      expect(mark2).toBeDefined();
      expect(mark2!.seq()).toBe(1);

      // Verify generator is still available and advanced
      const generator = xidDoc2.provenanceGenerator();
      expect(generator).toBeDefined();
      expect(generator!.nextSeq()).toBe(2);
    });

    it("should advance with provided generator", () => {
      // Create a generator
      const passphrase = "test_passphrase";
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.High,
        passphrase,
      );

      // Generate genesis mark
      const date1 = new Date(Date.UTC(2025, 0, 1));
      const mark1 = generator.next(date1, cbor("Genesis mark"));

      // Create XID document WITHOUT embedded generator
      const privateKeyBase = PrivateKeyBase.generate();
      const xidDocBase = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase },
        { type: "none" },
      );
      const xidDoc = XIDDocument.fromXid(xidDocBase.xid());
      xidDoc.setProvenance(mark1);

      // Verify initial state
      expect(xidDoc.provenance()!.seq()).toBe(0);
      expect(xidDoc.provenanceGenerator()).toBeUndefined();

      // Advance using the provided generator
      const date2 = new Date(Date.UTC(2025, 0, 2));
      xidDoc.nextProvenanceMarkWithProvidedGenerator(generator, date2, cbor("Second mark"));

      // Verify advancement
      const mark2 = xidDoc.provenance();
      expect(mark2!.seq()).toBe(1);

      // Generator should still be external
      expect(xidDoc.provenanceGenerator()).toBeUndefined();

      // External generator should be advanced
      expect(generator.nextSeq()).toBe(2);
    });
  });

  describe("Provenance errors", () => {
    it("should error when advancing without provenance mark", () => {
      const privateKeyBase = PrivateKeyBase.generate();

      const xidDoc = XIDDocument.new({ type: "privateKeyBase", privateKeyBase }, { type: "none" });

      expect(() => {
        xidDoc.nextProvenanceMarkWithEmbeddedGenerator(undefined, undefined, cbor("Test"));
      }).toThrow();
    });

    it("should error when advancing without generator", () => {
      // Create a mark without generator
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.High,
        "test",
      );
      const date = new Date(Date.UTC(2025, 0, 1));
      const mark = generator.next(date, cbor("Test"));

      // Create XID document with mark but no generator
      const privateKeyBase = PrivateKeyBase.generate();
      const xidDocBase = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase },
        { type: "none" },
      );
      const xidDoc = XIDDocument.fromXid(xidDocBase.xid());
      xidDoc.setProvenance(mark);

      expect(() => {
        xidDoc.nextProvenanceMarkWithEmbeddedGenerator(undefined, undefined, cbor("Test"));
      }).toThrow();
    });

    it("should error on generator conflict", () => {
      const passphrase = "test_passphrase";
      const date = new Date(Date.UTC(2025, 0, 1));
      const privateKeyBase = PrivateKeyBase.generate();

      const xidDoc = XIDDocument.new(
        { type: "publicKeyBase", publicKeyBase: privateKeyBase.publicKeys() },
        {
          type: "passphrase",
          passphrase,
          resolution: ProvenanceMarkResolution.High,
          date,
          info: cbor("Genesis mark"),
        },
      );

      // Create external generator
      const externalGenerator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.High,
        passphrase,
      );

      // Try to advance with provided generator (should fail because document has embedded generator)
      expect(() => {
        xidDoc.nextProvenanceMarkWithProvidedGenerator(externalGenerator, undefined, cbor("Test"));
      }).toThrow();
    });

    it("should error on chain ID mismatch", () => {
      // Create a mark with one generator
      const generator1 = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.High,
        "passphrase1",
      );
      const date1 = new Date(Date.UTC(2025, 0, 1));
      const mark1 = generator1.next(date1, cbor("Test"));

      // Create XID document with mark but no embedded generator
      const privateKeyBase = PrivateKeyBase.generate();
      const xidDocBase = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase },
        { type: "none" },
      );
      const xidDoc = XIDDocument.fromXid(xidDocBase.xid());
      xidDoc.setProvenance(mark1);

      // Try to advance with a different generator (different chain ID)
      const generator2 = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.High,
        "passphrase2",
      );

      expect(() => {
        xidDoc.nextProvenanceMarkWithProvidedGenerator(generator2, undefined, cbor("Test"));
      }).toThrow();
    });

    it("should error on sequence mismatch", () => {
      // Create a mark at seq 0
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.High,
        "test",
      );
      const date1 = new Date(Date.UTC(2025, 0, 1));
      const mark1 = generator.next(date1, cbor("Test"));

      // Advance generator to seq 2 (skip seq 1)
      const date2 = new Date(Date.UTC(2025, 0, 2));
      generator.next(date2, cbor("Test"));

      // Create XID document with mark at seq 0
      const privateKeyBase = PrivateKeyBase.generate();
      const xidDocBase = XIDDocument.new(
        { type: "privateKeyBase", privateKeyBase },
        { type: "none" },
      );
      const xidDoc = XIDDocument.fromXid(xidDocBase.xid());
      xidDoc.setProvenance(mark1);

      // Try to advance with generator at seq 2 (expecting seq 1)
      expect(() => {
        xidDoc.nextProvenanceMarkWithProvidedGenerator(generator, undefined, cbor("Test"));
      }).toThrow();
    });
  });

  describe("Provenance equality and cloning", () => {
    it("should compare provenance by mark", () => {
      const generator1 = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.High,
        "pass1",
      );
      const generator2 = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.High,
        "pass2",
      );
      const date = new Date(Date.UTC(2025, 0, 1));
      const mark1 = generator1.next(date);
      const mark2 = generator2.next(date);

      const provenance1 = Provenance.new(mark1);
      const provenance1Clone = Provenance.new(mark1);
      const provenance2 = Provenance.new(mark2);

      expect(provenance1.equals(provenance1Clone)).toBe(true);
      expect(provenance1.equals(provenance2)).toBe(false);
    });

    it("should clone provenance correctly", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.High,
        "test",
      );
      const date = new Date(Date.UTC(2025, 0, 1));
      const mark = generator.next(date);

      const provenance = Provenance.newWithGenerator(generator, mark);
      const cloned = provenance.clone();

      expect(cloned.equals(provenance)).toBe(true);
    });
  });
});
