#!/usr/bin/env node
/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * FROST CLI binary entry point.
 *
 * Port of `frost-hubert-rust/src/main.rs` and the per-subcommand
 * `clap::Parser` definitions in
 * `frost-hubert-rust/src/cmd/{registry,dkg,sign}/...`.
 *
 * Each subcommand is a thin wrapper that:
 *   1. parses CLI args into the matching `*Options` interface,
 *   2. constructs a `StorageClient` if a backend is requested,
 *   3. delegates to the library function in `src/cmd/...`,
 *   4. prints the same single-line output Rust prints.
 *
 * @module
 */

import { program } from "commander";

import { ownerSet } from "../cmd/registry/owner/set.js";
import { participantAdd } from "../cmd/registry/participant/add.js";
import { type StorageClient, type StorageSelection, createStorageClient } from "../cmd/storage.js";

// DKG / sign command modules transitively load `@frosts/core`, whose
// published dist auto-imports `vitest` as a side-effect (a known
// upstream packaging bug). Importing them at module-load time would
// crash the registry-only CLI, so we lazy-import them inside the
// command handlers below. Once `@frosts/core` ships a clean dist this
// can be flipped back to static imports.
const lazyDkgCoord = {
  invite: () => import("../cmd/dkg/coordinator/invite.js").then((m) => m.invite),
  round1: () => import("../cmd/dkg/coordinator/round1.js").then((m) => m.round1),
  round2: () => import("../cmd/dkg/coordinator/round2.js").then((m) => m.round2),
  finalize: () => import("../cmd/dkg/coordinator/finalize.js").then((m) => m.finalize),
};
const lazyDkgPart = {
  receive: () => import("../cmd/dkg/participant/receive.js").then((m) => m.receive),
  round1: () => import("../cmd/dkg/participant/round1.js").then((m) => m.round1),
  round2: () => import("../cmd/dkg/participant/round2.js").then((m) => m.round2),
  finalize: () => import("../cmd/dkg/participant/finalize.js").then((m) => m.finalize),
};
const lazySignCoord = {
  invite: () => import("../cmd/sign/coordinator/invite.js").then((m) => m.invite),
  round1: () => import("../cmd/sign/coordinator/round1.js").then((m) => m.round1),
  round2: () => import("../cmd/sign/coordinator/round2.js").then((m) => m.round2),
};
const lazySignPart = {
  receive: () => import("../cmd/sign/participant/receive.js").then((m) => m.receive),
  round1: () => import("../cmd/sign/participant/round1.js").then((m) => m.round1),
  round2: () => import("../cmd/sign/participant/round2.js").then((m) => m.round2),
  finalize: () => import("../cmd/sign/participant/finalize.js").then((m) => m.finalize),
};

// Type for modules that may have registerTags
interface TagModule {
  registerTags?: () => void;
}

/**
 * Initialize the global CBOR tag registry. Mirrors the
 * Rust `lib.rs::run` initialization step (`bc_components::register_tags();`
 * `bc_envelope::register_tags();` `provenance_mark::register_tags();`).
 */
async function registerTags(): Promise<void> {
  try {
    const components = (await import("@bcts/components")) as TagModule;
    const envelope = (await import("@bcts/envelope")) as TagModule;
    const provenanceMark = (await import("@bcts/provenance-mark")) as TagModule;

    if (typeof components.registerTags === "function") {
      components.registerTags();
    }
    if (typeof envelope.registerTags === "function") {
      envelope.registerTags();
    }
    if (typeof provenanceMark.registerTags === "function") {
      provenanceMark.registerTags();
    }
  } catch {
    // Tags may not need registration in this context
  }
}

/**
 * Storage-related CLI options shared across most subcommands.
 *
 * Mirrors Rust `OptionalStorageSelector` (clap-flatten) — the user can
 * pass exactly one of `--storage server|mainline|ipfs|hybrid` to enable
 * a Hubert backend. When omitted, the subcommand runs in local-only
 * preview/state mode.
 */
interface StorageOpts {
  storage?: StorageSelection;
  host?: string;
  port?: string;
}

function isStorageSelection(value: string): value is StorageSelection {
  return value === "server" || value === "mainline" || value === "ipfs" || value === "hybrid";
}

function parseStorageSelection(opts: StorageOpts): StorageSelection | undefined {
  const value = opts.storage;
  if (value === undefined) return undefined;
  if (!isStorageSelection(value)) {
    throw new Error(`Unknown --storage value: ${String(value)}`);
  }
  return value;
}

