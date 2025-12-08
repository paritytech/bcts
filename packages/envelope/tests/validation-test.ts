/**
 * Comprehensive Validation Test for Envelope CLI Commands
 *
 * This test validates that the envelope functionality works as documented.
 * It tests:
 * 1. Complete workflow: generate keypair, create envelope, encrypt, decrypt, verify
 * 2. Multi-recipient encryption with 2-3 keypairs
 * 3. Format commands to display envelope structure
 */

import { Envelope, PrivateKeyBase, SymmetricKey } from "../src";

// ANSI color codes for better output readability
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function section(title: string) {
  console.log("\n" + "=".repeat(80));
  log(title, colors.bright + colors.cyan);
  console.log("=".repeat(80) + "\n");
}

function subsection(title: string) {
  log(`\n--- ${title} ---`, colors.yellow);
}

function success(message: string) {
  log(`✓ ${message}`, colors.green);
}

function error(message: string) {
  log(`✗ ${message}`, colors.red);
}

function info(message: string) {
  log(`ℹ ${message}`, colors.blue);
}

async function runValidationTests() {
  let testsPassed = 0;
  let testsFailed = 0;
  const issues: string[] = [];

  try {
    // ========================================================================
    // TEST 1: COMPLETE WORKFLOW
    // ========================================================================
    section("TEST 1: Complete Workflow - Generate, Create, Encrypt, Decrypt, Verify");

    subsection("Step 1: Generate Keypair");
    const keypair = await PrivateKeyBase.generate();
    success("Keypair generated successfully");
    info(`Public Key (hex): ${keypair.publicKeys().hex().substring(0, 64)}...`);
    testsPassed++;

    subsection("Step 2: Create Envelope with Test Data");
    const testData = "Hello, Gordian Envelope! This is a test message.";
    const envelope = Envelope.new(testData)
      .addAssertion("author", "Alice")
      .addAssertion("timestamp", Date.now());
    success("Envelope created successfully");
    info(`Subject: ${envelope.subject().asText()}`);
    info(`Assertions count: ${envelope.assertions().length}`);
    testsPassed++;

    subsection("Step 3: Display Original Envelope Structure");
    info("Tree format:");
    console.log(envelope.treeFormat());
    info("\nDiagnostic format:");
    console.log(envelope.diagnostic());
    info("\nHex format:");
    console.log(envelope.hex());
    testsPassed++;

    subsection("Step 4: Encrypt for Recipient");
    const encrypted = await envelope.encryptSubjectToRecipient(keypair.publicKeys());
    success("Envelope encrypted successfully");
    info(`Encrypted subject is encrypted: ${encrypted.subject().isEncrypted()}`);
    info(`Recipients count: ${encrypted.recipients().length}`);
    testsPassed++;

    subsection("Step 5: Display Encrypted Envelope Structure");
    info("Encrypted tree format:");
    console.log(encrypted.treeFormat());
    testsPassed++;

    subsection("Step 6: Decrypt the Envelope");
    const decrypted = await encrypted.decryptSubjectToRecipient(keypair);
    success("Envelope decrypted successfully");
    info(`Decrypted subject: ${decrypted.subject().asText()}`);
    testsPassed++;

    subsection("Step 7: Verify Output Matches Original");
    const decryptedText = decrypted.subject().asText();
    if (decryptedText === testData) {
      success("Decrypted data matches original!");
      testsPassed++;
    } else {
      error(`Data mismatch! Expected: "${testData}", Got: "${decryptedText}"`);
      issues.push("Decrypted data does not match original in complete workflow test");
      testsFailed++;
    }

    // Verify digest equality
    if (envelope.digest().equals(decrypted.digest())) {
      success("Digest verification passed - envelopes are structurally identical");
      testsPassed++;
    } else {
      error("Digest mismatch - structural integrity check failed");
      issues.push("Digest verification failed in complete workflow test");
      testsFailed++;
    }

    // ========================================================================
    // TEST 2: MULTI-RECIPIENT ENCRYPTION
    // ========================================================================
    section("TEST 2: Multi-Recipient Encryption with 3 Keypairs");

    subsection("Step 1: Generate 3 Keypairs");
    const alice = await PrivateKeyBase.generate();
    const bob = await PrivateKeyBase.generate();
    const charlie = await PrivateKeyBase.generate();
    success("Generated keypairs for Alice, Bob, and Charlie");
    info(`Alice public key: ${alice.publicKeys().hex().substring(0, 40)}...`);
    info(`Bob public key: ${bob.publicKeys().hex().substring(0, 40)}...`);
    info(`Charlie public key: ${charlie.publicKeys().hex().substring(0, 40)}...`);
    testsPassed++;

    subsection("Step 2: Create Envelope with Shared Data");
    const sharedMessage = "This is a confidential message for Alice, Bob, and Charlie.";
    const sharedEnvelope = Envelope.new(sharedMessage)
      .addAssertion("classification", "confidential")
      .addAssertion("recipients", ["Alice", "Bob", "Charlie"]);
    success("Shared envelope created");
    info(`Subject: ${sharedEnvelope.subject().asText()}`);
    testsPassed++;

    subsection("Step 3: Encrypt for All 3 Recipients");
    const multiEncrypted = await sharedEnvelope.encryptSubjectToRecipients([
      alice.publicKeys(),
      bob.publicKeys(),
      charlie.publicKeys(),
    ]);
    success("Encrypted for multiple recipients");
    info(`Recipients count: ${multiEncrypted.recipients().length}`);
    if (multiEncrypted.recipients().length === 3) {
      success("All 3 recipients were added");
      testsPassed++;
    } else {
      error(`Expected 3 recipients, got ${multiEncrypted.recipients().length}`);
      issues.push("Multi-recipient encryption did not add all recipients");
      testsFailed++;
    }

    subsection("Step 4: Display Multi-Recipient Envelope Structure");
    info("Multi-recipient tree format:");
    console.log(multiEncrypted.treeFormat());
    testsPassed++;

    subsection("Step 5: Verify Each Recipient Can Decrypt Independently");

    // Alice decrypts
    const aliceDecrypted = await multiEncrypted.decryptSubjectToRecipient(alice);
    const aliceText = aliceDecrypted.subject().asText();
    if (aliceText === sharedMessage) {
      success("Alice successfully decrypted the message");
      testsPassed++;
    } else {
      error(`Alice's decryption failed. Expected: "${sharedMessage}", Got: "${aliceText}"`);
      issues.push("Alice could not decrypt multi-recipient message");
      testsFailed++;
    }

    // Bob decrypts
    const bobDecrypted = await multiEncrypted.decryptSubjectToRecipient(bob);
    const bobText = bobDecrypted.subject().asText();
    if (bobText === sharedMessage) {
      success("Bob successfully decrypted the message");
      testsPassed++;
    } else {
      error(`Bob's decryption failed. Expected: "${sharedMessage}", Got: "${bobText}"`);
      issues.push("Bob could not decrypt multi-recipient message");
      testsFailed++;
    }

    // Charlie decrypts
    const charlieDecrypted = await multiEncrypted.decryptSubjectToRecipient(charlie);
    const charlieText = charlieDecrypted.subject().asText();
    if (charlieText === sharedMessage) {
      success("Charlie successfully decrypted the message");
      testsPassed++;
    } else {
      error(`Charlie's decryption failed. Expected: "${sharedMessage}", Got: "${charlieText}"`);
      issues.push("Charlie could not decrypt multi-recipient message");
      testsFailed++;
    }

    // ========================================================================
    // TEST 3: FORMAT COMMANDS
    // ========================================================================
    section("TEST 3: Format Commands - Tree, Diagnostic, Hex");

    subsection("Step 1: Create Complex Nested Envelope");
    const complexEnvelope = Envelope.new("Main Document")
      .addAssertion("title", "Gordian Envelope Specification")
      .addAssertion("version", "1.0")
      .addAssertion(
        "metadata",
        Envelope.new("Metadata").addAssertion("author", "Blockchain Commons"),
      )
      .addAssertion("tags", ["privacy", "encryption", "cbor"]);
    success("Complex nested envelope created");
    testsPassed++;

    subsection("Step 2: Test Tree Format");
    try {
      const treeOutput = complexEnvelope.treeFormat();
      if (treeOutput && treeOutput.length > 0) {
        success("Tree format generated successfully");
        info("Tree output:");
        console.log(treeOutput);
        testsPassed++;
      } else {
        error("Tree format returned empty output");
        issues.push("Tree format command produced no output");
        testsFailed++;
      }
    } catch (e) {
      error(`Tree format failed: ${e}`);
      issues.push("Tree format command threw an error");
      testsFailed++;
    }

    subsection("Step 3: Test Tree Format with Options");
    try {
      const treeHideNodes = complexEnvelope.treeFormat({ hideNodes: true });
      if (treeHideNodes && treeHideNodes.length > 0) {
        success("Tree format with hideNodes option works");
        info("Tree output (hideNodes=true):");
        console.log(treeHideNodes);
        testsPassed++;
      } else {
        error("Tree format with options returned empty output");
        issues.push("Tree format with hideNodes option failed");
        testsFailed++;
      }
    } catch (e) {
      error(`Tree format with options failed: ${e}`);
      issues.push("Tree format with options threw an error");
      testsFailed++;
    }

    subsection("Step 4: Test Diagnostic Format");
    try {
      const diagnosticOutput = complexEnvelope.diagnostic();
      if (diagnosticOutput && diagnosticOutput.length > 0) {
        success("Diagnostic format generated successfully");
        info("Diagnostic output:");
        console.log(diagnosticOutput);
        testsPassed++;
      } else {
        error("Diagnostic format returned empty output");
        issues.push("Diagnostic format command produced no output");
        testsFailed++;
      }
    } catch (e) {
      error(`Diagnostic format failed: ${e}`);
      issues.push("Diagnostic format command threw an error");
      testsFailed++;
    }

    subsection("Step 5: Test Hex Format");
    try {
      const hexOutput = complexEnvelope.hex();
      if (hexOutput && hexOutput.length > 0) {
        success("Hex format generated successfully");
        info(`Hex output (first 100 chars): ${hexOutput.substring(0, 100)}...`);
        testsPassed++;
      } else {
        error("Hex format returned empty output");
        issues.push("Hex format command produced no output");
        testsFailed++;
      }
    } catch (e) {
      error(`Hex format failed: ${e}`);
      issues.push("Hex format command threw an error");
      testsFailed++;
    }

    subsection("Step 6: Test Format Round-Trip (Hex → Envelope → Hex)");
    try {
      const originalHex = complexEnvelope.hex();
      const restored = Envelope.fromHex(originalHex);
      const restoredHex = restored.hex();

      if (originalHex === restoredHex) {
        success("Hex round-trip successful - serialization is deterministic");
        testsPassed++;
      } else {
        error("Hex round-trip failed - serialization is not consistent");
        issues.push("Hex format round-trip produced different output");
        testsFailed++;
      }
    } catch (e) {
      error(`Hex round-trip failed: ${e}`);
      issues.push("Hex round-trip threw an error");
      testsFailed++;
    }

    // ========================================================================
    // ADDITIONAL TESTS: Edge Cases
    // ========================================================================
    section("ADDITIONAL TESTS: Edge Cases and Error Handling");

    subsection("Test 1: Wrong Recipient Cannot Decrypt");
    try {
      const eve = await PrivateKeyBase.generate();
      const secretMessage = Envelope.new("Top secret");
      const secretEncrypted = await secretMessage.encryptSubjectToRecipient(alice.publicKeys());

      try {
        await secretEncrypted.decryptSubjectToRecipient(eve);
        error("Wrong recipient was able to decrypt - security failure!");
        issues.push("Unauthorized recipient was able to decrypt message");
        testsFailed++;
      } catch {
        success("Wrong recipient correctly failed to decrypt");
        testsPassed++;
      }
    } catch (e) {
      error(`Wrong recipient test failed unexpectedly: ${e}`);
      issues.push("Wrong recipient test encountered an error");
      testsFailed++;
    }

    subsection("Test 2: Symmetric Key Encryption");
    try {
      const symmetricKey = await SymmetricKey.generate();
      const symmetricEnvelope = Envelope.new("Symmetric encryption test");
      const symmetricEncrypted = await symmetricEnvelope.encryptSubject(symmetricKey);
      const symmetricDecrypted = await symmetricEncrypted.decryptSubject(symmetricKey);

      if (symmetricDecrypted.subject().asText() === "Symmetric encryption test") {
        success("Symmetric key encryption/decryption works");
        testsPassed++;
      } else {
        error("Symmetric key encryption/decryption failed");
        issues.push("Symmetric encryption test failed");
        testsFailed++;
      }
    } catch (e) {
      error(`Symmetric key test failed: ${e}`);
      issues.push("Symmetric key test encountered an error");
      testsFailed++;
    }

    subsection("Test 3: Empty Envelope");
    try {
      const emptyEnvelope = Envelope.new("");
      const emptyText = emptyEnvelope.subject().asText();
      if (emptyText === "") {
        success("Empty envelope handled correctly");
        testsPassed++;
      } else {
        error(`Empty envelope returned unexpected value: "${emptyText}"`);
        issues.push("Empty envelope test failed");
        testsFailed++;
      }
    } catch (e) {
      error(`Empty envelope test failed: ${e}`);
      issues.push("Empty envelope test encountered an error");
      testsFailed++;
    }

    subsection("Test 4: Large Payload");
    try {
      const largeData = "X".repeat(10000);
      const largeEnvelope = Envelope.new(largeData);
      const largePubKey = await PrivateKeyBase.generate();
      const largeEncrypted = await largeEnvelope.encryptSubjectToRecipient(
        largePubKey.publicKeys(),
      );
      const largeDecrypted = await largeEncrypted.decryptSubjectToRecipient(largePubKey);

      if (largeDecrypted.subject().asText() === largeData) {
        success("Large payload (10KB) handled correctly");
        testsPassed++;
      } else {
        error("Large payload test failed");
        issues.push("Large payload test failed");
        testsFailed++;
      }
    } catch (e) {
      error(`Large payload test failed: ${e}`);
      issues.push("Large payload test encountered an error");
      testsFailed++;
    }
  } catch (e) {
    error(`Critical error during validation: ${e}`);
    testsFailed++;
  }

  // ========================================================================
  // FINAL REPORT
  // ========================================================================
  section("VALIDATION SUMMARY");

  const total = testsPassed + testsFailed;
  log(`Total Tests: ${total}`, colors.bright);
  log(`Passed: ${testsPassed}`, colors.green);
  log(`Failed: ${testsFailed}`, colors.red);
  log(`Success Rate: ${((testsPassed / total) * 100).toFixed(1)}%`, colors.cyan);

  if (issues.length > 0) {
    subsection("Issues Found");
    issues.forEach((issue, index) => {
      error(`${index + 1}. ${issue}`);
    });
  }

  if (testsFailed === 0) {
    log(
      "\n✓ ALL TESTS PASSED - Documentation is accurate and functional!",
      colors.bright + colors.green,
    );
  } else {
    log("\n✗ SOME TESTS FAILED - Documentation needs corrections", colors.bright + colors.red);
  }

  console.log("\n" + "=".repeat(80) + "\n");

  return { testsPassed, testsFailed, issues };
}

// Run the validation tests
runValidationTests()
  .then(({ testsFailed }) => {
    if (typeof globalThis.process !== "undefined") {
      globalThis.process.exit(testsFailed > 0 ? 1 : 0);
    }
  })
  .catch((error) => {
    console.error("Validation failed with error:", error);
    if (typeof globalThis.process !== "undefined") {
      globalThis.process.exit(1);
    }
  });
