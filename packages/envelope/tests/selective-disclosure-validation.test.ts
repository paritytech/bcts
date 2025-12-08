import { Envelope, PrivateKeyBase } from "../src";

describe("Selective Disclosure Workflow Validation", () => {
  let alice: PrivateKeyBase;
  let bob: PrivateKeyBase;
  const para1 = "Alice's confidential information: Project budget is $100,000";
  const para2 = "Bob's confidential information: Security audit report approved";
  const para3 = "Public information: Meeting scheduled for Monday at 10 AM";

  beforeAll(async () => {
    // Step 1 & 2: Generate keypairs for Alice and Bob
    alice = await PrivateKeyBase.generate();
    bob = await PrivateKeyBase.generate();
  });

  describe("Step 1-2: Keypair Generation", () => {
    it("should generate keypair for Alice", () => {
      expect(alice).toBeDefined();
      expect(alice.publicKeys().hex().length).toBeGreaterThan(0);
    });

    it("should generate keypair for Bob", () => {
      expect(bob).toBeDefined();
      expect(bob.publicKeys().hex().length).toBeGreaterThan(0);
    });
  });

  describe("Step 3-5: Paragraph Encryption", () => {
    let encryptedPara1: Envelope;
    let encryptedPara2: Envelope;
    let envelope3: Envelope;

    beforeAll(async () => {
      // Step 3: Encrypt paragraph 1 for Alice
      const envelope1 = Envelope.new(para1);
      encryptedPara1 = await envelope1.encryptSubjectToRecipient(alice.publicKeys());

      // Step 4: Encrypt paragraph 2 for Bob
      const envelope2 = Envelope.new(para2);
      encryptedPara2 = await envelope2.encryptSubjectToRecipient(bob.publicKeys());

      // Step 5: Create public paragraph (no encryption)
      envelope3 = Envelope.new(para3);
    });

    it("should encrypt paragraph 1 for Alice", () => {
      expect(encryptedPara1.subject().isEncrypted()).toBe(true);
    });

    it("should encrypt paragraph 2 for Bob", () => {
      expect(encryptedPara2.subject().isEncrypted()).toBe(true);
    });

    it("should keep paragraph 3 unencrypted", () => {
      expect(envelope3.subject().isEncrypted()).toBe(false);
    });

    describe("Step 6-7: Master Document Creation", () => {
      let masterDoc: Envelope;

      beforeAll(() => {
        // Step 6: Create master document with all 3 paragraphs
        masterDoc = Envelope.new("Master Document")
          .addAssertion("paragraph1", encryptedPara1)
          .addAssertion("paragraph2", encryptedPara2)
          .addAssertion("paragraph3", envelope3);
      });

      it("should create master document with 3 assertions", () => {
        expect(masterDoc.assertions().length).toBe(3);
      });

      it("should have all 3 paragraphs in document structure", () => {
        const assertions = masterDoc.assertions();
        const para1Assertion = assertions.find(
          (a) => a.predicate().asKnownValue() === "paragraph1",
        );
        const para2Assertion = assertions.find(
          (a) => a.predicate().asKnownValue() === "paragraph2",
        );
        const para3Assertion = assertions.find(
          (a) => a.predicate().asKnownValue() === "paragraph3",
        );

        expect(para1Assertion).toBeDefined();
        expect(para2Assertion).toBeDefined();
        expect(para3Assertion).toBeDefined();
      });

      describe("Step 8-12: Decryption and Access Control", () => {
        let para1Assertion: Envelope | undefined;
        let para2Assertion: Envelope | undefined;
        let para3Assertion: Envelope | undefined;

        beforeAll(() => {
          const assertions = masterDoc.assertions();
          para1Assertion = assertions.find((a) => a.predicate().asKnownValue() === "paragraph1");
          para2Assertion = assertions.find((a) => a.predicate().asKnownValue() === "paragraph2");
          para3Assertion = assertions.find((a) => a.predicate().asKnownValue() === "paragraph3");
        });

        it("should allow Alice to decrypt paragraph 1", async () => {
          const para1Envelope = para1Assertion.object();
          const aliceDecrypted = await para1Envelope.decryptSubjectToRecipient(alice);
          const decryptedText = aliceDecrypted.subject().asText();

          expect(decryptedText).toBe(para1);
        });

        it("should allow Bob to decrypt paragraph 2", async () => {
          const para2Envelope = para2Assertion.object();
          const bobDecrypted = await para2Envelope.decryptSubjectToRecipient(bob);
          const decryptedText = bobDecrypted.subject().asText();

          expect(decryptedText).toBe(para2);
        });

        it("should prevent Alice from decrypting Bob's paragraph", async () => {
          const para2Envelope = para2Assertion.object();
          await expect(para2Envelope.decryptSubjectToRecipient(alice)).rejects.toThrow();
        });

        it("should prevent Bob from decrypting Alice's paragraph", async () => {
          const para1Envelope = para1Assertion.object();
          await expect(para1Envelope.decryptSubjectToRecipient(bob)).rejects.toThrow();
        });

        it("should allow anyone to read public paragraph without decryption", () => {
          const para3Envelope = para3Assertion.object();
          const publicText = para3Envelope.subject().asText();

          expect(publicText).toBe(para3);
        });
      });
    });
  });

  describe("Summary: Working Command Examples", () => {
    it("demonstrates full workflow in TypeScript/JavaScript", () => {
      const workflowExample = `
// SELECTIVE DISCLOSURE WORKFLOW - TypeScript/JavaScript API

// 1. Generate keypairs
const alice = await PrivateKeyBase.generate();
const bob = await PrivateKeyBase.generate();

// 2. Create paragraphs
const para1 = "Alice's confidential information";
const para2 = "Bob's confidential information";
const para3 = "Public information";

// 3. Encrypt paragraph for Alice
const envelope1 = Envelope.new(para1);
const encryptedPara1 = await envelope1.encryptSubjectToRecipient(alice.publicKeys());

// 4. Encrypt paragraph for Bob
const envelope2 = Envelope.new(para2);
const encryptedPara2 = await envelope2.encryptSubjectToRecipient(bob.publicKeys());

// 5. Keep paragraph public
const envelope3 = Envelope.new(para3);

// 6. Create master document
const masterDoc = Envelope.new("Master Document")
  .addAssertion("paragraph1", encryptedPara1)
  .addAssertion("paragraph2", encryptedPara2)
  .addAssertion("paragraph3", envelope3);

// 7. Alice decrypts her paragraph
const para1Envelope = masterDoc.assertions()
  .find(a => a.predicate().asKnownValue() === "paragraph1")
  .object();
const aliceDecrypted = await para1Envelope.decryptSubjectToRecipient(alice);

// 8. Bob decrypts his paragraph
const para2Envelope = masterDoc.assertions()
  .find(a => a.predicate().asKnownValue() === "paragraph2")
  .object();
const bobDecrypted = await para2Envelope.decryptSubjectToRecipient(bob);

// 9. Anyone reads public paragraph
const para3Envelope = masterDoc.assertions()
  .find(a => a.predicate().asKnownValue() === "paragraph3")
  .object();
const publicText = para3Envelope.subject().asText();
      `.trim();

      // This test always passes - it's documentation
      expect(workflowExample).toBeTruthy();
      console.log("\n=== WORKING COMMAND EXAMPLES ===\n");
      console.log(workflowExample);
    });
  });
});
