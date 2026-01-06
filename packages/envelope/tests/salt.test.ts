import { Envelope, SALT } from "../src";

describe("Salt Extension", () => {
  describe("Basic decorrelation", () => {
    it("should make envelopes with same content have different digests", () => {
      const alice1 = Envelope.new("Alice")
        .addAssertion("email", "alice@example.com")
        .addAssertion("ssn", "123-45-6789");

      const alice2 = Envelope.new("Alice")
        .addAssertion("email", "alice@example.com")
        .addAssertion("ssn", "123-45-6789");

      expect(alice1.digest().equals(alice2.digest())).toBe(true);

      const salted1 = alice1.addSalt();
      const salted2 = alice2.addSalt();

      expect(salted1.digest().equals(salted2.digest())).toBe(false);
    });

    it("should add salt assertion to envelope", () => {
      const envelope = Envelope.new("Alice");
      const salted = envelope.addSalt();

      const hasSalt = salted.assertions().some((a) => {
        try {
          return a.asPredicate()?.asText() === SALT;
        } catch {
          return false;
        }
      });

      expect(hasSalt).toBe(true);
    });
  });

  describe("addSaltWithLength", () => {
    it("should add salt with specific length", () => {
      const envelope = Envelope.new("Hello");
      const salted = envelope.addSaltWithLength(16);

      expect(envelope.digest().equals(salted.digest())).toBe(false);
    });
  });

  describe("Error handling", () => {
    it("should throw error for salt < 8 bytes", () => {
      const envelope = Envelope.new("Hello");

      expect(() => envelope.addSaltWithLength(7)).toThrow();
    });

    it("should throw error for salt bytes < 8", () => {
      const envelope = Envelope.new("Test");
      const tooSmall = new Uint8Array([1, 2, 3, 4, 5, 6, 7]);

      expect(() => envelope.addSaltBytes(tooSmall)).toThrow();
    });

    it("should throw error for invalid range (min < 8)", () => {
      const envelope = Envelope.new("Range test");

      expect(() => envelope.addSaltInRange(7, 32)).toThrow();
    });

    it("should throw error for invalid range (max < min)", () => {
      const envelope = Envelope.new("Range test");

      expect(() => envelope.addSaltInRange(16, 10)).toThrow();
    });
  });

  describe("addSaltBytes", () => {
    it("should add specific salt bytes", () => {
      const envelope = Envelope.new("Test");
      const specificSalt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const salted = envelope.addSaltBytes(specificSalt);

      expect(envelope.digest().equals(salted.digest())).toBe(false);
    });
  });

  describe("addSaltInRange", () => {
    it("should add salt with random length in range", () => {
      const envelope = Envelope.new("Range test");
      const salted = envelope.addSaltInRange(16, 32);

      expect(envelope.digest().equals(salted.digest())).toBe(false);
    });
  });

  describe("Multiple salts", () => {
    it("should create different digests for each salt", () => {
      const base = Envelope.new("Same content");
      const salt1 = base.addSalt();
      const salt2 = base.addSalt();
      const salt3 = base.addSalt();

      expect(salt1.digest().equals(salt2.digest())).toBe(false);
      expect(salt1.digest().equals(salt3.digest())).toBe(false);
      expect(salt2.digest().equals(salt3.digest())).toBe(false);
    });
  });

  describe("SALT constant", () => {
    it("should have expected value", () => {
      expect(SALT).toBe("salt");
    });
  });

  describe("addAssertionSalted", () => {
    it("should add unsalted assertion when salted=false", () => {
      const envelope1 = Envelope.new("Alice").addAssertion("knows", "Bob");
      const envelope2 = Envelope.new("Alice").addAssertionSalted("knows", "Bob", false);

      // Should have same digest since no salt was added
      expect(envelope1.digest().equals(envelope2.digest())).toBe(true);
    });

    it("should add salted assertion when salted=true", () => {
      const envelope1 = Envelope.new("Alice").addAssertion("knows", "Bob");
      const envelope2 = Envelope.new("Alice").addAssertionSalted("knows", "Bob", true);

      // Should have different digest due to salt
      expect(envelope1.digest().equals(envelope2.digest())).toBe(false);
    });

    it("should create different digests for multiple salted assertions", () => {
      const envelope1 = Envelope.new("Alice").addAssertionSalted("knows", "Bob", true);
      const envelope2 = Envelope.new("Alice").addAssertionSalted("knows", "Bob", true);

      // Each salted assertion should be unique
      expect(envelope1.digest().equals(envelope2.digest())).toBe(false);
    });
  });

  describe("addAssertionEnvelopeSalted", () => {
    it("should add unsalted assertion envelope when salted=false", () => {
      const assertion = Envelope.newAssertion("knows", "Bob");
      const envelope1 = Envelope.new("Alice").addAssertionEnvelope(assertion);
      const envelope2 = Envelope.new("Alice").addAssertionEnvelopeSalted(assertion, false);

      // Should have same digest since no salt was added
      expect(envelope1.digest().equals(envelope2.digest())).toBe(true);
    });

    it("should add salted assertion envelope when salted=true", () => {
      const assertion = Envelope.newAssertion("knows", "Bob");
      const envelope1 = Envelope.new("Alice").addAssertionEnvelope(assertion);
      const envelope2 = Envelope.new("Alice").addAssertionEnvelopeSalted(assertion, true);

      // Should have different digest due to salt
      expect(envelope1.digest().equals(envelope2.digest())).toBe(false);
    });
  });

  describe("addOptionalAssertionEnvelopeSalted", () => {
    it("should return original envelope when assertion is undefined", () => {
      const envelope = Envelope.new("Alice");
      const result = envelope.addOptionalAssertionEnvelopeSalted(undefined, true);

      expect(envelope.digest().equals(result.digest())).toBe(true);
    });

    it("should add unsalted assertion when salted=false", () => {
      const assertion = Envelope.newAssertion("knows", "Bob");
      const envelope1 = Envelope.new("Alice").addOptionalAssertionEnvelope(assertion);
      const envelope2 = Envelope.new("Alice").addOptionalAssertionEnvelopeSalted(assertion, false);

      // Should have same digest since no salt was added
      expect(envelope1.digest().equals(envelope2.digest())).toBe(true);
    });

    it("should add salted assertion when salted=true", () => {
      const assertion = Envelope.newAssertion("knows", "Bob");
      const envelope1 = Envelope.new("Alice").addOptionalAssertionEnvelope(assertion);
      const envelope2 = Envelope.new("Alice").addOptionalAssertionEnvelopeSalted(assertion, true);

      // Should have different digest due to salt
      expect(envelope1.digest().equals(envelope2.digest())).toBe(false);
    });
  });
});
