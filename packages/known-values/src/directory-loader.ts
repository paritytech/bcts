/**
 * Directory-based loading of known values from JSON registry files.
 *
 * This module provides functionality to load known values from JSON files
 * stored in configurable directories.
 *
 * The module supports loading known values from:
 * - A default directory: `~/.known-values/`
 * - Custom directories specified at runtime
 *
 * Values loaded from JSON files can override hardcoded values when they
 * share the same codepoint (numeric identifier).
 *
 * JSON File Format:
 * ```json
 * {
 *   "ontology": {
 *     "name": "my_registry",
 *     "source_url": "https://example.com/registry"
 *   },
 *   "entries": [
 *     {
 *       "codepoint": 1000,
 *       "name": "myValue",
 *       "type": "property",
 *       "uri": "https://example.com/vocab#myValue",
 *       "description": "A custom known value"
 *     }
 *   ]
 * }
 * ```
 *
 * Only the `entries` array with `codepoint` and `name` fields
 * is required; other fields are optional.
 *
 * Equivalent to Rust's `src/directory_loader.rs`
 *
 * @module directory-loader
 */

import { KnownValue } from "./known-value";

// ---------------------------------------------------------------------------
// Node.js modules — loaded dynamically to support browser environments
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/consistent-type-imports */
let fs: typeof import("node:fs") | undefined;
let path: typeof import("node:path") | undefined;
let os: typeof import("node:os") | undefined;
/* eslint-enable @typescript-eslint/consistent-type-imports */

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, no-undef
  fs = require("node:fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, no-undef
  path = require("node:path");
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, no-undef
  os = require("node:os");
} catch {
  // Not in Node.js — directory loading will be unavailable
}

// ---------------------------------------------------------------------------
// JSON Schema Types (match Rust's serde-derived structs)
// ---------------------------------------------------------------------------

/**
 * A single entry in a known values JSON registry file.
 *
 * Equivalent to Rust's `RegistryEntry` struct.
 */
export interface RegistryEntry {
  /** The unique numeric identifier for this known value. */
  codepoint: number;
  /** The canonical string name for this known value. */
  name: string;
  /** The type of entry (e.g., "property", "class", "value"). */
  type?: string;
  /** An optional URI reference for this known value. */
  uri?: string;
  /** An optional human-readable description. */
  description?: string;
}

/**
 * Metadata about the ontology or registry source.
 *
 * Equivalent to Rust's `OntologyInfo` struct.
 */
export interface OntologyInfo {
  /** The name of this registry or ontology. */
  name?: string;
  /** The source URL for this registry. */
  source_url?: string;
  /** The starting codepoint for entries in this registry. */
  start_code_point?: number;
  /** The processing strategy used to generate this registry. */
  processing_strategy?: string;
}

/**
 * Information about how a registry file was generated.
 *
 * Equivalent to Rust's `GeneratedInfo` struct.
 */
export interface GeneratedInfo {
  /** The tool used to generate this registry. */
  tool?: string;
}

/**
 * Root structure of a known values JSON registry file.
 *
 * Equivalent to Rust's `RegistryFile` struct.
 */
export interface RegistryFile {
  /** Metadata about this registry. */
  ontology?: OntologyInfo;
  /** Information about how this file was generated. */
  generated?: GeneratedInfo;
  /** The known value entries in this registry. */
  entries: RegistryEntry[];
  /** Statistics about this registry (ignored during parsing). */
  statistics?: unknown;
}

// ---------------------------------------------------------------------------
// Error Types
// ---------------------------------------------------------------------------

/**
 * Errors that can occur when loading known values from directories.
 *
 * Equivalent to Rust's `LoadError` enum.
 */
export class LoadError extends Error {
  readonly errorType: "io" | "json";
  readonly filePath?: string | undefined;
  override readonly cause?: Error | undefined;

  private constructor(errorType: "io" | "json", message: string, filePath?: string, cause?: Error) {
    super(message);
    this.name = "LoadError";
    this.errorType = errorType;
    this.filePath = filePath;
    this.cause = cause;
  }

  /** Creates an I/O error. */
  static io(cause: Error): LoadError {
    return new LoadError("io", `IO error: ${cause.message}`, undefined, cause);
  }

  /** Creates a JSON parsing error. */
  static json(filePath: string, cause: Error): LoadError {
    return new LoadError(
      "json",
      `JSON parse error in ${filePath}: ${cause.message}`,
      filePath,
      cause,
    );
  }
}

/**
 * Error returned when configuration cannot be modified.
 *
 * Equivalent to Rust's `ConfigError` enum.
 */
export class ConfigError extends Error {
  constructor() {
    super("Cannot modify directory configuration after KNOWN_VALUES has been accessed");
    this.name = "ConfigError";
  }
}

// ---------------------------------------------------------------------------
// LoadResult
// ---------------------------------------------------------------------------

