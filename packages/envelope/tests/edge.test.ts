/**
 * Edge Extension Tests
 *
 * TypeScript adaptation of bc-envelope-rust/tests/edge_tests.rs
 *
 * Tests the Edge extension (BCR-2026-003) including:
 * - Edge construction and format
 * - Edge validation (all error paths)
 * - Edge accessor methods
 * - Adding edges to envelopes
 * - Edges retrieval
 * - Edges container operations
 * - Edges container round-trips
 * - Edgeable interface
 * - edgesMatching filtered retrieval
 * - Signed edges
 * - Edge coexistence with attachments
 * - Edge UR round-trips
 * - Edge with additional assertions
 */

import { describe, it, expect } from "vitest";
import { Envelope, Edges, SigningPrivateKey, EnvelopeError, ErrorCode } from "../src";
import { IS_A, SOURCE, TARGET, DEREFERENCE_VIA } from "@bcts/known-values";

// -------------------------------------------------------------------
// Test Helpers (equivalent to Rust common/test_data.rs)
// -------------------------------------------------------------------

/**
 * Helper to create a basic edge envelope with the three required assertions.
 * Equivalent to Rust's `make_edge()` helper.
 */
function makeEdge(subject: string, isA: string, source: Envelope, target: Envelope): Envelope {
  return Envelope.new(subject)
    .addAssertion(IS_A, isA)
    .addAssertion(SOURCE, source)
    .addAssertion(TARGET, target);
}

/**
 * Helper to create an XID-like identifier envelope.
 * Equivalent to Rust's `xid_like()` helper.
 */
function xidLike(name: string): Envelope {
  return Envelope.new(name);
}

/**
 * Creates a signing private key for testing.
 */
function testPrivateKey(): SigningPrivateKey {
  return SigningPrivateKey.random();
}

// ===================================================================
// Section 1: Edge construction and format
// ===================================================================

