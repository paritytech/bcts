/**
 * Permissions tests
 * Ported from bc-xid-rust/tests/permissions.rs
 */

import { Envelope } from "@bcts/envelope";
import { Permissions, Privilege } from "../src";

describe("Permissions", () => {
  it("should create empty permissions", () => {
    const permissions = Permissions.new();
    expect(permissions.allow.size).toBe(0);
    expect(permissions.deny.size).toBe(0);
  });

  it("should add allow and deny permissions", () => {
    const permissions = Permissions.new();
    expect(permissions.allow.size).toBe(0);
    expect(permissions.deny.size).toBe(0);

    permissions.addAllow(Privilege.All);
    permissions.addDeny(Privilege.Verify);

    expect(permissions.allow.has(Privilege.All)).toBe(true);
    expect(permissions.deny.has(Privilege.Verify)).toBe(true);
  });

  it("should add permissions to envelope and restore", () => {
    const permissions = Permissions.new();
    permissions.addAllow(Privilege.All);
    permissions.addDeny(Privilege.Verify);

    const envelope = permissions.addToEnvelope(Envelope.new("Subject"));
    const permissions2 = Permissions.tryFromEnvelope(envelope);
    expect(permissions.equals(permissions2)).toBe(true);
  });

  it("should create allow-all permissions", () => {
    const permissions = Permissions.newAllowAll();
    expect(permissions.allow.has(Privilege.All)).toBe(true);
    expect(permissions.deny.size).toBe(0);
  });

  it("should add individual allow permissions", () => {
    const permissions = Permissions.new();
    permissions.addAllow(Privilege.Encrypt);
    permissions.addAllow(Privilege.Sign);

    expect(permissions.allow.has(Privilege.Encrypt)).toBe(true);
    expect(permissions.allow.has(Privilege.Sign)).toBe(true);
    expect(permissions.allow.size).toBe(2);
  });

  it("should clone permissions correctly", () => {
    const permissions = Permissions.new();
    permissions.addAllow(Privilege.All);
    permissions.addDeny(Privilege.Verify);

    const cloned = permissions.clone();
    expect(cloned.equals(permissions)).toBe(true);

    // Modifying clone should not affect original
    cloned.addAllow(Privilege.Encrypt);
    expect(permissions.allow.has(Privilege.Encrypt)).toBe(false);
    expect(cloned.allow.has(Privilege.Encrypt)).toBe(true);
  });
});