async function buildClient(opts: StorageOpts): Promise<StorageClient | undefined> {
  const selection = parseStorageSelection(opts);
  if (selection === undefined) return undefined;
  const serverUrl =
    opts.host !== undefined && opts.port !== undefined
      ? `http://${opts.host}:${opts.port}`
      : opts.host;
  return createStorageClient(selection, serverUrl);
}

/** Convert a comma-separated, repeated-flag, or positional list. */
function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value === "string") return [value];
  return [];
}

function asNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error(`Expected a number, got: ${typeof value}`);
  }
  const n = Number(value);
  if (Number.isNaN(n)) throw new Error(`Expected a number, got: ${value as string}`);
  return n;
}

/**
 * Build an object containing only the keys whose values are defined.
 *
 * The frost-hubert library types use `exactOptionalPropertyTypes: true`,
 * which means `{ foo?: string }` rejects `{ foo: undefined }` — only
 * `{ foo: "x" }` or `{}` is allowed. Spreading this helper's return
 * value into an options object preserves that contract: at runtime we
 * filter out the `undefined` keys, and we strip `undefined` from the
 * value type so the spread satisfies `exactOptionalPropertyTypes`.
 */
type DefinedValues<T> = { [K in keyof T]?: Exclude<T[K], undefined> };
function defined<T extends Record<string, unknown>>(obj: T): DefinedValues<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out as DefinedValues<T>;
}

/**
 * Wrap a CLI action handler so any thrown error prints to stderr and
 * exits with code 1. Mirrors Rust's `anyhow::Result<()>` propagation.
 */
