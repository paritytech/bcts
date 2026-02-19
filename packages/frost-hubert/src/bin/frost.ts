#!/usr/bin/env node
/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

/**
 * FROST CLI binary entry point.
 *
 * Port of main.rs and lib.rs CLI from frost-hubert-rust.
 *
 * @module
 */

import { program } from "commander";

import { ownerSet } from "../cmd/registry/owner/set.js";
import { participantAdd } from "../cmd/registry/participant/add.js";

// Type for modules that may have registerTags
interface TagModule {
  registerTags?: () => void;
}

// Register CBOR tags using dynamic import
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

// Main CLI function
async function main(): Promise<void> {
  // Initialize tags before CLI runs
  await registerTags();

  program.name("frost").description("FROST threshold signing CLI").version("1.0.0");

  // Registry commands
  const registryCmd = program.command("registry").description("Manage the registry");

  // Registry owner commands
  const ownerCmd = registryCmd.command("owner").description("Manage the registry owner");

  ownerCmd
    .command("set <xid-document> [pet-name]")
    .description("Set the registry owner using an ur:xid document that includes private keys")
    .option("-r, --registry <path>", "Registry path or filename override")
    .action((xidDocument: string, petName: string | undefined, options: { registry?: string }) => {
      try {
        ownerSet(
          {
            xidDocument,
            petName,
            registryPath: options.registry,
          },
          process.cwd(),
        );
      } catch (error) {
        console.error((error as Error).message);
        process.exit(1);
      }
    });

  // Registry participant commands
  const participantCmd = registryCmd
    .command("participant")
    .description("Manage registry participants");

  participantCmd
    .command("add <xid-document> [pet-name]")
    .description("Add a participant using an ur:xid document")
    .option("-r, --registry <path>", "Registry path or filename override")
    .action((xidDocument: string, petName: string | undefined, options: { registry?: string }) => {
      try {
        participantAdd(
          {
            xidDocument,
            petName,
            registryPath: options.registry,
          },
          process.cwd(),
        );
      } catch (error) {
        console.error((error as Error).message);
        process.exit(1);
      }
    });

  // DKG commands (placeholder)
  const dkgCmd = program.command("dkg").description("Distributed Key Generation commands");

  const dkgCoordinatorCmd = dkgCmd.command("coordinator").description("DKG coordinator commands");
  dkgCoordinatorCmd
    .command("invite")
    .description("Send DKG invite to participants")
    .action(() => {
      console.log("DKG coordinator invite command not yet implemented");
    });

  dkgCoordinatorCmd
    .command("round1")
    .description("Collect round 1 responses")
    .action(() => {
      console.log("DKG coordinator round1 command not yet implemented");
    });

  dkgCoordinatorCmd
    .command("round2")
    .description("Collect round 2 responses")
    .action(() => {
      console.log("DKG coordinator round2 command not yet implemented");
    });

  const dkgParticipantCmd = dkgCmd.command("participant").description("DKG participant commands");
  dkgParticipantCmd
    .command("receive")
    .description("Receive DKG invite")
    .action(() => {
      console.log("DKG participant receive command not yet implemented");
    });

  dkgParticipantCmd
    .command("round1")
    .description("Send round 1 response")
    .action(() => {
      console.log("DKG participant round1 command not yet implemented");
    });

  dkgParticipantCmd
    .command("round2")
    .description("Send round 2 response")
    .action(() => {
      console.log("DKG participant round2 command not yet implemented");
    });

  dkgParticipantCmd
    .command("finalize")
    .description("Receive finalize package")
    .action(() => {
      console.log("DKG participant finalize command not yet implemented");
    });

  // Sign commands (placeholder)
  const signCmd = program.command("sign").description("Threshold signing commands");

  const signCoordinatorCmd = signCmd
    .command("coordinator")
    .description("Sign coordinator commands");
  signCoordinatorCmd
    .command("invite")
    .description("Send sign invite to participants")
    .action(() => {
      console.log("Sign coordinator invite command not yet implemented");
    });

  signCoordinatorCmd
    .command("round1")
    .description("Collect round 1 responses")
    .action(() => {
      console.log("Sign coordinator round1 command not yet implemented");
    });

  signCoordinatorCmd
    .command("round2")
    .description("Collect round 2 responses and finalize signature")
    .action(() => {
      console.log("Sign coordinator round2 command not yet implemented");
    });

  const signParticipantCmd = signCmd
    .command("participant")
    .description("Sign participant commands");
  signParticipantCmd
    .command("receive")
    .description("Receive sign invite")
    .action(() => {
      console.log("Sign participant receive command not yet implemented");
    });

  signParticipantCmd
    .command("round1")
    .description("Send commitment")
    .action(() => {
      console.log("Sign participant round1 command not yet implemented");
    });

  signParticipantCmd
    .command("round2")
    .description("Send signature share")
    .action(() => {
      console.log("Sign participant round2 command not yet implemented");
    });

  signParticipantCmd
    .command("finalize")
    .description("Receive finalize event")
    .action(() => {
      console.log("Sign participant finalize command not yet implemented");
    });

  program.parse();
}

main().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exit(1);
});
