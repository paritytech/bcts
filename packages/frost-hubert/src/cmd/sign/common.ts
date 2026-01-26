/**
 * Common utilities for sign commands.
 *
 * Port of cmd/sign/common.rs from frost-hubert-rust.
 *
 * @module
 */

import { Envelope, type EnvelopeEncodableValue } from "@bcts/envelope";

import { groupStateDir } from "../common";

/**
 * Get the signing state directory for a group (without session).
 *
 * Path: `{registry_dir}/group-state/{group_id.hex()}/signing`
 *
 * Port of `signing_state_dir_for_group()` from cmd/sign/common.rs.
 */
export function signingStateDirForGroup(registryPath: string, groupIdHex: string): string {
  return `${groupStateDir(registryPath, groupIdHex)}/signing`;
}

/**
 * Get the signing state directory for a given registry path, group ID, and session ID.
 *
 * Path: `{registry_dir}/group-state/{group_id.hex()}/signing/{session_id.hex()}`
 *
 * Port of `signing_state_dir()` from cmd/sign/common.rs.
 */
export function signingStateDir(
  registryPath: string,
  groupIdHex: string,
  sessionIdHex: string,
): string {
  return `${signingStateDirForGroup(registryPath, groupIdHex)}/${sessionIdHex}`;
}

/**
 * Content wrapper for signFinalize events.
 *
 * This wraps an envelope with a unit subject and type assertion
 * "signFinalize", implementing the traits required by SealedEvent<T>.
 *
 * Port of `struct SignFinalizeContent` from cmd/sign/common.rs.
 */
export class SignFinalizeContent {
  private readonly _envelope: Envelope;

  private constructor(envelope: Envelope) {
    this._envelope = envelope;
  }

  /**
   * Creates a new SignFinalizeContent with a unit subject and type assertion.
   *
   * Port of `SignFinalizeContent::new()` from cmd/sign/common.rs.
   */
  static new(): SignFinalizeContent {
    const envelope = Envelope.unit().addType("signFinalize");
    return new SignFinalizeContent(envelope);
  }

  /**
   * Adds an assertion to the content envelope.
   *
   * Port of `SignFinalizeContent::add_assertion()` from cmd/sign/common.rs.
   */
  addAssertion(
    predicate: EnvelopeEncodableValue,
    object: EnvelopeEncodableValue,
  ): SignFinalizeContent {
    const newEnvelope = this._envelope.addAssertion(predicate, object);
    return new SignFinalizeContent(newEnvelope);
  }

  /**
   * Returns the inner envelope.
   *
   * Port of `SignFinalizeContent::envelope()` from cmd/sign/common.rs.
   */
  envelope(): Envelope {
    return this._envelope;
  }

  /**
   * Creates a SignFinalizeContent from an envelope with validation.
   *
   * Validates that the envelope has a unit subject and type "signFinalize".
   *
   * Port of `TryFrom<Envelope> for SignFinalizeContent` from cmd/sign/common.rs.
   */
  static fromEnvelope(envelope: Envelope): SignFinalizeContent {
    // Validate it has a unit subject and type "signFinalize"
    envelope.checkSubjectUnit();
    envelope.checkType("signFinalize");
    return new SignFinalizeContent(envelope);
  }

  /**
   * Converts this SignFinalizeContent to an Envelope.
   *
   * Port of `From<SignFinalizeContent> for Envelope` from cmd/sign/common.rs.
   */
  toEnvelope(): Envelope {
    return this._envelope;
  }
}
