/**
 * Common test utilities.
 *
 * Port of tests/common/mod.rs from frost-hubert-rust.
 *
 * @module
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load a fixture from `tests/fixtures/<name>` trimming any trailing newline.
 *
 * Port of `fixture()` from tests/common/mod.rs lines 44-50.
 */
export function fixture(name: string): string {
  const fixturesPath = path.join(__dirname, "..", "fixtures", name);
  return fs.readFileSync(fixturesPath, "utf-8").trim();
}

/**
 * Get the registry file path in a directory.
 *
 * Port of `registry_file()` from tests/common/mod.rs lines 52-54.
 */
export function registryFile(dir: string): string {
  return path.join(dir, "registry.json");
}

/**
 * Assert that two values are equal with better diff output.
 *
 * Port of `assert_actual_expected!` macro from tests/common/mod.rs lines 8-28.
 */
export function assertActualExpected<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    console.log("Actual:", actual);
    throw new Error(`Assertion failed:\nActual: ${actual}\nExpected: ${expected}`);
  }
}

// Type for modules that may have registerTags
interface TagModule {
  registerTags?: () => void;
}

/**
 * Register CBOR tags for all BC packages.
 */
export async function registerTags(): Promise<void> {
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
}
