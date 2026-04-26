/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Envelope Sealing and Unsealing.
 *
 * This module provides convenience functions for combining signing and
 * encryption operations in a single step, creating secure, authenticated
 * envelopes.
 *
 * ## Sealing
 *
 * Sealing an envelope (mirroring Rust `seal()` /
 * `bc-envelope-rust/src/seal.rs:65-71`):
 *
 * 1. **`sign(sender)`** — wraps the envelope with `wrap()` and adds the
 *    sender's signature to the wrapped form. The wrap is critical: it
 *    locks the existing assertions inside a `Wrapped` envelope so the
 *    signature covers the whole, immutable structure.
 * 2. **`encryptToRecipient(recipient)`** — wraps *again* and encrypts the
 *    wrapped envelope to the recipient's public key. After this step the
 *    sealed envelope is `Wrapped(Encrypted)` over the original signed
 *    envelope.
 *
 * The result is a secure container where:
 * - Only the intended recipient can decrypt the content (confidentiality).
 * - The recipient can verify who sent it via the inner signature
 *   (authentication).
 * - The signature ensures the content hasn't been modified (integrity).
 *
 * ## Unsealing
 *
 * Unsealing performs these operations in reverse, mirroring Rust
 * `unseal()` / `bc-envelope-rust/src/seal.rs:172-178` ⇒
 * `decrypt_to_recipient(recipient)?.verify(sender)`:
 *
 * 1. **`decryptToRecipient(recipient)`** — recovers the wrapped signed
 *    envelope.
 * 2. **`verify(sender)`** — re-runs the signature verification, calling
 *    `verifySignatureFrom(sender)` and then `tryUnwrap()` to peel off the
 *    inner wrap added by `sign()`.
 *
 * The two unwraps (one inside `decrypt_to_recipient`, one inside `verify`)
 * are essential to undo the two wraps that `seal()` introduced.
 */

import { Envelope } from "./base/envelope";
import type { Signer, Verifier, SigningOptions } from "./extension/signature";
import type { Encrypter, Decrypter } from "@bcts/components";

// ============================================================================
// Envelope Prototype Extensions for Sealing
// ============================================================================

/// Implementation of encryptToRecipient
Envelope.prototype.encryptToRecipient = function (this: Envelope, recipient: Encrypter): Envelope {
  return this.wrap().encryptSubjectToRecipient(recipient);
};

/// Implementation of seal
///
/// Mirrors Rust `seal()` (`bc-envelope-rust/src/seal.rs:65-71`).
/// `sign(sender)` already wraps the envelope before signing, so the seal
/// pipeline is `wrap → addSignature → wrap → encryptToRecipient`. Earlier
/// revisions of this port called `addSignature(sender)` directly (no inner
/// wrap), which produced sealed envelopes one wrap layer shallower than
/// Rust's and broke cross-impl unseal.
Envelope.prototype.seal = function (
  this: Envelope,
  sender: Signer,
  recipient: Encrypter,
): Envelope {
  return this.sign(sender).encryptToRecipient(recipient);
};

/// Implementation of sealOpt — `seal_opt` with optional signing options.
///
/// Mirrors Rust `seal_opt()` (`bc-envelope-rust/src/seal.rs:117-125`).
/// Same pipeline as {@link Envelope.seal} but threads `options` through to
/// `signOpt`, used to select alternate signing schemes (e.g.
/// `SigningOptions::Ssh`).
Envelope.prototype.sealOpt = function (
  this: Envelope,
  sender: Signer,
  recipient: Encrypter,
  options?: SigningOptions,
): Envelope {
  return this.signOpt(sender, options).encryptToRecipient(recipient);
};

/// Implementation of unseal
///
/// Mirrors Rust `unseal()` (`bc-envelope-rust/src/seal.rs:172-178`):
/// `decrypt_to_recipient(recipient)?.verify(sender)`. The `verify` step
/// performs `verifySignatureFrom(sender)` *and then* `tryUnwrap()` — the
/// extra unwrap undoes the inner wrap that `sign()` added during seal.
Envelope.prototype.unseal = function (
  this: Envelope,
  senderPublicKey: Verifier,
  recipient: Decrypter,
): Envelope {
  return this.decryptToRecipient(recipient).verify(senderPublicKey);
};

// ============================================================================
// Module Registration
// ============================================================================

/// Register the seal extension
export const registerSealExtension = (): void => {
  // Extension methods are already added to prototype above
};
