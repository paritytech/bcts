#!/usr/bin/env bun
/**
 * Sealed Message Multi-Recipient Example
 *
 * This example demonstrates the "sealed message" pattern where:
 * - Data is encrypted with a symmetric key
 * - The symmetric key is then encrypted (sealed) for multiple recipients
 * - Any of the recipients can decrypt with their private key
 *
 * Use case: Store a SINGLE envelope on-chain where a GROUP of recipients
 * all have access to the same encrypted content.
 *
 * Usage: bun run apps/examples/src/sealed-message-multi-recipient.ts
 */

import { Envelope, PrivateKeyBase, SymmetricKey } from "@bcts/envelope";

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
|          SEALED MESSAGE WITH MULTIPLE RECIPIENTS                     |
|                                                                      |
|  A symmetric key encrypts the content.                               |
|  The symmetric key is then "sealed" (encrypted) for each recipient.  |
|  Any authorized recipient can unseal and decrypt.                    |
+======================================================================+
`);

  // ================================================================
  // STEP 1: Generate key pairs for recipients
  // ================================================================

  console.log("STEP 1: Generating recipient key pairs...\n");

  // Scenario: A legal document that needs to be read by multiple parties
  const aliceKeys = PrivateKeyBase.generate(); // Party A (e.g., Buyer)
  const bobKeys = PrivateKeyBase.generate(); // Party B (e.g., Seller)
  const carolKeys = PrivateKeyBase.generate(); // Party C (e.g., Notary)
  const daveKeys = PrivateKeyBase.generate(); // Party D (e.g., Lawyer)

  console.log("Generated keys for:");
  console.log(`  - Alice (Buyer):   ${aliceKeys.publicKeys().reference().shortReference("hex")}...`);
  console.log(`  - Bob (Seller):    ${bobKeys.publicKeys().reference().shortReference("hex")}...`);
  console.log(`  - Carol (Notary):  ${carolKeys.publicKeys().reference().shortReference("hex")}...`);
  console.log(`  - Dave (Lawyer):   ${daveKeys.publicKeys().reference().shortReference("hex")}...`);

  // Also create an unauthorized party
  const eveKeys = PrivateKeyBase.generate();
  console.log(`  - Eve (Attacker):  ${eveKeys.publicKeys().reference().shortReference("hex")}...`);

  // ================================================================
  // STEP 2: Create a contract document
  // ================================================================

  console.log("\n\nSTEP 2: Creating contract document...\n");

  const contract = Envelope.new("Real Estate Purchase Agreement")
    .addAssertion("propertyAddress", "456 Oak Avenue, San Francisco, CA 94110")
    .addAssertion("purchasePrice", 1500000)
    .addAssertion("buyerName", "Alice Johnson")
    .addAssertion("sellerName", "Bob Williams")
    .addAssertion("closingDate", "2025-03-15")
    .addAssertion("earnestMoney", 75000)
    .addAssertion("contingencies", "Inspection, Financing, Appraisal")
    .addAssertion("createdAt", new Date().toISOString());

  printEnvelope("ORIGINAL CONTRACT (Plaintext)", contract);

  // ================================================================
  // STEP 3: Encrypt for multiple recipients
  // ================================================================

  console.log("\n\nSTEP 3: Encrypting contract for multiple recipients...\n");

  // Method 1: Encrypt to multiple recipients at once
  const encryptedContract = contract.encryptToRecipients([
    aliceKeys.publicKeys(),
    bobKeys.publicKeys(),
    carolKeys.publicKeys(),
    daveKeys.publicKeys(),
  ]);

  console.log("Contract encrypted for 4 recipients:");
  console.log("  - Alice (Buyer)");
  console.log("  - Bob (Seller)");
  console.log("  - Carol (Notary)");
  console.log("  - Dave (Lawyer)");

  printEnvelope("ENCRYPTED CONTRACT (Stored on Blockchain)", encryptedContract);

  const contractBytes = encryptedContract.cborBytes();
  console.log(`\nSerialized size: ${contractBytes.length} bytes`);
  console.log(`Contract digest: ${encryptedContract.digest().hex()}`);

  // Count recipients
  const recipients = encryptedContract.recipients();
  console.log(`Number of recipient seals: ${recipients.length}`);

  // ================================================================
  // STEP 4: Each authorized recipient decrypts
  // ================================================================

  console.log(`\n\n${"=".repeat(70)}`);
  console.log("STEP 4: AUTHORIZED RECIPIENTS DECRYPT");
  console.log(`${"=".repeat(70)}`);

  // Alice decrypts
  console.log("\n ALICE (Buyer) decrypts with her private key:");
  try {
    const aliceView = encryptedContract.decryptToRecipient(aliceKeys);
    console.log(`   SUCCESS! Alice can read the contract.`);
    console.log(`   Property: ${aliceView.objectForPredicate("propertyAddress").extractString()}`);
    console.log(
      `   Price: $${aliceView.objectForPredicate("purchasePrice").extractNumber().toLocaleString()}`,
    );
  } catch (error: unknown) {
    console.log(`   FAILED: ${String(error)}`);
  }

  // Bob decrypts
  console.log("\n BOB (Seller) decrypts with his private key:");
  try {
    const bobView = encryptedContract.decryptToRecipient(bobKeys);
    console.log(`   SUCCESS! Bob can read the contract.`);
    console.log(`   Property: ${bobView.objectForPredicate("propertyAddress").extractString()}`);
    console.log(`   Closing Date: ${bobView.objectForPredicate("closingDate").extractString()}`);
  } catch (error: unknown) {
    console.log(`   FAILED: ${String(error)}`);
  }

  // Carol decrypts
  console.log("\n CAROL (Notary) decrypts with her private key:");
  try {
    const carolView = encryptedContract.decryptToRecipient(carolKeys);
    console.log(`   SUCCESS! Carol can read the contract.`);
    console.log(`   Buyer: ${carolView.objectForPredicate("buyerName").extractString()}`);
    console.log(`   Seller: ${carolView.objectForPredicate("sellerName").extractString()}`);
  } catch (error: unknown) {
    console.log(`   FAILED: ${String(error)}`);
  }

  // Dave decrypts
  console.log("\n DAVE (Lawyer) decrypts with his private key:");
  try {
    const daveView = encryptedContract.decryptToRecipient(daveKeys);
    console.log(`   SUCCESS! Dave can read the contract.`);
    console.log(
      `   Contingencies: ${daveView.objectForPredicate("contingencies").extractString()}`,
    );
    console.log(
      `   Earnest Money: $${daveView.objectForPredicate("earnestMoney").extractNumber().toLocaleString()}`,
    );
  } catch (error: unknown) {
    console.log(`   FAILED: ${String(error)}`);
  }

  // ================================================================
  // STEP 5: Unauthorized party cannot decrypt
  // ================================================================

  console.log(`\n\n${"=".repeat(70)}`);
  console.log("STEP 5: UNAUTHORIZED PARTY ATTEMPTS DECRYPTION");
  console.log(`${"=".repeat(70)}`);

  console.log("\n EVE (Attacker) tries to decrypt with her private key:");
  try {
    encryptedContract.decryptToRecipient(eveKeys);
    console.log(`   UNEXPECTED: Eve decrypted the contract!`);
  } catch {
    console.log(`   BLOCKED: Eve cannot decrypt - she is not a recipient.`);
    console.log(`   (The sealed message cannot be opened with her key)`);
  }

  // ================================================================
  // STEP 6: Adding a recipient later (if you have the content key)
  // ================================================================

  console.log(`\n\n${"=".repeat(70)}`);
  console.log("STEP 6: ADDING A NEW RECIPIENT (Requires Content Key)");
  console.log(`${"=".repeat(70)}`);

  console.log(`
  Note: To add a new recipient to an already-encrypted envelope,
  you need the original symmetric content key. This is a security
  feature - only those who encrypted the content can add recipients.

  In practice, the content key would be held by an authorized party
  (e.g., the document creator or a key management system).
