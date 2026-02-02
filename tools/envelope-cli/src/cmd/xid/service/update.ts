/**
 * XID service update command - 1:1 port of cmd/xid/service/update.rs
 *
 * Update a service in the XID document.
 */

import { PublicKeys } from "@bcts/components";
import { XIDDocument } from "@bcts/xid";
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
 * Command arguments for the service update command.
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
 * Service update command implementation.
 */
export class ServiceUpdateCommand implements ExecAsync {
  constructor(private readonly args: CommandArgs) {}

  async exec(): Promise<string> {
    const sArgs = this.args.serviceArgs;

    if (sArgs.uri === undefined || sArgs.uri === "") {
      throw new Error("Service URI is required to identify the service to update");
    }

    const xidDocument = await readXidDocumentWithPassword(
      this.args.envelope,
      this.args.passwordArgs.read,
      verifySignature(this.args.verifyArgs),
    );

    const service = xidDocument.findServiceByUri(sArgs.uri);
    if (service === undefined) {
      throw new Error(`Service not found: ${sArgs.uri}`);
    }

    if (sArgs.name !== undefined && sArgs.name !== "") {
      service.setName(sArgs.name);
    }

    if (sArgs.capability !== undefined && sArgs.capability !== "") {
      service.setCapability(sArgs.capability);
    }

    if (sArgs.permissions.length > 0) {
      service.permissions().allow.clear();
      service.permissions().deny.clear();
      for (const priv of sArgs.permissions) {
        const privilege = toPrivilege(priv);
        service.permissions().addAllow(privilege);
      }
    }

    if (sArgs.keys.length > 0) {
      service.keyReferences().clear();
      for (const keyStr of sArgs.keys) {
        const publicKeys = PublicKeys.fromURString(keyStr);
        service.addKeyReference(publicKeys.reference());
      }
    }

    if (sArgs.delegates.length > 0) {
      service.delegateReferences().clear();
      for (const delegateStr of sArgs.delegates) {
        const delegateEnvelope = readEnvelope(delegateStr);
        const delegateDoc = XIDDocument.fromEnvelope(delegateEnvelope);
        service.addDelegateReference(delegateDoc.reference());
      }
    }

    const signing = await signingOptions(this.args.signingArgs, this.args.passwordArgs.read);

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
 * Execute the service update command.
 */
export async function exec(args: CommandArgs): Promise<string> {
  return new ServiceUpdateCommand(args).exec();
}
