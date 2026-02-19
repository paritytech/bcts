/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Generator output options - 1:1 port of cmd/xid/generator_options.rs
 */

import { XIDGeneratorOptions, type XIDGeneratorOptionsValue } from "@bcts/xid";

/**
 * Options for how provenance mark generators are output in XID documents.
 */
export enum GeneratorOptions {
  /** Include the mark generator key in plaintext */
  Include = "include",
  /** Omit the mark generator (no provenance mark will be created) */
  Omit = "omit",
  /** Elide the mark generator (maintains digest tree) */
  Elide = "elide",
  /** Encrypt the mark generator with a password */
  Encrypt = "encrypt",
}

/**
 * Check if this option requires encryption.
 */
export function isEncrypt(opts: GeneratorOptions): boolean {
  return opts === GeneratorOptions.Encrypt;
}

/**
 * Convert GeneratorOptions to XIDGeneratorOptions.
 *
 * Note: The Encrypt variant needs additional parameters, so this returns
 * Omit as a placeholder. Callers should use the password_args module to
 * construct the full Encrypt variant.
 */
export function toXIDGeneratorOptions(opts: GeneratorOptions): XIDGeneratorOptionsValue {
  switch (opts) {
    case GeneratorOptions.Include:
      return XIDGeneratorOptions.Include;
    case GeneratorOptions.Omit:
      return XIDGeneratorOptions.Omit;
    case GeneratorOptions.Elide:
      return XIDGeneratorOptions.Elide;
    case GeneratorOptions.Encrypt:
      // Placeholder — callers must construct the full Encrypt variant
      return XIDGeneratorOptions.Omit;
  }
}