`);

  // Demonstrate manual recipient addition
  console.log("  Creating a new encrypted envelope with manual recipient management:");

  // Generate a content key
  const contentKey = SymmetricKey.new();
  console.log(
    `  Generated content key: ${Buffer.from(contentKey.data()).toString("hex").slice(0, 16)}...`,
  );

  // Encrypt with the content key
  let manualEncrypted = contract.encrypt(contentKey);

  // Add recipients one by one
  manualEncrypted = manualEncrypted.addRecipient(aliceKeys.publicKeys(), contentKey);
  manualEncrypted = manualEncrypted.addRecipient(bobKeys.publicKeys(), contentKey);
  console.log("  Added Alice and Bob as recipients.");

  // Later, add Eve as an authorized recipient (if the content keyholder allows it)
  manualEncrypted = manualEncrypted.addRecipient(eveKeys.publicKeys(), contentKey);
  console.log("  Added Eve as a new recipient (authorized by content key holder).");

  // Now Eve can decrypt
  console.log("\n EVE (Now Authorized) decrypts:");
  try {
    const eveView = manualEncrypted.decryptToRecipient(eveKeys);
    console.log(`   SUCCESS! Eve can now read the contract.`);
    console.log(`   Property: ${eveView.objectForPredicate("propertyAddress").extractString()}`);
  } catch (error: unknown) {
    console.log(`   FAILED: ${String(error)}`);
  }

  // ================================================================
  // SUMMARY
  // ================================================================

  console.log(`
+======================================================================+
|                           SUMMARY                                    |
+======================================================================+

  Single envelope stored on-chain: YES (${contractBytes.length} bytes)
  Digest (for verification):        ${encryptedContract.digest().hex().slice(0, 32)}...
  Number of recipients:             ${recipients.length}

  How Sealed Message Works:
  +------------------------------------------------------------------+
  | 1. Content is encrypted with a random symmetric key (ChaCha20)   |
  | 2. The symmetric key is "sealed" for each recipient:             |
  |    - Ephemeral X25519 key pair generated                         |
  |    - ECDH with recipient's public key -> shared secret           |
  |    - Derive encryption key from shared secret (HKDF)             |
  |    - Encrypt symmetric key with derived key                      |
  | 3. Each sealed key is stored as a "hasRecipient" assertion       |
  | 4. Any recipient can unseal the symmetric key and decrypt        |
  +------------------------------------------------------------------+

  Security Properties:
  - Forward secrecy: Ephemeral keys per recipient
  - No key revelation: Recipients don't learn each other's keys
  - Efficient: Content encrypted once, key sealed per recipient
  - Extensible: New recipients can be added (with content key)

  Comparison with Per-Assertion Encryption:
  +----------------------+------------------+------------------+
  | Feature              | Sealed Message   | Per-Assertion    |
  +----------------------+------------------+------------------+
  | Content visibility   | All or nothing   | Granular         |
  | Recipients see       | Same content     | Different data   |
  | Use case             | Shared document  | Access control   |
  | Overhead             | Lower            | Higher           |
  +----------------------+------------------+------------------+

+======================================================================+
`);
}

main();
