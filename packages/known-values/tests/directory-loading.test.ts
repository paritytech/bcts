/**
 * Integration and unit tests for the directory-loading feature.
 *
 * Ported from Rust's `tests/directory_loading.rs` (14 integration tests)
 * and `src/directory_loader.rs::tests` (8 unit tests).
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  KnownValue,
  KnownValuesStore,
  IS_A,
  NOTE,
  KNOWN_VALUES,
  // Directory loading types
  DirectoryConfig,
  LoadResult,
  LoadError,
  ConfigError,
  // Directory loading functions
  loadFromDirectory,
  loadFromConfig,
  setDirectoryConfig,
  addSearchPaths,
  getAndLockConfig,
  parseRegistryJson,
  _resetConfigLock,
} from "../src/index";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kv-test-"));
}

function cleanupTempDir(dirPath: string): void {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

function writeJsonFile(dirPath: string, fileName: string, content: string): string {
  const filePath = path.join(dirPath, fileName);
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

// ---------------------------------------------------------------------------
// Integration Tests (from Rust's tests/directory_loading.rs)
// ---------------------------------------------------------------------------

describe("Directory Loading Integration Tests", () => {
  // Rust: test_global_registry_still_works
  test("global registry still works with directory loading", () => {
    const store = KNOWN_VALUES.get();

    // Hardcoded values should still be present
    const isA = store.knownValueNamed("isA");
    expect(isA).toBeDefined();
    expect(isA!.value()).toBe(1);
  });

  // Rust: test_load_from_temp_directory
  test("load from temp directory", () => {
    const tempDir = createTempDir();
    try {
      writeJsonFile(
        tempDir,
        "test_registry.json",
        JSON.stringify({
          entries: [{ codepoint: 99999, name: "integrationTestValue" }],
        }),
      );

      const store = new KnownValuesStore([IS_A, NOTE]);
      const count = store.loadFromDirectory(tempDir);

      expect(count).toBe(1);

      const loaded = store.knownValueNamed("integrationTestValue");
      expect(loaded).toBeDefined();
      expect(loaded!.value()).toBe(99999);

      // Original values should still be present
      expect(store.knownValueNamed("isA")).toBeDefined();
      expect(store.knownValueNamed("note")).toBeDefined();
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  // Rust: test_override_hardcoded_value
  test("override hardcoded value via directory loading", () => {
    const tempDir = createTempDir();
    try {
      // Override IS_A (codepoint 1) with a custom name
      writeJsonFile(
        tempDir,
        "override.json",
        JSON.stringify({
          entries: [{ codepoint: 1, name: "overriddenIsA" }],
        }),
      );

      const store = new KnownValuesStore([IS_A]);
      store.loadFromDirectory(tempDir);

      // The original "isA" name should be gone (replaced)
      expect(store.knownValueNamed("isA")).toBeUndefined();

      // The new name should work
      const overridden = store.knownValueNamed("overriddenIsA");
      expect(overridden).toBeDefined();
      expect(overridden!.value()).toBe(1);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  // Rust: test_multiple_files_in_directory
  test("multiple files in directory", () => {
    const tempDir = createTempDir();
    try {
      writeJsonFile(
        tempDir,
        "registry1.json",
        JSON.stringify({
          entries: [{ codepoint: 10001, name: "valueOne" }],
        }),
      );
      writeJsonFile(
        tempDir,
        "registry2.json",
        JSON.stringify({
          entries: [{ codepoint: 10002, name: "valueTwo" }],
        }),
      );

      const store = new KnownValuesStore();
      const count = store.loadFromDirectory(tempDir);

      expect(count).toBe(2);
      expect(store.knownValueNamed("valueOne")).toBeDefined();
      expect(store.knownValueNamed("valueTwo")).toBeDefined();
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  // Rust: test_directory_config_custom_paths
  test("directory config custom paths", () => {
    const tempDir1 = createTempDir();
    const tempDir2 = createTempDir();
    try {
      // First directory has value A
      writeJsonFile(
        tempDir1,
        "a.json",
        JSON.stringify({
          entries: [{ codepoint: 20001, name: "fromDirOne" }],
        }),
      );

      // Second directory has value B
      writeJsonFile(
        tempDir2,
        "b.json",
        JSON.stringify({
          entries: [{ codepoint: 20002, name: "fromDirTwo" }],
        }),
      );

      const config = DirectoryConfig.withPaths([tempDir1, tempDir2]);
      const store = new KnownValuesStore();
      const result = store.loadFromConfig(config);

      expect(result.valuesCount()).toBe(2);
      expect(store.knownValueNamed("fromDirOne")).toBeDefined();
      expect(store.knownValueNamed("fromDirTwo")).toBeDefined();
    } finally {
      cleanupTempDir(tempDir1);
      cleanupTempDir(tempDir2);
    }
  });

  // Rust: test_later_directory_overrides_earlier
  test("later directory overrides earlier", () => {
    const tempDir1 = createTempDir();
    const tempDir2 = createTempDir();
    try {
      // Both directories have same codepoint with different names
      writeJsonFile(
        tempDir1,
        "first.json",
        JSON.stringify({
          entries: [{ codepoint: 30000, name: "firstVersion" }],
        }),
      );

      writeJsonFile(
        tempDir2,
        "second.json",
        JSON.stringify({
          entries: [{ codepoint: 30000, name: "secondVersion" }],
        }),
      );

      // Process dir1 first, then dir2
      const config = DirectoryConfig.withPaths([tempDir1, tempDir2]);
      const store = new KnownValuesStore();
      store.loadFromConfig(config);

      // Second directory should win (later in list)
      const value = store.knownValueNamed("secondVersion");
      expect(value).toBeDefined();
      expect(value!.value()).toBe(30000);

      // First name should be gone
      expect(store.knownValueNamed("firstVersion")).toBeUndefined();
    } finally {
      cleanupTempDir(tempDir1);
      cleanupTempDir(tempDir2);
    }
  });

  // Rust: test_nonexistent_directory_is_ok
  test("nonexistent directory returns 0", () => {
    const store = new KnownValuesStore();
    const count = store.loadFromDirectory("/nonexistent/path/12345");
    expect(count).toBe(0);
  });

  // Rust: test_invalid_json_is_error
  test("invalid JSON is error (strict loading)", () => {
    const tempDir = createTempDir();
    try {
      writeJsonFile(tempDir, "invalid.json", "{ this is not valid json }");

      const store = new KnownValuesStore();
      try {
        store.loadFromDirectory(tempDir);
        expect.unreachable("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(LoadError);
      }
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  // Rust: test_tolerant_loading_continues_on_error
  test("tolerant loading continues on error", () => {
    const tempDir = createTempDir();
    try {
      // One valid file
      writeJsonFile(
        tempDir,
        "valid.json",
        JSON.stringify({
          entries: [{ codepoint: 40001, name: "validValue" }],
        }),
      );

      // One invalid file
      writeJsonFile(tempDir, "invalid.json", "{ invalid json }");

      const config = DirectoryConfig.withPaths([tempDir]);
      const result = loadFromConfig(config);

      // Should have loaded the valid value
      expect(result.values.has(40001)).toBe(true);

      // Should have recorded the error
      expect(result.hasErrors()).toBe(true);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  // Rust: test_full_registry_format
  test("full registry format with ontology, stats", () => {
    const tempDir = createTempDir();
    try {
      const json = JSON.stringify({
        ontology: {
          name: "test_registry",
          source_url: "https://example.com",
          start_code_point: 50000,
          processing_strategy: "test",
        },
        generated: {
          tool: "test",
        },
        entries: [
          {
            codepoint: 50001,
            name: "fullFormatValue",
            type: "property",
            uri: "https://example.com/vocab#fullFormatValue",
            description: "A value in full format",
          },
          {
            codepoint: 50002,
            name: "anotherValue",
            type: "class",
          },
        ],
        statistics: {
          total_entries: 2,
        },
      });
      writeJsonFile(tempDir, "full_format.json", json);

      const store = new KnownValuesStore();
      const count = store.loadFromDirectory(tempDir);

      expect(count).toBe(2);
      expect(store.knownValueNamed("fullFormatValue")).toBeDefined();
      expect(store.knownValueNamed("anotherValue")).toBeDefined();
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  // Rust: test_load_result_methods (integration)
  test("load result methods", () => {
    const tempDir = createTempDir();
    try {
      writeJsonFile(
        tempDir,
        "test.json",
        JSON.stringify({
          entries: [
            { codepoint: 60001, name: "resultTest1" },
            { codepoint: 60002, name: "resultTest2" },
          ],
        }),
      );

      const config = DirectoryConfig.withPaths([tempDir]);
      const result = loadFromConfig(config);

      expect(result.valuesCount()).toBe(2);
      expect(result.hasErrors()).toBe(false);
      expect(result.filesProcessed.length).toBe(1);

      // Test iteration
      const values: KnownValue[] = [...result.valuesIter()];
      expect(values.length).toBe(2);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  // Rust: test_empty_entries_array
  test("empty entries array returns 0 values", () => {
    const tempDir = createTempDir();
    try {
      writeJsonFile(tempDir, "empty.json", JSON.stringify({ entries: [] }));

      const store = new KnownValuesStore();
      const count = store.loadFromDirectory(tempDir);

      expect(count).toBe(0);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  // Rust: test_non_json_files_ignored
  test("non-JSON files are ignored", () => {
    const tempDir = createTempDir();
    try {
      // JSON file should be loaded
      writeJsonFile(
        tempDir,
        "valid.json",
        JSON.stringify({
          entries: [{ codepoint: 70001, name: "jsonValue" }],
        }),
      );

      // Non-JSON files should be ignored
      fs.writeFileSync(path.join(tempDir, "readme.txt"), "Some text");
      fs.writeFileSync(path.join(tempDir, "data.xml"), "<xml/>");

      const store = new KnownValuesStore();
      const count = store.loadFromDirectory(tempDir);

      expect(count).toBe(1);
      expect(store.knownValueNamed("jsonValue")).toBeDefined();
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});

// ---------------------------------------------------------------------------
// Unit Tests (from Rust's src/directory_loader.rs::tests)
// ---------------------------------------------------------------------------

describe("Directory Loader Unit Tests", () => {
  // Rust: test_parse_registry_json
  test("parse registry JSON with ontology and statistics", () => {
    const json = JSON.stringify({
      ontology: { name: "test" },
      entries: [{ codepoint: 9999, name: "testValue", type: "property" }],
      statistics: {},
    });

    const registry = parseRegistryJson(json);
    expect(registry.entries.length).toBe(1);
    expect(registry.entries[0].codepoint).toBe(9999);
    expect(registry.entries[0].name).toBe("testValue");
  });

  // Rust: test_parse_minimal_registry
  test("parse minimal registry JSON", () => {
    const json = JSON.stringify({
      entries: [{ codepoint: 1, name: "minimal" }],
    });

    const registry = parseRegistryJson(json);
    expect(registry.entries.length).toBe(1);
    expect(registry.entries[0].codepoint).toBe(1);
  });

  // Rust: test_parse_full_entry
  test("parse full entry with all optional fields", () => {
    const json = JSON.stringify({
      entries: [
        {
          codepoint: 100,
          name: "fullEntry",
          type: "class",
          uri: "https://example.com/vocab#fullEntry",
          description: "A complete entry with all fields",
        },
      ],
    });

    const registry = parseRegistryJson(json);
    const entry = registry.entries[0];
    expect(entry.codepoint).toBe(100);
    expect(entry.name).toBe("fullEntry");
    expect(entry.type).toBe("class");
    expect(entry.uri).toBe("https://example.com/vocab#fullEntry");
    expect(entry.description).toBeDefined();
  });

  // Rust: test_directory_config_default
  test("directory config default points to ~/.known-values/", () => {
    const config = DirectoryConfig.defaultOnly();
    const paths = config.paths();
    expect(paths.length).toBe(1);
    expect(paths[0].endsWith(".known-values")).toBe(true);
  });

  // Rust: test_directory_config_custom_paths (unit)
  test("directory config custom paths", () => {
    const config = DirectoryConfig.withPaths(["/a", "/b"]);
    const paths = config.paths();
    expect(paths.length).toBe(2);
    expect(paths[0]).toBe("/a");
    expect(paths[1]).toBe("/b");
  });

  // Rust: test_directory_config_with_default
  test("directory config with paths and default", () => {
    const config = DirectoryConfig.withPathsAndDefault(["/custom"]);
    const paths = config.paths();
    expect(paths.length).toBe(2);
    expect(paths[0]).toBe("/custom");
    expect(paths[1].endsWith(".known-values")).toBe(true);
  });

  // Rust: test_load_from_nonexistent_directory (unit)
  test("loadFromDirectory on nonexistent path returns empty", () => {
    const result = loadFromDirectory("/nonexistent/path/12345");
    expect(result).toEqual([]);
  });

  // Rust: test_load_result_methods (unit)
  test("LoadResult methods on empty result", () => {
    const result = new LoadResult();
    expect(result.valuesCount()).toBe(0);
    expect(result.hasErrors()).toBe(false);

    // Add a value manually
    result.values.set(1, new KnownValue(1, "test"));
    expect(result.valuesCount()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Config locking tests
// ---------------------------------------------------------------------------

describe("Config Locking", () => {
  beforeEach(() => {
    // Reset the config lock before each test (may have been locked by earlier tests)
    _resetConfigLock();
  });

  afterEach(() => {
    // Reset the config lock after each test
    _resetConfigLock();
  });

  test("setDirectoryConfig works before lock", () => {
    const config = DirectoryConfig.withPaths(["/test"]);
    expect(() => setDirectoryConfig(config)).not.toThrow();
  });

  test("addSearchPaths works before lock", () => {
    expect(() => addSearchPaths(["/test"])).not.toThrow();
  });

  test("setDirectoryConfig throws ConfigError after lock", () => {
    // Lock the config by calling getAndLockConfig (same as KNOWN_VALUES.get())
    getAndLockConfig();

    // Attempting to set config after lock should throw
    const newConfig = DirectoryConfig.withPaths(["/other"]);
    expect(() => setDirectoryConfig(newConfig)).toThrow(ConfigError);
  });

  test("addSearchPaths throws ConfigError after lock", () => {
    getAndLockConfig();

    expect(() => addSearchPaths(["/other"])).toThrow(ConfigError);
  });
});

// ---------------------------------------------------------------------------
// LoadError tests
// ---------------------------------------------------------------------------

describe("LoadError", () => {
  test("io error has correct type", () => {
    const err = LoadError.io(new Error("read failed"));
    expect(err.errorType).toBe("io");
    expect(err.message).toContain("read failed");
    expect(err.filePath).toBeUndefined();
    expect(err.cause).toBeInstanceOf(Error);
  });

  test("json error has correct type and file path", () => {
    const err = LoadError.json("/path/to/file.json", new Error("parse error"));
    expect(err.errorType).toBe("json");
    expect(err.message).toContain("/path/to/file.json");
    expect(err.message).toContain("parse error");
    expect(err.filePath).toBe("/path/to/file.json");
    expect(err.cause).toBeInstanceOf(Error);
  });

  test("LoadError is instance of Error", () => {
    const err = LoadError.io(new Error("test"));
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(LoadError);
    expect(err.name).toBe("LoadError");
  });
});

// ---------------------------------------------------------------------------
// Standalone loadFromDirectory tests
// ---------------------------------------------------------------------------

describe("Standalone loadFromDirectory", () => {
  test("returns KnownValue array from valid directory", () => {
    const tempDir = createTempDir();
    try {
      writeJsonFile(
        tempDir,
        "test.json",
        JSON.stringify({
          entries: [{ codepoint: 80001, name: "standaloneValue" }],
        }),
      );

      const values = loadFromDirectory(tempDir);
      expect(values.length).toBe(1);
      expect(values[0].value()).toBe(80001);
      expect(values[0].name()).toBe("standaloneValue");
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  test("throws LoadError.json on invalid JSON", () => {
    const tempDir = createTempDir();
    try {
      writeJsonFile(tempDir, "bad.json", "not json at all");

      try {
        loadFromDirectory(tempDir);
        expect.unreachable("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(LoadError);
        expect((e as LoadError).errorType).toBe("json");
      }
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  test("throws LoadError.json on missing entries array", () => {
    const tempDir = createTempDir();
    try {
      writeJsonFile(tempDir, "no-entries.json", JSON.stringify({ ontology: {} }));

      try {
        loadFromDirectory(tempDir);
        expect.unreachable("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(LoadError);
      }
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});

// ---------------------------------------------------------------------------
// DirectoryConfig.addPath test
// ---------------------------------------------------------------------------

describe("DirectoryConfig.addPath", () => {
  test("addPath appends to existing paths", () => {
    const config = DirectoryConfig.withPaths(["/a"]);
    config.addPath("/b");
    config.addPath("/c");
    const paths = config.paths();
    expect(paths.length).toBe(3);
    expect(paths[0]).toBe("/a");
    expect(paths[1]).toBe("/b");
    expect(paths[2]).toBe("/c");
  });

  test("empty config has no paths", () => {
    const config = new DirectoryConfig();
    expect(config.paths().length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// parseRegistryJson edge cases
// ---------------------------------------------------------------------------

describe("parseRegistryJson edge cases", () => {
  test("throws on missing entries", () => {
    expect(() => parseRegistryJson("{}")).toThrow("Missing or invalid 'entries' array");
  });

  test("throws on non-array entries", () => {
    expect(() => parseRegistryJson('{"entries": "not an array"}')).toThrow(
      "Missing or invalid 'entries' array",
    );
  });

  test("throws on malformed JSON", () => {
    expect(() => parseRegistryJson("{bad json")).toThrow();
  });

  test("accepts empty entries array", () => {
    const result = parseRegistryJson('{"entries": []}');
    expect(result.entries.length).toBe(0);
  });
});
