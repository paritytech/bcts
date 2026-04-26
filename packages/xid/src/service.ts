/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * XID Service
 *
 * Represents a service endpoint in an XID document, containing URI, key references,
 * delegate references, permissions, capability, and name.
 *
 * Ported from bc-xid-rust/src/service.rs.
 *
 * Wire shape — mirrors Rust:
 * ```
 * URI("…") [
 *     'key': Reference(...)
 *     'delegate': Reference(...)
 *     'capability': "..."
 *     'name': "..."
 *     'allow': '...'
 * ]
 * ```
 *
 * The subject is a tagged URI (`tag(TAG_URI, text)`), each `key` /
 * `delegate` object is a tagged Reference (`tag(TAG_REFERENCE,
 * byte_string(32))`).
 */

import { Envelope, type EnvelopeEncodable, type EnvelopeEncodableValue } from "@bcts/envelope";
import { KEY, DELEGATE, NAME, CAPABILITY, ALLOW, type KnownValue } from "@bcts/known-values";
import { Reference, URI, type PublicKeys, type XID } from "@bcts/components";
import type { Cbor } from "@bcts/dcbor";
import { Permissions, type HasPermissions } from "./permissions";
import { privilegeFromEnvelope } from "./privilege";
import { XIDError } from "./error";

// Helper to convert KnownValue to EnvelopeEncodableValue
const kv = (v: KnownValue): EnvelopeEncodableValue => v;

// Raw values for predicate matching
const KEY_RAW = KEY.value();
const DELEGATE_RAW = DELEGATE.value();
const NAME_RAW = NAME.value();
const CAPABILITY_RAW = CAPABILITY.value();
const ALLOW_RAW = ALLOW.value();

/**
 * Map a `Reference` to a stable string key, used to back the internal
 * `Map` so the typed value compares structurally.
 */
const referenceKey = (reference: Reference): string => reference.toHex();

/**
 * Represents a service endpoint in an XID document.
 */
export class Service implements HasPermissions, EnvelopeEncodable {
  private readonly _uri: URI;
  private _keyReferences: Map<string, Reference>;
  private _delegateReferences: Map<string, Reference>;
  private _permissions: Permissions;
  private _capability: string;
  private _name: string;

  constructor(uri: URI | string) {
    this._uri = uri instanceof URI ? uri : URI.from(uri);
    this._keyReferences = new Map();
    this._delegateReferences = new Map();
    this._permissions = Permissions.new();
    this._capability = "";
    this._name = "";
  }

  /**
   * Create a new Service with the given URI.
   */
  static new(uri: URI | string): Service {
    return new Service(uri);
  }

  /**
   * Get the service URI as a typed value.
   */
  uri(): URI {
    return this._uri;
  }

  /**
   * Get the service URI as a plain string.
   */
  uriString(): string {
    return this._uri.toString();
  }

  /**
   * Get the capability string.
   */
  capability(): string {
    return this._capability;
  }

  /**
   * Set the capability string.
   */
  setCapability(capability: string): void {
    this._capability = capability;
  }

  /**
   * Add a capability, throwing if one already exists or is empty.
   */
  addCapability(capability: string): void {
    if (this._capability !== "") {
      throw XIDError.duplicate("capability");
    }
    if (capability === "") {
      throw XIDError.emptyValue("capability");
    }
    this.setCapability(capability);
  }

  /**
   * Get the key references as a Set of typed Reference values.
   */
  keyReferences(): Set<Reference> {
    return new Set(this._keyReferences.values());
  }

  /**
   * Get the underlying key-references Map for direct mutation.
   */
  keyReferencesMut(): Map<string, Reference> {
    return this._keyReferences;
  }

  /**
   * Add a key reference by hex string (back-compat alias).
   */
  addKeyReferenceHex(keyReferenceHex: string): void {
    this.addKeyReference(Reference.fromHex(keyReferenceHex));
  }

  /**
   * Add a key reference.
   */
  addKeyReference(keyReference: Reference): void {
    const key = referenceKey(keyReference);
    if (this._keyReferences.has(key)) {
      throw XIDError.duplicate("key reference");
    }
    this._keyReferences.set(key, keyReference);
  }

  /**
   * Get the delegate references as a Set of typed Reference values.
   */
  delegateReferences(): Set<Reference> {
    return new Set(this._delegateReferences.values());
  }

  /**
   * Get the underlying delegate-references Map for direct mutation.
   */
  delegateReferencesMut(): Map<string, Reference> {
    return this._delegateReferences;
  }

  /**
   * Add a delegate reference by hex string (back-compat alias).
   */
  addDelegateReferenceHex(delegateReferenceHex: string): void {
    this.addDelegateReference(Reference.fromHex(delegateReferenceHex));
  }

  /**
   * Add a delegate reference.
   */
  addDelegateReference(delegateReference: Reference): void {
    const key = referenceKey(delegateReference);
    if (this._delegateReferences.has(key)) {
      throw XIDError.duplicate("delegate reference");
    }
    this._delegateReferences.set(key, delegateReference);
  }

