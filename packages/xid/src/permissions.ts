/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * XID Permissions
 *
 * Permissions management for XID documents, including allow and deny sets
 * of privileges.
 *
 * Ported from bc-xid-rust/src/permissions.rs
 */

import { ALLOW, DENY } from "@bcts/known-values";
import { Envelope } from "@bcts/envelope";
import { Privilege, privilegeFromEnvelope, privilegeToKnownValue } from "./privilege";

/**
 * Interface for types that have permissions.
 */
export interface HasPermissions {
  /**
   * Get the permissions for this object.
   */
  permissions(): Permissions;

  /**
   * Get a mutable reference to the permissions.
   */
  permissionsMut(): Permissions;
}

/**
 * Helper methods for HasPermissions implementers.
 */
export const HasPermissionsMixin = {
  /**
   * Get the set of allowed privileges.
   */
  allow(obj: HasPermissions): Set<Privilege> {
    return obj.permissions().allow;
  },

  /**
   * Get the set of denied privileges.
   */
  deny(obj: HasPermissions): Set<Privilege> {
    return obj.permissions().deny;
  },

  /**
   * Add an allowed privilege.
   */
  addAllow(obj: HasPermissions, privilege: Privilege): void {
    obj.permissionsMut().allow.add(privilege);
  },

  /**
   * Add a denied privilege.
   */
  addDeny(obj: HasPermissions, privilege: Privilege): void {
    obj.permissionsMut().deny.add(privilege);
  },

  /**
   * Remove an allowed privilege.
   */
  removeAllow(obj: HasPermissions, privilege: Privilege): void {
    obj.permissionsMut().allow.delete(privilege);
  },

  /**
   * Remove a denied privilege.
   */
  removeDeny(obj: HasPermissions, privilege: Privilege): void {
    obj.permissionsMut().deny.delete(privilege);
  },

  /**
   * Clear all permissions.
   */
  clearAllPermissions(obj: HasPermissions): void {
    obj.permissionsMut().allow.clear();
    obj.permissionsMut().deny.clear();
  },
};

/**
 * Represents the permissions granted to a key or delegate.
 */
export class Permissions implements HasPermissions {
  public allow: Set<Privilege>;
  public deny: Set<Privilege>;

  constructor(allow?: Set<Privilege>, deny?: Set<Privilege>) {
    this.allow = allow ?? new Set();
    this.deny = deny ?? new Set();
  }

  /**
   * Create a new empty Permissions object.
   */
  static new(): Permissions {
    return new Permissions();
  }

  /**
   * Create a new Permissions object that allows all privileges.
   */
  static newAllowAll(): Permissions {
    const allow = new Set<Privilege>();
    allow.add(Privilege.All);
    return new Permissions(allow);
  }

  /**
   * Add permissions assertions to an envelope.
   */
  addToEnvelope(envelope: Envelope): Envelope {
    let result = envelope;

    // Add allow assertions
    for (const privilege of this.allow) {
      result = result.addAssertion(
        Envelope.newWithKnownValue(ALLOW.value()),
        Envelope.newWithKnownValue(privilegeToKnownValue(privilege).value()),
      );
    }

    // Add deny assertions
    for (const privilege of this.deny) {
      result = result.addAssertion(
        Envelope.newWithKnownValue(DENY.value()),
        Envelope.newWithKnownValue(privilegeToKnownValue(privilege).value()),
      );
    }

    return result;
  }

  /**
   * Try to extract Permissions from an envelope.
   */
  static tryFromEnvelope(envelope: Envelope): Permissions {
    const allow = new Set<Privilege>();
    const deny = new Set<Privilege>();

    // Extract allow assertions
    const allowObjects = (
      envelope as unknown as { objectsForPredicate(p: unknown): Envelope[] }
    ).objectsForPredicate(ALLOW);
    for (const obj of allowObjects) {
      const privilege = privilegeFromEnvelope(obj);
      allow.add(privilege);
    }

    // Extract deny assertions
    const denyObjects = (
      envelope as unknown as { objectsForPredicate(p: unknown): Envelope[] }
    ).objectsForPredicate(DENY);
    for (const obj of denyObjects) {
      const privilege = privilegeFromEnvelope(obj);
      deny.add(privilege);
    }

    return new Permissions(allow, deny);
  }

  /**
   * Add an allowed privilege.
   */
  addAllow(privilege: Privilege): void {
    this.allow.add(privilege);
  }

  /**
   * Add a denied privilege.
   */
  addDeny(privilege: Privilege): void {
    this.deny.add(privilege);
  }

  /**
   * Check if a specific privilege is allowed.
   */
  isAllowed(privilege: Privilege): boolean {
    // Deny takes precedence
    if (this.deny.has(privilege) || this.deny.has(Privilege.All)) {
      return false;
    }
    // Check if specifically allowed or all is allowed
    return this.allow.has(privilege) || this.allow.has(Privilege.All);
  }

  /**
   * Check if a specific privilege is denied.
   */
  isDenied(privilege: Privilege): boolean {
    return this.deny.has(privilege) || this.deny.has(Privilege.All);
  }

  // HasPermissions implementation
  permissions(): Permissions {
    return this;
  }

  permissionsMut(): Permissions {
    return this;
  }

  /**
   * Check equality with another Permissions object.
   */
  equals(other: Permissions): boolean {
    if (this.allow.size !== other.allow.size || this.deny.size !== other.deny.size) {
      return false;
    }
    for (const p of this.allow) {
      if (!other.allow.has(p)) return false;
    }
    for (const p of this.deny) {
      if (!other.deny.has(p)) return false;
    }
    return true;
  }

  /**
   * Clone this Permissions object.
   */
  clone(): Permissions {
    return new Permissions(new Set(this.allow), new Set(this.deny));
  }
}