function runAsync<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<void>,
): (...args: TArgs) => void {
  return (...args: TArgs): void => {
    handler(...args).catch((err: unknown) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
  };
}

function runSync<TArgs extends unknown[]>(
  handler: (...args: TArgs) => void,
): (...args: TArgs) => void {
  return (...args: TArgs): void => {
    try {
      handler(...args);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  };
}

// Common option attachers — keep the per-subcommand definitions short.
const addStorageOpts = (cmd: ReturnType<typeof program.command>): typeof cmd =>
  cmd
    .option("--storage <selection>", "Storage backend (server|mainline|ipfs|hybrid)")
    .option("--host <host>", "Server host (server backend only)")
    .option("--port <port>", "Server port (server backend only)");

const addRegistryOpt = (cmd: ReturnType<typeof program.command>): typeof cmd =>
  cmd.option("-r, --registry <path>", "Registry path or filename override");

const addTimeoutOpt = (cmd: ReturnType<typeof program.command>): typeof cmd =>
  cmd.option("--timeout <seconds>", "Wait up to this many seconds");

// ---------------------------------------------------------------------------
// CLI definition
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  await registerTags();

  program.name("frost").description("FROST threshold signing CLI").version("1.0.0");

  // ─── Registry ──────────────────────────────────────────────────────────
  const registryCmd = program.command("registry").description("Manage the registry");
  const ownerCmd = registryCmd.command("owner").description("Manage the registry owner");

  ownerCmd
    .command("set <xid-document> [pet-name]")
    .description("Set the registry owner using an ur:xid document that includes private keys")
    .option("-r, --registry <path>", "Registry path or filename override")
    .action(
      runSync(
        (xidDocument: string, petName: string | undefined, options: { registry?: string }) => {
          ownerSet({ xidDocument, petName, registryPath: options.registry }, process.cwd());
        },
      ),
    );

  const participantCmd = registryCmd
    .command("participant")
    .description("Manage registry participants");

  participantCmd
    .command("add <xid-document> [pet-name]")
    .description("Add a participant using an ur:xid document")
    .option("-r, --registry <path>", "Registry path or filename override")
    .action(
      runSync(
        (xidDocument: string, petName: string | undefined, options: { registry?: string }) => {
          participantAdd({ xidDocument, petName, registryPath: options.registry }, process.cwd());
        },
      ),
    );

  // ─── DKG ──────────────────────────────────────────────────────────────
  const dkgCmd = program.command("dkg").description("Distributed Key Generation commands");
  const dkgCoordinatorCmd = dkgCmd.command("coordinator").description("DKG coordinator commands");

  // dkg coordinator invite
  addStorageOpts(
    addRegistryOpt(
      dkgCoordinatorCmd
        .command("invite <participants...>")
        .description("Compose or send a DKG invite")
        .option("--min-signers <n>", "Minimum signers required; defaults to participant count")
        .option("--charter <string>", "Charter statement for the DKG group", "")
        .option("--valid-days <days>", "Days the invite is valid for", "30")
        .option("--preview", "Print the preview invite envelope UR instead of the sealed envelope"),
    ),
  ).action(
    runAsync(
      async (
        participants: string[],
        opts: StorageOpts & {
          registry?: string;
          minSigners?: string;
          charter?: string;
          validDays?: string;
          preview?: boolean;
        },
      ) => {
        const selection = parseStorageSelection(opts);
        if (selection !== undefined && opts.preview === true) {
          throw new Error("--preview cannot be used with Hubert storage options");
        }
        const client = await buildClient(opts);
        const fn = await lazyDkgCoord.invite();
        const result = await fn(
          // dkgCoordInvite requires a defined client; for preview the
          // invite is built but not posted, so we pass a no-op client.
          client ?? noOpClient(),
          {
            charter: opts.charter ?? "",
            validDays: asNumber(opts.validDays) ?? 30,
            participantNames: asStringArray(participants),
            ...defined({
              registryPath: opts.registry,
              minSigners: asNumber(opts.minSigners),
            }),
          },
          process.cwd(),
        );
        console.log(result.envelopeUr);
      },
    ),
  );

  // dkg coordinator round1
  addStorageOpts(
    addTimeoutOpt(
      addRegistryOpt(
        dkgCoordinatorCmd
          .command("round1 <group-id>")
          .description("Collect round 1 responses")
          .option("--preview", "Preview one of the round 2 requests while sending")
          .option("--parallel", "Use parallel fetch/send"),
      ),
    ),
  ).action(
    runAsync(
      async (
        groupId: string,
        opts: StorageOpts & {
          registry?: string;
          timeout?: string;
          preview?: boolean;
          parallel?: boolean;
        },
      ) => {
        const client = await buildClient(opts);
        if (client === undefined) {
          throw new Error("dkg coordinator round1 requires --storage");
        }
        const fn = await lazyDkgCoord.round1();
        const result = await fn(
          client,
          {
            groupId,
            ...defined({
              registryPath: opts.registry,
              timeoutSeconds: asNumber(opts.timeout),
              preview: opts.preview,
              parallel: opts.parallel,
            }),
          },
          process.cwd(),
        );
        console.log(JSON.stringify(result));
      },
    ),
  );

  // dkg coordinator round2
  addStorageOpts(
    addTimeoutOpt(
      addRegistryOpt(
        dkgCoordinatorCmd
          .command("round2 <group-id>")
          .description("Collect round 2 responses")
          .option("--preview", "Preview one of the finalize requests while sending")
          .option("--parallel", "Use parallel fetch/send"),
      ),
    ),
  ).action(
    runAsync(
      async (
        groupId: string,
        opts: StorageOpts & {
          registry?: string;
          timeout?: string;
          preview?: boolean;
          parallel?: boolean;
        },
      ) => {
        const client = await buildClient(opts);
        if (client === undefined) {
          throw new Error("dkg coordinator round2 requires --storage");
        }
        const fn = await lazyDkgCoord.round2();
        const result = await fn(
          client,
          {
            groupId,
            ...defined({
              registryPath: opts.registry,
              timeoutSeconds: asNumber(opts.timeout),
              preview: opts.preview,
              parallel: opts.parallel,
            }),
          },
          process.cwd(),
        );
        console.log(JSON.stringify(result));
      },
    ),
  );

  // dkg coordinator finalize
  addStorageOpts(
    addTimeoutOpt(
      addRegistryOpt(
        dkgCoordinatorCmd
          .command("finalize <group-id>")
          .description("Collect finalize responses")
          .option("--parallel", "Use parallel fetch"),
      ),
    ),
  ).action(
    runAsync(
      async (
        groupId: string,
        opts: StorageOpts & {
          registry?: string;
          timeout?: string;
          parallel?: boolean;
        },
      ) => {
        const client = await buildClient(opts);
        if (client === undefined) {
          throw new Error("dkg coordinator finalize requires --storage");
        }
        const fn = await lazyDkgCoord.finalize();
        const result = await fn(
          client,
          {
            groupId,
            ...defined({
              registryPath: opts.registry,
              timeoutSeconds: asNumber(opts.timeout),
              parallel: opts.parallel,
            }),
          },
          process.cwd(),
        );
        console.log(result.verifyingKey);
      },
    ),
  );

  // ─── DKG participant ───────────────────────────────────────────────────
  const dkgParticipantCmd = dkgCmd.command("participant").description("DKG participant commands");

  // dkg participant receive
  addStorageOpts(
    addTimeoutOpt(
      addRegistryOpt(
        dkgParticipantCmd
          .command("receive <invite>")
          .description("Receive a DKG invite (ur:arid or ur:envelope)")
          .option("--no-envelope", "Suppress printing the invite envelope UR")
          .option("--info", "Show invite details")
          .option("--sender <sender>", "Require the invite to come from this sender"),
      ),
    ),
  ).action(
    runAsync(
      async (
        invite: string,
        opts: StorageOpts & {
          registry?: string;
          timeout?: string;
          envelope?: boolean;
          info?: boolean;
          sender?: string;
        },
      ) => {
        const selection = parseStorageSelection(opts);
        const client = await buildClient(opts);
        const fn = await lazyDkgPart.receive();
        const result = await fn(
          client,
          {
            invite,
            // commander auto-negates `--no-envelope` into `envelope: false`.
            noEnvelope: opts.envelope === false,
            ...defined({
              registryPath: opts.registry,
              timeoutSeconds: asNumber(opts.timeout),
              info: opts.info,
              sender: opts.sender,
              storageSelection: selection,
            }),
          },
          process.cwd(),
        );
        if (result.envelopeUr !== undefined) console.log(result.envelopeUr);
      },
    ),
  );

  // dkg participant round1
  addStorageOpts(
    addTimeoutOpt(
      addRegistryOpt(
        dkgParticipantCmd
          .command("round1 <invite>")
          .description("Send round 1 response")
          .option("--response-arid <ur>", "Optional ARID for the next response")
          .option("--preview", "Print the preview response envelope UR instead")
          .option("--reject <reason>", "Reject the invite with the provided reason")
          .option("--sender <sender>", "Require the invite to come from this sender"),
      ),
    ),
  ).action(
    runAsync(
      async (
        invite: string,
        opts: StorageOpts & {
          registry?: string;
          timeout?: string;
          responseArid?: string;
          preview?: boolean;
          reject?: string;
          sender?: string;
        },
      ) => {
        const selection = parseStorageSelection(opts);
        const client = await buildClient(opts);
        const fn = await lazyDkgPart.round1();
        const result = await fn(
          client,
          {
            invite,
            ...defined({
              registryPath: opts.registry,
              timeoutSeconds: asNumber(opts.timeout),
              responseArid: opts.responseArid,
              preview: opts.preview,
              rejectReason: opts.reject,
              sender: opts.sender,
              storageSelection: selection,
            }),
          },
          process.cwd(),
        );
        if (result.envelopeUr !== undefined) console.log(result.envelopeUr);
        else if (result.listeningArid !== undefined) console.log(result.listeningArid);
      },
    ),
  );

  // dkg participant round2
  addStorageOpts(
    addTimeoutOpt(
      addRegistryOpt(
        dkgParticipantCmd
          .command("round2 <group-id>")
          .description("Send round 2 response")
          .option("--preview", "Also print the preview response envelope"),
      ),
    ),
  ).action(
    runAsync(
      async (
        groupId: string,
        opts: StorageOpts & { registry?: string; timeout?: string; preview?: boolean },
      ) => {
        const selection = parseStorageSelection(opts);
        const client = await buildClient(opts);
        const fn = await lazyDkgPart.round2();
        const result = await fn(
          client,
          {
            groupId,
            ...defined({
              registryPath: opts.registry,
              timeoutSeconds: asNumber(opts.timeout),
              preview: opts.preview,
              storageSelection: selection,
            }),
          },
          process.cwd(),
        );
        if (result.envelopeUr !== undefined) console.log(result.envelopeUr);
        else console.log(result.listeningArid);
      },
    ),
  );

  // dkg participant finalize
  addStorageOpts(
    addTimeoutOpt(
      addRegistryOpt(
        dkgParticipantCmd
          .command("finalize <group-id>")
          .description("Receive finalize package")
          .option("--preview", "Also print the preview response envelope"),
      ),
    ),
  ).action(
    runAsync(
      async (
        groupId: string,
        opts: StorageOpts & { registry?: string; timeout?: string; preview?: boolean },
      ) => {
        const selection = parseStorageSelection(opts);
        const client = await buildClient(opts);
        const fn = await lazyDkgPart.finalize();
        const result = await fn(
          client,
          {
            groupId,
            ...defined({
              registryPath: opts.registry,
              timeoutSeconds: asNumber(opts.timeout),
              preview: opts.preview,
              storageSelection: selection,
            }),
          },
          process.cwd(),
        );
        console.log(result.verifyingKey);
      },
    ),
  );

  // ─── Sign ──────────────────────────────────────────────────────────────
  const signCmd = program.command("sign").description("Threshold signing commands");
  const signCoordinatorCmd = signCmd
    .command("coordinator")
    .description("Sign coordinator commands");

  // sign coordinator invite
  addStorageOpts(
    addRegistryOpt(
      signCoordinatorCmd
        .command("invite <group-id>")
        .description("Send sign invite to participants")
        .requiredOption("--target <path>", "Path to a file containing the target envelope UR")
        .option("--preview", "Print the preview request envelope UR instead of sending"),
    ),
  ).action(
    runAsync(
      async (
        groupId: string,
        opts: StorageOpts & { registry?: string; target: string; preview?: boolean },
      ) => {
        const client = await buildClient(opts);
        const fn = await lazySignCoord.invite();
        const result = await fn(
          client,
          {
            groupId,
            targetFile: opts.target,
            ...defined({
              registryPath: opts.registry,
              preview: opts.preview,
            }),
          },
          process.cwd(),
        );
        console.log(result.startArid);
      },
    ),
  );

  // sign coordinator round1
  addStorageOpts(
    addTimeoutOpt(
      addRegistryOpt(
        signCoordinatorCmd
          .command("round1 <session-id>")
          .description("Collect round 1 (commitment) responses")
          .option("--group <ur:arid>", "Optional group ID hint")
          .option("--preview-share", "Print a sample unsealed signRound2 request")
          .option("--parallel", "Use parallel fetch/send"),
      ),
    ),
  ).action(
    runAsync(
      async (
        sessionId: string,
        opts: StorageOpts & {
          registry?: string;
          timeout?: string;
          group?: string;
          previewShare?: boolean;
          parallel?: boolean;
        },
      ) => {
        const client = await buildClient(opts);
        if (client === undefined) {
          throw new Error("sign coordinator round1 requires --storage");
        }
        const fn = await lazySignCoord.round1();
        const result = await fn(
          client,
          {
            sessionId,
            ...defined({
              registryPath: opts.registry,
              groupId: opts.group,
              timeoutSeconds: asNumber(opts.timeout),
              previewShare: opts.previewShare,
              parallel: opts.parallel,
            }),
          },
          process.cwd(),
        );
        console.log(JSON.stringify(result));
      },
    ),
  );

  // sign coordinator round2
  addStorageOpts(
    addTimeoutOpt(
      addRegistryOpt(
        signCoordinatorCmd
          .command("round2 <session-id>")
          .description("Collect round 2 responses and finalize signature")
          .option("--group <ur:arid>", "Optional group ID hint")
          .option("--preview-finalize", "Print a sample unsealed finalize package")
          .option("--parallel", "Use parallel fetch/send"),
      ),
    ),
  ).action(
    runAsync(
      async (
        sessionId: string,
        opts: StorageOpts & {
          registry?: string;
          timeout?: string;
          group?: string;
          previewFinalize?: boolean;
          parallel?: boolean;
        },
      ) => {
        const client = await buildClient(opts);
        if (client === undefined) {
          throw new Error("sign coordinator round2 requires --storage");
        }
        const fn = await lazySignCoord.round2();
        const result = await fn(
          client,
          {
            sessionId,
            ...defined({
              registryPath: opts.registry,
              groupId: opts.group,
              timeoutSeconds: asNumber(opts.timeout),
              previewFinalize: opts.previewFinalize,
              parallel: opts.parallel,
            }),
          },
          process.cwd(),
        );
        console.log(result.signedEnvelope);
      },
    ),
  );

  // ─── Sign participant ──────────────────────────────────────────────────
  const signParticipantCmd = signCmd
    .command("participant")
    .description("Sign participant commands");

  // sign participant receive
  addStorageOpts(
    addTimeoutOpt(
      addRegistryOpt(
        signParticipantCmd
          .command("receive <request>")
          .description("Receive a signInvite request (ur:arid or ur:envelope)")
          .option("--info", "Show request details")
          .option("--sender <sender>", "Require the request to come from this sender"),
      ),
    ),
  ).action(
    runAsync(
      async (
        request: string,
        opts: StorageOpts & {
          registry?: string;
          timeout?: string;
          info?: boolean;
          sender?: string;
        },
      ) => {
        const selection = parseStorageSelection(opts);
        const client = await buildClient(opts);
        const fn = await lazySignPart.receive();
        const result = await fn(
          client,
          selection,
          {
            request,
            ...defined({
              registryPath: opts.registry,
              timeoutSeconds: asNumber(opts.timeout),
              info: opts.info,
              sender: opts.sender,
            }),
          },
          process.cwd(),
        );
        console.log(JSON.stringify(result));
      },
    ),
  );

  // sign participant round1
  addStorageOpts(
    addRegistryOpt(
      signParticipantCmd
        .command("round1 <session-id>")
        .description("Send commitment")
        .option("--preview", "Print the preview response envelope UR instead of sending")
        .option("--reject <reason>", "Reject the signInvite request with the provided reason")
        .option("--group <ur:arid>", "Optional group ID hint"),
    ),
  ).action(
    runAsync(
      async (
        sessionId: string,
        opts: StorageOpts & {
          registry?: string;
          preview?: boolean;
          reject?: string;
          group?: string;
        },
      ) => {
        const selection = parseStorageSelection(opts);
        const client = await buildClient(opts);
        const fn = await lazySignPart.round1();
        const result = await fn(
          client,
          {
            sessionId,
            ...defined({
              registryPath: opts.registry,
              groupId: opts.group,
              preview: opts.preview,
              rejectReason: opts.reject,
              storageSelection: selection,
            }),
          },
          process.cwd(),
        );
        if (result.envelopeUr !== undefined) console.log(result.envelopeUr);
        else if (result.listeningArid !== undefined) console.log(result.listeningArid);
      },
    ),
  );

  // sign participant round2
  addStorageOpts(
    addTimeoutOpt(
      addRegistryOpt(
        signParticipantCmd
          .command("round2 <session-id>")
          .description("Send signature share")
          .option("--preview", "Print the unsealed response envelope UR instead of sending")
          .option("--group <ur:arid>", "Optional group ID hint"),
      ),
    ),
  ).action(
    runAsync(
      async (
        sessionId: string,
        opts: StorageOpts & {
          registry?: string;
          timeout?: string;
          preview?: boolean;
          group?: string;
        },
      ) => {
        const client = await buildClient(opts);
        if (client === undefined) {
          throw new Error("sign participant round2 requires --storage");
        }
        const fn = await lazySignPart.round2();
        const result = await fn(
          client,
          {
            sessionId,
            ...defined({
              registryPath: opts.registry,
              groupId: opts.group,
              timeoutSeconds: asNumber(opts.timeout),
              preview: opts.preview,
            }),
          },
          process.cwd(),
        );
        console.log(result.listeningArid);
      },
    ),
  );

  // sign participant finalize
  addStorageOpts(
    addTimeoutOpt(
      addRegistryOpt(
        signParticipantCmd
          .command("finalize <session-id>")
          .description("Receive finalize event")
          .option("--group <ur:arid>", "Optional group ID hint"),
      ),
    ),
  ).action(
    runAsync(
      async (
        sessionId: string,
        opts: StorageOpts & {
          registry?: string;
          timeout?: string;
          group?: string;
        },
      ) => {
        const client = await buildClient(opts);
        if (client === undefined) {
          throw new Error("sign participant finalize requires --storage");
        }
        const fn = await lazySignPart.finalize();
        const result = await fn(
          client,
          {
            sessionId,
            ...defined({
              registryPath: opts.registry,
              groupId: opts.group,
              timeoutSeconds: asNumber(opts.timeout),
            }),
          },
          process.cwd(),
        );
        console.log(result.signature);
      },
    ),
  );

  program.parse();
}

/**
 * Build a no-op StorageClient for preview-only paths (the
 * coordinator-invite library expects a defined client even when no
 * envelope is sent, because it threads through some helpers).
 *
 * Mirrors Rust's behaviour: `--preview` skips the
 * `StorageClient::from_selection` call entirely, but the underlying
 * library still walks through the same code path with a stub.
 */
function noOpClient(): StorageClient {
  return {
    put: () => Promise.reject(new Error("no-op storage client used in preview mode")),
    get: () => Promise.reject(new Error("no-op storage client used in preview mode")),
    exists: () => Promise.resolve(false),
  };
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
