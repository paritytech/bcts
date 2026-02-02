/**
 * XID privilege enum - 1:1 port of cmd/xid/xid_privilege.rs
 */

import { Privilege } from "@bcts/xid";

/**
 * CLI-level privilege options for XID operations.
 */
export enum XIDPrivilege {
  /** Allow all applicable XID operations */
  All = "all",

  // Operational Functions
  /** Operational: Authenticate as the subject (e.g., log into services) */
  Auth = "auth",
  /** Operational: Sign digital communications as the subject */
  Sign = "sign",
  /** Operational: Encrypt messages from the subject */
  Encrypt = "encrypt",
  /** Operational: Elide data under the subject's control */
  Elide = "elide",
  /** Operational: Issue or revoke verifiable credentials on the subject's authority */
  Issue = "issue",
  /** Operational: Access resources under the subject's control */
  Access = "access",

  // Management Functions
  /** Management: Delegate privileges to third parties */
  Delegate = "delegate",
  /** Management: Verify (update) the XID document */
  Verify = "verify",
  /** Management: Update service endpoints */
  Update = "update",
  /** Management: Remove the inception key from the XID document */
  Transfer = "transfer",
  /** Management: Add or remove other verifiers (rotate keys) */
  Elect = "elect",
  /** Management: Transition to a new provenance mark chain */
  Burn = "burn",
  /** Management: Revoke the XID entirely */
  Revoke = "revoke",
}

/**
 * Convert XIDPrivilege to the XID library's Privilege type.
 */
export function toPrivilege(privilege: XIDPrivilege): Privilege {
  switch (privilege) {
    case XIDPrivilege.All:
      return Privilege.All;
    case XIDPrivilege.Auth:
      return Privilege.Auth;
    case XIDPrivilege.Sign:
      return Privilege.Sign;
    case XIDPrivilege.Encrypt:
      return Privilege.Encrypt;
    case XIDPrivilege.Elide:
      return Privilege.Elide;
    case XIDPrivilege.Issue:
      return Privilege.Issue;
    case XIDPrivilege.Access:
      return Privilege.Access;
    case XIDPrivilege.Delegate:
      return Privilege.Delegate;
    case XIDPrivilege.Verify:
      return Privilege.Verify;
    case XIDPrivilege.Update:
      return Privilege.Update;
    case XIDPrivilege.Transfer:
      return Privilege.Transfer;
    case XIDPrivilege.Elect:
      return Privilege.Elect;
    case XIDPrivilege.Burn:
      return Privilege.Burn;
    case XIDPrivilege.Revoke:
      return Privilege.Revoke;
  }
}