describe("Edge Extension", () => {
  describe("Edge construction and format", () => {
    it("test_edge_basic_format", () => {
      const alice = xidLike("Alice");
      const edge = makeEdge("credential-1", "foaf:Person", alice, alice);

      const formatted = edge.format();
      expect(formatted).toContain('"credential-1"');
      expect(formatted).toContain("'isA': \"foaf:Person\"");
      expect(formatted).toContain("'source': \"Alice\"");
      expect(formatted).toContain("'target': \"Alice\"");
    });

    it("test_edge_relationship_format", () => {
      const alice = xidLike("Alice");
      const bob = xidLike("Bob");
      const edge = makeEdge("knows-bob", "schema:colleague", alice, bob);

      const formatted = edge.format();
      expect(formatted).toContain('"knows-bob"');
      expect(formatted).toContain("'isA': \"schema:colleague\"");
      expect(formatted).toContain("'source': \"Alice\"");
      expect(formatted).toContain("'target': \"Bob\"");
    });
  });

  // ===================================================================
  // Section 2: Edge validation
  // ===================================================================

  describe("Edge validation", () => {
    it("test_validate_edge_valid", () => {
      const alice = xidLike("Alice");
      const edge = makeEdge("cred-1", "foaf:Person", alice, alice);
      expect(() => edge.validateEdge()).not.toThrow();
    });

    it("test_validate_edge_missing_is_a", () => {
      const alice = xidLike("Alice");
      const edge = Envelope.new("cred-1").addAssertion(SOURCE, alice).addAssertion(TARGET, alice);
      expect(() => edge.validateEdge()).toThrow(EnvelopeError);
      try {
        edge.validateEdge();
      } catch (e) {
        expect((e as EnvelopeError).code).toBe(ErrorCode.EDGE_MISSING_IS_A);
      }
    });

    it("test_validate_edge_missing_source", () => {
      const alice = xidLike("Alice");
      const edge = Envelope.new("cred-1")
        .addAssertion(IS_A, "foaf:Person")
        .addAssertion(TARGET, alice);
      expect(() => edge.validateEdge()).toThrow(EnvelopeError);
      try {
        edge.validateEdge();
      } catch (e) {
        expect((e as EnvelopeError).code).toBe(ErrorCode.EDGE_MISSING_SOURCE);
      }
    });

    it("test_validate_edge_missing_target", () => {
      const alice = xidLike("Alice");
      const edge = Envelope.new("cred-1")
        .addAssertion(IS_A, "foaf:Person")
        .addAssertion(SOURCE, alice);
      expect(() => edge.validateEdge()).toThrow(EnvelopeError);
      try {
        edge.validateEdge();
      } catch (e) {
        expect((e as EnvelopeError).code).toBe(ErrorCode.EDGE_MISSING_TARGET);
      }
    });

    it("test_validate_edge_no_assertions", () => {
      const edge = Envelope.new("cred-1");
      expect(() => edge.validateEdge()).toThrow(EnvelopeError);
      try {
        edge.validateEdge();
      } catch (e) {
        // First check is IS_A, so this should be EdgeMissingIsA
        expect((e as EnvelopeError).code).toBe(ErrorCode.EDGE_MISSING_IS_A);
      }
    });

    it("test_validate_edge_duplicate_is_a", () => {
      const alice = xidLike("Alice");
      const edge = Envelope.new("cred-1")
        .addAssertion(IS_A, "foaf:Person")
        .addAssertion(IS_A, "schema:Thing")
        .addAssertion(SOURCE, alice)
        .addAssertion(TARGET, alice);
      expect(() => edge.validateEdge()).toThrow(EnvelopeError);
      try {
        edge.validateEdge();
      } catch (e) {
        expect((e as EnvelopeError).code).toBe(ErrorCode.EDGE_DUPLICATE_IS_A);
      }
    });

    it("test_validate_edge_duplicate_source", () => {
      const alice = xidLike("Alice");
      const bob = xidLike("Bob");
      const edge = Envelope.new("cred-1")
        .addAssertion(IS_A, "foaf:Person")
        .addAssertion(SOURCE, alice)
        .addAssertion(SOURCE, bob)
        .addAssertion(TARGET, alice);
      expect(() => edge.validateEdge()).toThrow(EnvelopeError);
      try {
        edge.validateEdge();
      } catch (e) {
        expect((e as EnvelopeError).code).toBe(ErrorCode.EDGE_DUPLICATE_SOURCE);
      }
    });

    it("test_validate_edge_duplicate_target", () => {
      const alice = xidLike("Alice");
      const bob = xidLike("Bob");
      const edge = Envelope.new("cred-1")
        .addAssertion(IS_A, "foaf:Person")
        .addAssertion(SOURCE, alice)
        .addAssertion(TARGET, alice)
        .addAssertion(TARGET, bob);
      expect(() => edge.validateEdge()).toThrow(EnvelopeError);
      try {
        edge.validateEdge();
      } catch (e) {
        expect((e as EnvelopeError).code).toBe(ErrorCode.EDGE_DUPLICATE_TARGET);
      }
    });

    it("test_validate_edge_wrapped_signed", () => {
      const alice = xidLike("Alice");
      const edge = makeEdge("cred-1", "foaf:Person", alice, alice);

      // Wrap and sign the edge
      const privateKey = testPrivateKey();
      const signedEdge = edge.wrap().addSignature(privateKey);

      // Signed (wrapped) edge should still validate
      expect(() => signedEdge.validateEdge()).not.toThrow();
    });
  });

  // ===================================================================
  // Section 3: Edge accessor methods
  // ===================================================================

  describe("Edge accessor methods", () => {
    it("test_edge_is_a", () => {
      const alice = xidLike("Alice");
      const edge = makeEdge("cred-1", "foaf:Person", alice, alice);

      const isA = edge.edgeIsA();
      expect(isA.format()).toBe('"foaf:Person"');
    });

    it("test_edge_source", () => {
      const alice = xidLike("Alice");
      const edge = makeEdge("cred-1", "foaf:Person", alice, alice);

      const source = edge.edgeSource();
      expect(source.format()).toBe('"Alice"');
    });

    it("test_edge_target", () => {
      const alice = xidLike("Alice");
      const bob = xidLike("Bob");
      const edge = makeEdge("knows-bob", "schema:colleague", alice, bob);

      const target = edge.edgeTarget();
      expect(target.format()).toBe('"Bob"');
    });

    it("test_edge_subject", () => {
      const alice = xidLike("Alice");
      const edge = makeEdge("my-credential", "foaf:Person", alice, alice);

      const subject = edge.edgeSubject();
      expect(subject.format()).toBe('"my-credential"');
    });

    it("test_edge_accessors_on_signed_edge", () => {
      const alice = xidLike("Alice");
      const bob = xidLike("Bob");
      const edge = makeEdge("cred-1", "foaf:Person", alice, bob);

      const privateKey = testPrivateKey();
      const signedEdge = edge.wrap().addSignature(privateKey);

      // Accessors should work through the wrapped/signed layer
      const isA = signedEdge.edgeIsA();
      expect(isA.format()).toBe('"foaf:Person"');

      const source = signedEdge.edgeSource();
      expect(source.format()).toBe('"Alice"');

      const target = signedEdge.edgeTarget();
      expect(target.format()).toBe('"Bob"');

      const subject = signedEdge.edgeSubject();
      expect(subject.format()).toBe('"cred-1"');
    });
  });

  // ===================================================================
  // Section 4: Adding edges to envelopes
  // ===================================================================

  describe("Adding edges to envelopes", () => {
    it("test_add_edge_envelope", () => {
      const alice = xidLike("Alice");
      const edge = makeEdge("cred-1", "foaf:Person", alice, alice);

      const doc = Envelope.new("Alice").addEdgeEnvelope(edge);

      const formatted = doc.format();
      expect(formatted).toContain("'edge':");
      expect(formatted).toContain('"cred-1"');
      expect(formatted).toContain("'isA': \"foaf:Person\"");
      expect(formatted).toContain("'source': \"Alice\"");
      expect(formatted).toContain("'target': \"Alice\"");
    });

    it("test_add_multiple_edges", () => {
      const alice = xidLike("Alice");
      const bob = xidLike("Bob");
      const edge1 = makeEdge("self-desc", "foaf:Person", alice, alice);
      const edge2 = makeEdge("knows-bob", "schema:colleague", alice, bob);

      const doc = Envelope.new("Alice").addEdgeEnvelope(edge1).addEdgeEnvelope(edge2);

      const edges = doc.edges();
      expect(edges.length).toBe(2);

      const formatted = doc.format();
      expect(formatted).toContain("'edge'");
      expect(formatted).toContain('"self-desc"');
      expect(formatted).toContain('"knows-bob"');
    });
  });

  // ===================================================================
  // Section 5: Edges retrieval via envelope
  // ===================================================================

  describe("Edges retrieval via envelope", () => {
    it("test_edges_empty", () => {
      const doc = Envelope.new("Alice");
      const edges = doc.edges();
      expect(edges.length).toBe(0);
    });

    it("test_edges_retrieval", () => {
      const alice = xidLike("Alice");
      const edge1 = makeEdge("cred-1", "foaf:Person", alice, alice);
      const edge2 = makeEdge("cred-2", "schema:Thing", alice, alice);

      const doc = Envelope.new("Alice").addEdgeEnvelope(edge1).addEdgeEnvelope(edge2);

      const edges = doc.edges();
      expect(edges.length).toBe(2);

      // Each retrieved edge should be a valid edge
      for (const edge of edges) {
        expect(() => edge.validateEdge()).not.toThrow();
      }
    });
  });

  // ===================================================================
  // Section 6: Edges container operations
  // ===================================================================

  describe("Edges container operations", () => {
    it("test_edges_container_new_is_empty", () => {
      const edges = new Edges();
      expect(edges.isEmpty()).toBe(true);
      expect(edges.len()).toBe(0);
    });

    it("test_edges_container_add_and_get", () => {
      const alice = xidLike("Alice");
      const edge = makeEdge("cred-1", "foaf:Person", alice, alice);
      const digest = edge.digest();

      const edges = new Edges();
      edges.add(edge);

      expect(edges.isEmpty()).toBe(false);
      expect(edges.len()).toBe(1);
      expect(edges.get(digest)).toBeDefined();
      expect(edges.get(digest)?.isEquivalentTo(edge)).toBe(true);
    });

    it("test_edges_container_remove", () => {
      const alice = xidLike("Alice");
      const edge = makeEdge("cred-1", "foaf:Person", alice, alice);
      const digest = edge.digest();

      const edges = new Edges();
      edges.add(edge);

      const removed = edges.remove(digest);
      expect(removed).toBeDefined();
      expect(edges.isEmpty()).toBe(true);
    });

    it("test_edges_container_remove_nonexistent", () => {
      const alice = xidLike("Alice");
      const edge = makeEdge("cred-1", "foaf:Person", alice, alice);

      const edges = new Edges();
      const removed = edges.remove(edge.digest());
      expect(removed).toBeUndefined();
    });

    it("test_edges_container_clear", () => {
      const alice = xidLike("Alice");
      const edge1 = makeEdge("cred-1", "foaf:Person", alice, alice);
      const edge2 = makeEdge("cred-2", "schema:Thing", alice, alice);

      const edges = new Edges();
      edges.add(edge1);
      edges.add(edge2);
      expect(edges.len()).toBe(2);

      edges.clear();
      expect(edges.isEmpty()).toBe(true);
      expect(edges.len()).toBe(0);
    });

    it("test_edges_container_iter", () => {
      const alice = xidLike("Alice");
      const edge1 = makeEdge("cred-1", "foaf:Person", alice, alice);
      const edge2 = makeEdge("cred-2", "schema:Thing", alice, alice);

      const edges = new Edges();
      edges.add(edge1);
      edges.add(edge2);

      const count = Array.from(edges.iter()).length;
      expect(count).toBe(2);
    });
  });

  // ===================================================================
  // Section 7: Edges container round-trip
  // ===================================================================

  describe("Edges container round-trip", () => {
    it("test_edges_container_roundtrip", () => {
      const alice = xidLike("Alice");
      const edge1 = makeEdge("cred-1", "foaf:Person", alice, alice);
      const edge2 = makeEdge("cred-2", "schema:Thing", alice, alice);

      const edges = new Edges();
      edges.add(edge1);
      edges.add(edge2);

      // Serialize to envelope
      const doc = Envelope.new("Alice");
      const docWithEdges = edges.addToEnvelope(doc);

      // Deserialize back
      const recovered = Edges.fromEnvelope(docWithEdges);
      expect(recovered.len()).toBe(2);
      expect(recovered.get(edge1.digest())).toBeDefined();
      expect(recovered.get(edge2.digest())).toBeDefined();
    });

    it("test_edges_container_roundtrip_empty", () => {
      const edges = new Edges();
      const doc = Envelope.new("Alice");
      const docWithEdges = edges.addToEnvelope(doc);

      const recovered = Edges.fromEnvelope(docWithEdges);
      expect(recovered.isEmpty()).toBe(true);
    });

    it("test_edges_container_roundtrip_preserves_format", () => {
      const alice = xidLike("Alice");
      const bob = xidLike("Bob");
      const edge = makeEdge("knows-bob", "schema:colleague", alice, bob);

      const edges = new Edges();
      edges.add(edge);

      const doc = edges.addToEnvelope(Envelope.new("Alice"));

      const formatted = doc.format();
      expect(formatted).toContain("'edge':");
      expect(formatted).toContain('"knows-bob"');
      expect(formatted).toContain("'isA': \"schema:colleague\"");
      expect(formatted).toContain("'source': \"Alice\"");
      expect(formatted).toContain("'target': \"Bob\"");

      const recovered = Edges.fromEnvelope(doc);
      expect(recovered.len()).toBe(1);
    });
  });

  // ===================================================================
  // Section 8: Edgeable trait (tested via Edges container)
  // ===================================================================

  describe("Edgeable trait", () => {
    it("test_edgeable_default_methods", () => {
      const alice = xidLike("Alice");
      const edge = makeEdge("cred-1", "foaf:Person", alice, alice);
      const digest = edge.digest();

      const edges = new Edges();
      edges.add(edge);

      expect(edges.isEmpty()).toBe(false);
      expect(edges.len()).toBe(1);
      expect(edges.get(digest)).toBeDefined();

      const removed = edges.remove(digest);
      expect(removed).toBeDefined();
      expect(edges.isEmpty()).toBe(true);
    });
  });

  // ===================================================================
  // Section 9: edgesMatching — filtered retrieval
  // ===================================================================

  describe("edgesMatching — filtered retrieval", () => {
    it("test_edges_matching_no_filters", () => {
      const alice = xidLike("Alice");
      const bob = xidLike("Bob");
      const edge1 = makeEdge("self-desc", "foaf:Person", alice, alice);
      const edge2 = makeEdge("knows-bob", "schema:colleague", alice, bob);

      const doc = Envelope.new("Alice").addEdgeEnvelope(edge1).addEdgeEnvelope(edge2);

      // No filters => all edges
      const matching = doc.edgesMatching();
      expect(matching.length).toBe(2);
    });

    it("test_edges_matching_by_is_a", () => {
      const alice = xidLike("Alice");
      const bob = xidLike("Bob");
      const edge1 = makeEdge("self-desc", "foaf:Person", alice, alice);
      const edge2 = makeEdge("knows-bob", "schema:colleague", alice, bob);
      const edge3 = makeEdge("self-thing", "foaf:Person", alice, alice);

      const doc = Envelope.new("Alice")
        .addEdgeEnvelope(edge1)
        .addEdgeEnvelope(edge2)
        .addEdgeEnvelope(edge3);

      const isAPerson = Envelope.new("foaf:Person");
      const matching1 = doc.edgesMatching(isAPerson);
      expect(matching1.length).toBe(2);

      const isAColleague = Envelope.new("schema:colleague");
      const matching2 = doc.edgesMatching(isAColleague);
      expect(matching2.length).toBe(1);

      const isANone = Envelope.new("nonexistent");
      const matching3 = doc.edgesMatching(isANone);
      expect(matching3.length).toBe(0);
    });

    it("test_edges_matching_by_source", () => {
      const alice = xidLike("Alice");
      const bob = xidLike("Bob");
      const edge1 = makeEdge("alice-claim", "foaf:Person", alice, alice);
      const edge2 = makeEdge("bob-claim", "foaf:Person", bob, alice);

      const doc = Envelope.new("Alice").addEdgeEnvelope(edge1).addEdgeEnvelope(edge2);

      const matching1 = doc.edgesMatching(undefined, alice);
      expect(matching1.length).toBe(1);

      const matching2 = doc.edgesMatching(undefined, bob);
      expect(matching2.length).toBe(1);

      const carol = xidLike("Carol");
      const matching3 = doc.edgesMatching(undefined, carol);
      expect(matching3.length).toBe(0);
    });

    it("test_edges_matching_by_target", () => {
      const alice = xidLike("Alice");
      const bob = xidLike("Bob");
      const edge1 = makeEdge("self-desc", "foaf:Person", alice, alice);
      const edge2 = makeEdge("knows-bob", "schema:colleague", alice, bob);

      const doc = Envelope.new("Alice").addEdgeEnvelope(edge1).addEdgeEnvelope(edge2);

      const matching1 = doc.edgesMatching(undefined, undefined, alice);
      expect(matching1.length).toBe(1);

      const matching2 = doc.edgesMatching(undefined, undefined, bob);
      expect(matching2.length).toBe(1);
    });

    it("test_edges_matching_by_subject", () => {
      const alice = xidLike("Alice");
      const edge1 = makeEdge("self-desc", "foaf:Person", alice, alice);
      const edge2 = makeEdge("cred-2", "schema:Thing", alice, alice);

      const doc = Envelope.new("Alice").addEdgeEnvelope(edge1).addEdgeEnvelope(edge2);

      const subjectFilter = Envelope.new("self-desc");
      const matching1 = doc.edgesMatching(undefined, undefined, undefined, subjectFilter);
      expect(matching1.length).toBe(1);

      const subjectFilter2 = Envelope.new("nonexistent");
      const matching2 = doc.edgesMatching(undefined, undefined, undefined, subjectFilter2);
      expect(matching2.length).toBe(0);
    });

    it("test_edges_matching_combined_filters", () => {
      const alice = xidLike("Alice");
      const bob = xidLike("Bob");
      const edge1 = makeEdge("self-desc", "foaf:Person", alice, alice);
      const edge2 = makeEdge("self-thing", "foaf:Person", alice, alice);
      const edge3 = makeEdge("knows-bob", "foaf:Person", alice, bob);

      const doc = Envelope.new("Alice")
        .addEdgeEnvelope(edge1)
        .addEdgeEnvelope(edge2)
        .addEdgeEnvelope(edge3);

      // All three are foaf:Person
      const isA = Envelope.new("foaf:Person");
      const matching1 = doc.edgesMatching(isA);
      expect(matching1.length).toBe(3);

      // foaf:Person + target Alice => 2 (self-desc, self-thing)
      const matching2 = doc.edgesMatching(isA, undefined, alice);
      expect(matching2.length).toBe(2);

      // foaf:Person + target Bob => 1 (knows-bob)
      const matching3 = doc.edgesMatching(isA, undefined, bob);
      expect(matching3.length).toBe(1);

      // foaf:Person + target Alice + subject "self-desc" => 1
      const subj1 = Envelope.new("self-desc");
      const matching4 = doc.edgesMatching(isA, undefined, alice, subj1);
      expect(matching4.length).toBe(1);

      // foaf:Person + source Alice + target Bob + subject "knows-bob" => 1
      const subj2 = Envelope.new("knows-bob");
      const matching5 = doc.edgesMatching(isA, alice, bob, subj2);
      expect(matching5.length).toBe(1);

      // All filters that match nothing
      const subj3 = Envelope.new("nonexistent");
      const matching6 = doc.edgesMatching(isA, alice, alice, subj3);
      expect(matching6.length).toBe(0);
    });
  });

  // ===================================================================
  // Section 10: Signed edges
  // ===================================================================

  describe("Signed edges", () => {
    it("test_signed_edge_format", () => {
      const alice = xidLike("Alice");
      const edge = makeEdge("cred-1", "foaf:Person", alice, alice);

      const privateKey = testPrivateKey();
      const signedEdge = edge.wrap().addSignature(privateKey);

      const formatted = signedEdge.format();
      expect(formatted).toContain('"cred-1"');
      expect(formatted).toContain("'isA': \"foaf:Person\"");
      expect(formatted).toContain("'source': \"Alice\"");
      expect(formatted).toContain("'target': \"Alice\"");
      // Signed predicate renders with single quotes (KnownValue)
      expect(formatted).toContain("'signed'");
    });

    it("test_signed_edge_on_document_format", () => {
      const alice = xidLike("Alice");
      const edge = makeEdge("cred-1", "foaf:Person", alice, alice);
      const privateKey = testPrivateKey();
      const signedEdge = edge.wrap().addSignature(privateKey);

      const doc = Envelope.new("Alice").addAssertion("knows", "Bob").addEdgeEnvelope(signedEdge);

      const formatted = doc.format();
      expect(formatted).toContain("'edge': {");
      expect(formatted).toContain("'signed'");
      expect(formatted).toContain("'isA': \"foaf:Person\"");
    });
  });

  // ===================================================================
  // Section 11: Edge coexistence and serialization
  // ===================================================================

  describe("Edge coexistence and serialization", () => {
    it("test_edges_coexist_with_attachments", () => {
      const alice = xidLike("Alice");
      const edge = makeEdge("cred-1", "foaf:Person", alice, alice);

      const doc = Envelope.new("Alice")
        .addAttachment("Metadata", "com.example", "https://example.com/v1")
        .addEdgeEnvelope(edge);

      // Both should be present
      expect(doc.edges().length).toBe(1);
      expect(doc.attachments().length).toBe(1);

      const formatted = doc.format();
      expect(formatted).toContain("'edge'");
      // Attachment predicate renders with single quotes (KnownValue)
      expect(formatted).toContain("'attachment'");
    });

    it("test_edge_ur_roundtrip", () => {
      const alice = xidLike("Alice");
      const edge = makeEdge("cred-1", "foaf:Person", alice, alice);

      const doc = Envelope.new("Alice").addEdgeEnvelope(edge);

      // Round-trip through UR
      const urString = doc.urString();
      const recovered = Envelope.fromUrString(urString);
      expect(recovered.isEquivalentTo(doc)).toBe(true);

      const recoveredEdges = recovered.edges();
      expect(recoveredEdges.length).toBe(1);
      expect(recoveredEdges[0].isEquivalentTo(edge)).toBe(true);
    });

    it("test_multiple_edges_ur_roundtrip", () => {
      const alice = xidLike("Alice");
      const bob = xidLike("Bob");
      const edge1 = makeEdge("self-desc", "foaf:Person", alice, alice);
      const edge2 = makeEdge("knows-bob", "schema:colleague", alice, bob);
      const edge3 = makeEdge("project", "schema:CreativeWork", alice, bob);

      const doc = Envelope.new("Alice")
        .addEdgeEnvelope(edge1)
        .addEdgeEnvelope(edge2)
        .addEdgeEnvelope(edge3);

      const urString = doc.urString();
      const recovered = Envelope.fromUrString(urString);
      expect(recovered.isEquivalentTo(doc)).toBe(true);

      const recoveredEdges = recovered.edges();
      expect(recoveredEdges.length).toBe(3);
    });

    it("test_edge_with_additional_assertions", () => {
      const alice = xidLike("Alice");
      const bob = xidLike("Bob");

      // An edge with extra detail assertions beyond isA/source/target
      // Per BCR-2026-003, this is now INVALID — only the three required
      // assertions are permitted on the edge subject.
      const edge = Envelope.new("knows-bob")
        .addAssertion(IS_A, "schema:colleague")
        .addAssertion(SOURCE, alice)
        .addAssertion(TARGET, bob)
        .addAssertion("department", "Engineering")
        .addAssertion("since", "2024-01-15");

      expect(() => edge.validateEdge()).toThrow(EnvelopeError);
      try {
        edge.validateEdge();
      } catch (e) {
        expect((e as EnvelopeError).code).toBe(ErrorCode.EDGE_UNEXPECTED_ASSERTION);
      }
    });

    it("test_edge_with_claim_detail_on_target", () => {
      // Per BCR-2026-003, claim detail goes as assertions on the *target*
      // object, not on the edge subject itself.
      const alice = xidLike("Alice");
      const target = Envelope.new("Bob")
        .addAssertion("department", "Engineering")
        .addAssertion("since", "2024-01-15");
      const edge = makeEdge("knows-bob", "schema:colleague", alice, target);
      expect(() => edge.validateEdge()).not.toThrow();

      // Target assertions are preserved
      const edgeTarget = edge.edgeTarget();
      expect(edgeTarget.format()).toContain('"Bob"');
      expect(edgeTarget.format()).toContain('"department"');
      expect(edgeTarget.format()).toContain('"Engineering"');
    });

    it("test_edge_with_claim_detail_on_source", () => {
      // The source XID may also carry assertions such as 'dereferenceVia'.
      const source = Envelope.new("Alice")
        .addAssertion(DEREFERENCE_VIA, "https://example.com/xid/");
      const target = xidLike("Bob");
      const edge = makeEdge("knows-bob", "schema:colleague", source, target);
      expect(() => edge.validateEdge()).not.toThrow();

      // Source assertions are preserved
      const edgeSource = edge.edgeSource();
      expect(edgeSource.format()).toContain('"Alice"');
      expect(edgeSource.format()).toContain("'dereferenceVia'");
    });
  });
});
