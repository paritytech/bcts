/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * XID Privileges
 *
 * Defines the various privileges that can be granted to keys and delegates
 * in an XID document.
 *
 * Ported from bc-xid-rust/src/privilege.rs
 */

import {
  type KnownValue,
  PRIVILEGE_ALL,
  PRIVILEGE_AUTH,
  PRIVILEGE_SIGN,
  PRIVILEGE_ENCRYPT,
  PRIVILEGE_ELIDE,
  PRIVILEGE_ISSUE,
  PRIVILEGE_ACCESS,
  PRIVILEGE_DELEGATE,
  PRIVILEGE_VERIFY,
  PRIVILEGE_UPDATE,
  PRIVILEGE_TRANSFER,
  PRIVILEGE_ELECT,
  PRIVILEGE_BURN,
  PRIVILEGE_REVOKE,
} from "@bcts/known-values";
import { Envelope } from "@bcts/envelope";
import { XIDError } from "./error";

/**
 * Enum representing XID privileges.
 */
export enum Privilege {
  // Operational Functions
  /** Allow all applicable XID operations */
  All = "All",
  /** Authenticate as the subject (e.g., log into services) */
  Auth = "Auth",
  /** Sign digital communications as the subject */
  Sign = "Sign",
  /** Encrypt messages from the subject */
  Encrypt = "Encrypt",
  /** Elide data under the subject's control */
  Elide = "Elide",
  /** Issue or revoke verifiable credentials on the subject's authority */
  Issue = "Issue",
  /** Access resources under the subject's control */
  Access = "Access",

  // Management Functions
  /** Delegate privileges to third parties */
  Delegate = "Delegate",
  /** Verify (update) the XID document */
  Verify = "Verify",
  /** Update service endpoints */
  Update = "Update",
  /** Remove the inception key from the XID document */
  Transfer = "Transfer",
  /** Add or remove other verifiers (rotate keys) */
  Elect = "Elect",
  /** Transition to a new provenance mark chain */
  Burn = "Burn",
  /** Revoke the XID entirely */
  Revoke = "Revoke",
}

/**
 * Convert a Privilege to its corresponding KnownValue.
 */
export function privilegeToKnownValue(privilege: Privilege): KnownValue {
  switch (privilege) {
    case Privilege.All:
      return PRIVILEGE_ALL;
    case Privilege.Auth:
      return PRIVILEGE_AUTH;
    case Privilege.Sign:
      return PRIVILEGE_SIGN;
    case Privilege.Encrypt:
      return PRIVILEGE_ENCRYPT;
    case Privilege.Elide:
      return PRIVILEGE_ELIDE;
    case Privilege.Issue:
      return PRIVILEGE_ISSUE;
    case Privilege.Access:
      return PRIVILEGE_ACCESS;
    case Privilege.Delegate:
      return PRIVILEGE_DELEGATE;
    case Privilege.Verify:
      return PRIVILEGE_VERIFY;
    case Privilege.Update:
      return PRIVILEGE_UPDATE;
    case Privilege.Transfer:
      return PRIVILEGE_TRANSFER;
    case Privilege.Elect:
      return PRIVILEGE_ELECT;
    case Privilege.Burn:
      return PRIVILEGE_BURN;
    case Privilege.Revoke:
      return PRIVILEGE_REVOKE;
    default:
      throw XIDError.unknownPrivilege();
  }
}

/**
 * Convert a KnownValue to its corresponding Privilege.
 */
export function privilegeFromKnownValue(knownValue: KnownValue): Privilege {
  const value = knownValue.value();
  switch (value) {
    case PRIVILEGE_ALL.value():
      return Privilege.All;
    case PRIVILEGE_AUTH.value():
      return Privilege.Auth;
    case PRIVILEGE_SIGN.value():
      return Privilege.Sign;
    case PRIVILEGE_ENCRYPT.value():
      return Privilege.Encrypt;
    case PRIVILEGE_ELIDE.value():
      return Privilege.Elide;
    case PRIVILEGE_ISSUE.value():
      return Privilege.Issue;
    case PRIVILEGE_ACCESS.value():
      return Privilege.Access;
    case PRIVILEGE_DELEGATE.value():
      return Privilege.Delegate;
    case PRIVILEGE_VERIFY.value():
      return Privilege.Verify;
    case PRIVILEGE_UPDATE.value():
      return Privilege.Update;
    case PRIVILEGE_TRANSFER.value():
      return Privilege.Transfer;
    case PRIVILEGE_ELECT.value():
      return Privilege.Elect;
    case PRIVILEGE_BURN.value():
      return Privilege.Burn;
    case PRIVILEGE_REVOKE.value():
      return Privilege.Revoke;
    default:
      throw XIDError.unknownPrivilege();
  }
}

/**
 * Convert a Privilege to an Envelope.
 */
export function privilegeToEnvelope(privilege: Privilege): Envelope {
  return Envelope.newWithKnownValue(privilegeToKnownValue(privilege));
}

/**
 * Convert an Envelope to a Privilege.
 */
export function privilegeFromEnvelope(envelope: Envelope): Privilege {
  const envelopeCase = envelope.case();
  if (envelopeCase.type !== "knownValue") {
    throw XIDError.unknownPrivilege();
  }
  return privilegeFromKnownValue(envelopeCase.value);
}
