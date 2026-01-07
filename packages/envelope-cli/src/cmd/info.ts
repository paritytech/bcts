/**
 * Info command - 1:1 port of cmd/info.rs
 *
 * Provide type and other information about the object.
 */

import type { Exec } from "../exec.js";
import { readArgument, envelopeFromUr } from "../utils.js";
import { UR } from "@bcts/uniform-resources";
import { cborData } from "@bcts/dcbor";
import {
  Seed,
  PrivateKeyBase,
  PublicKeys,
  SigningPrivateKey,
  SigningPublicKey,
  Signature,
} from "@bcts/components";

/**
 * Command arguments for the info command.
 */
export interface CommandArgs {
  /** The object to provide information for */
  object?: string;
}

/**
 * Info command implementation.
 */
export class InfoCommand implements Exec {
  constructor(private args: CommandArgs) {}

  exec(): string {
    const result: string[] = [];

    const add = (field: string, value: string) => {
      result.push(`${field}: ${value}`);
    };

    const object = readArgument(this.args.object).trim();

    if (!object.startsWith("ur:")) {
      throw new Error("Unknown object.");
    }

    const ur = UR.fromURString(object);
    const urType = ur.urTypeStr();
    const cborSize = cborData(ur.cbor()).length;

    add("Format", `ur:${urType}`);
    add("CBOR Size", cborSize.toString());

    // Check if it's an envelope
    try {
      envelopeFromUr(ur);
      add("Description", "Gordian Envelope");
      return result.join("\n");
    } catch {
      // Not an envelope
    }

    switch (urType) {
      case "seed": {
        Seed.fromUR(ur);
        add("Description", "Cryptographic Seed");
        break;
      }
      case "prvkeys": {
        PrivateKeyBase.fromUR(ur);
        add("Description", "Private Key Base");
        break;
      }
      case "pubkeys": {
        PublicKeys.fromUR(ur);
        add("Description", "Public Keys");
        break;
      }
      case "signing-private-key": {
        const signingPrivateKey = SigningPrivateKey.fromUR(ur);
        const keyType = signingPrivateKey.keyType();
        add("Description", `${keyType} Signing Private Key`);
        break;
      }
      case "signing-public-key": {
        const signingPublicKey = SigningPublicKey.fromUR(ur);
        const keyType = signingPublicKey.keyType();
        add("Description", `${keyType} Signing Public Key`);
        break;
      }
      case "signature": {
        const signature = Signature.fromUR(ur);
        const sigType = signature.signatureType();
        add("Description", `${sigType} Signature`);
        break;
      }
      default:
        throw new Error(`Unknown UR type: ${urType}`);
    }

    return result.join("\n");
  }
}

/**
 * Execute the info command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new InfoCommand(args).exec();
}
