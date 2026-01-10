/**
 * Post-quantum tests for GSTP
 * Ported from gstp-rust/tests/pq_tests.rs
 *
 * These tests use MLDSA for signing and MLKEM for encapsulation,
 * providing post-quantum security for GSTP operations.
 */

import { describe, it, expect } from "vitest";
import {
  ARID,
  MLDSAPrivateKey,
  MLDSALevel,
  MLKEMLevel,
  SigningPrivateKey,
  SigningPublicKey,
  EncapsulationPrivateKey,
  PrivateKeys,
  PublicKeys,
} from "@bcts/components";
import { Expression, Function } from "@bcts/envelope";
import { XIDDocument } from "@bcts/xid";
import { Continuation, SealedRequest, SealedResponse, SealedEvent } from "../src";

// Helper function to create a test request ID
function requestId(): ARID {
  return ARID.fromHex("c66be27dbad7cd095ca77647406d07976dc0f35f0d4d654bb0e96dd227a1e9fc");
}

// Helper function to create a test request date
function requestDate(): Date {
  return new Date("2024-07-04T11:11:11Z");
}

// Helper function to create a request continuation
function requestContinuation(): Continuation {
  const validDuration = 60 * 1000; // 60 seconds in milliseconds
  const validUntil = new Date(requestDate().getTime() + validDuration);
  return new Continuation("The state of things.", requestId(), validUntil);
}

/**
 * Generate PQ keypairs using MLDSA44 for signing and MLKEM512 for encapsulation.
 * Matches the Rust test setup: keypair_opt(SignatureScheme::MLDSA44, EncapsulationScheme::MLKEM512)
 */
function createPQKeypairs(): { privateKeys: PrivateKeys; publicKeys: PublicKeys } {
  // Signing with MLDSA44 - must use keypair() to get both keys
  const [mldsaPrivate, mldsaPublic] = MLDSAPrivateKey.keypair(MLDSALevel.MLDSA44);
  const signingPrivate = SigningPrivateKey.newMldsa(mldsaPrivate);
  const signingPublic = SigningPublicKey.fromMldsa(mldsaPublic);

  // Encapsulation with MLKEM512
  const [encapsulationPrivate, encapsulationPublic] = EncapsulationPrivateKey.mlkemKeypair(
    MLKEMLevel.MLKEM512,
  );

  const privateKeys = PrivateKeys.withKeys(signingPrivate, encapsulationPrivate);
  const publicKeys = PublicKeys.new(signingPublic, encapsulationPublic);

  return { privateKeys, publicKeys };
}

/**
 * Create an XIDDocument with PQ keys.
 */
function createPQXIDDocument(): {
  xid: XIDDocument;
  privateKeys: PrivateKeys;
  publicKeys: PublicKeys;
} {
  const { privateKeys, publicKeys } = createPQKeypairs();
  const xid = XIDDocument.new({ type: "privateKeys", privateKeys, publicKeys }, { type: "none" });
  return { xid, privateKeys, publicKeys };
}

