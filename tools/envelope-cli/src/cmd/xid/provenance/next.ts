/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * XID provenance next command - 1:1 port of cmd/xid/provenance/next.rs
 *
 * Advance the provenance mark to the next state.
 */

import { Envelope } from "@bcts/envelope";
import { ProvenanceMarkGenerator } from "@bcts/provenance-mark";
import { CborDate } from "@bcts/dcbor";
import type { ExecAsync } from "../../../exec.js";
import type { OutputOptions } from "../output-options.js";
import type { ReadWritePasswordArgs } from "../password-args.js";
import { readDecryptPassword } from "../password-args.js";
import type { SigningArgs } from "../signing-args.js";
import { signingOptions } from "../signing-args.js";
import type { VerifyArgs } from "../verify-args.js";
import { verifySignature } from "../verify-args.js";
import { readXidDocumentWithPassword, xidDocumentToUrString } from "../xid-utils.js";

/**
 * Command arguments for the provenance next command.
 */
export interface CommandArgs {
  date?: string;
  info?: string;
  urTag?: number;
  externalGenerator?: string;
  outputOpts: OutputOptions;
  passwordArgs: ReadWritePasswordArgs;
  verifyArgs: VerifyArgs;
  signingArgs: SigningArgs;
  envelope?: string;
}

/**
 * Provenance next command implementation.
 */
export class ProvenanceNextCommand implements ExecAsync {
  constructor(private readonly args: CommandArgs) {}

  async exec(): Promise<string> {
    const xidDocument = await readXidDocumentWithPassword(
      this.args.envelope,
      this.args.passwordArgs.read,
      verifySignature(this.args.verifyArgs),
    );

    // Parse optional date parameter
    const date =
      this.args.date !== undefined ? CborDate.fromString(this.args.date).datetime() : undefined;

    // Parse optional info parameter
    const info =
      this.args.info !== undefined
        ? Envelope.fromUrString(this.args.info).untaggedCbor()
        : undefined;

    if (this.args.externalGenerator !== undefined) {
      // User provided a generator
      const generatorEnvelope = Envelope.fromUrString(this.args.externalGenerator);
      const generator = ProvenanceMarkGenerator.fromEnvelope(generatorEnvelope);
      xidDocument.nextProvenanceMarkWithProvidedGenerator(generator, date, info);
    } else {
      // Use embedded generator
      const password = await readDecryptPassword(
        this.args.passwordArgs.read,
        "Decryption password:",
      );
      const passwordBytes = password !== undefined ? new TextEncoder().encode(password) : undefined;
      xidDocument.nextProvenanceMarkWithEmbeddedGenerator(passwordBytes, date, info);
    }

    const signing = await signingOptions(this.args.signingArgs, this.args.passwordArgs.read);

    const sharedPassword = await readDecryptPassword(
      this.args.passwordArgs.read,
      "Decryption password:",
    );

    return xidDocumentToUrString(
      xidDocument,
      this.args.outputOpts,
      this.args.passwordArgs.write,
      sharedPassword,
      signing,
    );
  }
}

/**
 * Execute the provenance next command.
 */
export async function exec(args: CommandArgs): Promise<string> {
  return new ProvenanceNextCommand(args).exec();
}
