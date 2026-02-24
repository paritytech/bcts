/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Registry commands.
 *
 * Port of cmd/registry/mod.rs from frost-hubert-rust.
 *
 * @module
 */

import * as fs from "node:fs";
import * as path from "node:path";

export * from "./owner/index.js";
export * from "./participant/index.js";

const DEFAULT_FILENAME = "registry.json";

/**
 * Resolve the participants registry path, defaulting to `registry.json` in the
 * current working directory.
 *
 * Port of `participants_file_path()` from cmd/registry/mod.rs.
 */
export function participantsFilePath(registry: string | undefined, cwd: string): string {
  if (registry === undefined) {
    return path.join(cwd, DEFAULT_FILENAME);
  }

  return resolveRegistryPath(cwd, DEFAULT_FILENAME, registry);
}

/**
 * Resolve registry path with smart directory detection.
 *
 * Port of `resolve_registry_path()` from cmd/registry/mod.rs.
 */
function resolveRegistryPath(cwd: string, defaultFilename: string, raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error("Registry path cannot be empty");
  }

  const provided = trimmed;
  const treatAsDirectory = isDirectoryHint(trimmed, provided);

  let resolved: string;
  if (path.isAbsolute(provided)) {
    resolved = provided;
  } else {
    resolved = path.join(cwd, provided);
  }

  if (treatAsDirectory) {
    // Ensure the directory exists
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
    }
    resolved = path.join(resolved, defaultFilename);
  }

  return resolved;
}

/**
 * Check if the input should be treated as a directory path.
 *
 * Port of `is_directory_hint()` from cmd/registry/mod.rs.
 */
function isDirectoryHint(input: string, pathStr: string): boolean {
  if (endsWithSeparator(input)) {
    return true;
  }

  const basename = path.basename(pathStr);
  if (basename === "" || basename === "." || basename === "..") {
    return true;
  }

  return false;
}

/**
 * Check if input ends with a path separator.
 *
 * Port of `ends_with_separator()` from cmd/registry/mod.rs.
 */
function endsWithSeparator(input: string): boolean {
  return input.endsWith("/") || input.endsWith("\\");
}
