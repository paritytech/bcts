/**
 * Utilities module - 1:1 port of utils.rs
 *
 * Helper functions for CLI operations.
 */

import { Envelope } from "@bcts/envelope";
import { Digest } from "@bcts/components";
import { UR } from "@bcts/uniform-resources";
import { XID, XIDDocument } from "@bcts/xid";
import * as readline from "readline";
import { execSync, spawnSync } from "child_process";
import * as fs from "fs";

/** Help text for askpass option */
export const ASKPASS_HELP = "Prompt for the password using an external program.";

/** Long help text for askpass option */
export const ASKPASS_LONG_HELP = `If set, the password will be obtained by executing the program \
referenced by the SSH_ASKPASS environment variable. Attempts to fall \
back to common locations for askpass helpers if the variable is not set. \
If the program is not found, the password will be read from the \
terminal.`;

/**
 * Reads a password either from the provided argument, via the system's askpass
 * tool when enabled, or interactively via terminal prompt.
 *
 * @param prompt - The prompt to show the user
 * @param passwordOverride - An optional password string
 * @param useAskpass - Boolean flag to indicate if the system's askpass should be used
 * @returns The password string
 */
export async function readPassword(
  prompt: string,
  passwordOverride?: string,
  useAskpass = false,
): Promise<string> {
  // 1. If the caller already supplied a password, trust it and return.
  if (passwordOverride !== undefined) {
    return passwordOverride;
  }

  // 2. If the caller wants a GUI prompt, try to discover and invoke one.
  if (useAskpass) {
    const askpassCmd = resolveAskpass();
    if (askpassCmd) {
      try {
        const result = spawnSync(askpassCmd, [prompt], {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        });
        if (result.status === 0 && result.stdout) {
          const pass = result.stdout.trim();
          if (pass) {
            return pass;
          }
        } else {
          console.error(`askpass exited with ${result.status}`);
        }
      } catch (e) {
        console.error(`askpass failed: ${String(e)}`);
      }
    }
  }

  // 3. Last resort: prompt on the terminal.
  const password = await promptPassword(prompt);

  // 4. If the password is empty, return an error.
  if (!password) {
    throw new Error("Password cannot be empty");
  }

  return password;
}

/**
 * Locate a suitable askpass helper.
 *
 * The search order is:
 * - `$SSH_ASKPASS` or `$ASKPASS` if either is set.
 * - Well-known install locations on macOS and Linux.
 * - The first `askpass`-named binary found in `$PATH`.
 */
function resolveAskpass(): string | undefined {
  // Explicit environment overrides take precedence.
  const envAskpass = process.env["SSH_ASKPASS"] ?? process.env["ASKPASS"];
  if (envAskpass) {
    return envAskpass;
  }

  // Common absolute paths used by package managers and system installs.
  const candidates = [
    "/usr/libexec/ssh-askpass",
    "/usr/lib/ssh/ssh-askpass",
    "/usr/local/bin/ssh-askpass",
    "/opt/homebrew/bin/ssh-askpass",
  ];

  for (const cand of candidates) {
    try {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        return cand;
      }
    } catch {
      // Ignore
    }
  }

  // Finally, fall back to whatever "askpass" the user might have on $PATH.
  try {
    const result = execSync("which askpass", { encoding: "utf-8" }).trim();
    if (result) {
      return result;
    }
  } catch {
    // Not found
  }

  return undefined;
}

/**
 * Prompt for password on terminal without echoing.
 */
async function promptPassword(prompt: string): Promise<string> {
  // For Node.js, we need to use readline with hidden input
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Try to hide input (works on most terminals)
    process.stdout.write(prompt);

    // Read line with input hidden
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;

    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }

    let password = "";
    const onData = (char: Buffer): void => {
      const c = char.toString("utf8");
      if (c === "\n" || c === "\r" || c === "\u0004") {
        // Enter or Ctrl+D
        if (stdin.isTTY) {
          stdin.setRawMode(wasRaw ?? false);
        }
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        rl.close();
        resolve(password);
      } else if (c === "\u0003") {
        // Ctrl+C
        if (stdin.isTTY) {
          stdin.setRawMode(wasRaw ?? false);
        }
        stdin.removeListener("data", onData);
        rl.close();
        process.exit(1);
      } else if (c === "\u007F" || c === "\b") {
        // Backspace
        if (password.length > 0) {
          password = password.slice(0, -1);
        }
      } else {
        password += c;
      }
    };

    stdin.on("data", onData);
  });
}

