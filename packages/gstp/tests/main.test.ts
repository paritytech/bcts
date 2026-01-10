/**
 * Main tests for GSTP
 * Ported from gstp-rust/tests/main_tests.rs
 */

import { ARID, PrivateKeys } from "@bcts/components";
import { Expression, Function, type Envelope } from "@bcts/envelope";
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

// Helper function to create a response continuation
function responseContinuation(): Continuation {
  const validDuration = 60 * 60 * 1000; // 1 hour in milliseconds
  const validUntil = new Date(requestDate().getTime() + validDuration);
  return new Continuation("The state of things.", undefined, validUntil);
}

describe("Continuation", () => {
  describe("Request continuation", () => {
    it("should create and parse request continuation", () => {
      const continuation = requestContinuation();
      const envelope = continuation.toEnvelope(undefined);

      // Parse back the continuation
      const parsedContinuation = Continuation.tryFromEnvelope(
        envelope,
        requestId(),
        undefined,
        undefined,
      );

      expect(parsedContinuation.state().digest().equals(continuation.state().digest())).toBe(true);
      const expectedId = continuation.id();
      const actualId = parsedContinuation.id();
      if (expectedId !== undefined && actualId !== undefined) {
        expect(actualId.equals(expectedId)).toBe(true);
      } else {
        expect(actualId).toBe(expectedId);
      }
      expect(parsedContinuation.validUntil()?.getTime()).toBe(continuation.validUntil()?.getTime());
      expect(continuation.equals(parsedContinuation)).toBe(true);
    });
  });

  describe("Response continuation", () => {
    it("should create and parse response continuation", () => {
      const continuation = responseContinuation();
      const envelope = continuation.toEnvelope(undefined);

      // Parse back the continuation
      const parsedContinuation = Continuation.tryFromEnvelope(
        envelope,
        undefined,
        undefined,
        undefined,
      );

      expect(parsedContinuation.state().digest().equals(continuation.state().digest())).toBe(true);
      expect(parsedContinuation.id()).toBeUndefined();
      expect(parsedContinuation.validUntil()?.getTime()).toBe(continuation.validUntil()?.getTime());
      expect(continuation.equals(parsedContinuation)).toBe(true);
    });
  });

  describe("Encrypted continuation", () => {
    it("should create and parse encrypted continuation", () => {
      const senderPrivateKeys = PrivateKeys.new();
      const senderPublicKeys = senderPrivateKeys.publicKeys();

      const continuation = requestContinuation();
      const envelope = continuation.toEnvelope(senderPublicKeys);

      // The envelope's subject should be encrypted (the outer envelope is a node with hasRecipient assertion)
      expect(envelope.subject().isEncrypted()).toBe(true);

      // Parse with valid time (30 seconds after request date)
      const validNow = new Date(requestDate().getTime() + 30 * 1000);
      const parsedContinuation = Continuation.tryFromEnvelope(
        envelope,
        requestId(),
        validNow,
        senderPrivateKeys,
      );

      expect(parsedContinuation.state().digest().equals(continuation.state().digest())).toBe(true);
      const expectedId = continuation.id();
      const actualId = parsedContinuation.id();
      if (expectedId !== undefined && actualId !== undefined) {
        expect(actualId.equals(expectedId)).toBe(true);
      } else {
        expect(actualId).toBe(expectedId);
      }
      expect(parsedContinuation.validUntil()?.getTime()).toBe(continuation.validUntil()?.getTime());
      expect(continuation.equals(parsedContinuation)).toBe(true);
    });

    it("should reject expired continuation", () => {
      const senderPrivateKeys = PrivateKeys.new();
      const senderPublicKeys = senderPrivateKeys.publicKeys();

      const continuation = requestContinuation();
      const envelope = continuation.toEnvelope(senderPublicKeys);

      // Parse with invalid time (90 seconds after request date - expired)
      const invalidNow = new Date(requestDate().getTime() + 90 * 1000);

      expect(() => {
        Continuation.tryFromEnvelope(envelope, requestId(), invalidNow, senderPrivateKeys);
      }).toThrow();
    });

    it("should reject continuation with invalid ID", () => {
      const senderPrivateKeys = PrivateKeys.new();
      const senderPublicKeys = senderPrivateKeys.publicKeys();

      const continuation = requestContinuation();
      const envelope = continuation.toEnvelope(senderPublicKeys);

      // Parse with valid time but invalid ID
      const validNow = new Date(requestDate().getTime() + 30 * 1000);
      const invalidId = ARID.new();

      expect(() => {
        Continuation.tryFromEnvelope(envelope, invalidId, validNow, senderPrivateKeys);
      }).toThrow();
    });
  });
});

