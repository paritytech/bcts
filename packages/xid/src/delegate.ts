/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * XID Delegate
 *
 * Represents a delegate in an XID document, containing a controller XIDDocument
 * and permissions.
 *
 * Ported from bc-xid-rust/src/delegate.rs
 */

import { type Envelope, type EnvelopeEncodable } from "@bcts/envelope";
import { Reference, type XID } from "@bcts/components";
import { Permissions, type HasPermissions } from "./permissions";
import { Shared } from "./shared";

/**
 * Forward declaration interface for XIDDocument to avoid circular dependency.
 * The actual XIDDocument class implements this interface.
 */
export interface XIDDocumentType {
  xid(): XID;
  intoEnvelope(): Envelope;
  clone(): XIDDocumentType;
}

// This will be set by xid-document.ts when it loads
let XIDDocumentClass: {
  tryFromEnvelope(envelope: Envelope): XIDDocumentType;
} | null = null;

/**
 * Register the XIDDocument class to avoid circular dependency issues.
 * Called by xid-document.ts when it loads.
 */
export function registerXIDDocumentClass(cls: {
  tryFromEnvelope(envelope: Envelope): XIDDocumentType;
}): void {
  XIDDocumentClass = cls;
}

/**
 * Represents a delegate in an XID document.
 */
export class Delegate implements HasPermissions, EnvelopeEncodable {
  private readonly _controller: Shared<XIDDocumentType>;
  private readonly _permissions: Permissions;

  private constructor(controller: Shared<XIDDocumentType>, permissions: Permissions) {
    this._controller = controller;
    this._permissions = permissions;
  }

  /**
   * Create a new Delegate with the given controller document.
   */
  static new(controller: XIDDocumentType): Delegate {
    return new Delegate(Shared.new(controller), Permissions.new());
  }

  /**
   * Get the controller document.
   */
  controller(): Shared<XIDDocumentType> {
    return this._controller;
  }

  /**
   * Get the XID of the controller.
   */
  xid(): XID {
    return this._controller.read().xid();
  }

  /**
   * Get the reference for this delegate.
   */
  reference(): Reference {
    return Reference.hash(this.xid().toData());
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
    const doc = this._controller.read();
    const envelope = (doc.intoEnvelope() as unknown as { wrap(): Envelope }).wrap();
    return this._permissions.addToEnvelope(envelope);
  }

  /**
   * Try to extract a Delegate from an envelope.
   */
  static tryFromEnvelope(envelope: Envelope): Delegate {
    if (XIDDocumentClass === null) {
      throw new Error("XIDDocument class not registered. Import xid-document.js first.");
    }

    const permissions = Permissions.tryFromEnvelope(envelope);
    const inner = (envelope as unknown as { tryUnwrap(): Envelope }).tryUnwrap();
    const controller = Shared.new(XIDDocumentClass.tryFromEnvelope(inner));
    return new Delegate(controller, permissions);
  }

  /**
   * Check equality with another Delegate (based on controller XID).
   */
  equals(other: Delegate): boolean {
    return this.xid().equals(other.xid());
  }

  /**
   * Get a hash key for use in Sets/Maps.
   */
  hashKey(): string {
    return this.xid().toHex();
  }

  /**
   * Clone this Delegate.
   */
  clone(): Delegate {
    return new Delegate(Shared.new(this._controller.read().clone()), this._permissions.clone());
  }
}
