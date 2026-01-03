#!/usr/bin/env node
/**
 * envelope CLI - Gordian Envelope command line tool
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

program
  .command("xid")
  .description("Work with XID documents")
  .argument("<action>", "Action: new, service, provenance, etc.")
  .action((_action) => {
    // TODO: Implement xid command
    console.error("xid command is not yet implemented");
    process.exit(1);
  });

program.parse();
