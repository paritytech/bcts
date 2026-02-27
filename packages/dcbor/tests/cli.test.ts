/**
 * CLI Tests - Comparison with bc-dcbor-cli
 *
 * REQUIREMENTS:
 * These tests require the bc-dcbor-cli tool to be installed on your system.
 * The tests execute the actual dcbor CLI command to verify our TypeScript
 * implementation produces identical output to the Rust reference implementation.
 *
 * Installation:
 * cargo install bc-dcbor-cli
 *
 * To run these tests:
 * npm run test-cli
 *
 * Based on tests from: https://github.com/BlockchainCommons/bc-dcbor-cli
 */

import { execSync } from "child_process";
import type { CborInput } from "../src";
import { cbor, CborMap, decodeCbor } from "../src";

/**
 * Type for execSync error with stderr
 */
interface ExecError extends Error {
  stderr?: string | Buffer;
}

/**
 * Escape shell argument
 */
function escapeShellArg(arg: string): string {
  // Wrap in single quotes and escape any single quotes inside
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * Execute dcbor CLI command and return the output
 */
function runDcbor(args: string[]): string {
  try {
    const escapedArgs = args.map(escapeShellArg).join(" ");
    const result = execSync(`dcbor ${escapedArgs}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return result.trim();
  } catch (error) {
    const execError = error as ExecError;
    throw new Error(`dcbor command failed: ${execError.stderr || execError.message}`, { cause: error });
  }
}

/**
 * Execute dcbor CLI command with stdin input
 */
function runDcborWithInput(args: string[], input: string): string {
  try {
    const result = execSync(`echo '${input}' | dcbor ${args.join(" ")}`, {
      encoding: "utf-8",
      shell: "/bin/bash",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return result.trim();
  } catch (error) {
    const execError = error as ExecError;
    throw new Error(`dcbor command failed: ${execError.stderr || execError.message}`, { cause: error });
  }
}

/**
 * Parse a diagnostic notation string into a CBOR value
 * Handles: numbers, strings, booleans, null, arrays, maps
 */
function parseDiagnostic(input: string): CborInput {
  // Trim whitespace
  input = input.trim();

  // Handle null
  if (input === "null") return null;

  // Handle booleans
  if (input === "true") return true;
  if (input === "false") return false;

  // Handle numbers (including negative)
  if (/^-?\d+(\.\d+)?$/.test(input)) {
    const num = Number(input);
    return Number.isInteger(num) ? num : num;
  }

  // Handle strings (quoted)
  if (input.startsWith('"') && input.endsWith('"')) {
    return input.slice(1, -1);
  }

  // Handle arrays
  if (input.startsWith("[") && input.endsWith("]")) {
    const content = input.slice(1, -1).trim();
    if (content === "") return [];

    const elements: CborInput[] = [];
    let depth = 0;
    let current = "";
    let inString = false;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];

      if (char === '"' && (i === 0 || content[i - 1] !== "\\")) {
        inString = !inString;
      }

      if (!inString) {
        if (char === "[" || char === "{") depth++;
        if (char === "]" || char === "}") depth--;

        if (char === "," && depth === 0) {
          elements.push(parseDiagnostic(current.trim()));
          current = "";
          continue;
        }
      }

      current += char;
    }

    if (current.trim()) {
      elements.push(parseDiagnostic(current.trim()));
    }

    return elements;
  }

  // Handle maps
  if (input.startsWith("{") && input.endsWith("}")) {
    const content = input.slice(1, -1).trim();
    if (content === "") return CborMap.new();

    const map = CborMap.new();
    let depth = 0;
    let current = "";
    let inString = false;
    const pairs: string[] = [];

    for (let i = 0; i < content.length; i++) {
      const char = content[i];

      if (char === '"' && (i === 0 || content[i - 1] !== "\\")) {
        inString = !inString;
      }

      if (!inString) {
        if (char === "[" || char === "{") depth++;
        if (char === "]" || char === "}") depth--;

        if (char === "," && depth === 0) {
          pairs.push(current.trim());
          current = "";
          continue;
        }
      }

      current += char;
    }

    if (current.trim()) {
      pairs.push(current.trim());
    }

    // Parse key-value pairs
    for (const pair of pairs) {
      const colonIndex = pair.indexOf(":");
      if (colonIndex === -1) continue;

      const keyStr = pair.slice(0, colonIndex).trim();
      const valueStr = pair.slice(colonIndex + 1).trim();

      const key = parseDiagnostic(keyStr);
      const value = parseDiagnostic(valueStr);

      map.set(key, value);
    }

    return map;
  }

  // Default: return as-is
  return input;
}

/**
 * Convert a value to hex output (matching CLI format)
 */
function toHex(value: CborInput): string {
  const cborValue = cbor(value);
  return cborValue.toHex();
}

/**
 * Convert a value to diagnostic output (matching CLI format)
 */
function toDiagnostic(value: CborInput): string {
  const cborValue = cbor(value);
  return cborValue.toString();
}

/**
 * Convert a value to annotated hex output (matching CLI format)
 */
function toAnnotatedHex(value: CborInput): string {
  const cborValue = cbor(value);
  return cborValue.toHexAnnotated();
}

/**
 * Convert hex string to diagnostic notation
 */
function hexToDiagnostic(hexStr: string): string {
  // Remove any whitespace
  hexStr = hexStr.replace(/\s+/g, "");

  // Convert hex to bytes
  const bytes = new Uint8Array(hexStr.length / 2);
  for (let i = 0; i < hexStr.length; i += 2) {
    bytes[i / 2] = parseInt(hexStr.substr(i, 2), 16);
  }

  // Decode and convert to diagnostic
  const decoded = decodeCbor(bytes);
  return decoded.toString();
}

/**
 * Array command: Compose a dCBOR array from elements
 */
function arrayCommand(args: string[], output: "diag" | "hex", annotate = false): string {
  const elements = args.map((arg) => parseDiagnostic(arg));

  if (output === "diag") {
    return toDiagnostic(elements);
  } else if (output === "hex") {
    if (annotate) {
      return toAnnotatedHex(elements);
    }
    return toHex(elements);
  }

  return "";
}

/**
 * Map command: Compose a dCBOR map from keys and values
 */
function mapCommand(args: string[], output: "diag" | "hex", annotate = false): string | Error {
  // Check for odd number of arguments
  if (args.length % 2 !== 0) {
    return new Error("Map requires an even number of arguments (key-value pairs)");
  }

  const map = CborMap.new();

  for (let i = 0; i < args.length; i += 2) {
    const keyStr = args[i];
    const valueStr = args[i + 1];
    if (keyStr === undefined || valueStr === undefined) {
      throw new Error("Invalid map arguments");
    }
    const key = parseDiagnostic(keyStr);
    const value = parseDiagnostic(valueStr);
    map.set(key, value);
  }

  if (output === "diag") {
    return toDiagnostic(map);
  } else if (output === "hex") {
    if (annotate) {
      return toAnnotatedHex(map);
    }
    return toHex(map);
  }

  return "";
}

describe("CLI Tests - Array Command (vs dcbor CLI)", () => {
  test("basic_array", () => {
    const cliOutput = runDcbor(["array", "--out", "diag", "1", "2", "3"]);
    const tsOutput = arrayCommand(["1", "2", "3"], "diag");
    expect(tsOutput).toBe(cliOutput);
  });

  test("mixed_types_array", () => {
    const cliOutput = runDcbor(["array", "--out", "diag", "42", '"hello"', "true"]);
    const tsOutput = arrayCommand(["42", '"hello"', "true"], "diag");
    expect(tsOutput).toBe(cliOutput);
  });

  test("hex_output_array", () => {
    const cliOutput = runDcbor(["array", "--out", "hex", "1", "2", "3"]);
    const tsOutput = arrayCommand(["1", "2", "3"], "hex");
    expect(tsOutput).toBe(cliOutput);
  });

  test("annotated_hex_array", () => {
    const cliOutput = runDcbor(["array", "--out", "hex", "--annotate", "1", "2"]);
    const tsOutput = arrayCommand(["1", "2"], "hex", true);
    // Check that both contain the same hex values (annotations may differ in format)
    expect(tsOutput).toContain("82");
    expect(cliOutput).toContain("82");
    expect(tsOutput).toContain("01");
    expect(cliOutput).toContain("01");
    expect(tsOutput).toContain("02");
    expect(cliOutput).toContain("02");
  });

  test("empty_array_diag", () => {
    const cliOutput = runDcbor(["array", "--out", "diag"]);
    const tsOutput = arrayCommand([], "diag");
    expect(tsOutput).toBe(cliOutput);
  });

  test("empty_array_hex", () => {
    const cliOutput = runDcbor(["array", "--out", "hex"]);
    const tsOutput = arrayCommand([], "hex");
    expect(tsOutput).toBe(cliOutput);
  });

  test("nested_array", () => {
    const cliOutput = runDcbor(["array", "--out", "diag", "[1, 2]", "[3, 4]"]);
    const tsOutput = arrayCommand(["[1, 2]", "[3, 4]"], "diag");
    expect(tsOutput).toBe(cliOutput);
  });

  test("complex_elements_array", () => {
    const cliOutput = runDcbor(["array", "--out", "diag", '{1: "a"}', '{2: "b"}']);
    const tsOutput = arrayCommand(['{1: "a"}', '{2: "b"}'], "diag");
    expect(tsOutput).toBe(cliOutput);
  });
});

describe("CLI Tests - Map Command (vs dcbor CLI)", () => {
  test("basic_map", () => {
    const cliOutput = runDcbor(["map", "--out", "diag", "1", "2", "3", "4"]);
    const tsOutput = mapCommand(["1", "2", "3", "4"], "diag");
    expect(tsOutput).toBe(cliOutput);
  });

  test("text_keys", () => {
    const cliOutput = runDcbor([
      "map",
      "--out",
      "diag",
      '"key1"',
      '"value1"',
      '"key2"',
      '"value2"',
    ]);
    const tsOutput = mapCommand(['"key1"', '"value1"', '"key2"', '"value2"'], "diag");
    expect(tsOutput).toBe(cliOutput);
  });

  test("hex_output_map", () => {
    const cliOutput = runDcbor(["map", "--out", "hex", "1", "2", "3", "4"]);
    const tsOutput = mapCommand(["1", "2", "3", "4"], "hex");
    expect(tsOutput).toBe(cliOutput);
  });

  test("annotated_hex_map", () => {
    const cliOutput = runDcbor(["map", "--out", "hex", "--annotate", "1", "2"]);
    const tsOutput = mapCommand(["1", "2"], "hex", true);
    // Check that both contain the same hex values
    expect(tsOutput).toContain("a1");
    expect(cliOutput).toContain("a1");
  });

  test("empty_map_diag", () => {
    const cliOutput = runDcbor(["map", "--out", "diag"]);
    const tsOutput = mapCommand([], "diag");
    expect(tsOutput).toBe(cliOutput);
  });

  test("empty_map_hex", () => {
    const cliOutput = runDcbor(["map", "--out", "hex"]);
    const tsOutput = mapCommand([], "hex");
    expect(tsOutput).toBe(cliOutput);
  });

  test("mixed_types_map", () => {
    const cliOutput = runDcbor(["map", "--out", "diag", "1", '"text"', '"key"', "42"]);
    const tsOutput = mapCommand(["1", '"text"', '"key"', "42"], "diag");
    expect(tsOutput).toBe(cliOutput);
  });

  test("nested_values_map", () => {
    const cliOutput = runDcbor(["map", "--out", "diag", "1", "[1, 2]", "2", "{3: 4}"]);
    const tsOutput = mapCommand(["1", "[1, 2]", "2", "{3: 4}"], "diag");
    expect(tsOutput).toBe(cliOutput);
  });

  test("odd_arguments_error", () => {
    // dcbor CLI should fail with odd arguments
    expect(() => runDcbor(["map", "--out", "diag", "1", "2", "3"])).toThrow();
    const tsOutput = mapCommand(["1", "2", "3"], "diag");
    expect(tsOutput).toBeInstanceOf(Error);
  });
});

describe("CLI Tests - Default Command Conversions (vs dcbor CLI)", () => {
  test("diag_to_hex_number", () => {
    const cliOutput = runDcborWithInput(["--in", "diag", "--out", "hex"], "42");
    const tsOutput = toHex(42);
    expect(tsOutput).toBe(cliOutput);
  });

  test("diag_to_hex_string", () => {
    const cliOutput = runDcborWithInput(["--in", "diag", "--out", "hex"], '"Hello"');
    const tsOutput = toHex("Hello");
    expect(tsOutput).toBe(cliOutput);
  });

  test("diag_to_hex_boolean_true", () => {
    const cliOutput = runDcborWithInput(["--in", "diag", "--out", "hex"], "true");
    const tsOutput = toHex(true);
    expect(tsOutput).toBe(cliOutput);
  });

  test("diag_to_hex_boolean_false", () => {
    const cliOutput = runDcborWithInput(["--in", "diag", "--out", "hex"], "false");
    const tsOutput = toHex(false);
    expect(tsOutput).toBe(cliOutput);
  });

  test("diag_to_hex_null", () => {
    const cliOutput = runDcborWithInput(["--in", "diag", "--out", "hex"], "null");
    const tsOutput = toHex(null);
    expect(tsOutput).toBe(cliOutput);
  });

  test("hex_to_diag_number", () => {
    const cliOutput = runDcborWithInput(["--in", "hex", "--out", "diag"], "182a");
    const tsOutput = hexToDiagnostic("182a");
    expect(tsOutput).toBe(cliOutput);
  });

  test("hex_to_diag_string", () => {
    const cliOutput = runDcborWithInput(["--in", "hex", "--out", "diag"], "6548656c6c6f");
    const tsOutput = hexToDiagnostic("6548656c6c6f");
    expect(tsOutput).toBe(cliOutput);
  });

  test("hex_to_diag_boolean_true", () => {
    const cliOutput = runDcborWithInput(["--in", "hex", "--out", "diag"], "f5");
    const tsOutput = hexToDiagnostic("f5");
    expect(tsOutput).toBe(cliOutput);
  });

  test("hex_to_diag_boolean_false", () => {
    const cliOutput = runDcborWithInput(["--in", "hex", "--out", "diag"], "f4");
    const tsOutput = hexToDiagnostic("f4");
    expect(tsOutput).toBe(cliOutput);
  });

  test("hex_to_diag_null", () => {
    const cliOutput = runDcborWithInput(["--in", "hex", "--out", "diag"], "f6");
    const tsOutput = hexToDiagnostic("f6");
    expect(tsOutput).toBe(cliOutput);
  });

  test("array_hex_conversion", () => {
    const cliHexOutput = runDcborWithInput(["--in", "diag", "--out", "hex"], "[1, 2, 3]");
    const tsHexOutput = toHex([1, 2, 3]);
    expect(tsHexOutput).toBe(cliHexOutput);

    const cliDiagOutput = runDcborWithInput(["--in", "hex", "--out", "diag"], "83010203");
    const tsDiagOutput = hexToDiagnostic("83010203");
    expect(tsDiagOutput).toBe(cliDiagOutput);
  });

  test("map_hex_conversion", () => {
    const map = CborMap.new();
    map.set(1, 2);
    map.set(3, 4);

    const cliHexOutput = runDcborWithInput(["--in", "diag", "--out", "hex"], "{1: 2, 3: 4}");
    const tsHexOutput = toHex(map);
    expect(tsHexOutput).toBe(cliHexOutput);

    const cliDiagOutput = runDcborWithInput(["--in", "hex", "--out", "diag"], "a201020304");
    const tsDiagOutput = hexToDiagnostic("a201020304");
    expect(tsDiagOutput).toBe(cliDiagOutput);
  });

  test("round_trip_conversions", () => {
    const testValues: Array<[string, CborInput]> = [
      ["42", 42],
      ['"test"', "test"],
      ["true", true],
      ["false", false],
      ["null", null],
      ["[1, 2, 3]", [1, 2, 3]],
    ];

    for (const [diagInput, tsValue] of testValues) {
      const cliHexOutput = runDcborWithInput(["--in", "diag", "--out", "hex"], diagInput);
      const tsHexOutput = toHex(tsValue);
      expect(tsHexOutput).toBe(cliHexOutput);

      const cliBackToDiag = runDcborWithInput(["--in", "hex", "--out", "diag"], cliHexOutput);
      const tsBackToDiag = hexToDiagnostic(tsHexOutput);
      expect(tsBackToDiag).toBe(cliBackToDiag);
    }
  });

  test("annotated_output", () => {
    const cliOutput = runDcborWithInput(["--in", "diag", "--out", "hex", "--annotate"], "42");
    const tsOutput = toAnnotatedHex(42);
    // Both should contain the hex values
    expect(tsOutput).toContain("18");
    expect(cliOutput).toContain("18");
    expect(tsOutput).toContain("2a");
    expect(cliOutput).toContain("2a");
  });
});

describe("CLI Tests - Complex Structures (vs dcbor CLI)", () => {
  test("deeply_nested_array", () => {
    const cliOutput = runDcborWithInput(
      ["--in", "diag", "--out", "hex"],
      "[[[1, 2], [3, 4]], [[5, 6], [7, 8]]]",
    );
    const tsOutput = toHex([
      [
        [1, 2],
        [3, 4],
      ],
      [
        [5, 6],
        [7, 8],
      ],
    ]);
    expect(tsOutput).toBe(cliOutput);
  });

  test("complex_map", () => {
    const cliOutput = runDcborWithInput(
      ["--in", "diag", "--out", "hex"],
      '{"name": "Alice", "age": 30, "active": true}',
    );
    const map = CborMap.new();
    map.set("name", "Alice");
    map.set("age", 30);
    map.set("active", true);
    const tsOutput = toHex(map);
    expect(tsOutput).toBe(cliOutput);
  });

  test("mixed_nested_structures", () => {
    const cliOutput = runDcborWithInput(
      ["--in", "diag", "--out", "hex"],
      '{1: [1, 2, 3], 2: {"nested": true}}',
    );
    const innerMap = CborMap.new();
    innerMap.set("nested", true);
    const outerMap = CborMap.new();
    outerMap.set(1, [1, 2, 3]);
    outerMap.set(2, innerMap);
    const tsOutput = toHex(outerMap);
    expect(tsOutput).toBe(cliOutput);
  });

  test("large_array", () => {
    const numbers = Array.from({ length: 100 }, (_, i) => i);
    const diagInput = `[${numbers.join(", ")}]`;
    const cliOutput = runDcborWithInput(["--in", "diag", "--out", "hex"], diagInput);
    const tsOutput = toHex(numbers);
    expect(tsOutput).toBe(cliOutput);
  });
});
