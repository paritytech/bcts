/**
 * XID Service
 *
 * Represents a service endpoint in an XID document, containing URI, key references,
 * delegate references, permissions, capability, and name.
 *
 * Ported from bc-xid-rust/src/service.rs
 */

import { Envelope, type EnvelopeEncodable } from "@blockchain-commons/envelope";
import { KEY, DELEGATE, NAME, CAPABILITY, ALLOW } from "@blockchain-commons/known-values";
import type { Reference } from "@blockchain-commons/components";
import { Permissions, type HasPermissions } from "./permissions.js";
import { privilegeFromEnvelope } from "./privilege.js";
import { XIDError } from "./error.js";

// Raw values for predicate matching
const KEY_RAW = KEY.value();
const DELEGATE_RAW = DELEGATE.value();
const NAME_RAW = NAME.value();
const CAPABILITY_RAW = CAPABILITY.value();
const ALLOW_RAW = ALLOW.value();

/**
 * Represents a service endpoint in an XID document.
 */
export class Service implements HasPermissions, EnvelopeEncodable {
  private readonly _uri: string;
  private _keyReferences: Set<string>; // Store as hex strings for easier comparison
  private _delegateReferences: Set<string>;
  private _permissions: Permissions;
  private _capability: string;
  private _name: string;

  constructor(uri: string) {
    this._uri = uri;
    this._keyReferences = new Set();
    this._delegateReferences = new Set();
    this._permissions = Permissions.new();
    this._capability = "";
    this._name = "";
  }

  /**
   * Create a new Service with the given URI.
   */
  static new(uri: string): Service {
    return new Service(uri);
  }

  /**
   * Get the service URI.
   */
  uri(): string {
    return this._uri;
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
   * Get the key references set.
   */
  keyReferences(): Set<string> {
    return this._keyReferences;
  }

  /**
   * Get the key references set for mutation.
   */
  keyReferencesMut(): Set<string> {
    return this._keyReferences;
  }

  /**
   * Add a key reference by hex string.
   */
  addKeyReferenceHex(keyReferenceHex: string): void {
    if (this._keyReferences.has(keyReferenceHex)) {
      throw XIDError.duplicate("key reference");
    }
    this._keyReferences.add(keyReferenceHex);
  }

  /**
   * Add a key reference.
   */
  addKeyReference(keyReference: Reference): void {
    this.addKeyReferenceHex(keyReference.toHex());
  }

  /**
   * Get the delegate references set.
   */
  delegateReferences(): Set<string> {
    return this._delegateReferences;
  }

  /**
   * Get the delegate references set for mutation.
   */
  delegateReferencesMut(): Set<string> {
    return this._delegateReferences;
  }

  /**
   * Add a delegate reference by hex string.
   */
  addDelegateReferenceHex(delegateReferenceHex: string): void {
    if (this._delegateReferences.has(delegateReferenceHex)) {
      throw XIDError.duplicate("delegate reference");
    }
    this._delegateReferences.add(delegateReferenceHex);
  }

  /**
   * Add a delegate reference.
   */
  addDelegateReference(delegateReference: Reference): void {
    this.addDelegateReferenceHex(delegateReference.toHex());
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

    // Add key references
    for (const keyRef of this._keyReferences) {
      const refBytes = hexToBytes(keyRef);
      envelope = envelope.addAssertion(KEY, refBytes);
    }

    // Add delegate references
    for (const delegateRef of this._delegateReferences) {
      const refBytes = hexToBytes(delegateRef);
      envelope = envelope.addAssertion(DELEGATE, refBytes);
    }

    // Add capability if not empty
    if (this._capability !== "") {
      envelope = envelope.addAssertion(CAPABILITY, this._capability);
    }

    // Add name if not empty
    if (this._name !== "") {
      envelope = envelope.addAssertion(NAME, this._name);
    }

    // Add permissions
    envelope = this._permissions.addToEnvelope(envelope);

    return envelope;
  }

  /**
   * Try to extract a Service from an envelope.
   */
  static tryFromEnvelope(envelope: Envelope): Service {
    // Extract URI from subject
    const uri = (envelope as unknown as { asText(): string | undefined }).asText();
    if (uri === undefined) {
      throw XIDError.component(new Error("Could not extract URI from envelope"));
    }

    const service = new Service(uri);

    // Process assertions
    const assertions = (envelope as unknown as { assertions(): Envelope[] }).assertions();
    for (const assertion of assertions) {
      const assertionCase = assertion.case();
      if (assertionCase.type !== "assertion") {
        continue;
      }

      const predicateEnv = assertionCase.assertion.predicate() as Envelope;
      const predicateCase = predicateEnv.case();
      if (predicateCase.type !== "knownValue") {
        continue;
      }

      const predicate = predicateCase.value.value();
      const object = assertionCase.assertion.object() as Envelope;

      // Check for nested assertions
      const objectAssertions = (object as unknown as { assertions(): Envelope[] }).assertions();
      if (objectAssertions.length > 0) {
        throw XIDError.unexpectedNestedAssertions();
      }

      switch (predicate) {
        case KEY_RAW: {
          const keyData = (
            object as unknown as { asByteString(): Uint8Array | undefined }
          ).asByteString();
          if (keyData !== undefined) {
            service.addKeyReferenceHex(bytesToHex(keyData));
          }
          break;
        }
        case DELEGATE_RAW: {
          const delegateData = (
            object as unknown as { asByteString(): Uint8Array | undefined }
          ).asByteString();
          if (delegateData !== undefined) {
            service.addDelegateReferenceHex(bytesToHex(delegateData));
          }
          break;
        }
        case CAPABILITY_RAW: {
          const capability = (object as unknown as { asText(): string | undefined }).asText();
          if (capability !== undefined) {
            service.addCapability(capability);
          }
          break;
        }
        case NAME_RAW: {
          const name = (object as unknown as { asText(): string | undefined }).asText();
          if (name !== undefined) {
            service.setName(name);
          }
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
    return this._uri === other._uri;
  }

  /**
   * Get a hash key for use in Sets/Maps.
   */
  hashKey(): string {
    return this._uri;
  }

  /**
   * Clone this Service.
   */
  clone(): Service {
    const clone = new Service(this._uri);
    clone._keyReferences = new Set(this._keyReferences);
    clone._delegateReferences = new Set(this._delegateReferences);
    clone._permissions = this._permissions.clone();
    clone._capability = this._capability;
    clone._name = this._name;
    return clone;
  }
}

// Helper functions
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
