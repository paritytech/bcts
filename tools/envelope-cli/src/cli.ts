#!/usr/bin/env node
/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 * envelope CLI - Gordian Envelope command line tool
 *
 * Wires every subcommand to the corresponding cmd/** module.
 */

import { Command, Option } from "commander";
import { URI } from "@bcts/components";
import { registerTags as registerBcTags } from "@bcts/tags";
import { registerTags as registerEnvelopeTags } from "@bcts/envelope";
import { registerTags as registerProvenanceTags } from "@bcts/provenance-mark";
import { VERSION } from "./index.js";
import { DataType } from "./data-types.js";

// Mirror bc-envelope-cli-rust/src/main.rs:73-75 — register all tag stores at
// startup so the global tag store is populated before any command dispatches.
// Without this, `getGlobalTagsStore().tagForName('digest')` returns undefined
// and `subject type ur ur:digest/...` (and similar) fails with "Unknown UR type".
registerBcTags();
registerEnvelopeTags();
registerProvenanceTags();
import * as cmd from "./cmd/index.js";
import { Action as ElideAction } from "./cmd/elide/index.js";
import {
  FormatType,
  DigestFormatType,
  MermaidOrientationType,
  MermaidThemeType,
} from "./cmd/format.js";
import { Depth as DigestDepth } from "./cmd/digest.js";
import { SubjectType as ExtractSubjectType } from "./cmd/extract.js";
import { HashType as SignHashType } from "./cmd/sign.js";
import { PasswordDerivationType as EncryptPasswordDerivation } from "./cmd/encrypt.js";
import {
  KeypairsSigningScheme,
  KeypairsEncryptionScheme,
  PrvKeysSigningScheme,
  PrvKeysEncryptionScheme,
} from "./cmd/generate/index.js";
import { GeneratorOptions } from "./cmd/xid/generator-options.js";
import { PrivateOptions } from "./cmd/xid/private-options.js";
import { PasswordMethod } from "./cmd/xid/password-args.js";
import { SigningOption } from "./cmd/xid/signing-args.js";
import { VerifyOption } from "./cmd/xid/verify-args.js";
import { IDFormat as XidIDFormat } from "./cmd/xid/id.js";
import { XIDPrivilege } from "./cmd/xid/xid-privilege.js";

// ============================================================================
// Helpers
// ============================================================================

type AnyArgs = Record<string, unknown>;

function run(fn: () => string): void {
  try {
    const out = fn();
    if (out !== "") {
      process.stdout.write(out);
      if (!out.endsWith("\n")) process.stdout.write("\n");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`Error: ${msg}\n`);
    process.exit(1);
  }
}

async function runAsync(fn: () => Promise<string>): Promise<void> {
  try {
    const out = await fn();
    if (out !== "") {
      process.stdout.write(out);
      if (!out.endsWith("\n")) process.stdout.write("\n");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`Error: ${msg}\n`);
    process.exit(1);
  }
}

/**
 * Validate a positional argument against an enum's allowed values, emitting a
 * clap-style error and exiting with code 2 on mismatch. Mirrors the format
 * produced by clap's ValueEnum derive macro in the Rust CLI.
 *
 * Output (stderr):
 *   error: invalid value 'X' for '<ARG_NAME>'
 *     [possible values: a, b, c]
 *
 *   For more information, try '--help'.
 *
 * Choices are listed in declaration order — `Object.values(enum)` preserves
 * insertion order in JS, matching clap's ordering.
 */
function parseEnumValue<T extends Record<string, string>>(
  enumObj: T,
  value: string,
  argName: string,
): T[keyof T] {
  const choices = Object.values(enumObj);
  for (const v of choices) {
    if (v === value) return v as T[keyof T];
  }
  process.stderr.write(
    `error: invalid value '${value}' for '<${argName}>'\n` +
      `  [possible values: ${choices.join(", ")}]\n\n` +
      `For more information, try '--help'.\n`,
  );
  process.exit(2);
}

function dataTypeFromString(s: string, argName = "TYPE"): DataType {
  return parseEnumValue(DataType as unknown as Record<string, string>, s, argName) as DataType;
}

function privilegesFromArray(arr: string[] | undefined): XIDPrivilege[] {
  if (!arr || arr.length === 0) return [];
  return arr.map((p) => parseEnumValue(XIDPrivilege, p, "PRIVILEGE"));
}

function endpointsFromArray(arr: string[] | undefined): URI[] {
  if (!arr || arr.length === 0) return [];
  return arr.map((u) => URI.new(u));
}

function intArg(value: string, _previous?: number): number {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) throw new Error(`Invalid integer: ${value}`);
  return n;
}

/**
 * Collector for repeatable single-value options. Use this instead of `<value...>`
 * (variadic) so options don't swallow trailing positional arguments.
 *
 * Example:
 *   .option("--signer <key>", "desc", collect, [])
 *   $ cli sign --signer K1 --signer K2 ENVELOPE   // K1, K2 collected; ENVELOPE positional
 */
function collect(value: string, previous: string[] | undefined): string[] {
  return [...(previous ?? []), value];
}

/**
 * Strip undefined-valued fields. Required because the CLI has
 * exactOptionalPropertyTypes enabled, so a missing optional field is
 * different from an explicit undefined.
 *
 * The return type is inferred from the caller's expected type, so this
 * can be passed directly into `exec()` calls.
 */
