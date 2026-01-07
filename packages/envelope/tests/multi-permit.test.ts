import { describe, it, expect, beforeEach } from "vitest";
import { Envelope, SymmetricKey, PrivateKeyBase, SigningPrivateKey } from "../src";
import { KeyDerivationMethod, SSKRSpec, SSKRGroupSpec } from "@bcts/components";

/**
 * Multi-permit tests - TypeScript port of bc-envelope-rust/tests/multi_permit_tests.rs
 *
 * These tests demonstrate how to create envelopes with multiple "permits" that
 * can unlock the same encrypted content. A permit is a method by which an
 * envelope can be decrypted, including:
 * - Direct symmetric key decryption
 * - Password-based decryption (using key derivation functions)
 * - Public-key-based decryption (recipients)
 * - SSKR share-based decryption (social recovery)
 */
describe("Multi-Permit", () => {
  /**
   * Main multi-permit test demonstrating multiple unlock methods for the same envelope.
   *
   * Note: This test uses encryptSubject() which encrypts only the subject,
   * as the TypeScript sskrJoin implementation works with subject-level encryption.
   * The Rust version uses encrypt() which wraps and encrypts the whole envelope.
   */
  it("should support multiple unlock methods for the same envelope", () => {
    //
    // Alice composes a poem.
    //
    const poemText = "At midnight, the clocks sang lullabies to the wandering teacups.";

    //
    // Alice creates a new envelope and assigns the text as the envelope's
    // subject. She also adds some metadata assertions to the envelope,
    // including that the subject is a "poem", the title, the author, and
    // the date.
    //
    const originalEnvelope = Envelope.new(poemText)
      .addType("poem")
      .addAssertion("title", "A Song of Ice Cream")
      .addAssertion("author", "Plonkus the Iridescent")
      .addAssertion("date", "2025-05-15");

    //
    // Alice signs the envelope with her private key.
    //
    const aliceSigningKey = SigningPrivateKey.generate();
    const alicePublicKey = aliceSigningKey.publicKey();
    const signedEnvelope = originalEnvelope.addSignature(aliceSigningKey);

    // Verify the signed envelope format contains expected elements
    const signedFormat = signedEnvelope.format();
    expect(signedFormat).toContain("At midnight, the clocks sang lullabies");
    expect(signedFormat).toContain("isA");
    expect(signedFormat).toContain("poem");
    expect(signedFormat).toContain("author");
    expect(signedFormat).toContain("Plonkus the Iridescent");
    expect(signedFormat).toContain("title");
    expect(signedFormat).toContain("A Song of Ice Cream");
    expect(signedFormat).toContain("signed");

    //
    // Alice picks a random symmetric "content key" and uses it to encrypt the
    // envelope's subject. She will provide several different methods ("permits")
    // that can be used to unlock it. Each permit encrypts the same content key
    // using a different method.
    //
    // Note: We use encryptSubject() here as the TypeScript SSKR implementation
    // works with subject-level encryption. The assertions remain visible.
    //
    const contentKey = SymmetricKey.generate();
    const encryptedEnvelope = signedEnvelope.encryptSubject(contentKey);

    // The envelope shows ENCRYPTED for the subject but assertions are preserved
    expect(encryptedEnvelope.subject().isEncrypted()).toBe(true);
    expect(encryptedEnvelope.assertions().length).toBeGreaterThan(0);

    //
    // Alice wants to be able to recover the envelope later using a password she
    // can remember. So she adds the first permit to the envelope by using the
    // `addSecret()` method, providing a derivation method `Argon2id`, her
    // password, and the content key. The `addSecret()` method encrypts the
    // content key with a key derived from her password, and adds it to the
    // envelope as a `'hasSecret'` assertion.
    //
    const password = new TextEncoder().encode("unicorns_dance_on_mars_while_eating_pizza");
    const lockedEnvelope = encryptedEnvelope.addSecret(
      KeyDerivationMethod.Argon2id,
      password,
      contentKey,
    );

    const lockedFormat = lockedEnvelope.format();
    expect(lockedFormat).toContain("ENCRYPTED");
    expect(lockedFormat).toContain("hasSecret");

    //
    // Next, Alice wants to be able to unlock her envelope using her private
    // key, and she also wants Bob to be able to unlock it using his private
    // key. To do this, she uses the `addRecipient()` method, which
    // encrypts the content key with the public keys of Alice and Bob.
    //
    const aliceKeys = PrivateKeyBase.generate();
    const bobKeys = PrivateKeyBase.generate();

    const lockedWithRecipients = lockedEnvelope
      .addRecipient(aliceKeys.publicKeys(), contentKey)
      .addRecipient(bobKeys.publicKeys(), contentKey);

    const recipientFormat = lockedWithRecipients.format();
    expect(recipientFormat).toContain("ENCRYPTED");
    expect(recipientFormat).toContain("hasRecipient");
    expect(recipientFormat).toContain("hasSecret");

    //
    // An SSKR share is a kind of permit defined by the characteristic that one
    // share by itself is not enough to unlock the envelope: some quorum of
    // shares is required.
    //
    // Alice wants to back up her poem using a social recovery scheme. So even
    // if she forgets her password and loses her private key, she can still
    // recover the envelope by finding two of the three friends she entrusted
    // with the shares.
    //
    // So Alice creates a 2-of-3 SSKR group and "shards" the envelope into three
    // envelopes, each containing a unique SSKR share.
    //
    const sskrGroup = SSKRGroupSpec.new(2, 3);
    const spec = SSKRSpec.new(1, [sskrGroup]);
    const shardedEnvelopes = lockedWithRecipients.sskrSplitFlattened(spec, contentKey);

    // Should have 3 sharded envelopes
    expect(shardedEnvelopes.length).toBe(3);

    //
    // Every envelope looks the same including the previous permits Alice added,
    // but each one contains a different SSKR share, so we only show the first
    // one here.
    //
    const shardedFormat = shardedEnvelopes[0].format();
    expect(shardedFormat).toContain("ENCRYPTED");
    expect(shardedFormat).toContain("hasRecipient");
    expect(shardedFormat).toContain("hasSecret");
    expect(shardedFormat).toContain("sskrShare");

    //
    // So now there are three envelopes, and five different ways to unlock
    // them:
    //
    // 1. Using her original content key (usually not saved, but could be stored
    //    in a safe place)
    // 2. Using her password
    // 3. Using her private key
    // 4. Using Bob's private key
    // 5. Using any two of the three SSKR shares
    //

    //
    // Using the content key.
    //
    const receivedEnvelope = shardedEnvelopes[0];
    const unlockedWithKey = receivedEnvelope.decryptSubject(contentKey);
    expect(unlockedWithKey.subject().asText()).toBe(poemText);

    //
    // Using the password and the Argon2id method.
    //
    const unlockedWithPassword = receivedEnvelope.unlockSubject(password);
    expect(unlockedWithPassword.subject().asText()).toBe(poemText);

    //
    // Using Alice's private key.
    //
    const unlockedWithAliceKey = receivedEnvelope.decryptSubjectToRecipient(aliceKeys);
    expect(unlockedWithAliceKey.subject().asText()).toBe(poemText);

    //
    // Using Bob's private key.
    //
    const unlockedWithBobKey = receivedEnvelope.decryptSubjectToRecipient(bobKeys);
    expect(unlockedWithBobKey.subject().asText()).toBe(poemText);

    //
    // Using any two of the three SSKR shares.
    //
    const unlockedWithShares = (
      Envelope as unknown as { sskrJoin: (e: Envelope[]) => Envelope }
    ).sskrJoin([shardedEnvelopes[0], shardedEnvelopes[2]]);

    // The sskrJoin returns the decrypted subject directly
    expect(unlockedWithShares.asText()).toBe(poemText);

    // Verify the signature on one of the unlocked envelopes
    expect(unlockedWithPassword.hasSignatureFrom(alicePublicKey)).toBe(true);
    const verified = unlockedWithPassword.verifySignatureFrom(alicePublicKey);
    expect(verified.subject().asText()).toBe(poemText);
  });

  describe("Individual permit types", () => {
    const testContent = "Secret message for multiple unlock methods";
    let contentKey: SymmetricKey;
    let envelope: Envelope;
    let encryptedEnvelope: Envelope;

    beforeEach(() => {
      contentKey = SymmetricKey.generate();
      envelope = Envelope.new(testContent);
      // Use encryptSubject for subject-only encryption (compatible with SSKR)
      encryptedEnvelope = envelope.encryptSubject(contentKey);
    });

    it("should unlock with direct content key", () => {
      const decrypted = encryptedEnvelope.decryptSubject(contentKey);
      expect(decrypted.asText()).toBe(testContent);
    });

    it("should unlock with password using HKDF", () => {
      const password = new TextEncoder().encode("my-secret-password");
      const locked = encryptedEnvelope.addSecret(KeyDerivationMethod.HKDF, password, contentKey);

      const unlocked = locked.unlockSubject(password);
      // unlocked is a node envelope (with hasSecret assertion), access subject for text
      expect(unlocked.subject().asText()).toBe(testContent);
    });

    it("should unlock with password using Argon2id", () => {
      const password = new TextEncoder().encode("argon2-password");
      const locked = encryptedEnvelope.addSecret(
        KeyDerivationMethod.Argon2id,
        password,
        contentKey,
      );

      const unlocked = locked.unlockSubject(password);
      expect(unlocked.subject().asText()).toBe(testContent);
    });

    it("should unlock with password using PBKDF2", () => {
      const password = new TextEncoder().encode("pbkdf2-password");
      const locked = encryptedEnvelope.addSecret(KeyDerivationMethod.PBKDF2, password, contentKey);

      const unlocked = locked.unlockSubject(password);
      expect(unlocked.subject().asText()).toBe(testContent);
    });

    it("should unlock with password using Scrypt", () => {
      const password = new TextEncoder().encode("scrypt-password");
      const locked = encryptedEnvelope.addSecret(KeyDerivationMethod.Scrypt, password, contentKey);

      const unlocked = locked.unlockSubject(password);
      expect(unlocked.subject().asText()).toBe(testContent);
    });

    it("should unlock with recipient private key", () => {
      const recipient = PrivateKeyBase.generate();
      const locked = encryptedEnvelope.addRecipient(recipient.publicKeys(), contentKey);

      const unlocked = locked.decryptSubjectToRecipient(recipient);
      // decryptSubjectToRecipient returns the envelope with decrypted subject
      expect(unlocked.subject().asText()).toBe(testContent);
    });

    it("should unlock with SSKR shares (2-of-3)", () => {
      const spec = SSKRSpec.new(1, [SSKRGroupSpec.new(2, 3)]);
      const shares = encryptedEnvelope.sskrSplitFlattened(spec, contentKey);

      expect(shares.length).toBe(3);

      // Any 2 shares should work
      const recovered = (Envelope as unknown as { sskrJoin: (e: Envelope[]) => Envelope }).sskrJoin(
        [shares[0], shares[1]],
      );

      // sskrJoin returns the decrypted subject directly
      expect(recovered.asText()).toBe(testContent);
    });
  });

  describe("Multiple permits on same envelope", () => {
    it("should support multiple password-based secrets", () => {
      const envelope = Envelope.new("Multi-secret content");
      const contentKey = SymmetricKey.generate();
      // Use encryptSubject for subject-only encryption
      const encrypted = envelope.encryptSubject(contentKey);

      const password1 = new TextEncoder().encode("password-one");
      const password2 = new TextEncoder().encode("password-two");
      const password3 = new TextEncoder().encode("password-three");

      const multiSecret = encrypted
        .addSecret(KeyDerivationMethod.HKDF, password1, contentKey)
        .addSecret(KeyDerivationMethod.HKDF, password2, contentKey)
        .addSecret(KeyDerivationMethod.HKDF, password3, contentKey);

      // All passwords should work - unlockSubject returns node envelope, access subject
      expect(multiSecret.unlockSubject(password1).subject().asText()).toBe("Multi-secret content");
      expect(multiSecret.unlockSubject(password2).subject().asText()).toBe("Multi-secret content");
      expect(multiSecret.unlockSubject(password3).subject().asText()).toBe("Multi-secret content");
    });

    it("should support multiple recipients", () => {
      const envelope = Envelope.new("Multi-recipient content");
      const contentKey = SymmetricKey.generate();
      // Use encryptSubject for subject-only encryption
      const encrypted = envelope.encryptSubject(contentKey);

      const alice = PrivateKeyBase.generate();
      const bob = PrivateKeyBase.generate();
      const charlie = PrivateKeyBase.generate();

      const multiRecipient = encrypted
        .addRecipient(alice.publicKeys(), contentKey)
        .addRecipient(bob.publicKeys(), contentKey)
        .addRecipient(charlie.publicKeys(), contentKey);

      expect(multiRecipient.recipients().length).toBe(3);

      // All recipients should be able to decrypt - access subject for text
      expect(multiRecipient.decryptSubjectToRecipient(alice).subject().asText()).toBe(
        "Multi-recipient content",
      );
      expect(multiRecipient.decryptSubjectToRecipient(bob).subject().asText()).toBe(
        "Multi-recipient content",
      );
      expect(multiRecipient.decryptSubjectToRecipient(charlie).subject().asText()).toBe(
        "Multi-recipient content",
      );
    });

    it("should support mixed permit types", () => {
      // For SSKR compatibility, use a simple envelope with encryptSubject
      const envelope = Envelope.new("Mixed permit content");
      const contentKey = SymmetricKey.generate();
      // Use encryptSubject for subject-only encryption (compatible with SSKR)
      const encrypted = envelope.encryptSubject(contentKey);

      const password = new TextEncoder().encode("backup-password");
      const alice = PrivateKeyBase.generate();

      const sskrSpec = SSKRSpec.new(1, [SSKRGroupSpec.new(2, 3)]);

      // Add password permit
      const withPassword = encrypted.addSecret(KeyDerivationMethod.Argon2id, password, contentKey);

      // Add recipient permit
      const withRecipient = withPassword.addRecipient(alice.publicKeys(), contentKey);

      // Add SSKR permits
      const shares = withRecipient.sskrSplitFlattened(sskrSpec, contentKey);

      // Verify all unlocking methods work
      const share = shares[0];

      // Password unlock - returns node envelope, access subject
      const fromPassword = share.unlockSubject(password);
      expect(fromPassword.subject().asText()).toBe("Mixed permit content");

      // Recipient unlock - returns node envelope, access subject
      const fromRecipient = share.decryptSubjectToRecipient(alice);
      expect(fromRecipient.subject().asText()).toBe("Mixed permit content");

      // SSKR unlock - sskrJoin returns the decrypted subject directly
      const fromSskr = (Envelope as unknown as { sskrJoin: (e: Envelope[]) => Envelope }).sskrJoin([
        shares[1],
        shares[2],
      ]);
      expect(fromSskr.asText()).toBe("Mixed permit content");
    });
  });

  describe("Error cases", () => {
    it("should fail with wrong password", () => {
      const envelope = Envelope.new("Secret");
      const contentKey = SymmetricKey.generate();
      const encrypted = envelope.encryptSubject(contentKey);

      const correctPassword = new TextEncoder().encode("correct");
      const wrongPassword = new TextEncoder().encode("wrong");

      const locked = encrypted.addSecret(KeyDerivationMethod.HKDF, correctPassword, contentKey);

      expect(() => locked.unlockSubject(wrongPassword)).toThrow();
    });

    it("should fail with wrong recipient key", () => {
      const envelope = Envelope.new("Secret");
      const contentKey = SymmetricKey.generate();
      const encrypted = envelope.encryptSubject(contentKey);

      const alice = PrivateKeyBase.generate();
      const bob = PrivateKeyBase.generate();

      const locked = encrypted.addRecipient(alice.publicKeys(), contentKey);

      expect(() => locked.decryptSubjectToRecipient(bob)).toThrow();
    });

    it("should fail with insufficient SSKR shares", () => {
      const envelope = Envelope.new("Secret");
      const contentKey = SymmetricKey.generate();
      const encrypted = envelope.encryptSubject(contentKey);

      const spec = SSKRSpec.new(1, [SSKRGroupSpec.new(2, 3)]);
      const shares = encrypted.sskrSplitFlattened(spec, contentKey);

      // Only 1 share is not enough for 2-of-3
      expect(() =>
        (Envelope as unknown as { sskrJoin: (e: Envelope[]) => Envelope }).sskrJoin([shares[0]]),
      ).toThrow();
    });
  });

  describe("Signed and encrypted workflow", () => {
    it("should verify signature after decryption", () => {
      const signingKey = SigningPrivateKey.generate();
      const publicKey = signingKey.publicKey();

      const document = Envelope.new("Legal contract")
        .addAssertion("parties", "Alice and Bob")
        .addAssertion("date", "2025-01-01")
        .addSignature(signingKey);

      const contentKey = SymmetricKey.generate();
      // Use encryptSubject to encrypt only the subject, preserving assertions
      const encrypted = document.encryptSubject(contentKey);

      const password = new TextEncoder().encode("contract-password");
      const locked = encrypted.addSecret(KeyDerivationMethod.HKDF, password, contentKey);

      // Unlock and verify
      const unlocked = locked.unlockSubject(password);
      expect(unlocked.hasSignatureFrom(publicKey)).toBe(true);

      const verified = unlocked.verifySignatureFrom(publicKey);
      expect(verified.subject().asText()).toBe("Legal contract");
    });

    it("should preserve all assertions through encrypt/decrypt cycle", () => {
      const envelope = Envelope.new("Data")
        .addType("Document")
        .addAssertion("author", "Alice")
        .addAssertion("created", "2025-01-01")
        .addAssertion("version", 1);

      const contentKey = SymmetricKey.generate();
      // Use encryptSubject to encrypt only the subject
      const encrypted = envelope.encryptSubject(contentKey);
      const decrypted = encrypted.decryptSubject(contentKey);

      // Subject-level encryption preserves the envelope structure
      expect(decrypted.digest().equals(envelope.digest())).toBe(true);
      expect(decrypted.hasType("Document")).toBe(true);
      expect(decrypted.objectForPredicate("author").extractString()).toBe("Alice");
      expect(decrypted.objectForPredicate("version").extractNumber()).toBe(1);
    });
  });
});