describe("SealedRequest", () => {
  it("should handle full request/response cycle", () => {
    // Generate keypairs for the server and client
    const serverPrivateKeys = PrivateKeys.new();
    const serverPublicKeys = serverPrivateKeys.publicKeys();
    const server = XIDDocument.new(
      { type: "privateKeys", privateKeys: serverPrivateKeys, publicKeys: serverPublicKeys },
      { type: "none" },
    );

    const clientPrivateKeys = PrivateKeys.new();
    const clientPublicKeys = clientPrivateKeys.publicKeys();
    const client = XIDDocument.new(
      { type: "privateKeys", privateKeys: clientPrivateKeys, publicKeys: clientPublicKeys },
      { type: "none" },
    );

    const now = requestDate();

    // Server previously sent this continuation
    const serverResponseDate = new Date(now.getTime() - 30 * 1000); // 30 seconds ago
    const serverContinuationValidUntil = new Date(serverResponseDate.getTime() + 60 * 1000); // Valid for 60 seconds
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

    // Create sealed envelope (signed by client, encrypted to server)
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

  it("should handle multi-recipient requests", () => {
    // Generate keypairs for server, auditor, and client
    const serverPrivateKeys = PrivateKeys.new();
    const serverPublicKeys = serverPrivateKeys.publicKeys();
    const server = XIDDocument.new(
      { type: "privateKeys", privateKeys: serverPrivateKeys, publicKeys: serverPublicKeys },
      { type: "none" },
    );

    const auditorPrivateKeys = PrivateKeys.new();
    const auditorPublicKeys = auditorPrivateKeys.publicKeys();
    const auditor = XIDDocument.new(
      { type: "privateKeys", privateKeys: auditorPrivateKeys, publicKeys: auditorPublicKeys },
      { type: "none" },
    );

    const clientPrivateKeys = PrivateKeys.new();
    const clientPublicKeys = clientPrivateKeys.publicKeys();
    const client = XIDDocument.new(
      { type: "privateKeys", privateKeys: clientPrivateKeys, publicKeys: clientPublicKeys },
      { type: "none" },
    );

    const now = requestDate();

    // Server previously provided this continuation
    const serverState = new Expression(Function.newNamed("nextPage"))
      .withParameter("fromRecord", 100)
      .withParameter("toRecord", 199);
    const serverContinuation = new Continuation(
      serverState,
      undefined,
      new Date(now.getTime() + 60 * 1000),
    );
    const serverContinuationEnvelope = serverContinuation.toEnvelope(serverPublicKeys);

    // Client composes request
    const clientContinuationValidUntil = new Date(now.getTime() + 60 * 1000);
    const clientRequest = SealedRequest.new("test", requestId(), client)
      .withParameter("param1", 42)
      .withParameter("param2", "hello")
      .withNote("This is a test")
      .withDate(now)
      .withState("The state of things.")
      .withPeerContinuation(serverContinuationEnvelope);

    // Create sealed envelope to multiple recipients
    const recipients = [server, auditor];
    const sealedClientRequestEnvelope = clientRequest.toEnvelopeForRecipients(
      clientContinuationValidUntil,
      clientPrivateKeys,
      recipients,
    );

    // Both server and auditor can decrypt
    expect(() => {
      sealedClientRequestEnvelope.decryptToRecipient(serverPrivateKeys);
    }).not.toThrow();

    expect(() => {
      sealedClientRequestEnvelope.decryptToRecipient(auditorPrivateKeys);
    }).not.toThrow();

    // Server parses the request
    const parsedClientRequestServer = SealedRequest.tryFromEnvelope(
      sealedClientRequestEnvelope,
      undefined,
      now,
      serverPrivateKeys,
    );

    expect(parsedClientRequestServer.extractObjectForParameter<number>("param1")).toBe(42);
    expect(parsedClientRequestServer.extractObjectForParameter<string>("param2")).toBe("hello");

    // Server creates response to multiple recipients
    const serverStateNew = new Expression(Function.newNamed("nextPage"))
      .withParameter("fromRecord", 200)
      .withParameter("toRecord", 299);
    const peerContinuation = parsedClientRequestServer.peerContinuation();
    const serverResponse = SealedResponse.newSuccess(parsedClientRequestServer.id(), server)
      .withResult("Records retrieved: 100-199")
      .withState(serverStateNew)
      .withPeerContinuation(peerContinuation);

    const responseRecipients = [client, auditor];
    const sealedServerResponseEnvelope = serverResponse.toEnvelopeForRecipients(
      new Date(now.getTime() + 60 * 1000),
      serverPrivateKeys,
      responseRecipients,
    );

    // Client parses the response
    const parsedServerResponseClient = SealedResponse.tryFromEncryptedEnvelope(
      sealedServerResponseEnvelope,
      parsedClientRequestServer.id(),
      now,
      clientPrivateKeys,
    );

    expect(parsedServerResponseClient.result().extractString()).toBe("Records retrieved: 100-199");

    // Auditor can also decrypt
    expect(() => {
      sealedServerResponseEnvelope.decryptToRecipient(auditorPrivateKeys);
    }).not.toThrow();
  });
});

describe("SealedEvent", () => {
  it("should handle events", () => {
    // Generate keypairs for sender and recipient
    const senderPrivateKeys = PrivateKeys.new();
    const senderPublicKeys = senderPrivateKeys.publicKeys();
    const sender = XIDDocument.new(
      { type: "privateKeys", privateKeys: senderPrivateKeys, publicKeys: senderPublicKeys },
      { type: "none" },
    );

    const recipientPrivateKeys = PrivateKeys.new();
    const recipientPublicKeys = recipientPrivateKeys.publicKeys();
    const recipient = XIDDocument.new(
      { type: "privateKeys", privateKeys: recipientPrivateKeys, publicKeys: recipientPublicKeys },
      { type: "none" },
    );

    const now = requestDate();

    // Create sealed event
    const event = SealedEvent.new("test", requestId(), sender)
      .withNote("This is a test")
      .withDate(now);

    // Create sealed envelope (signed by sender, encrypted to recipient)
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

  it("should handle multi-recipient events", () => {
    // Generate keypairs for sender and recipients
    const senderPrivateKeys = PrivateKeys.new();
    const senderPublicKeys = senderPrivateKeys.publicKeys();
    const sender = XIDDocument.new(
      { type: "privateKeys", privateKeys: senderPrivateKeys, publicKeys: senderPublicKeys },
      { type: "none" },
    );

    const recipientAPrivateKeys = PrivateKeys.new();
    const recipientAPublicKeys = recipientAPrivateKeys.publicKeys();
    const recipientA = XIDDocument.new(
      { type: "privateKeys", privateKeys: recipientAPrivateKeys, publicKeys: recipientAPublicKeys },
      { type: "none" },
    );

    const recipientBPrivateKeys = PrivateKeys.new();
    const recipientBPublicKeys = recipientBPrivateKeys.publicKeys();
    const recipientB = XIDDocument.new(
      { type: "privateKeys", privateKeys: recipientBPrivateKeys, publicKeys: recipientBPublicKeys },
      { type: "none" },
    );

    const recipients = [recipientA, recipientB];
    const validUntil = new Date("2024-07-04T11:12:11Z");

    // Create sealed event with Expression content
    const event = SealedEvent.new(new Expression(Function.newNamed("sync")), requestId(), sender)
      .withNote("Escrow update")
      .withState("state");

    const sealedEventEnvelope = event.toEnvelopeForRecipients(
      validUntil,
      senderPrivateKeys,
      recipients,
    );

    // Both recipients can parse the event
    const parsedEventA = SealedEvent.tryFromEnvelope<Envelope>(
      sealedEventEnvelope,
      requestId(),
      undefined,
      recipientAPrivateKeys,
    );

    const parsedEventB = SealedEvent.tryFromEnvelope<Envelope>(
      sealedEventEnvelope,
      requestId(),
      undefined,
      recipientBPrivateKeys,
    );

    expect(parsedEventA.note()).toBe(parsedEventB.note());
  });
});
