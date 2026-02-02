#!/usr/bin/env node
/**
 * envelope CLI - Gordian Envelope command line tool
 *
 */

import { Command } from "commander";
import { VERSION } from "./index.js";

const program = new Command();

program.name("envelope").description("Gordian Envelope command line tool").version(VERSION);

program
  .command("subject")
  .description("Create or extract envelope subject")
  .argument("<type>", "Subject type: string, data, etc.")
  .argument("[value]", "Subject value")
  .action((_type, _value) => {
    // TODO: Implement subject command
    console.error("subject command is not yet implemented");
    process.exit(1);
  });

program
  .command("assertion")
  .description("Work with assertions")
  .argument("<action>", "Action: add, remove, find, count, all, at")
  .action((_action) => {
    // TODO: Implement assertion command
    console.error("assertion command is not yet implemented");
    process.exit(1);
  });

program
  .command("wrap")
  .description("Wrap an envelope")
  .action(() => {
    // TODO: Implement wrap command
    console.error("wrap command is not yet implemented");
    process.exit(1);
  });

program
  .command("unwrap")
  .description("Unwrap an envelope")
  .action(() => {
    // TODO: Implement unwrap command
    console.error("unwrap command is not yet implemented");
    process.exit(1);
  });

program
  .command("sign")
  .description("Sign an envelope")
  .option("--prvkeys <keys>", "Private keys for signing")
  .action((_options) => {
    // TODO: Implement sign command
    console.error("sign command is not yet implemented");
    process.exit(1);
  });

program
  .command("verify")
  .description("Verify envelope signatures")
  .option("--pubkeys <keys>", "Public keys for verification")
  .action((_options) => {
    // TODO: Implement verify command
    console.error("verify command is not yet implemented");
    process.exit(1);
  });

program
  .command("encrypt")
  .description("Encrypt envelope content")
  .option("--key <key>", "Symmetric key for encryption")
  .action((_options) => {
    // TODO: Implement encrypt command
    console.error("encrypt command is not yet implemented");
    process.exit(1);
  });

program
  .command("decrypt")
  .description("Decrypt envelope content")
  .option("--key <key>", "Symmetric key for decryption")
  .action((_options) => {
    // TODO: Implement decrypt command
    console.error("decrypt command is not yet implemented");
    process.exit(1);
  });

program
  .command("elide")
  .description("Elide envelope content")
  .argument("<action>", "Action: removing, revealing")
  .argument("[digest]", "Digest to elide/reveal")
  .action((_action, _digest) => {
    // TODO: Implement elide command
    console.error("elide command is not yet implemented");
    process.exit(1);
  });

program
  .command("format")
  .description("Format envelope for display")
  .action(() => {
    // TODO: Implement format command
    console.error("format command is not yet implemented");
    process.exit(1);
  });

program
  .command("generate")
  .description("Generate keys and other values")
  .argument("<type>", "Type: prvkeys, pubkeys, etc.")
  .action((_type) => {
    // TODO: Implement generate command
    console.error("generate command is not yet implemented");
    process.exit(1);
  });

// ============================================================================
// XID command group
// ============================================================================

const xidCmd = program
  .command("xid")
  .description("Work with XID documents");

xidCmd
  .command("new")
  .description("Create a new XID document")
  .argument("[key]", "Inception key (ur:crypto-pubkeys, ur:crypto-prvkeys, or ur:prvkeys)")
  .option("--nickname <name>", "Nickname for the inception key")
  .option("--endpoint <uri>", "Endpoint URI for the inception key")
  .option("--permission <perm>", "Permission for the inception key")
  .option("--private <mode>", "Private key mode: include, omit, encrypt, elide", "include")
  .option("--generator <mode>", "Generator mode: omit, include, encrypt", "omit")
  .option("--sign <mode>", "Signing mode: none, inception", "none")
  .option("--signing-key <key>", "External signing key")
  .option("--password <password>", "Decryption password")
  .option("--encrypt-password <password>", "Encryption password")
  .option("--date <date>", "Date for genesis mark (ISO 8601)")
  .option("--info <ur>", "Additional info UR for genesis mark")
  .action((_key, _options) => {
    // TODO: Wire to NewCommand
    console.error("xid new command is not yet wired to CLI");
    process.exit(1);
  });

