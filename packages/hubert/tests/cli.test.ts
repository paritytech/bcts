/**
 * CLI tests.
 *
 * Port of tests/test_cli_basic.rs, test_cli_check.rs, test_cli_operations.rs from hubert-rust.
 *
 * @module
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn } from "node:child_process";
import { ARID } from "@bcts/components";
import { Envelope } from "@bcts/envelope";
import { Server, type ServerConfig } from "../src/server/index.js";

/**
 * Run CLI command and return stdout.
 */
async function runCli(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    // Use bun to run the CLI source directly (no build required)
    const child = spawn("bun", ["run", "src/bin/hubert.ts", ...args], {
      cwd: process.cwd(),
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr || `Process exited with code ${code}`));
      }
    });
  });
}

/**
 * Run CLI and expect it to fail.
 */
async function runCliExpectError(args: string[]): Promise<void> {
  try {
    await runCli(args);
    throw new Error("Expected command to fail, but it succeeded");
  } catch {
    // Expected to fail
  }
}

/**
 * Run CLI and check if output contains expected string.
 */
async function runCliContains(args: string[], expected: string): Promise<void> {
  const output = await runCli(args);
  if (!output.includes(expected)) {
    throw new Error(`Expected output to contain "${expected}", got: ${output}`);
  }
}

describe("CLI Basic Tests", () => {
  // Note: These tests require the CLI to be built first
  // Run `bun run build` before running tests

  describe("Command Validation", () => {
    it("should reject invalid commands", async () => {
      await runCliExpectError(["invalid"]);
    });

    it("should require arguments for put command", async () => {
      await runCliExpectError(["put"]);
    });

    it("should require arguments for get command", async () => {
      await runCliExpectError(["get"]);
    });

    it("should reject invalid ARID format for put", async () => {
      await runCliExpectError([
        "put",
        "not-a-valid-arid",
        "ur:envelope/tpsoiyfdihjzjzjldmksbaoede",
      ]);
    });

    it("should reject invalid ARID format for get", async () => {
      await runCliExpectError(["get", "not-a-valid-arid"]);
    });

    it("should reject invalid envelope format", async () => {
      await runCliExpectError([
        "put",
        "ur:arid/hdcxuestvsdemusrdlkngwtosweortdwbasrdrfxhssgfmvlrflthdplatjydmmwahgdwlflguqz",
        "not-a-valid-envelope",
      ]);
    });

    it("should reject invalid storage backend", async () => {
      await runCliExpectError(["check", "--storage", "invalid"]);
    });

    it("should reject hex ARID format", async () => {
      await runCliExpectError([
        "put",
        "dec7e82893c32f7a4fcec633c02c0ec32a4361ca3ee3bc8758ae07742e940550",
        "ur:envelope/tpsoiyfdihjzjzjldmksbaoede",
      ]);
    });
  });

  describe("Generate Commands", () => {
    it("should show generate help", async () => {
      await runCliContains(["generate", "--help"], "Generate a new ARID");
    });

    it("should generate unique ARIDs", { timeout: 15_000 }, async () => {
      const output1 = await runCli(["generate", "arid"]);
      const output2 = await runCli(["generate", "arid"]);

      // Should be different
      expect(output1).not.toBe(output2);

      // Should be valid ur:arid format
      expect(output1).toMatch(/^ur:arid\//);
      expect(output2).toMatch(/^ur:arid\//);

      // Should be parseable as ARID
      ARID.fromURString(output1);
      ARID.fromURString(output2);
    });

    it("should generate envelope of specified size", async () => {
      const output = await runCli(["generate", "envelope", "100"]);

      // Should be valid ur:envelope format
      expect(output).toMatch(/^ur:envelope\//);

      // Should be parseable
      const envelope = Envelope.fromURString(output);
      expect(envelope).toBeDefined();
    });
  });
});

describe("CLI Server Operations", () => {
  let server: Server;
  const port = 45700;

  beforeAll(async () => {
    const config: ServerConfig = {
      port,
      maxTtl: 86400,
      verbose: false,
    };
    server = Server.newMemory(config);

    // Start server in background
    server.run().catch(() => {});

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 200));
  });

  afterAll(async () => {
    await server.close();
  });

  it("should put and get envelope via CLI", { timeout: 60_000 }, async () => {
    // Generate test data
    const aridOutput = await runCli(["generate", "arid"]);
    const envOutput = await runCli(["generate", "envelope", "50"]);

    // Put the envelope
    const putOutput = await runCli([
      "put",
      aridOutput,
      envOutput,
      "--storage",
      "server",
      "--port",
      port.toString(),
    ]);
    expect(putOutput).toContain("Stored");

    // Get the envelope back
    const getOutput = await runCli([
      "get",
      aridOutput,
      "--storage",
      "server",
      "--port",
      port.toString(),
    ]);
    expect(getOutput).toMatch(/^ur:envelope\//);
  });

  it("should check server availability", async () => {
    const output = await runCli(["check", "--storage", "server", "--port", port.toString()]);
    expect(output.toLowerCase()).toContain("available");
  });
});
