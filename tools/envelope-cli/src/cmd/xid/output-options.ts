/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Output options - 1:1 port of cmd/xid/output_options.rs
 *
 * Options controlling how sensitive data is output in XID documents.
 */

import { PrivateOptions, isEncrypt as isPrivateEncrypt } from "./private-options.js";
import { GeneratorOptions, isEncrypt as isGeneratorEncrypt } from "./generator-options.js";

/**
 * Options controlling how sensitive data is output in XID documents.
 *
 * This interface provides a unified interface for controlling how private keys
 * and provenance mark generators are handled when outputting XID documents.
 */
export interface OutputOptions {
  /** Private key output option */
  privateOpts: PrivateOptions;
  /** Generator output option */
  generatorOpts: GeneratorOptions;
}

/**
 * Default output options.
 */
export function defaultOutputOptions(): OutputOptions {
  return {
    privateOpts: PrivateOptions.Include,
    generatorOpts: GeneratorOptions.Include,
  };
}

/**
 * Check if either private keys or generator need encryption.
 */
export function needsEncryption(opts: OutputOptions): boolean {
  return isPrivateEncrypt(opts.privateOpts) || isGeneratorEncrypt(opts.generatorOpts);
}

/**
 * Trait for commands that support output options.
 */
export interface HasOutputOptions {
  outputOptions: OutputOptions;
}