xidCmd
  .command("export")
  .description("Export a XID document")
  .action((_options) => {
    console.error("xid export command is not yet wired to CLI");
    process.exit(1);
  });

xidCmd
  .command("id")
  .description("Get the XID identifier from a XID document")
  .action((_options) => {
    console.error("xid id command is not yet wired to CLI");
    process.exit(1);
  });

// XID key subcommands
const keyCmd = xidCmd.command("key").description("Work with XID document keys");
keyCmd.command("add").description("Add a key to the XID document").action(() => {
  console.error("xid key add: not yet wired to CLI");
  process.exit(1);
});
keyCmd.command("remove").description("Remove a key from the XID document").action(() => {
  console.error("xid key remove: not yet wired to CLI");
  process.exit(1);
});
keyCmd.command("update").description("Update a key in the XID document").action(() => {
  console.error("xid key update: not yet wired to CLI");
  process.exit(1);
});
keyCmd.command("at").description("Get the key at the given index").action(() => {
  console.error("xid key at: not yet wired to CLI");
  process.exit(1);
});
keyCmd.command("all").description("List all keys in the XID document").action(() => {
  console.error("xid key all: not yet wired to CLI");
  process.exit(1);
});
keyCmd.command("count").description("Count keys in the XID document").action(() => {
  console.error("xid key count: not yet wired to CLI");
  process.exit(1);
});
const keyFindCmd = keyCmd.command("find").description("Find keys by criteria");
keyFindCmd.command("inception").description("Find the inception key").action(() => {
  console.error("xid key find inception: not yet wired to CLI");
  process.exit(1);
});
keyFindCmd.command("name").description("Find key by nickname").action(() => {
  console.error("xid key find name: not yet wired to CLI");
  process.exit(1);
});
keyFindCmd.command("public").description("Find key by public key").action(() => {
  console.error("xid key find public: not yet wired to CLI");
  process.exit(1);
});

// XID method subcommands
const methodCmd = xidCmd.command("method").description("Work with resolution methods");
methodCmd.command("add").description("Add a resolution method").action(() => {
  console.error("xid method add: not yet wired to CLI");
  process.exit(1);
});
methodCmd.command("remove").description("Remove a resolution method").action(() => {
  console.error("xid method remove: not yet wired to CLI");
  process.exit(1);
});
methodCmd.command("at").description("Get method at index").action(() => {
  console.error("xid method at: not yet wired to CLI");
  process.exit(1);
});
methodCmd.command("all").description("List all methods").action(() => {
  console.error("xid method all: not yet wired to CLI");
  process.exit(1);
});
methodCmd.command("count").description("Count methods").action(() => {
  console.error("xid method count: not yet wired to CLI");
  process.exit(1);
});

// XID delegate subcommands
const delegateCmd = xidCmd.command("delegate").description("Work with delegates");
delegateCmd.command("add").description("Add a delegate").action(() => {
  console.error("xid delegate add: not yet wired to CLI");
  process.exit(1);
});
delegateCmd.command("remove").description("Remove a delegate").action(() => {
  console.error("xid delegate remove: not yet wired to CLI");
  process.exit(1);
});
delegateCmd.command("update").description("Update delegate permissions").action(() => {
  console.error("xid delegate update: not yet wired to CLI");
  process.exit(1);
});
delegateCmd.command("at").description("Get delegate at index").action(() => {
  console.error("xid delegate at: not yet wired to CLI");
  process.exit(1);
});
delegateCmd.command("all").description("List all delegates").action(() => {
  console.error("xid delegate all: not yet wired to CLI");
  process.exit(1);
});
delegateCmd.command("count").description("Count delegates").action(() => {
  console.error("xid delegate count: not yet wired to CLI");
  process.exit(1);
});
delegateCmd.command("find").description("Find delegate by XID").action(() => {
  console.error("xid delegate find: not yet wired to CLI");
  process.exit(1);
});