/**
 * Read an argument from command line or stdin.
 */
export function readArgument(argument?: string): string {
  if (argument !== undefined && argument !== "") {
    return argument;
  }

  // Read from stdin
  const input = readStdinSync();
  if (!input || input.trim() === "") {
    throw new Error("No argument provided");
  }
  return input.trim();
}

/**
 * Read all stdin synchronously.
 */
export function readStdinSync(): string {
  let input = "";
  const BUFSIZE = 256;
  const buf = Buffer.alloc(BUFSIZE);

  try {
    let bytesRead = 0;
    // Use stdin file descriptor directly (0 is stdin)
    const fd = 0;

    while (true) {
      try {
        bytesRead = fs.readSync(fd, buf, 0, BUFSIZE, null);
        if (bytesRead === 0) break;
        input += buf.toString("utf8", 0, bytesRead);
      } catch {
        break;
      }
    }
  } catch {
    // Fallback: stdin might not be readable
  }

  return input;
}

/**
 * Read a single line from stdin synchronously.
 */
export function readStdinLine(): string {
  const input = readStdinSync();
  const lines = input.split("\n");
  return lines[0]?.trim() ?? "";
}

/**
 * Read all stdin as bytes synchronously.
 */
export function readStdinBytes(): Uint8Array {
  const BUFSIZE = 256;
  const buf = Buffer.alloc(BUFSIZE);
  const chunks: Buffer[] = [];

  try {
    // Use stdin file descriptor directly (0 is stdin)
    const fd = 0;

    while (true) {
      try {
        const bytesRead = fs.readSync(fd, buf, 0, BUFSIZE, null);
        if (bytesRead === 0) break;
        chunks.push(Buffer.from(buf.subarray(0, bytesRead)));
      } catch {
        break;
      }
    }
  } catch {
    // Fallback: stdin might not be readable
  }

  return new Uint8Array(Buffer.concat(chunks));
}

/**
 * Convert a UR to an Envelope.
 * Handles envelope URs, tagged CBOR, and XID URs.
 */
export function envelopeFromUr(ur: UR): Envelope {
  // Try as envelope first
  try {
    return Envelope.fromUR(ur);
  } catch {
    // Ignore
  }

  // Try as tagged CBOR
  try {
    return Envelope.fromTaggedCbor(ur.cbor());
  } catch {
    // Ignore
  }

  // Try as XID
  if (ur.urTypeStr() === "xid") {
    try {
      const xid = XID.fromTaggedCbor(ur.cbor());
      const doc = XIDDocument.fromXid(xid);
      return doc.toEnvelope();
    } catch {
      // Ignore
    }
  }

  throw new Error("Invalid envelope");
}

/**
 * Read an envelope from command line argument or stdin.
 */
export function readEnvelope(envelope?: string): Envelope {
  let urString: string;

  if (envelope !== undefined && envelope !== "") {
    urString = envelope;
  } else {
    urString = readStdinLine();
  }

  urString = urString.trim();
  if (!urString) {
    throw new Error("No envelope provided");
  }

  // Try parsing as ur:envelope first
  try {
    return Envelope.fromUrString(urString);
  } catch {
    // Try as other UR type
    try {
      const ur = UR.fromURString(urString);
      return envelopeFromUr(ur);
    } catch {
      throw new Error("Invalid envelope");
    }
  }
}

/**
 * Parse a digest from a UR string.
 * Accepts ur:digest or ur:envelope (takes the digest of the envelope).
 */
export function parseDigestFromUr(target: string): Digest {
  const ur = UR.fromURString(target);

  switch (ur.urTypeStr()) {
    case "digest":
      return Digest.fromUR(ur);
    case "envelope": {
      const envelope = Envelope.fromUR(ur);
      return envelope.digest();
    }
    default:
      throw new Error(`Invalid digest type: ${ur.urTypeStr()}`);
  }
}

/**
 * Parse multiple digests from a space-separated string.
 * Returns a Set of Digest objects.
 */
export function parseDigests(target: string): Set<Digest> {
  const trimmed = target.trim();
  if (!trimmed) {
    return new Set();
  }

  const digestStrings = trimmed.split(/\s+/);
  const digests = new Set<Digest>();

  for (const s of digestStrings) {
    const digest = parseDigestFromUr(s);
    digests.add(digest);
  }

  return digests;
}
