/**
 * Copyright © 2025-2026 Parity Technologies
 *
 * SSH certificate (`cert-v01@openssh.com`) placeholder — parity with
 * Rust's `bc-components-rust/src/tags_registry.rs:231-238`, which
 * registers a fixed `"SSHCertificate"` summarizer for
 * `TAG_SSH_TEXT_CERTIFICATE` (40803) with a `// todo: validation`
 * comment. The Rust side does *not* parse certificate fields either —
 * it only round-trips the text.
 *
 * This class therefore stores the OpenSSH certificate text verbatim
 * and defers real `cert-v01@openssh.com` parsing to v2 (`SSH_PLAN.md`
 * V2.D), only contingent on Rust gaining a real parser upstream.
 */

import { sha256 } from "@noble/hashes/sha2.js";

export class SSHCertificate {
  /** The full single-line OpenSSH cert text, e.g.
   *  `ssh-ed25519-cert-v01@openssh.com AAAAI...== user@host`. */
  readonly text: string;

  private constructor(text: string) {
    this.text = text;
  }

  /** Construct from the canonical OpenSSH certificate text. */
  static fromText(text: string): SSHCertificate {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      throw new Error("SSHCertificate: empty input");
    }
    return new SSHCertificate(trimmed);
  }

  /** The canonical OpenSSH text — round-trips byte-identically. */
  toText(): string {
    return this.text;
  }

  /** Fixed summarizer string — matches Rust `tags_registry.rs:236`. */
  toString(): string {
    return "SSHCertificate";
  }

  digest(): Uint8Array {
    return sha256(new TextEncoder().encode(this.text));
  }
}
