/**
 * XID export command - 1:1 port of cmd/xid/export.rs
 *
 * Export a XID document with specified output options.
 */

import type { Digest } from "@bcts/components";
import type { Envelope } from "@bcts/envelope";
import { KEY, PRIVATE_KEY, PROVENANCE, PROVENANCE_GENERATOR } from "@bcts/known-values";
import { XIDDocument, XIDVerifySignature } from "@bcts/xid";
import type { ExecAsync } from "../../exec.js";
import { readEnvelope } from "../../utils.js";
import { GeneratorOptions } from "./generator-options.js";
import type { OutputOptions } from "./output-options.js";
import { defaultOutputOptions } from "./output-options.js";
import type { ReadWritePasswordArgs } from "./password-args.js";
import { PasswordMethod } from "./password-args.js";
import { PrivateOptions } from "./private-options.js";
import type { SigningArgs } from "./signing-args.js";
import { SigningOption, signingOptions } from "./signing-args.js";
import type { VerifyArgs } from "./verify-args.js";
import { VerifyOption, verifySignature } from "./verify-args.js";
import {
  envelopeToXidUrString,
  readXidDocumentWithPassword,
  xidDocumentToUrString,
} from "./xid-utils.js";

/**
 * Command arguments for the export command.
 */
export interface CommandArgs {
  /** Output options (private/generator handling) */
  outputOpts: OutputOptions;
  /** Password arguments */
  passwordArgs: ReadWritePasswordArgs;
  /** Signature verification arguments */
  verifyArgs: VerifyArgs;
  /** Signing arguments */
  signingArgs: SigningArgs;
  /** The XID document envelope */
  envelope?: string;
}

/**
 * Default command arguments.
 */
export function defaultArgs(): CommandArgs {
  return {
    outputOpts: defaultOutputOptions(),
    passwordArgs: {
      read: { askpass: false },
      write: {
        encryptAskpass: false,
        encryptMethod: PasswordMethod.Argon2id,
      },
    },
    verifyArgs: { verify: VerifyOption.None },
    signingArgs: { sign: SigningOption.None },
  };
}

/**
 * Collect digests of privateKey assertions from all keys in the XID document.
 */
function collectPrivateKeyDigests(envelope: Envelope, digests: Set<Digest>): void {
  const keyAssertions = envelope.assertionsWithPredicate(KEY);
  for (const keyAssertion of keyAssertions) {
    const keyObject = keyAssertion.tryObject();
    const pkAssertion = keyObject.optionalAssertionWithPredicate(PRIVATE_KEY);
    if (pkAssertion !== undefined) {
      digests.add(pkAssertion.digest());
    }
  }
}

/**
 * Collect digests of provenanceGenerator assertions from provenance marks.
 */
function collectGeneratorDigests(envelope: Envelope, digests: Set<Digest>): void {
  const provAssertion = envelope.optionalAssertionWithPredicate(PROVENANCE);
  if (provAssertion !== undefined) {
    const provObject = provAssertion.tryObject();
    const genAssertion = provObject.optionalAssertionWithPredicate(PROVENANCE_GENERATOR);
    if (genAssertion !== undefined) {
      digests.add(genAssertion.digest());
    }
  }
}

/**
 * Export command implementation.
 */
export class ExportCommand implements ExecAsync {
  constructor(private readonly args: CommandArgs) {}

  async exec(): Promise<string> {
    const privateOpts = this.args.outputOpts.privateOpts;
    const generatorOpts = this.args.outputOpts.generatorOpts;

    // For elide or include operations, work directly at the envelope level
    // to preserve signatures. Only omit and encrypt require reconstruction.
    const canUseEnvelopeElision =
      (privateOpts === PrivateOptions.Elide || privateOpts === PrivateOptions.Include) &&
      (generatorOpts === GeneratorOptions.Elide || generatorOpts === GeneratorOptions.Include);

    if (canUseEnvelopeElision) {
      return this.elideAtEnvelopeLevel(privateOpts, generatorOpts);
    }

    // For omit, encrypt, or mixed operations, use the reconstruction approach
    return this.reconstructDocument();
  }

  /**
   * Perform elision directly on the envelope, preserving signatures.
   */
  private elideAtEnvelopeLevel(
    privateOpts: PrivateOptions,
    generatorOpts: GeneratorOptions,
  ): string {
    // Read the original envelope
    const envelope = readEnvelope(this.args.envelope);

    // Verify signature if requested
    if (verifySignature(this.args.verifyArgs) === XIDVerifySignature.Inception) {
      // Parse just to verify
      XIDDocument.fromEnvelope(envelope, undefined, XIDVerifySignature.Inception);
    }

    // Collect digests to elide
    const digestsToElide = new Set<Digest>();

    // Get the inner XID document
    // A signed envelope has its subject wrapped: { XID [...] } [ 'signed': Signature ]
    const inner = envelope.subject().isWrapped() ? envelope.subject().tryUnwrap() : envelope;

    // Find privateKey assertions to elide
    if (privateOpts === PrivateOptions.Elide) {
      collectPrivateKeyDigests(inner, digestsToElide);
    }

    // Find provenanceGenerator assertions to elide
    if (generatorOpts === GeneratorOptions.Elide) {
      collectGeneratorDigests(inner, digestsToElide);
    }

    // Elide the collected digests from the original envelope
    const elided = digestsToElide.size === 0 ? envelope : envelope.elideRemovingSet(digestsToElide);

    // Return as XID UR
    return envelopeToXidUrString(elided);
  }

  /**
   * Reconstruct the document (for omit, encrypt, or other operations).
   */
  private async reconstructDocument(): Promise<string> {
    // Read the XID document with optional password and verification
    const xidDocument = await readXidDocumentWithPassword(
      this.args.envelope,
      this.args.passwordArgs.read,
      verifySignature(this.args.verifyArgs),
    );

    // Get signing options
    const signing = await signingOptions(this.args.signingArgs, this.args.passwordArgs.read);

    // Convert to UR string with the specified output options
    return xidDocumentToUrString(
      xidDocument,
      this.args.outputOpts,
      this.args.passwordArgs.write,
      undefined,
      signing,
    );
  }
}

/**
 * Execute the export command with the given arguments.
 */
export async function exec(args: CommandArgs): Promise<string> {
  return new ExportCommand(args).exec();
}