describe("Post-Quantum", () => {
  describe("Encrypted continuation", () => {
    it("should create and parse encrypted continuation with MLKEM", () => {
      const { privateKeys, publicKeys } = createPQKeypairs();

      const continuation = requestContinuation();
      const envelope = continuation.toEnvelope(publicKeys);

      // The envelope's subject should be encrypted (the outer envelope is a node with hasRecipient assertion)
      expect(envelope.subject().isEncrypted()).toBe(true);

      // Parse with valid time (30 seconds after request date)
      const validNow = new Date(requestDate().getTime() + 30 * 1000);
      const parsedContinuation = Continuation.tryFromEnvelope(
        envelope,
        requestId(),
        validNow,
        privateKeys,
      );

      expect(parsedContinuation.state().digest().equals(continuation.state().digest())).toBe(true);
      expect(parsedContinuation.id()?.equals(continuation.id() ?? parsedContinuation.id())).toBe(
        true,
      );
      expect(parsedContinuation.validUntil()?.getTime()).toBe(continuation.validUntil()?.getTime());
      expect(continuation.equals(parsedContinuation)).toBe(true);
    });

    it("should reject expired PQ continuation", () => {
      const { privateKeys, publicKeys } = createPQKeypairs();

      const continuation = requestContinuation();
      const envelope = continuation.toEnvelope(publicKeys);

      // Parse with invalid time (90 seconds after request date - expired)
      const invalidNow = new Date(requestDate().getTime() + 90 * 1000);

      expect(() => {
        Continuation.tryFromEnvelope(envelope, requestId(), invalidNow, privateKeys);
      }).toThrow();
    });

    it("should reject PQ continuation with invalid ID", () => {
      const { privateKeys, publicKeys } = createPQKeypairs();

      const continuation = requestContinuation();
      const envelope = continuation.toEnvelope(publicKeys);

      // Parse with valid time but invalid ID
      const validNow = new Date(requestDate().getTime() + 30 * 1000);
      const invalidId = ARID.new();

      expect(() => {
        Continuation.tryFromEnvelope(envelope, invalidId, validNow, privateKeys);
      }).toThrow();
    });
  });

  describe("Sealed request", () => {
    it("should handle full PQ request/response cycle", () => {
      // Generate PQ keypairs for the server and client
      const {
        xid: server,
        privateKeys: serverPrivateKeys,
        publicKeys: serverPublicKeys,
      } = createPQXIDDocument();
      const { xid: client, privateKeys: clientPrivateKeys } = createPQXIDDocument();

      const now = requestDate();

      // Server previously sent this continuation (30 seconds ago)
      const serverResponseDate = new Date(now.getTime() - 30 * 1000);
      const serverContinuationValidUntil = new Date(serverResponseDate.getTime() + 60 * 1000);
      const serverState = new Expression(Function.newNamed("nextPage"))
        .withParameter("fromRecord", 100)
        .withParameter("toRecord", 199);
      const serverContinuation = new Continuation(
        serverState,
        undefined,
        serverContinuationValidUntil,
      );
      const serverContinuationEnvelope = serverContinuation.toEnvelope(serverPublicKeys);

      // Client composes a request
      const clientContinuationValidUntil = new Date(now.getTime() + 60 * 1000);
      const clientRequest = SealedRequest.new("test", requestId(), client)
        .withParameter("param1", 42)
        .withParameter("param2", "hello")
        .withNote("This is a test")
        .withDate(now)
        .withState("The state of things.")
        .withPeerContinuation(serverContinuationEnvelope);

      // Create sealed envelope (signed by client with MLDSA, encrypted to server with MLKEM)
      const sealedClientRequestEnvelope = clientRequest.toEnvelope(
        clientContinuationValidUntil,
        clientPrivateKeys,
        server,
      );

      // Server receives and parses the envelope
      const parsedClientRequest = SealedRequest.tryFromEnvelope(
        sealedClientRequestEnvelope,
        undefined,
        now,
        serverPrivateKeys,
      );

      // Verify request contents
      expect(parsedClientRequest.function().id()).toBe("test");
      expect(parsedClientRequest.extractObjectForParameter<number>("param1")).toBe(42);
      expect(parsedClientRequest.extractObjectForParameter<string>("param2")).toBe("hello");
      expect(parsedClientRequest.note()).toBe("This is a test");
      expect(parsedClientRequest.date()?.getTime()).toBe(now.getTime());

      // Server can access the continuation state
      const state = parsedClientRequest.state();
      expect(state).toBeDefined();

      // Server constructs response
      const responseState = new Expression(Function.newNamed("nextPage"))
        .withParameter("fromRecord", 200)
        .withParameter("toRecord", 299);
      const peerContinuation = parsedClientRequest.peerContinuation();

      const serverResponse = SealedResponse.newSuccess(parsedClientRequest.id(), server)
        .withResult("Records retrieved: 100-199")
        .withState(responseState)
        .withPeerContinuation(peerContinuation);

      // Create sealed response envelope
      const serverContinuationValidUntilNew = new Date(now.getTime() + 60 * 1000);
      const sealedServerResponseEnvelope = serverResponse.toEnvelope(
        serverContinuationValidUntilNew,
        serverPrivateKeys,
        client,
      );

      // Client receives and parses the response
      const parsedServerResponse = SealedResponse.tryFromEncryptedEnvelope(
        sealedServerResponseEnvelope,
        parsedClientRequest.id(),
        now,
        clientPrivateKeys,
      );

      // Verify response
      expect(parsedServerResponse.isOk()).toBe(true);
      expect(parsedServerResponse.result().extractString()).toBe("Records retrieved: 100-199");

      // Client can access the returned state
      const clientState = parsedServerResponse.state();
      expect(clientState).toBeDefined();
      expect(clientState?.extractString()).toBe("The state of things.");
    });
  });

  describe("Sealed event", () => {
    it("should handle PQ sealed event", () => {
      // Generate PQ keypairs for sender and recipient
      const { xid: sender, privateKeys: senderPrivateKeys } = createPQXIDDocument();
      const { xid: recipient, privateKeys: recipientPrivateKeys } = createPQXIDDocument();

      const now = requestDate();

      // Create sealed event
      const event = SealedEvent.new("test", requestId(), sender)
        .withNote("This is a test")
        .withDate(now);

      // Create sealed envelope (signed by sender with MLDSA, encrypted to recipient with MLKEM)
      const sealedEventEnvelope = event.toEnvelope(undefined, senderPrivateKeys, recipient);

      // Recipient parses the event
      const parsedEvent = SealedEvent.tryFromEnvelope<string>(
        sealedEventEnvelope,
        undefined,
        undefined,
        recipientPrivateKeys,
      );

      expect(parsedEvent.content()).toBe("test");
      expect(parsedEvent.note()).toBe("This is a test");
      expect(parsedEvent.date()?.getTime()).toBe(now.getTime());
    });
  });
});
