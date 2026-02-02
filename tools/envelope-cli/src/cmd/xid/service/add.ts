/**
 * XID service add command - 1:1 port of cmd/xid/service/add.rs
 *
 * Add a service to the XID document.
 */

import { PublicKeys } from "@bcts/components";
import { XIDDocument, Service } from "@bcts/xid";
import type { ExecAsync } from "../../../exec.js";
import { readEnvelope } from "../../../utils.js";
import type { OutputOptions } from "../output-options.js";
import type { ReadWritePasswordArgs } from "../password-args.js";
import type { SigningArgs } from "../signing-args.js";
import { signingOptions } from "../signing-args.js";
import type { VerifyArgs } from "../verify-args.js";
import { verifySignature } from "../verify-args.js";
import { toPrivilege } from "../xid-privilege.js";
import type { ServiceArgsLike } from "./service-args.js";
import { readXidDocumentWithPassword, xidDocumentToUrString } from "../xid-utils.js";

/**
 * Command arguments for the service add command.
 */
export interface CommandArgs {
  serviceArgs: ServiceArgsLike;
  outputOpts: OutputOptions;
  passwordArgs: ReadWritePasswordArgs;
  verifyArgs: VerifyArgs;
  signingArgs: SigningArgs;
  envelope?: string;
}

/**
 * Service add command implementation.
 */
export class ServiceAddCommand implements ExecAsync {
  constructor(private readonly args: CommandArgs) {}

  async exec(): Promise<string> {
    const sArgs = this.args.serviceArgs;

    if (sArgs.uri === undefined || sArgs.uri === "") {
      throw new Error("Service URI is required");
    }

    const xidDocument = await readXidDocumentWithPassword(
      this.args.envelope,
      this.args.passwordArgs.read,
      verifySignature(this.args.verifyArgs),
    );

    const service = Service.new(sArgs.uri);

    if (sArgs.name !== undefined && sArgs.name !== "") {
      service.setName(sArgs.name);
    }

    if (sArgs.capability !== undefined && sArgs.capability !== "") {
      service.setCapability(sArgs.capability);
    }

    for (const priv of sArgs.permissions) {
      const privilege = toPrivilege(priv);
      service.permissions().addAllow(privilege);
    }

    for (const keyStr of sArgs.keys) {
      const publicKeys = PublicKeys.fromURString(keyStr);
      service.addKeyReference(publicKeys.reference());
    }

    for (const delegateStr of sArgs.delegates) {
      const delegateEnvelope = readEnvelope(delegateStr);
      const delegateDoc = XIDDocument.fromEnvelope(delegateEnvelope);
      service.addDelegateReference(delegateDoc.reference());
    }

    xidDocument.addService(service);

    const signing = await signingOptions(
      this.args.signingArgs,
      this.args.passwordArgs.read,
    );

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
 * Execute the service add command.
 */
export async function exec(args: CommandArgs): Promise<string> {
  return new ServiceAddCommand(args).exec();
}