// XID service subcommands
const serviceCmd = xidCmd.command("service").description("Work with services");
serviceCmd.command("add").description("Add a service").action(() => {
  console.error("xid service add: not yet wired to CLI");
  process.exit(1);
});
serviceCmd.command("remove").description("Remove a service").action(() => {
  console.error("xid service remove: not yet wired to CLI");
  process.exit(1);
});
serviceCmd.command("update").description("Update a service").action(() => {
  console.error("xid service update: not yet wired to CLI");
  process.exit(1);
});
serviceCmd.command("at").description("Get service at index").action(() => {
  console.error("xid service at: not yet wired to CLI");
  process.exit(1);
});
serviceCmd.command("all").description("List all services").action(() => {
  console.error("xid service all: not yet wired to CLI");
  process.exit(1);
});
serviceCmd.command("count").description("Count services").action(() => {
  console.error("xid service count: not yet wired to CLI");
  process.exit(1);
});
const serviceFindCmd = serviceCmd.command("find").description("Find services by criteria");
serviceFindCmd.command("name").description("Find service by name").action(() => {
  console.error("xid service find name: not yet wired to CLI");
  process.exit(1);
});
serviceFindCmd.command("uri").description("Find service by URI").action(() => {
  console.error("xid service find uri: not yet wired to CLI");
  process.exit(1);
});

// XID resolution subcommands
const resolutionCmd = xidCmd.command("resolution").description("Work with resolution methods");
resolutionCmd.command("add").description("Add a resolution method").action(() => {
  console.error("xid resolution add: not yet wired to CLI");
  process.exit(1);
});
resolutionCmd.command("remove").description("Remove a resolution method").action(() => {
  console.error("xid resolution remove: not yet wired to CLI");
  process.exit(1);
});
resolutionCmd.command("at").description("Get resolution at index").action(() => {
  console.error("xid resolution at: not yet wired to CLI");
  process.exit(1);
});
resolutionCmd.command("all").description("List all resolutions").action(() => {
  console.error("xid resolution all: not yet wired to CLI");
  process.exit(1);
});
resolutionCmd.command("count").description("Count resolutions").action(() => {
  console.error("xid resolution count: not yet wired to CLI");
  process.exit(1);
});

// XID attachment subcommands
const attachmentCmd = xidCmd.command("attachment").description("Work with attachments");
attachmentCmd.command("add").description("Add an attachment").action(() => {
  console.error("xid attachment add: not yet wired to CLI");
  process.exit(1);
});
attachmentCmd.command("remove").description("Remove an attachment").action(() => {
  console.error("xid attachment remove: not yet wired to CLI");
  process.exit(1);
});
attachmentCmd.command("at").description("Get attachment at index").action(() => {
  console.error("xid attachment at: not yet wired to CLI");
  process.exit(1);
});
attachmentCmd.command("all").description("List all attachments").action(() => {
  console.error("xid attachment all: not yet wired to CLI");
  process.exit(1);
});
attachmentCmd.command("count").description("Count attachments").action(() => {
  console.error("xid attachment count: not yet wired to CLI");
  process.exit(1);
});
attachmentCmd.command("find").description("Find attachments by criteria").action(() => {
  console.error("xid attachment find: not yet wired to CLI");
  process.exit(1);
});

// XID edge subcommands
const edgeCmd = xidCmd.command("edge").description("Work with edges");
edgeCmd.command("add").description("Add an edge").action(() => {
  console.error("xid edge add: not yet wired to CLI");
  process.exit(1);
});
edgeCmd.command("remove").description("Remove an edge").action(() => {
  console.error("xid edge remove: not yet wired to CLI");
  process.exit(1);
});
edgeCmd.command("at").description("Get edge at index").action(() => {
  console.error("xid edge at: not yet wired to CLI");
  process.exit(1);
});
edgeCmd.command("all").description("List all edges").action(() => {
  console.error("xid edge all: not yet wired to CLI");
  process.exit(1);
});
edgeCmd.command("count").description("Count edges").action(() => {
  console.error("xid edge count: not yet wired to CLI");
  process.exit(1);
});
edgeCmd.command("find").description("Find edges by criteria").action(() => {
  console.error("xid edge find: not yet wired to CLI");
  process.exit(1);
});

// XID provenance subcommands
const provenanceCmd = xidCmd.command("provenance").description("Work with provenance marks");
provenanceCmd.command("get").description("Get the current provenance mark").action(() => {
  console.error("xid provenance get: not yet wired to CLI");
  process.exit(1);
});
provenanceCmd.command("next").description("Advance the provenance mark").action(() => {
  console.error("xid provenance next: not yet wired to CLI");
  process.exit(1);
});

program.parse();