/**
 * Result of a directory loading operation.
 *
 * Equivalent to Rust's `LoadResult` struct.
 */
export class LoadResult {
  /** Known values loaded, keyed by codepoint. */
  readonly values: Map<number, KnownValue>;
  /** Files that were successfully processed. */
  readonly filesProcessed: string[];
  /** Non-fatal errors encountered during loading. */
  readonly errors: [string, LoadError][];

  constructor() {
    this.values = new Map();
    this.filesProcessed = [];
    this.errors = [];
  }

  /** Returns the number of unique values loaded. */
  valuesCount(): number {
    return this.values.size;
  }

  /** Returns an iterator over the loaded known values. */
  valuesIter(): IterableIterator<KnownValue> {
    return this.values.values();
  }

  /** Returns an iterator that consumes the values. */
  intoValues(): IterableIterator<KnownValue> {
    return this.values.values();
  }

  /** Returns true if any errors occurred during loading. */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }
}

// ---------------------------------------------------------------------------
// DirectoryConfig
// ---------------------------------------------------------------------------

/**
 * Configuration for loading known values from directories.
 *
 * This class specifies which directories to search for JSON registry files.
 * Directories are processed in order, with values from later directories
 * overriding values from earlier directories when codepoints collide.
 *
 * Equivalent to Rust's `DirectoryConfig` struct.
 */
export class DirectoryConfig {
  private _paths: string[];

  /** Creates a new empty configuration with no search paths. */
  constructor() {
    this._paths = [];
  }

  /** Creates configuration with only the default directory (`~/.known-values/`). */
  static defaultOnly(): DirectoryConfig {
    const config = new DirectoryConfig();
    config._paths = [DirectoryConfig.defaultDirectory()];
    return config;
  }

  /**
   * Creates configuration with custom paths (processed in order).
   *
   * Later paths in the list take precedence over earlier paths when
   * values have the same codepoint.
   */
  static withPaths(paths: string[]): DirectoryConfig {
    const config = new DirectoryConfig();
    config._paths = [...paths];
    return config;
  }

  /**
   * Creates configuration with custom paths followed by the default directory.
   *
   * The default directory (`~/.known-values/`) is appended to the list,
   * so its values will override values from the custom paths.
   */
  static withPathsAndDefault(paths: string[]): DirectoryConfig {
    const config = new DirectoryConfig();
    config._paths = [...paths, DirectoryConfig.defaultDirectory()];
    return config;
  }

  /**
   * Returns the default directory: `~/.known-values/`
   *
   * Falls back to `./.known-values/` if the home directory cannot be determined.
   */
  static defaultDirectory(): string {
    if (os !== undefined && path !== undefined) {
      try {
        return path.join(os.homedir(), ".known-values");
      } catch {
        // homedir() can throw in some environments
      }
    }
    if (path !== undefined) {
      return path.join(".", ".known-values");
    }
    return ".known-values";
  }

  /** Returns the configured search paths. */
  paths(): readonly string[] {
    return this._paths;
  }

  /**
   * Adds a path to the configuration.
   *
   * The new path will be processed after existing paths, so its values
   * will override values from earlier paths.
   */
  addPath(dirPath: string): void {
    this._paths.push(dirPath);
  }
}

// ---------------------------------------------------------------------------
// Global Configuration State
// ---------------------------------------------------------------------------

let customConfig: DirectoryConfig | undefined;
let configLocked = false;

/**
 * Sets custom directory configuration for known values loading.
 *
 * This function must be called **before** the first access to `KNOWN_VALUES`.
 * Once `KNOWN_VALUES` is accessed, the configuration is locked and cannot
 * be changed.
 *
 * Equivalent to Rust's `set_directory_config()`.
 *
 * @throws {ConfigError} If KNOWN_VALUES has already been accessed.
 */
export function setDirectoryConfig(config: DirectoryConfig): void {
  if (configLocked) {
    throw new ConfigError();
  }
  customConfig = config;
}

/**
 * Adds additional search paths to the directory configuration.
 *
 * This function must be called **before** the first access to `KNOWN_VALUES`.
 * Paths are added after any existing paths, so they will take precedence.
 *
 * If no configuration has been set, this creates a new configuration with
 * the default directory and appends the new paths.
 *
 * Equivalent to Rust's `add_search_paths()`.
 *
 * @throws {ConfigError} If KNOWN_VALUES has already been accessed.
 */
export function addSearchPaths(paths: string[]): void {
  if (configLocked) {
    throw new ConfigError();
  }
  customConfig ??= DirectoryConfig.defaultOnly();
  for (const p of paths) {
    customConfig.addPath(p);
  }
}

/**
 * Gets the current directory configuration, locking it for future modifications.
 *
 * This is called internally during `KNOWN_VALUES` initialization.
 *
 * Equivalent to Rust's `get_and_lock_config()`.
 */
