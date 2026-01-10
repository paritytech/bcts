#!/usr/bin/env bun
/**
 * Per-Assertion Encryption Example
 *
 * This example demonstrates encrypting individual assertions for different recipients.
 * Each recipient can only decrypt the assertions meant for them.
 *
 * Use case: Store a SINGLE envelope on-chain where different parties can read
 * only their authorized portions.
 *
 * Usage: bun run apps/examples/src/per-assertion-encryption.ts
 */

import { Envelope, PrivateKeyBase } from "@bcts/envelope";

// Helper to print envelope structure
function printEnvelope(name: string, envelope: Envelope): void {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`${name}`);
  console.log(`${"=".repeat(70)}`);
  console.log(envelope.treeFormat());
}

function main(): void {
  console.log(`
+======================================================================+
|           PER-ASSERTION ENCRYPTION FOR MULTIPLE RECIPIENTS           |
|                                                                      |
|  Each assertion is encrypted for its specific recipient.             |
|  Only one envelope is stored, but different parties can only         |
|  decrypt the data meant for them.                                    |
+======================================================================+
`);

  // ================================================================
  // STEP 1: Generate key pairs for each recipient
  // ================================================================

  console.log("STEP 1: Generating recipient key pairs...\n");

  const barKeys = PrivateKeyBase.generate();
  const employerKeys = PrivateKeyBase.generate();
  const bankKeys = PrivateKeyBase.generate();
  const medicalKeys = PrivateKeyBase.generate();
  const deliveryKeys = PrivateKeyBase.generate();

  console.log("Generated keys for:");
  console.log(`  - Bar/Club:     ${barKeys.publicKeys().reference().shortReference("hex")}...`);
  console.log(`  - Employer:     ${employerKeys.publicKeys().reference().shortReference("hex")}...`);
  console.log(`  - Bank:         ${bankKeys.publicKeys().reference().shortReference("hex")}...`);
  console.log(`  - Medical:      ${medicalKeys.publicKeys().reference().shortReference("hex")}...`);
  console.log(`  - Delivery:     ${deliveryKeys.publicKeys().reference().shortReference("hex")}...`);

  // ================================================================
  // STEP 2: Create encrypted assertions for each recipient
  // ================================================================

  console.log("\n\nSTEP 2: Creating encrypted assertions...\n");

  // Helper function to create an encrypted assertion
  function createEncryptedAssertion(
    predicate: string,
    value: string | number,
    recipientPublicKey: ReturnType<typeof barKeys.publicKeys>,
  ): Envelope {
    // Create the assertion value envelope and encrypt it for the recipient
    const valueEnvelope = Envelope.new(value);
    const encryptedValue = valueEnvelope.encryptSubjectToRecipient(recipientPublicKey);
    return Envelope.newAssertion(predicate, encryptedValue);
  }

  // Create the identity envelope with the subject in plaintext
  // (everyone can see WHO this is about)
  let identity = Envelope.new("John Smith");

  // Add encrypted assertions for BAR (age verification)
  console.log("  Encrypting age for Bar/Club...");
  identity = identity.addAssertionEnvelope(
    createEncryptedAssertion("age", 39, barKeys.publicKeys()),
  );

  // Add encrypted assertions for EMPLOYER
  console.log("  Encrypting employment info for Employer...");
  identity = identity.addAssertionEnvelope(
    createEncryptedAssertion("employer", "Tech Corp Inc.", employerKeys.publicKeys()),
  );
  identity = identity.addAssertionEnvelope(
    createEncryptedAssertion("jobTitle", "Senior Engineer", employerKeys.publicKeys()),
  );
  identity = identity.addAssertionEnvelope(
    createEncryptedAssertion("employeeId", "EMP-2024-1234", employerKeys.publicKeys()),
  );

  // Add encrypted assertions for BANK
  console.log("  Encrypting financial info for Bank...");
  identity = identity.addAssertionEnvelope(
    createEncryptedAssertion("ssn", "123-45-6789", bankKeys.publicKeys()),
  );
  identity = identity.addAssertionEnvelope(
    createEncryptedAssertion("annualIncome", 150000, bankKeys.publicKeys()),
  );
  identity = identity.addAssertionEnvelope(
    createEncryptedAssertion("creditScore", 780, bankKeys.publicKeys()),
  );

  // Add encrypted assertions for MEDICAL
  console.log("  Encrypting medical info for Medical Provider...");
  identity = identity.addAssertionEnvelope(
    createEncryptedAssertion("dateOfBirth", "1985-03-15", medicalKeys.publicKeys()),
  );
  identity = identity.addAssertionEnvelope(
    createEncryptedAssertion("bloodType", "O+", medicalKeys.publicKeys()),
  );
  identity = identity.addAssertionEnvelope(
    createEncryptedAssertion("allergies", "Penicillin", medicalKeys.publicKeys()),
  );

  // Add encrypted assertions for DELIVERY
  console.log("  Encrypting delivery info for Delivery Service...");
  identity = identity.addAssertionEnvelope(
    createEncryptedAssertion("phone", "+1-555-123-4567", deliveryKeys.publicKeys()),
  );
  identity = identity.addAssertionEnvelope(
    createEncryptedAssertion(
      "address",
      "123 Main St, San Francisco, CA 94102",
      deliveryKeys.publicKeys(),
    ),
  );

  // ================================================================
  // STEP 3: Display the encrypted envelope (what gets stored on-chain)
  // ================================================================

  printEnvelope("STEP 3: ENCRYPTED ENVELOPE (Stored on Blockchain)", identity);

  const envelopeBytes = identity.cborBytes();
  console.log(`\nSerialized size: ${envelopeBytes.length} bytes`);
  console.log(`Envelope digest: ${identity.digest().hex()}`);

  // ================================================================
  // STEP 4: Demonstrate decryption by each recipient
  // ================================================================

  console.log(`\n\n${"=".repeat(70)}`);
  console.log("STEP 4: RECIPIENT DECRYPTION DEMONSTRATION");
  console.log(`${"=".repeat(70)}`);

  // Helper to find and decrypt an assertion for a recipient
  function decryptAssertionForRecipient(
    envelope: Envelope,
    predicate: string,
    recipientKeys: PrivateKeyBase,
  ): string | number | null {
    try {
      const assertion = envelope.assertionWithPredicate(predicate);
      const encryptedObject = assertion.tryObject();
      if (encryptedObject !== undefined) {
        // The object is a NODE with encrypted subject + hasRecipient assertion
        // Try to decrypt it - will throw if we're not the right recipient
        const decrypted = encryptedObject.decryptSubjectToRecipient(recipientKeys);
        // After decryption, get the subject value
        const subject = decrypted.subject();
        // Try to extract the value as text or number
        try {
          return subject.extractString();
        } catch {
          try {
            return subject.extractNumber();
          } catch {
            return "[decrypted]";
          }
        }
      }
      return null;
    } catch {
      // Decryption failed - not authorized for this assertion
      return null;
    }
  }

  // BAR decrypts their data
  console.log("\n BAR/CLUB decrypts with their private key:");
  const barAge = decryptAssertionForRecipient(identity, "age", barKeys);
  console.log(`   age: ${barAge}`);
  const barSsn = decryptAssertionForRecipient(identity, "ssn", barKeys);
  console.log(`   ssn: ${barSsn ?? "CANNOT DECRYPT (not authorized)"}`);

  // EMPLOYER decrypts their data
  console.log("\n EMPLOYER decrypts with their private key:");
  const empEmployer = decryptAssertionForRecipient(identity, "employer", employerKeys);
  const empTitle = decryptAssertionForRecipient(identity, "jobTitle", employerKeys);
  const empId = decryptAssertionForRecipient(identity, "employeeId", employerKeys);
  console.log(`   employer: ${empEmployer}`);
  console.log(`   jobTitle: ${empTitle}`);
  console.log(`   employeeId: ${empId}`);
  const empSsn = decryptAssertionForRecipient(identity, "ssn", employerKeys);
  console.log(`   ssn: ${empSsn ?? "CANNOT DECRYPT (not authorized)"}`);

  // BANK decrypts their data
  console.log("\n BANK decrypts with their private key:");
  const bankSsn = decryptAssertionForRecipient(identity, "ssn", bankKeys);
  const bankIncome = decryptAssertionForRecipient(identity, "annualIncome", bankKeys);
  const bankCredit = decryptAssertionForRecipient(identity, "creditScore", bankKeys);
  console.log(`   ssn: ${bankSsn}`);
  console.log(`   annualIncome: ${bankIncome}`);
  console.log(`   creditScore: ${bankCredit}`);
  const bankMedical = decryptAssertionForRecipient(identity, "bloodType", bankKeys);
  console.log(`   bloodType: ${bankMedical ?? "CANNOT DECRYPT (not authorized)"}`);

  // MEDICAL decrypts their data
  console.log("\n MEDICAL PROVIDER decrypts with their private key:");
  const medDob = decryptAssertionForRecipient(identity, "dateOfBirth", medicalKeys);
  const medBlood = decryptAssertionForRecipient(identity, "bloodType", medicalKeys);
  const medAllergies = decryptAssertionForRecipient(identity, "allergies", medicalKeys);
  console.log(`   dateOfBirth: ${medDob}`);
  console.log(`   bloodType: ${medBlood}`);
  console.log(`   allergies: ${medAllergies}`);

  // DELIVERY decrypts their data
  console.log("\n DELIVERY SERVICE decrypts with their private key:");
  const delPhone = decryptAssertionForRecipient(identity, "phone", deliveryKeys);
  const delAddress = decryptAssertionForRecipient(identity, "address", deliveryKeys);
  console.log(`   phone: ${delPhone}`);
  console.log(`   address: ${delAddress}`);
  const delIncome = decryptAssertionForRecipient(identity, "annualIncome", deliveryKeys);
  console.log(`   annualIncome: ${delIncome ?? "CANNOT DECRYPT (not authorized)"}`);

  // ================================================================
  // SUMMARY
  // ================================================================

  console.log(`
+======================================================================+
|                           SUMMARY                                    |
+======================================================================+

  Single envelope stored on-chain: YES (${envelopeBytes.length} bytes)
  Digest (for verification):        ${identity.digest().hex().slice(0, 32)}...

  What each recipient can see:
  +------------------+---------------------------------------------+
  | Recipient        | Accessible Data                             |
  +------------------+---------------------------------------------+
  | Everyone         | Subject: "John Smith"                       |
  | Bar/Club         | age                                         |
  | Employer         | employer, jobTitle, employeeId              |
  | Bank             | ssn, annualIncome, creditScore              |
  | Medical          | dateOfBirth, bloodType, allergies           |
  | Delivery         | phone, address                              |
  +------------------+---------------------------------------------+

  Key Benefits:
  - ONE envelope stored on blockchain
  - Each recipient only decrypts their data
  - Predicates (field names) are visible to all
  - Values are encrypted per-recipient
  - Forward secrecy via ephemeral keys

+======================================================================+
`);
}

main();