function compact<T>(obj: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

const EMPTY_OPT: Record<string, never> = {};

// ============================================================================
// Program setup
// ============================================================================

const program = new Command();
program
  .name("envelope")
  .description("Gordian Envelope command line tool")
  .version(`@bcts/envelope-cli ${VERSION}`);

// ============================================================================
// subject
// ============================================================================

const subjectCmd = program.command("subject").description("Create or extract envelope subject");

subjectCmd
  .command("type")
  .description("Create an envelope with the given subject type")
  .argument("<type>", "Subject type (string, number, bool, ur, envelope, …)")
  .argument("[value]", "Subject value")
  .option("--ur-tag <n>", "CBOR tag for an enclosed UR", intArg)
  .action((type: string, value: string | undefined, opts: AnyArgs) => {
    run(() =>
      cmd.subject.type.exec(
        compact({
          subjectType: dataTypeFromString(type),
          subjectValue: value,
          urTag: opts["urTag"],
        }),
      ),
    );
  });

subjectCmd
  .command("assertion")
  .description("Create a bare assertion envelope")
  .argument("<predType>", "Predicate type")
  .argument("<predValue>", "Predicate value")
  .argument("<objType>", "Object type")
  .argument("<objValue>", "Object value")
  .option("--pred-tag <n>", "Predicate UR tag", intArg)
  .option("--obj-tag <n>", "Object UR tag", intArg)
  .action(
    (predType: string, predValue: string, objType: string, objValue: string, opts: AnyArgs) => {
      run(() =>
        cmd.subject.assertion.exec(
          compact({
            predType: dataTypeFromString(predType, "PRED_TYPE"),
            predValue,
            objType: dataTypeFromString(objType, "OBJ_TYPE"),
            objValue,
            predTag: opts["predTag"],
            objTag: opts["objTag"],
          }),
        ),
      );
    },
  );

// ============================================================================
// assertion
// ============================================================================

const assertionCmd = program.command("assertion").description("Work with envelope assertions");

const assertionAdd = assertionCmd.command("add").description("Add an assertion");
assertionAdd
  .command("pred-obj")
  .description("Add an assertion with the given predicate and object")
  .argument("<predType>")
  .argument("<predValue>")
  .argument("<objType>")
  .argument("<objValue>")
  .argument("[envelope]")
  .option("-s, --salted", "Add salt to the assertion", false)
  .option("--pred-tag <n>", "Predicate UR tag", intArg)
  .option("--obj-tag <n>", "Object UR tag", intArg)
  .action(
    (
      predType: string,
      predValue: string,
      objType: string,
      objValue: string,
      envelope: string | undefined,
      opts: AnyArgs,
    ) => {
      run(() =>
        cmd.assertion.add.predObj.exec(
          compact({
            predType: dataTypeFromString(predType, "PRED_TYPE"),
            predValue,
            objType: dataTypeFromString(objType, "OBJ_TYPE"),
            objValue,
            predTag: opts["predTag"],
            objTag: opts["objTag"],
            salted: Boolean(opts["salted"]),
            envelope,
          }),
        ),
      );
    },
  );

assertionAdd
  .command("envelope")
  .description("Add a pre-made assertion envelope")
  .argument("<assertion>")
  .argument("[envelope]")
  .option("-s, --salted", "Add salt", false)
  .action((assertion: string, envelope: string | undefined, opts: AnyArgs) => {
    run(() =>
      cmd.assertion.add.envelope.exec(
        compact({
          assertion,
          salted: Boolean(opts["salted"]),
          envelope,
        }),
      ),
    );
  });

assertionCmd
  .command("all")
  .description("List all assertions")
  .argument("[envelope]")
  .action((envelope: string | undefined) => {
    run(() => cmd.assertion.all.exec(compact({ envelope })));
  });

assertionCmd
  .command("at")
  .description("Get the assertion at the given index")
  .argument("<index>", "Index", intArg)
  .argument("[envelope]")
  .action((index: number, envelope: string | undefined) => {
    run(() => cmd.assertion.at.exec(compact({ index, envelope })));
  });

assertionCmd
  .command("count")
  .description("Count assertions")
  .argument("[envelope]")
  .action((envelope: string | undefined) => {
    run(() => cmd.assertion.count.exec(compact({ envelope })));
  });

assertionCmd
  .command("create")
  .description("Create a bare assertion")
  .argument("<predType>")
  .argument("<predValue>")
  .argument("<objType>")
  .argument("<objValue>")
  .option("-s, --salted", "Add salt", false)
  .option("--pred-tag <n>", "Predicate UR tag", intArg)
  .option("--obj-tag <n>", "Object UR tag", intArg)
  .action(
    (predType: string, predValue: string, objType: string, objValue: string, opts: AnyArgs) => {
      run(() =>
        cmd.assertion.create.exec(
          compact({
            predType: dataTypeFromString(predType, "PRED_TYPE"),
            predValue,
            objType: dataTypeFromString(objType, "OBJ_TYPE"),
            objValue,
            predTag: opts["predTag"],
            objTag: opts["objTag"],
            salted: Boolean(opts["salted"]),
          }),
        ),
      );
    },
  );

const assertionFind = assertionCmd.command("find").description("Find assertions");
assertionFind
  .command("predicate")
  .description("Find assertions by predicate")
  .argument("<type>", "Subject type")
  .argument("[value]", "Subject value")
  .argument("[envelope]")
  .option("--ur-tag <n>", "CBOR tag for an enclosed UR", intArg)
  .action(
    (type: string, value: string | undefined, envelope: string | undefined, opts: AnyArgs) => {
      run(() =>
        cmd.assertion.find.predicate.exec(
          compact({
            subjectType: dataTypeFromString(type),
            subjectValue: value,
            urTag: opts["urTag"],
            envelope,
          }),
        ),
      );
    },
  );

assertionFind
  .command("object")
  .description("Find assertions by object")
  .argument("<type>", "Subject type")
  .argument("[value]", "Subject value")
  .argument("[envelope]")
  .option("--ur-tag <n>", "CBOR tag for an enclosed UR", intArg)
  .action(
    (type: string, value: string | undefined, envelope: string | undefined, opts: AnyArgs) => {
      run(() =>
        cmd.assertion.find.object.exec(
          compact({
            subjectType: dataTypeFromString(type),
            subjectValue: value,
            urTag: opts["urTag"],
            envelope,
          }),
        ),
      );
    },
  );

const assertionRemove = assertionCmd.command("remove").description("Remove an assertion");
assertionRemove
  .command("pred-obj")
  .argument("<predType>")
  .argument("<predValue>")
  .argument("<objType>")
  .argument("<objValue>")
  .argument("[envelope]")
  .option("--pred-tag <n>", "Predicate UR tag", intArg)
  .option("--obj-tag <n>", "Object UR tag", intArg)
  .action(
    (
      predType: string,
      predValue: string,
      objType: string,
      objValue: string,
      envelope: string | undefined,
      opts: AnyArgs,
    ) => {
      run(() =>
        cmd.assertion.remove.predObj.exec(
          compact({
            predType: dataTypeFromString(predType, "PRED_TYPE"),
            predValue,
            objType: dataTypeFromString(objType, "OBJ_TYPE"),
            objValue,
            predTag: opts["predTag"],
            objTag: opts["objTag"],
            envelope,
          }),
        ),
      );
    },
  );
assertionRemove
  .command("envelope")
  .argument("<assertion>")
  .argument("[envelope]")
  .action((assertion: string, envelope: string | undefined) => {
    run(() => cmd.assertion.remove.envelope.exec(compact({ assertion, envelope })));
  });

// ============================================================================
// format
// ============================================================================

program
  .command("format")
  .description("Format envelope for display")
  .argument("[envelope]")
  .addOption(
    new Option("-t, --type <type>", "Output format")
      .choices(Object.values(FormatType))
      .default(FormatType.Envelope),
  )
  .option("--hide-nodes", "Hide NODE case and digests in tree/mermaid", false)
  .addOption(
    new Option("-d, --digest-format <format>", "Digest display format")
      .choices(Object.values(DigestFormatType))
      .default(DigestFormatType.Short),
  )
  .addOption(
    new Option("--theme <theme>", "Mermaid theme")
      .choices(Object.values(MermaidThemeType))
      .default(MermaidThemeType.Default),
  )
  .addOption(
    new Option("--orientation <orientation>", "Mermaid orientation")
      .choices(Object.values(MermaidOrientationType))
      .default(MermaidOrientationType.LeftToRight),
  )
  .option("--monochrome", "Monochrome mermaid output", false)
  .action((envelope: string | undefined, opts: AnyArgs) => {
    run(() =>
      cmd.format.exec(
        compact({
          type: opts["type"],
          hideNodes: Boolean(opts["hideNodes"]),
          digestFormat: opts["digestFormat"],
          theme: opts["theme"],
          orientation: opts["orientation"],
          monochrome: Boolean(opts["monochrome"]),
          envelope,
        }),
      ),
    );
  });

// ============================================================================
// digest
// ============================================================================

program
  .command("digest")
  .description("Print the envelope's digest")
  .argument("[envelope]")
  .addOption(
    new Option("-d, --depth <depth>", "Digest depth")
      .choices(Object.values(DigestDepth))
      .default(DigestDepth.Top),
  )
  .option("--hex", "Output as hex instead of UR", false)
  .action((envelope: string | undefined, opts: AnyArgs) => {
    run(() =>
      cmd.digest.exec(
        compact({
          depth: opts["depth"],
          hex: Boolean(opts["hex"]),
          envelope,
        }),
      ),
    );
  });

// ============================================================================
// extract
// ============================================================================

program
  .command("extract")
  .description("Extract the subject of the input envelope")
  .argument("<type>", "Subject type to extract")
  .argument("[envelope]")
  .option("--ur-type <type>")
  .option("--ur-tag <n>", "CBOR tag for an enclosed UR", intArg)
  .action((type: string, envelope: string | undefined, opts: AnyArgs) => {
    run(() =>
      cmd.extract.exec(
        compact({
          type: parseEnumValue(ExtractSubjectType, type, "TYPE"),
          urType: opts["urType"],
          urTag: opts["urTag"],
          envelope,
        }),
      ),
    );
  });

// ============================================================================
// sign / verify
// ============================================================================

program
  .command("sign")
  .description("Sign the envelope subject")
  .argument("[envelope]")
  .option(
    "--signer <signer>",
    "Signing key (ur:crypto-prvkeys or ur:signing-private-key); may be repeated",
    collect,
    [],
  )
  .option("-n, --note <text>", "Optional note")
  .option("--namespace <ns>", "SSH signature namespace", "envelope")
  .addOption(
    new Option("--hash <hash>", "SSH hash algorithm")
      .choices(Object.values(SignHashType))
      .default(SignHashType.Sha256),
  )
  .action((envelope: string | undefined, opts: AnyArgs) => {
    run(() =>
      cmd.sign.exec(
        compact({
          signers: (opts["signer"] as string[] | undefined) ?? [],
          note: opts["note"],
          namespace: (opts["namespace"] as string | undefined) ?? "envelope",
          hashType: opts["hash"],
          envelope,
        }),
      ),
    );
  });

program
  .command("verify")
  .description("Verify signatures on the envelope")
  .argument("[envelope]")
  .option(
    "-v, --verifier <verifier>",
    "Verifier (public or private key); may be repeated",
    collect,
    [],
  )
  .option("-s, --silent", "Don't output the envelope on success", false)
  .option("-t, --threshold <n>", "Minimum required valid signatures", intArg, 1)
  .action((envelope: string | undefined, opts: AnyArgs) => {
    run(() =>
      cmd.verify.exec(
        compact({
          silent: Boolean(opts["silent"]),
          threshold: (opts["threshold"] as number | undefined) ?? 1,
          verifiers: (opts["verifier"] as string[] | undefined) ?? [],
          envelope,
        }),
      ),
    );
  });

// ============================================================================
// encrypt / decrypt
// ============================================================================

program
  .command("encrypt")
  .description("Encrypt the envelope subject")
  .argument("[envelope]")
  .option("--key <ur>", "Symmetric key (ur:crypto-key)")
  .option("--password <password>", "Password to lock the content key")
  .option("--askpass", "Use SSH_ASKPASS to read the password", false)
  .addOption(
    new Option("--password-derivation <method>", "Password derivation algorithm")
      .choices(Object.values(EncryptPasswordDerivation))
      .default(EncryptPasswordDerivation.Argon2id),
  )
  .option("--ssh-id <id>", "SSH agent identity used to lock the content key")
  .option(
    "--recipient <ur>",
    "Recipient public keys (ur:crypto-pubkeys); may be repeated",
    collect,
    [],
  )
  .action(async (envelope: string | undefined, opts: AnyArgs) => {
    await runAsync(() =>
      cmd.encrypt.exec(
        compact({
          key: opts["key"],
          password: opts["password"],
          askpass: Boolean(opts["askpass"]),
          passwordDerivation: opts["passwordDerivation"],
          sshId: opts["sshId"],
          recipients: (opts["recipient"] as string[] | undefined) ?? [],
          envelope,
        }),
      ),
    );
  });

program
  .command("decrypt")
  .description("Decrypt the envelope subject")
  .argument("[envelope]")
  .option("--key <ur>", "Symmetric key (ur:crypto-key)")
  .option("--password <password>", "Password to derive the symmetric key")
  .option("--askpass", "Use SSH_ASKPASS to read the password", false)
  .option("--recipient <ur>", "Recipient private keys (ur:crypto-prvkeys or ur:crypto-prvkey-base)")
  .option("--ssh-id <id>", "SSH identity used to decrypt the subject")
  .action(async (envelope: string | undefined, opts: AnyArgs) => {
    await runAsync(() =>
      cmd.decrypt.exec(
        compact({
          key: opts["key"],
          password: opts["password"],
          askpass: Boolean(opts["askpass"]),
          recipient: opts["recipient"],
          sshId: opts["sshId"],
          envelope,
        }),
      ),
    );
  });

// ============================================================================
// elide
// ============================================================================

const elideCmd = program.command("elide").description("Elide envelope content");

function elideAction(revealing: boolean) {
  return (target: string, envelope: string | undefined, opts: AnyArgs) => {
    run(() => {
      const raw = {
        action: opts["action"] as ElideAction,
        key: opts["key"] as string | undefined,
        target,
        envelope,
      };
      return revealing
        ? cmd.elide.revealing.exec(compact(raw))
        : cmd.elide.removing.exec(compact(raw));
    });
  };
}

elideCmd
  .command("removing")
  .description("Elide all elements matching the target")
  .argument("<target>", "Whitespace-separated digest URs (or the env if shifted)")
  .argument("[envelope]")
  .addOption(
    new Option("-a, --action <action>", "Action")
      .choices(Object.values(ElideAction))
      .default(ElideAction.Elide),
  )
  .option("--key <ur>", "Symmetric key for encrypt action")
  .action(elideAction(false));

elideCmd
  .command("revealing")
  .description("Elide all elements not in the target (reveal only target)")
  .argument("<target>")
  .argument("[envelope]")
  .addOption(
    new Option("-a, --action <action>", "Action")
      .choices(Object.values(ElideAction))
      .default(ElideAction.Elide),
  )
  .option("--key <ur>", "Symmetric key for encrypt action")
  .action(elideAction(true));

// ============================================================================
// generate
// ============================================================================

const generateCmd = program.command("generate").description("Generate keys and other values");

generateCmd
  .command("arid")
  .description("Generate a random ARID")
  .option("-x, --hex", "Output as hex", false)
  .action((opts: AnyArgs) => {
    run(() => cmd.generate.arid.exec(compact({ hex: Boolean(opts["hex"]) })));
  });

generateCmd
  .command("digest")
  .description("Generate a digest from data")
  .argument("[data]")
  .action((data: string | undefined) => {
    run(() => cmd.generate.digest.exec(compact({ data })));
  });

generateCmd
  .command("key")
  .description("Generate a symmetric key")
  .action(() => {
    run(() => cmd.generate.key.exec(EMPTY_OPT));
  });

generateCmd
  .command("nonce")
  .description("Generate a nonce")
  .action(() => {
    run(() => cmd.generate.nonce.exec(EMPTY_OPT));
  });

generateCmd
  .command("seed")
  .description("Generate a seed")
  .option("-c, --count <n>", "Number of bytes (16..256)", intArg, 16)
  .option("--hex <hex>", "Raw hex data for the seed")
  .action((opts: AnyArgs) => {
    run(() =>
      cmd.generate.seed.exec(
        compact({
          count: opts["count"],
          hex: opts["hex"],
        }),
      ),
    );
  });

generateCmd
  .command("keypairs")
  .description("Generate a private/public keypair pair")
  .addOption(
    new Option("-s, --signing <scheme>", "Signing scheme")
      .choices(Object.values(KeypairsSigningScheme))
      .default(KeypairsSigningScheme.Ed25519),
  )
  .addOption(
    new Option("-e, --encryption <scheme>", "Encryption scheme")
      .choices(Object.values(KeypairsEncryptionScheme))
      .default(KeypairsEncryptionScheme.X25519),
  )
  .action((opts: AnyArgs) => {
    run(() =>
      cmd.generate.keypairs.exec(
        compact({
          signing: opts["signing"],
          encryption: opts["encryption"],
        }),
      ),
    );
  });

generateCmd
  .command("prvkeys")
  .description("Generate or derive a private keys UR")
  .argument("[input]", "Optional ur:seed or ur:crypto-prvkey-base input")
  .addOption(
    new Option("-s, --signing <scheme>", "Signing scheme")
      .choices(Object.values(PrvKeysSigningScheme))
      .default(PrvKeysSigningScheme.Schnorr),
  )
  .addOption(
    new Option("-e, --encryption <scheme>", "Encryption scheme")
      .choices(Object.values(PrvKeysEncryptionScheme))
      .default(PrvKeysEncryptionScheme.X25519),
  )
  .action((input: string | undefined, opts: AnyArgs) => {
    run(() =>
      cmd.generate.prvKeys.exec(
        compact({
          input,
          signing: opts["signing"],
          encryption: opts["encryption"],
        }),
      ),
    );
  });

generateCmd
  .command("pubkeys")
  .description("Convert private keys to public keys")
  .argument("[prvKeys]")
  .option("--comment <comment>", "SSH key comment", "")
  .action((prvKeys: string | undefined, opts: AnyArgs) => {
    run(() =>
      cmd.generate.pubKeys.exec(
        compact({
          prvKeys,
          comment: (opts["comment"] as string | undefined) ?? "",
        }),
      ),
    );
  });

// ============================================================================
// import / export
// ============================================================================

program
  .command("import")
  .description("Import a native object as a UR")
  .argument("[object]")
  .option("--password <password>")
  .option("--askpass", "Use SSH_ASKPASS to read the password", false)
  .action(async (object: string | undefined, opts: AnyArgs) => {
    await runAsync(() =>
      cmd.importCmd.exec(
        compact({
          object,
          password: opts["password"],
          askpass: Boolean(opts["askpass"]),
        }),
      ),
    );
  });

program
  .command("export")
  .description("Export a UR to its native format")
  .argument("[urString]")
  .option("--encrypt", "Encrypt the exported SSH private key", false)
  .option("--password <password>")
  .option("--askpass", "Use SSH_ASKPASS to read the password", false)
  .action(async (urString: string | undefined, opts: AnyArgs) => {
    await runAsync(() =>
      cmd.exportCmd.exec(
        compact({
          urString,
          encrypt: Boolean(opts["encrypt"]),
          password: opts["password"],
          askpass: Boolean(opts["askpass"]),
        }),
      ),
    );
  });

// ============================================================================
// salt / compress / decompress / info / pattern
// ============================================================================

program
  .command("salt")
  .description("Add random salt to the envelope")
  .argument("[envelope]")
  .option("-s, --size <n>", "Salt size in bytes", intArg)
  .action((envelope: string | undefined, opts: AnyArgs) => {
    run(() =>
      cmd.salt.exec(
        compact({
          size: opts["size"],
          envelope,
        }),
      ),
    );
  });

program
  .command("compress")
  .description("Compress the envelope")
  .argument("[envelope]")
  .option("-s, --subject", "Compress only the subject", false)
  .action((envelope: string | undefined, opts: AnyArgs) => {
    run(() =>
      cmd.compress.exec(
        compact({
          subject: Boolean(opts["subject"]),
          envelope,
        }),
      ),
    );
  });

program
  .command("decompress")
  .description("Decompress the envelope")
  .argument("[envelope]")
  .option("-s, --subject", "Decompress only the subject", false)
  .action((envelope: string | undefined, opts: AnyArgs) => {
    run(() =>
      cmd.decompress.exec(
        compact({
          subject: Boolean(opts["subject"]),
          envelope,
        }),
      ),
    );
  });

program
  .command("info")
  .description("Provide type and other information about a UR object")
  .argument("[object]")
  .action((object: string | undefined) => {
    run(() => cmd.info.exec(compact({ object })));
  });

// ============================================================================
// XID
// ============================================================================

const xidCmd = program.command("xid").description("Work with XID documents");

// ----- xid new -----
xidCmd
  .command("new")
  .description("Create a new XID document")
  .argument("[key]", "Inception key (ur:crypto-pubkeys, ur:crypto-prvkeys, or ur:prvkeys)")
  .option("--nickname <name>", "Nickname for the inception key", "")
  .option("-e, --endpoint <uri>", "Endpoint URI (may repeat)", collect, [])
  .option("--allow <permission>", "Permission (may repeat)", collect, [])
  .addOption(
    new Option("--private <mode>", "Private key mode")
      .choices(Object.values(PrivateOptions))
      .default(PrivateOptions.Include),
  )
  .addOption(
    new Option("--generator <mode>", "Generator mode")
      .choices(Object.values(GeneratorOptions))
      .default(GeneratorOptions.Omit),
  )
  .addOption(
    new Option("--sign <mode>", "Signing mode")
      .choices(Object.values(SigningOption))
      .default(SigningOption.None),
  )
  .option("--signing-key <ur>", "External signing key (UR)")
  .option("--password <password>", "Decryption password")
  .option("--encrypt-password <password>", "Encryption password")
  .option("--askpass", "Use SSH_ASKPASS to read the password", false)
  .option("--encrypt-askpass", "Use SSH_ASKPASS to read the encryption password", false)
  .addOption(
    new Option("--encrypt-method <method>", "Password derivation method for encryption")
      .choices(Object.values(PasswordMethod))
      .default(PasswordMethod.Argon2id),
  )
  .option("--date <date>", "Date for genesis mark (ISO 8601)")
  .option("--info <ur>", "Additional info UR for genesis mark")
  .option("--ur-tag <n>", "CBOR tag for an enclosed UR", intArg)
  .action(async (key: string | undefined, opts: AnyArgs) => {
    await runAsync(() =>
      cmd.xid.newCmd.exec(
        compact({
          keyArgs: {
            nickname: (opts["nickname"] as string | undefined) ?? "",
            privateOpts: opts["private"] as PrivateOptions,
            endpoints: endpointsFromArray(opts["endpoint"] as string[] | undefined),
            permissions: privilegesFromArray(opts["allow"] as string[] | undefined),
            keys: key,
          },
          generatorOpts: opts["generator"],
          date: opts["date"],
          info: opts["info"],
          urTag: opts["urTag"],
          outputOpts: {
            privateOpts: opts["private"] as PrivateOptions,
            generatorOpts: opts["generator"] as GeneratorOptions,
          },
          passwordArgs: {
            read: {
              password: opts["password"] as string | undefined,
              askpass: Boolean(opts["askpass"]),
            },
            write: {
              encryptPassword: opts["encryptPassword"] as string | undefined,
              encryptAskpass: Boolean(opts["encryptAskpass"]),
              encryptMethod: opts["encryptMethod"] as PasswordMethod,
            },
          },
          signingArgs: {
            sign: opts["sign"] as SigningOption,
            signingKey: opts["signingKey"] as string | undefined,
          },
        }),
      ),
    );
  });

// ----- xid id -----
xidCmd
  .command("id")
  .description("Get the XID identifier from a XID document")
  .argument("[envelope]")
  .option(
    "-f, --format <format>",
    `Output format (${Object.values(XidIDFormat).join(", ")}); may be repeated`,
    collect,
    [],
  )
  .addOption(
    new Option("--verify <opt>", "Signature verification")
      .choices(Object.values(VerifyOption))
      .default(VerifyOption.None),
  )
  .action((envelope: string | undefined, opts: AnyArgs) => {
    run(() => {
      const formats = (opts["format"] as string[] | undefined)?.map((f) =>
        parseEnumValue(XidIDFormat, f, "format"),
      ) ?? [XidIDFormat.Ur];
      return cmd.xid.id.exec(
        compact({
          format: formats,
          verifyArgs: { verify: opts["verify"] as VerifyOption },
          envelope,
        }),
      );
    });
  });

// ----- xid export -----
xidCmd
  .command("export")
  .description("Export a XID document")
  .argument("[envelope]")
  .addOption(
    new Option("--private <mode>", "Private key handling")
      .choices(Object.values(PrivateOptions))
      .default(PrivateOptions.Include),
  )
  .addOption(
    new Option("--generator <mode>", "Generator handling")
      .choices(Object.values(GeneratorOptions))
      .default(GeneratorOptions.Include),
  )
  .option("--password <password>")
  .option("--encrypt-password <password>")
  .option("--askpass", "Use SSH_ASKPASS to read the password", false)
  .option("--encrypt-askpass", "Use SSH_ASKPASS to read the encryption password", false)
  .addOption(
    new Option("--encrypt-method <method>")
      .choices(Object.values(PasswordMethod))
      .default(PasswordMethod.Argon2id),
  )
  .addOption(
    new Option("--verify <opt>", "Signature verification")
      .choices(Object.values(VerifyOption))
      .default(VerifyOption.None),
  )
  .addOption(
    new Option("--sign <mode>", "Signing mode")
      .choices(Object.values(SigningOption))
      .default(SigningOption.None),
  )
  .option("--signing-key <ur>")
  .action(async (envelope: string | undefined, opts: AnyArgs) => {
    await runAsync(() =>
      cmd.xid.exportCmd.exec(
        compact({
          outputOpts: {
            privateOpts: opts["private"] as PrivateOptions,
            generatorOpts: opts["generator"] as GeneratorOptions,
          },
          passwordArgs: {
            read: {
              password: opts["password"] as string | undefined,
              askpass: Boolean(opts["askpass"]),
            },
            write: {
              encryptPassword: opts["encryptPassword"] as string | undefined,
              encryptAskpass: Boolean(opts["encryptAskpass"]),
              encryptMethod: opts["encryptMethod"] as PasswordMethod,
            },
          },
          verifyArgs: { verify: opts["verify"] as VerifyOption },
          signingArgs: {
            sign: opts["sign"] as SigningOption,
            signingKey: opts["signingKey"] as string | undefined,
          },
          envelope,
        }),
      ),
    );
  });

// ----- helpers for shared XID write opts -----

interface XidSharedOpts {
  private?: PrivateOptions;
  generator?: GeneratorOptions;
  password?: string;
  encryptPassword?: string;
  askpass?: boolean;
  encryptAskpass?: boolean;
  encryptMethod?: PasswordMethod;
  verify?: VerifyOption;
  sign?: SigningOption;
  signingKey?: string;
}

function readWriteArgs(opts: AnyArgs): {
  read: { password: string | undefined; askpass: boolean };
  write: {
    encryptPassword: string | undefined;
    encryptAskpass: boolean;
    encryptMethod: PasswordMethod;
  };
} {
  const o = opts as XidSharedOpts;
  return {
    read: {
      password: o.password,
      askpass: Boolean(o.askpass),
    },
    write: {
      encryptPassword: o.encryptPassword,
      encryptAskpass: Boolean(o.encryptAskpass),
      encryptMethod: o.encryptMethod ?? PasswordMethod.Argon2id,
    },
  };
}

function readArgsOnly(opts: AnyArgs): { password: string | undefined; askpass: boolean } {
  const o = opts as XidSharedOpts;
  return {
    password: o.password,
    askpass: Boolean(o.askpass),
  };
}

function outputOpts(opts: AnyArgs): {
  privateOpts: PrivateOptions;
  generatorOpts: GeneratorOptions;
} {
  const o = opts as XidSharedOpts;
  return {
    privateOpts: o.private ?? PrivateOptions.Include,
    generatorOpts: o.generator ?? GeneratorOptions.Include,
  };
}

function verifyArgs(opts: AnyArgs): { verify: VerifyOption } {
  const o = opts as XidSharedOpts;
  return { verify: o.verify ?? VerifyOption.None };
}

function signingArgs(opts: AnyArgs): { sign: SigningOption; signingKey: string | undefined } {
  const o = opts as XidSharedOpts;
  return {
    sign: o.sign ?? SigningOption.None,
    signingKey: o.signingKey,
  };
}

function addXidOutputOptions(c: Command): Command {
  return c
    .addOption(
      new Option("--private <mode>")
        .choices(Object.values(PrivateOptions))
        .default(PrivateOptions.Include),
    )
    .addOption(
      new Option("--generator <mode>")
        .choices(Object.values(GeneratorOptions))
        .default(GeneratorOptions.Include),
    );
}

function addXidPasswordOptions(c: Command): Command {
  return c
    .option("--password <password>")
    .option("--encrypt-password <password>")
    .option("--askpass", "Use SSH_ASKPASS to read the password", false)
    .option("--encrypt-askpass", "Use SSH_ASKPASS to read the encryption password", false)
    .addOption(
      new Option("--encrypt-method <method>")
        .choices(Object.values(PasswordMethod))
        .default(PasswordMethod.Argon2id),
    );
}

function addXidVerifyOption(c: Command): Command {
  return c.addOption(
    new Option("--verify <opt>").choices(Object.values(VerifyOption)).default(VerifyOption.None),
  );
}

function addXidSigningOptions(c: Command): Command {
  return c
    .addOption(
      new Option("--sign <mode>").choices(Object.values(SigningOption)).default(SigningOption.None),
    )
    .option("--signing-key <ur>");
}

// ----- xid key -----
const xidKeyCmd = xidCmd.command("key").description("Work with XID document keys");

addXidSigningOptions(
  addXidVerifyOption(
    addXidPasswordOptions(
      xidKeyCmd
        .command("add")
        .description("Add a key")
        .argument("[key]", "Key UR")
        .option("--nickname <name>", "Nickname", "")
        .option("-e, --endpoint <uri>", "Endpoint (may repeat)", collect, [])
        .option("--allow <perm>", "Permission (may repeat)", collect, [])
        .addOption(
          new Option("--private <mode>")
            .choices(Object.values(PrivateOptions))
            .default(PrivateOptions.Include),
        )
        .addOption(
          new Option("--generator <mode>")
            .choices(Object.values(GeneratorOptions))
            .default(GeneratorOptions.Include),
        )
        .argument("[envelope]"),
    ),
  ),
).action(async (key: string | undefined, envelope: string | undefined, opts: AnyArgs) => {
  await runAsync(() =>
    cmd.xid.key.add.exec(
      compact({
        keyArgs: {
          nickname: (opts["nickname"] as string | undefined) ?? "",
          privateOpts: opts["private"] as PrivateOptions,
          endpoints: endpointsFromArray(opts["endpoint"] as string[] | undefined),
          permissions: privilegesFromArray(opts["allow"] as string[] | undefined),
          keys: key,
        },
        generatorOpts: opts["generator"],
        passwordArgs: readWriteArgs(opts),
        verifyArgs: verifyArgs(opts),
        signingArgs: signingArgs(opts),
        envelope,
      }),
    ),
  );
});

addXidVerifyOption(
  xidKeyCmd
    .command("all")
    .description("List all keys")
    .argument("[envelope]")
    .option("--private", "Return private keys", false)
    .option("--password <password>")
    .option("--askpass", "Use SSH_ASKPASS to read the password", false),
).action(async (envelope: string | undefined, opts: AnyArgs) => {
  await runAsync(() =>
    cmd.xid.key.all.exec(
      compact({
        private: Boolean(opts["private"]),
        passwordArgs: readArgsOnly(opts),
        verifyArgs: verifyArgs(opts),
        envelope,
      }),
    ),
  );
});

addXidVerifyOption(
  xidKeyCmd
    .command("at")
    .description("Get key at index")
    .argument("<index>", "Index", intArg)
    .argument("[envelope]")
    .option("--private", "Operate on the private key form", false)
    .option("--password <password>")
    .option("--askpass", "Use SSH_ASKPASS to read the password", false),
).action(async (index: number, envelope: string | undefined, opts: AnyArgs) => {
  await runAsync(() =>
    cmd.xid.key.at.exec(
      compact({
        index,
        private: Boolean(opts["private"]),
        passwordArgs: readArgsOnly(opts),
        verifyArgs: verifyArgs(opts),
        envelope,
      }),
    ),
  );
});

addXidVerifyOption(
  xidKeyCmd.command("count").description("Count keys").argument("[envelope]"),
).action((envelope: string | undefined, opts: AnyArgs) => {
  run(() =>
    cmd.xid.key.count.exec(
      compact({
        verifyArgs: verifyArgs(opts),
        envelope,
      }),
    ),
  );
});

addXidSigningOptions(
  addXidVerifyOption(
    addXidPasswordOptions(
      addXidOutputOptions(
        xidKeyCmd
          .command("remove")
          .description("Remove a key")
          .argument("[keys]", "Public keys UR")
          .argument("[envelope]"),
      ),
    ),
  ),
).action(async (keys: string | undefined, envelope: string | undefined, opts: AnyArgs) => {
  await runAsync(() =>
    cmd.xid.key.remove.exec(
      compact({
        keys,
        privateOpts: (opts["private"] as PrivateOptions | undefined) ?? PrivateOptions.Include,
        generatorOpts:
          (opts["generator"] as GeneratorOptions | undefined) ?? GeneratorOptions.Include,
        passwordArgs: readWriteArgs(opts),
        verifyArgs: verifyArgs(opts),
        signingArgs: signingArgs(opts),
        envelope,
      }),
    ),
  );
});

addXidSigningOptions(
  addXidVerifyOption(
    addXidPasswordOptions(
      xidKeyCmd
        .command("update")
        .description("Update a key's metadata")
        .argument("[key]", "Key UR")
        .option("--nickname <name>", "", "")
        .option("-e, --endpoint <uri>", "Endpoint (may repeat)", collect, [])
        .option("--allow <perm>", "Permission (may repeat)", collect, [])
        .addOption(
          new Option("--private <mode>")
            .choices(Object.values(PrivateOptions))
            .default(PrivateOptions.Include),
        )
        .addOption(
          new Option("--generator <mode>")
            .choices(Object.values(GeneratorOptions))
            .default(GeneratorOptions.Include),
        )
        .argument("[envelope]"),
    ),
  ),
).action(async (key: string | undefined, envelope: string | undefined, opts: AnyArgs) => {
  await runAsync(() =>
    cmd.xid.key.update.exec(
      compact({
        keyArgs: {
          nickname: (opts["nickname"] as string | undefined) ?? "",
          privateOpts: opts["private"] as PrivateOptions,
          endpoints: endpointsFromArray(opts["endpoint"] as string[] | undefined),
          permissions: privilegesFromArray(opts["allow"] as string[] | undefined),
          keys: key,
        },
        generatorOpts: opts["generator"],
        passwordArgs: readWriteArgs(opts),
        verifyArgs: verifyArgs(opts),
        signingArgs: signingArgs(opts),
        envelope,
      }),
    ),
  );
});

const xidKeyFind = xidKeyCmd.command("find").description("Find keys");

addXidVerifyOption(
  xidKeyFind
    .command("inception")
    .description("Find the inception key")
    .argument("[envelope]")
    .option("--private", "Operate on the private key form", false)
    .option("--password <password>")
    .option("--askpass", "Use SSH_ASKPASS to read the password", false),
).action(async (envelope: string | undefined, opts: AnyArgs) => {
  await runAsync(() =>
    cmd.xid.key.find.inception.exec(
      compact({
        private: Boolean(opts["private"]),
        passwordArgs: readArgsOnly(opts),
        verifyArgs: verifyArgs(opts),
        envelope,
      }),
    ),
  );
});

addXidVerifyOption(
  xidKeyFind
    .command("name")
    .description("Find keys by nickname")
    .argument("<name>")
    .argument("[envelope]")
    .option("--private", "Operate on the private key form", false)
    .option("--password <password>")
    .option("--askpass", "Use SSH_ASKPASS to read the password", false),
).action(async (name: string, envelope: string | undefined, opts: AnyArgs) => {
  await runAsync(() =>
    cmd.xid.key.find.name.exec(
      compact({
        name,
        private: Boolean(opts["private"]),
        passwordArgs: readArgsOnly(opts),
        verifyArgs: verifyArgs(opts),
        envelope,
      }),
    ),
  );
});

addXidVerifyOption(
  xidKeyFind
    .command("public")
    .description("Find keys by public key")
    .argument("[keys]")
    .argument("[envelope]")
    .option("--private", "Operate on the private key form", false)
    .option("--password <password>")
    .option("--askpass", "Use SSH_ASKPASS to read the password", false),
).action(async (keys: string | undefined, envelope: string | undefined, opts: AnyArgs) => {
  await runAsync(() =>
    cmd.xid.key.find.publicCmd.exec(
      compact({
        keys,
        private: Boolean(opts["private"]),
        passwordArgs: readArgsOnly(opts),
        verifyArgs: verifyArgs(opts),
        envelope,
      }),
    ),
  );
});

// ----- xid method -----
const xidMethodCmd = xidCmd.command("method").description("Work with resolution methods");

addXidSigningOptions(
  addXidVerifyOption(
    addXidPasswordOptions(
      addXidOutputOptions(
        xidMethodCmd
          .command("add")
          .description("Add a resolution method")
          .argument("<method>")
          .argument("[envelope]"),
      ),
    ),
  ),
).action(async (method: string, envelope: string | undefined, opts: AnyArgs) => {
  await runAsync(() =>
    cmd.xid.method.add.exec(
      compact({
        method,
        outputOpts: outputOpts(opts),
        passwordArgs: readWriteArgs(opts),
        verifyArgs: verifyArgs(opts),
        signingArgs: signingArgs(opts),
        envelope,
      }),
    ),
  );
});

xidMethodCmd
  .command("all")
  .description("List all resolution methods")
  .argument("[envelope]")
  .action((envelope: string | undefined) => {
    run(() => cmd.xid.method.all.exec(compact({ envelope })));
  });

xidMethodCmd
  .command("at")
  .description("Get method at index")
  .argument("<index>", "Index", intArg)
  .argument("[envelope]")
  .action((index: number, envelope: string | undefined) => {
    run(() => cmd.xid.method.at.exec(compact({ index, envelope })));
  });

xidMethodCmd
  .command("count")
  .description("Count resolution methods")
  .argument("[envelope]")
  .action((envelope: string | undefined) => {
    run(() => cmd.xid.method.count.exec(compact({ envelope })));
  });

addXidSigningOptions(
  addXidVerifyOption(
    addXidPasswordOptions(
      addXidOutputOptions(
        xidMethodCmd
          .command("remove")
          .description("Remove a resolution method")
          .argument("<method>")
          .argument("[envelope]"),
      ),
    ),
  ),
).action(async (method: string, envelope: string | undefined, opts: AnyArgs) => {
  await runAsync(() =>
    cmd.xid.method.remove.exec(
      compact({
        method,
        outputOpts: outputOpts(opts),
        passwordArgs: readWriteArgs(opts),
        verifyArgs: verifyArgs(opts),
        signingArgs: signingArgs(opts),
        envelope,
      }),
    ),
  );
});

// ----- xid delegate -----
const xidDelegateCmd = xidCmd.command("delegate").description("Work with delegates");

addXidSigningOptions(
  addXidVerifyOption(
    addXidPasswordOptions(
      addXidOutputOptions(
        xidDelegateCmd
          .command("add")
          .description("Add a delegate")
          .argument("<delegate>")
          .argument("[envelope]")
          .option("--allow <perm>", "Permission (may repeat)", collect, []),
      ),
    ),
  ),
).action(async (delegate: string, envelope: string | undefined, opts: AnyArgs) => {
  await runAsync(() =>
    cmd.xid.delegate.add.exec(
      compact({
        delegate,
        allow: privilegesFromArray(opts["allow"] as string[] | undefined),
        outputOpts: outputOpts(opts),
        passwordArgs: readWriteArgs(opts),
        verifyArgs: verifyArgs(opts),
        signingArgs: signingArgs(opts),
        envelope,
      }),
    ),
  );
});

xidDelegateCmd
  .command("all")
  .description("List delegates")
  .argument("[envelope]")
  .action((envelope: string | undefined) => {
    run(() => cmd.xid.delegate.all.exec(compact({ envelope })));
  });

xidDelegateCmd
  .command("at")
  .description("Get delegate at index")
  .argument("<index>", "Index", intArg)
  .argument("[envelope]")
  .action((index: number, envelope: string | undefined) => {
    run(() => cmd.xid.delegate.at.exec(compact({ index, envelope })));
  });

xidDelegateCmd
  .command("count")
  .description("Count delegates")
  .argument("[envelope]")
  .action((envelope: string | undefined) => {
    run(() => cmd.xid.delegate.count.exec(compact({ envelope })));
  });

xidDelegateCmd
  .command("find")
  .description("Find delegate by XID")
  .argument("<delegate>")
  .argument("[envelope]")
  .action((delegate: string, envelope: string | undefined) => {
    run(() => cmd.xid.delegate.find.exec(compact({ delegate, envelope })));
  });

addXidSigningOptions(
  addXidVerifyOption(
    addXidPasswordOptions(
      addXidOutputOptions(
        xidDelegateCmd
          .command("update")
          .description("Update delegate's permissions")
          .argument("<delegate>")
          .argument("[envelope]")
          .option("--allow <perm>", "Permission (may repeat)", collect, []),
      ),
    ),
  ),
).action(async (delegate: string, envelope: string | undefined, opts: AnyArgs) => {
  await runAsync(() =>
    cmd.xid.delegate.update.exec(
      compact({
        delegate,
        allow: privilegesFromArray(opts["allow"] as string[] | undefined),
        outputOpts: outputOpts(opts),
        passwordArgs: readWriteArgs(opts),
        verifyArgs: verifyArgs(opts),
        signingArgs: signingArgs(opts),
        envelope,
      }),
    ),
  );
});

addXidSigningOptions(
  addXidVerifyOption(
    addXidPasswordOptions(
      addXidOutputOptions(
        xidDelegateCmd
          .command("remove")
          .description("Remove a delegate")
          .argument("<delegate>")
          .argument("[envelope]"),
      ),
    ),
  ),
).action(async (delegate: string, envelope: string | undefined, opts: AnyArgs) => {
  await runAsync(() =>
    cmd.xid.delegate.remove.exec(
      compact({
        delegate,
        outputOpts: outputOpts(opts),
        passwordArgs: readWriteArgs(opts),
        verifyArgs: verifyArgs(opts),
        signingArgs: signingArgs(opts),
        envelope,
      }),
    ),
  );
});

// ----- xid service -----
const xidServiceCmd = xidCmd.command("service").description("Work with services");

function buildServiceArgs(opts: AnyArgs): {
  name: string | undefined;
  capability: string | undefined;
  keys: string[];
  delegates: string[];
  permissions: XIDPrivilege[];
  uri: string | undefined;
} {
  return {
    name: opts["name"] as string | undefined,
    capability: opts["capability"] as string | undefined,
    keys: (opts["key"] as string[] | undefined) ?? [],
    delegates: (opts["delegate"] as string[] | undefined) ?? [],
    permissions: privilegesFromArray(opts["allow"] as string[] | undefined),
    uri: opts["uri"] as string | undefined,
  };
}

addXidSigningOptions(
  addXidVerifyOption(
    addXidPasswordOptions(
      addXidOutputOptions(
        xidServiceCmd
          .command("add")
          .description("Add a service")
          .argument("[envelope]")
          .option("--name <name>")
          .option("--capability <capability>")
          .option("--key <ur>", "Key UR (may repeat)", collect, [])
          .option("--delegate <ur>", "Delegate UR (may repeat)", collect, [])
          .option("--allow <perm>", "Permission (may repeat)", collect, [])
          .requiredOption("--uri <uri>"),
      ),
    ),
  ),
).action(async (envelope: string | undefined, opts: AnyArgs) => {
  await runAsync(() =>
    cmd.xid.service.add.exec(
      compact({
        serviceArgs: buildServiceArgs(opts),
        outputOpts: outputOpts(opts),
        passwordArgs: readWriteArgs(opts),
        verifyArgs: verifyArgs(opts),
        signingArgs: signingArgs(opts),
        envelope,
      }),
    ),
  );
});

xidServiceCmd
  .command("all")
  .description("List services")
  .argument("[envelope]")
  .action((envelope: string | undefined) => {
    run(() => cmd.xid.service.all.exec(compact({ envelope })));
  });

xidServiceCmd
  .command("at")
  .description("Get service at index")
  .argument("<index>", "Index", intArg)
  .argument("[envelope]")
  .action((index: number, envelope: string | undefined) => {
    run(() => cmd.xid.service.at.exec(compact({ index, envelope })));
  });

xidServiceCmd
  .command("count")
  .description("Count services")
  .argument("[envelope]")
  .action((envelope: string | undefined) => {
    run(() => cmd.xid.service.count.exec(compact({ envelope })));
  });

const xidServiceFind = xidServiceCmd.command("find").description("Find services");
xidServiceFind
  .command("name")
  .argument("<name>")
  .argument("[envelope]")
  .action((name: string, envelope: string | undefined) => {
    run(() => cmd.xid.service.find.name.exec(compact({ name, envelope })));
  });
xidServiceFind
  .command("uri")
  .argument("<uri>")
  .argument("[envelope]")
  .action((uri: string, envelope: string | undefined) => {
    run(() => cmd.xid.service.find.uri.exec(compact({ uri, envelope })));
  });

addXidSigningOptions(
  addXidVerifyOption(
    addXidPasswordOptions(
      addXidOutputOptions(
        xidServiceCmd
          .command("update")
          .description("Update a service")
          .argument("[envelope]")
          .option("--name <name>")
          .option("--capability <capability>")
          .option("--key <ur>", "Key UR (may repeat)", collect, [])
          .option("--delegate <ur>", "Delegate UR (may repeat)", collect, [])
          .option("--allow <perm>", "Permission (may repeat)", collect, [])
          .requiredOption("--uri <uri>"),
      ),
    ),
  ),
).action(async (envelope: string | undefined, opts: AnyArgs) => {
  await runAsync(() =>
    cmd.xid.service.update.exec(
      compact({
        serviceArgs: buildServiceArgs(opts),
        outputOpts: outputOpts(opts),
        passwordArgs: readWriteArgs(opts),
        verifyArgs: verifyArgs(opts),
        signingArgs: signingArgs(opts),
        envelope,
      }),
    ),
  );
});

addXidSigningOptions(
  addXidVerifyOption(
    addXidPasswordOptions(
      addXidOutputOptions(
        xidServiceCmd
          .command("remove")
          .description("Remove a service")
          .argument("<uri>")
          .argument("[envelope]"),
      ),
    ),
  ),
).action(async (uri: string, envelope: string | undefined, opts: AnyArgs) => {
  await runAsync(() =>
    cmd.xid.service.remove.exec(
      compact({
        uri,
        outputOpts: outputOpts(opts),
        passwordArgs: readWriteArgs(opts),
        verifyArgs: verifyArgs(opts),
        signingArgs: signingArgs(opts),
        envelope,
      }),
    ),
  );
});

// ----- xid edge -----
const xidEdgeCmd = xidCmd.command("edge").description("Work with edges");

addXidSigningOptions(
  addXidVerifyOption(
    addXidPasswordOptions(
      addXidOutputOptions(
        xidEdgeCmd
          .command("add")
          .description("Add an edge")
          .argument("<edge>")
          .argument("[envelope]"),
      ),
    ),
  ),
).action(async (edge: string, envelope: string | undefined, opts: AnyArgs) => {
  await runAsync(() =>
    cmd.xid.edge.add.exec(
      compact({
        edge,
        outputOpts: outputOpts(opts),
        passwordArgs: readWriteArgs(opts),
        verifyArgs: verifyArgs(opts),
        signingArgs: signingArgs(opts),
        envelope,
      }),
    ),
  );
});

xidEdgeCmd
  .command("all")
  .description("List edges")
  .argument("[envelope]")
  .action((envelope: string | undefined) => {
    run(() => cmd.xid.edge.all.exec(compact({ envelope })));
  });

xidEdgeCmd
  .command("at")
  .description("Get edge at index")
  .argument("<index>", "Index", intArg)
  .argument("[envelope]")
  .action((index: number, envelope: string | undefined) => {
    run(() => cmd.xid.edge.at.exec(compact({ index, envelope })));
  });

xidEdgeCmd
  .command("count")
  .description("Count edges")
  .argument("[envelope]")
  .action((envelope: string | undefined) => {
    run(() => cmd.xid.edge.count.exec(compact({ envelope })));
  });

xidEdgeCmd
  .command("find")
  .description("Find edges")
  .argument("[envelope]")
  .option("--is-a <ur>")
  .option("--source <ur>")
  .option("--target <ur>")
  .option("--subject <ur>")
  .action((envelope: string | undefined, opts: AnyArgs) => {
    run(() =>
      cmd.xid.edge.find.exec(
        compact({
          isA: opts["isA"],
          source: opts["source"],
          target: opts["target"],
          subject: opts["subject"],
          envelope,
        }),
      ),
    );
  });

addXidSigningOptions(
  addXidVerifyOption(
    addXidPasswordOptions(
      addXidOutputOptions(
        xidEdgeCmd
          .command("remove")
          .description("Remove an edge")
          .argument("<edge>")
          .argument("[envelope]"),
      ),
    ),
  ),
).action(async (edge: string, envelope: string | undefined, opts: AnyArgs) => {
  await runAsync(() =>
    cmd.xid.edge.remove.exec(
      compact({
        edge,
        outputOpts: outputOpts(opts),
        passwordArgs: readWriteArgs(opts),
        verifyArgs: verifyArgs(opts),
        signingArgs: signingArgs(opts),
        envelope,
      }),
    ),
  );
});

// ----- xid resolution -----
const xidResolutionCmd = xidCmd.command("resolution").description("Work with resolution methods");

addXidSigningOptions(
  addXidVerifyOption(
    addXidPasswordOptions(
      addXidOutputOptions(
        xidResolutionCmd
          .command("add")
          .description("Add a resolution method (dereferenceVia)")
          .argument("[uri]")
          .argument("[envelope]"),
      ),
    ),
  ),
).action(async (uri: string | undefined, envelope: string | undefined, opts: AnyArgs) => {
  await runAsync(() =>
    cmd.xid.resolution.add.exec(
      compact({
        uri,
        outputOpts: outputOpts(opts),
        passwordArgs: readWriteArgs(opts),
        verifyArgs: verifyArgs(opts),
        signingArgs: signingArgs(opts),
        envelope,
      }),
    ),
  );
});

xidResolutionCmd
  .command("all")
  .description("List all resolution methods")
  .argument("[envelope]")
  .action((envelope: string | undefined) => {
    run(() => cmd.xid.resolution.all.exec(compact({ envelope })));
  });

xidResolutionCmd
  .command("at")
  .description("Get resolution at index")
  .argument("<index>", "Index", intArg)
  .argument("[envelope]")
  .action((index: number, envelope: string | undefined) => {
    run(() => cmd.xid.resolution.at.exec(compact({ index, envelope })));
  });

xidResolutionCmd
  .command("count")
  .description("Count resolutions")
  .argument("[envelope]")
  .action((envelope: string | undefined) => {
    run(() => cmd.xid.resolution.count.exec(compact({ envelope })));
  });

addXidSigningOptions(
  addXidVerifyOption(
    addXidPasswordOptions(
      addXidOutputOptions(
        xidResolutionCmd
          .command("remove")
          .description("Remove a resolution method")
          .argument("[uri]")
          .argument("[envelope]"),
      ),
    ),
  ),
).action(async (uri: string | undefined, envelope: string | undefined, opts: AnyArgs) => {
  await runAsync(() =>
    cmd.xid.resolution.remove.exec(
      compact({
        uri,
        outputOpts: outputOpts(opts),
        passwordArgs: readWriteArgs(opts),
        verifyArgs: verifyArgs(opts),
        signingArgs: signingArgs(opts),
        envelope,
      }),
    ),
  );
});

// ----- xid attachment -----
const xidAttachmentCmd = xidCmd.command("attachment").description("Work with attachments");

addXidSigningOptions(
  addXidVerifyOption(
    addXidPasswordOptions(
      addXidOutputOptions(
        xidAttachmentCmd
          .command("add")
          .description("Add an attachment")
          .argument("[envelope]")
          .option("--attachment <ur>")
          .option("--vendor <vendor>")
          .option("--payload <payload>")
          .option("--conforms-to <uri>"),
      ),
    ),
  ),
).action(async (envelope: string | undefined, opts: AnyArgs) => {
  await runAsync(() =>
    cmd.xid.attachment.add.exec(
      compact({
        attachment: opts["attachment"],
        vendor: opts["vendor"],
        payload: opts["payload"],
        conformsTo: opts["conformsTo"],
        outputOpts: outputOpts(opts),
        passwordArgs: readWriteArgs(opts),
        verifyArgs: verifyArgs(opts),
        signingArgs: signingArgs(opts),
        envelope,
      }),
    ),
  );
});

xidAttachmentCmd
  .command("all")
  .description("List attachments")
  .argument("[envelope]")
  .action((envelope: string | undefined) => {
    run(() => cmd.xid.attachment.all.exec(compact({ envelope })));
  });

xidAttachmentCmd
  .command("at")
  .description("Get attachment at index")
  .argument("<index>", "Index", intArg)
  .argument("[envelope]")
  .action((index: number, envelope: string | undefined) => {
    run(() => cmd.xid.attachment.at.exec(compact({ index, envelope })));
  });

xidAttachmentCmd
  .command("count")
  .description("Count attachments")
  .argument("[envelope]")
  .action((envelope: string | undefined) => {
    run(() => cmd.xid.attachment.count.exec(compact({ envelope })));
  });

xidAttachmentCmd
  .command("find")
  .description("Find attachments")
  .argument("[envelope]")
  .option("--vendor <vendor>")
  .option("--conforms-to <uri>")
  .action((envelope: string | undefined, opts: AnyArgs) => {
    run(() =>
      cmd.xid.attachment.find.exec(
        compact({
          vendor: opts["vendor"],
          conformsTo: opts["conformsTo"],
          envelope,
        }),
      ),
    );
  });

addXidSigningOptions(
  addXidVerifyOption(
    addXidPasswordOptions(
      addXidOutputOptions(
        xidAttachmentCmd
          .command("remove")
          .description("Remove an attachment")
          .argument("<attachment>")
          .argument("[envelope]"),
      ),
    ),
  ),
).action(async (attachment: string, envelope: string | undefined, opts: AnyArgs) => {
  await runAsync(() =>
    cmd.xid.attachment.remove.exec(
      compact({
        attachment,
        outputOpts: outputOpts(opts),
        passwordArgs: readWriteArgs(opts),
        verifyArgs: verifyArgs(opts),
        signingArgs: signingArgs(opts),
        envelope,
      }),
    ),
  );
});

// ----- xid provenance -----
const xidProvenanceCmd = xidCmd.command("provenance").description("Work with provenance marks");

addXidVerifyOption(
  xidProvenanceCmd
    .command("get")
    .description("Get the current provenance mark")
    .argument("[envelope]")
    .option("--password <password>")
    .option("--encrypt-password <password>")
    .option("--askpass", "Use SSH_ASKPASS to read the password", false)
    .option("--encrypt-askpass", "Use SSH_ASKPASS to read the encryption password", false)
    .addOption(
      new Option("--encrypt-method <method>")
        .choices(Object.values(PasswordMethod))
        .default(PasswordMethod.Argon2id),
    ),
).action(async (envelope: string | undefined, opts: AnyArgs) => {
  await runAsync(() =>
    cmd.xid.provenance.get.exec(
      compact({
        passwordArgs: readWriteArgs(opts),
        verifyArgs: verifyArgs(opts),
        envelope,
      }),
    ),
  );
});

addXidSigningOptions(
  addXidVerifyOption(
    addXidPasswordOptions(
      addXidOutputOptions(
        xidProvenanceCmd
          .command("next")
          .description("Advance the provenance mark to the next state")
          .argument("[envelope]")
          .option("--date <date>", "ISO-8601 date for the new mark")
          .option("--info <ur>", "Optional info UR")
          .option("--ur-tag <n>", "CBOR tag for an enclosed UR", intArg)
          .option("--external-generator <ur>", "Use an external generator UR"),
      ),
    ),
  ),
).action(async (envelope: string | undefined, opts: AnyArgs) => {
  await runAsync(() =>
    cmd.xid.provenance.next.exec(
      compact({
        date: opts["date"],
        info: opts["info"],
        urTag: opts["urTag"],
        externalGenerator: opts["externalGenerator"],
        outputOpts: outputOpts(opts),
        passwordArgs: readWriteArgs(opts),
        verifyArgs: verifyArgs(opts),
        signingArgs: signingArgs(opts),
        envelope,
      }),
    ),
  );
});

program.parseAsync().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  process.stderr.write(`Error: ${msg}\n`);
  process.exit(1);
});