  /**
   * Add a key by its public keys provider (convenience method).
   * Matches Rust's `add_key(&mut self, key: &dyn PublicKeysProvider)`.
   */
  addKey(keyProvider: { publicKeys(): PublicKeys }): void {
    this.addKeyReference(keyProvider.publicKeys().reference());
  }

  /**
   * Add a delegate by its XID provider (convenience method).
   *
   * Mirrors Rust's `add_delegate(&mut self, delegate: &dyn XIDProvider)`,
   * which delegates to `xid.reference()` — i.e. the XID's 32 bytes used
   * directly as the Reference. The earlier port hashed the bytes with
   * SHA-256, producing a different reference that didn't round-trip
   * across implementations.
   */
  addDelegate(xidProvider: { xid(): XID }): void {
    this.addDelegateReference(xidProvider.xid().reference());
  }

  /**
   * Get the name.
   */
  name(): string {
    return this._name;
  }

  /**
   * Set the name, throwing if one already exists or is empty.
   */
  setName(name: string): void {
    if (this._name !== "") {
      throw XIDError.duplicate("name");
    }
    if (name === "") {
      throw XIDError.emptyValue("name");
    }
    this._name = name;
  }

  // HasPermissions implementation
  permissions(): Permissions {
    return this._permissions;
  }

  permissionsMut(): Permissions {
    return this._permissions;
  }

  /**
   * Convert to envelope.
   */
  intoEnvelope(): Envelope {
    let envelope = Envelope.new(this._uri);

    for (const reference of this._keyReferences.values()) {
      envelope = envelope.addAssertion(kv(KEY), reference);
    }

    for (const reference of this._delegateReferences.values()) {
      envelope = envelope.addAssertion(kv(DELEGATE), reference);
    }

    if (this._capability !== "") {
      envelope = envelope.addAssertion(kv(CAPABILITY), this._capability);
    }

    if (this._name !== "") {
      envelope = envelope.addAssertion(kv(NAME), this._name);
    }

    envelope = this._permissions.addToEnvelope(envelope);

    return envelope;
  }

  /**
   * Try to extract a Service from an envelope.
   *
   * Mirrors Rust `Service::try_from`:
   * - Subject must be a tagged-CBOR URI leaf.
   * - Each `'key'`/`'delegate'` object is a tagged Reference leaf.
   * - Nested assertions on any object are rejected.
   * - Unknown predicates are rejected.
   */
  static tryFromEnvelope(envelope: Envelope): Service {
    type EnvelopeExt = Envelope & {
      subject(): Envelope;
      tryLeaf(): Cbor;
      tryPredicate(): Envelope;
      tryObject(): Envelope;
      tryKnownValue(): KnownValue;
      assertions(): Envelope[];
      hasAssertions(): boolean;
      asText(): string | undefined;
    };

    const env = envelope as EnvelopeExt;
    const subjectLeaf = (env.subject() as EnvelopeExt).tryLeaf();
    const uri = URI.fromTaggedCbor(subjectLeaf);

    const service = new Service(uri);

    for (const assertion of env.assertions()) {
      const predicateEnv = (assertion as EnvelopeExt).tryPredicate() as EnvelopeExt;
      const knownValue = predicateEnv.tryKnownValue();
      const object = (assertion as EnvelopeExt).tryObject() as EnvelopeExt;
      if (object.hasAssertions()) {
        throw XIDError.unexpectedNestedAssertions();
      }
      const predicate = knownValue.value();

      switch (predicate) {
        case KEY_RAW: {
          const reference = Reference.fromTaggedCbor(object.tryLeaf());
          service.addKeyReference(reference);
          break;
        }
        case DELEGATE_RAW: {
          const reference = Reference.fromTaggedCbor(object.tryLeaf());
          service.addDelegateReference(reference);
          break;
        }
        case CAPABILITY_RAW: {
          const capability = object.asText();
          if (capability === undefined) {
            throw XIDError.envelopeParsing(new Error("capability is not text"));
          }
          service.addCapability(capability);
          break;
        }
        case NAME_RAW: {
          const name = object.asText();
          if (name === undefined) {
            throw XIDError.envelopeParsing(new Error("name is not text"));
          }
          service.setName(name);
          break;
        }
        case ALLOW_RAW: {
          const privilege = privilegeFromEnvelope(object);
          service._permissions.addAllow(privilege);
          break;
        }
        default:
          throw XIDError.unexpectedPredicate(String(predicate));
      }
    }

    return service;
  }

  /**
   * Check equality with another Service (based on URI).
   */
  equals(other: Service): boolean {
    return this._uri.toString() === other._uri.toString();
  }

  /**
   * Get a hash key for use in Sets/Maps.
   */
  hashKey(): string {
    return this._uri.toString();
  }

  /**
   * Clone this Service.
   */
  clone(): Service {
    const clone = new Service(this._uri);
    clone._keyReferences = new Map(this._keyReferences);
    clone._delegateReferences = new Map(this._delegateReferences);
    clone._permissions = this._permissions.clone();
    clone._capability = this._capability;
    clone._name = this._name;
    return clone;
  }
}