export function getAndLockConfig(): DirectoryConfig {
  configLocked = true;
  const config = customConfig ?? DirectoryConfig.defaultOnly();
  customConfig = undefined;
  return config;
}

/**
 * Resets the config lock (for testing only).
 * @internal
 */
export function _resetConfigLock(): void {
  configLocked = false;
  customConfig = undefined;
}

// ---------------------------------------------------------------------------
// Loading Functions
// ---------------------------------------------------------------------------

/**
 * Parses a JSON string as a RegistryFile.
 *
 * @internal
 */
export function parseRegistryJson(jsonString: string): RegistryFile {
  const parsed = JSON.parse(jsonString) as RegistryFile;
  if (!Array.isArray(parsed.entries)) {
    throw new Error("Missing or invalid 'entries' array");
  }
  return parsed;
}

/**
 * Loads all JSON registry files from a single directory.
 *
 * This function scans the specified directory for files with a `.json`
 * extension and attempts to parse them as known value registries.
 *
 * Returns an empty array if the directory doesn't exist.
 * Throws LoadError for I/O errors or invalid JSON (strict mode).
 *
 * Equivalent to Rust's `load_from_directory()`.
 */
export function loadFromDirectory(dirPath: string): KnownValue[] {
  if (fs === undefined || path === undefined) {
    return [];
  }

  const values: KnownValue[] = [];

  // Return empty if directory doesn't exist or isn't a directory
  if (!fs.existsSync(dirPath)) {
    return values;
  }
  const stat = fs.statSync(dirPath);
  if (!stat.isDirectory()) {
    return values;
  }

  let entries: string[];
  try {
    entries = fs.readdirSync(dirPath);
  } catch (e) {
    throw LoadError.io(e instanceof Error ? e : new Error(String(e)));
  }

  for (const entry of entries) {
    const filePath = path.join(dirPath, entry);

    // Only process .json files
    if (!filePath.endsWith(".json")) {
      continue;
    }

    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch (e) {
      throw LoadError.io(e instanceof Error ? e : new Error(String(e)));
    }

    let registry: RegistryFile;
    try {
      registry = parseRegistryJson(content);
    } catch (e) {
      throw LoadError.json(filePath, e instanceof Error ? e : new Error(String(e)));
    }

    for (const registryEntry of registry.entries) {
      values.push(new KnownValue(registryEntry.codepoint, registryEntry.name));
    }
  }

  return values;
}

/**
 * Loads known values from a single JSON file (internal helper).
 */
function loadSingleFile(filePath: string): KnownValue[] {
  if (fs === undefined) {
    return [];
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const registry = parseRegistryJson(content);

  return registry.entries.map((entry) => new KnownValue(entry.codepoint, entry.name));
}

/**
 * Loads from a directory with tolerance for individual file failures.
 */
function loadFromDirectoryTolerant(dirPath: string): {
  values: KnownValue[];
  errors: [string, LoadError][];
} {
  if (fs === undefined || path === undefined) {
    return { values: [], errors: [] };
  }

  const values: KnownValue[] = [];
  const errors: [string, LoadError][] = [];

  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    return { values, errors };
  }

  let entries: string[];
  try {
    entries = fs.readdirSync(dirPath);
  } catch (e) {
    throw LoadError.io(e instanceof Error ? e : new Error(String(e)));
  }

  for (const entry of entries) {
    const filePath = path.join(dirPath, entry);

    if (!filePath.endsWith(".json")) {
      continue;
    }

    try {
      const fileValues = loadSingleFile(filePath);
      values.push(...fileValues);
    } catch (e) {
      if (e instanceof LoadError) {
        errors.push([filePath, e]);
      } else {
        errors.push([
          filePath,
          LoadError.json(filePath, e instanceof Error ? e : new Error(String(e))),
        ]);
      }
    }
  }

  return { values, errors };
}

/**
 * Loads known values from all directories in the given configuration.
 *
 * Directories are processed in order. When multiple entries have the same
 * codepoint, values from later directories override values from earlier
 * directories.
 *
 * This function is fault-tolerant: it will continue processing even if
 * some files fail to parse. Errors are collected in the returned LoadResult.
 *
 * Equivalent to Rust's `load_from_config()`.
 */
export function loadFromConfig(config: DirectoryConfig): LoadResult {
  const result = new LoadResult();

  for (const dirPath of config.paths()) {
    try {
      const { values, errors } = loadFromDirectoryTolerant(dirPath);
      for (const value of values) {
        result.values.set(value.value(), value);
      }
      if (errors.length > 0) {
        result.errors.push(...errors);
      }
      result.filesProcessed.push(dirPath);
    } catch (e) {
      if (e instanceof LoadError) {
        result.errors.push([dirPath, e]);
      } else {
        result.errors.push([dirPath, LoadError.io(e instanceof Error ? e : new Error(String(e)))]);
      }
    }
  }

  return result;
}
