# Seedtool CLI - Rust to TypeScript Porting Plan

> **Target:** 100% API parity with `seedtool-cli-rust` v0.4.0
> **Reference:** `/Users/custodio/Development/Parity/Tools/bcts/ref/seedtool-cli-rust`

## Current Status

| Phase | Status | Progress |
|-------|--------|----------|
| Phase 1: Foundation | ✅ COMPLETED | 100% |
| Phase 2: Seed Type | ✅ COMPLETED | 100% |
| Phase 3: Format System | ✅ COMPLETED | 100% |
| Phase 4: Main Entry Point | ✅ COMPLETED | 100% |
| Phase 5: Testing & Polish | ✅ COMPLETED | 100% |

**Last Updated:** 2026-01-10

### Test Results

- **19 tests passing** (all tests enabled)
- All core functionality working correctly
- SSKR split/join working
- Multipart encoding/decoding working
- All format conversions working
- BytewordsStyle.Uri uses hyphens (matches Rust)
- Seed envelope dates use CBOR Date tag 1 (matches Rust)

### CLI Verified Working

The following commands have been tested and produce expected output:
- `seedtool` - Generates random 16-byte hex seed
- `seedtool -d "test"` - Deterministic seed generation (consistent output)
- `seedtool -d "test" -o bip39` - BIP39 mnemonic output
- `seedtool -d "test" -o btw` - Bytewords output
- `seedtool -d "test" -o envelope` - Envelope UR output
- `seedtool -d "test" -o ints --low 1 --high 10` - Integer output
- `seedtool -d "test" -o cards` - Playing cards output
- `echo "hex" | seedtool -i hex -o bip39` - Piped input processing

---

## Overview

This document provides a comprehensive plan to port `seedtool-cli-rust` to TypeScript with exact 1:1 parity. The TypeScript implementation will maintain:

- Same file structure
- Same function names and signatures
- Same behavior and output
- Same test coverage

## Source Analysis

### Rust Project Structure

```
seedtool-cli-rust/
├── Cargo.toml                    # → package.json
├── src/
│   ├── main.rs                   # → src/main.ts (CLI entry point)
│   ├── cli.rs                    # → src/cli.ts (CLI argument parsing)
│   ├── seed.rs                   # → src/seed.ts (Seed type - extends @bcts/components)
│   ├── random.rs                 # → src/random.ts (RNG utilities)
│   ├── styles.rs                 # → src/styles.ts (CLI styling/colors)
│   ├── util.rs                   # → src/util.ts (Utility functions)
│   ├── exec.rs                   # → src/exec.ts (Placeholder - optional)
│   └── formats/
│       ├── mod.rs                # → src/formats/index.ts
│       ├── format.rs             # → src/formats/format.ts
│       ├── hex.rs                # → src/formats/hex.ts
│       ├── bip39.rs              # → src/formats/bip39.ts
│       ├── sskr.rs               # → src/formats/sskr.ts
│       ├── envelope.rs           # → src/formats/envelope.ts
│       ├── seed.rs               # → src/formats/seed-format.ts
│       ├── multipart.rs          # → src/formats/multipart.ts
│       ├── random.rs             # → src/formats/random.ts
│       ├── base6.rs              # → src/formats/base6.ts
│       ├── base10.rs             # → src/formats/base10.ts
│       ├── bits.rs               # → src/formats/bits.ts
│       ├── dice.rs               # → src/formats/dice.ts
│       ├── cards.rs              # → src/formats/cards.ts
│       ├── ints.rs               # → src/formats/ints.ts
│       ├── bytewords_standard.rs # → src/formats/bytewords-standard.ts
│       ├── bytewords_minimal.rs  # → src/formats/bytewords-minimal.ts
│       └── bytewords_uri.rs      # → src/formats/bytewords-uri.ts
└── tests/
    ├── tests.rs                  # → tests/main.test.ts
    └── common/
        └── mod.rs                # → tests/common.ts
```

### Rust Dependencies → TypeScript Mapping

| Rust Crate | Version | TypeScript Package | Notes |
|------------|---------|-------------------|-------|
| `dcbor` | ^0.24.1 | `@bcts/dcbor` | Already available |
| `bc-ur` | ^0.17.0 | `@bcts/uniform-resources` | Already available |
| `bc-envelope` | ^0.39.0 | `@bcts/envelope` | Already available |
| `bc-components` | ^0.30.0 | `@bcts/components` | Already available (includes Seed, SSKR) |
| `bc-rand` | ^0.5.0 | `@bcts/rand` | Already available |
| `bc-crypto` | ^0.13.0 | `@noble/hashes` | Use noble-hashes for SHA256, HKDF |
| `sskr` | ^0.12.0 | `@bcts/sskr` | Already available |
| `clap` | ^4.4.3 | `commander` | CLI argument parsing |
| `anyhow` | ^1.0.0 | (native errors) | Use standard Error handling |
| `anstyle` | ^1.0.1 | `chalk` or `picocolors` | Terminal styling |
| `hex` | ^0.4.3 | (native/utils) | Use @bcts/components utils |
| `regex` | ^1.11.1 | (native RegExp) | Native JavaScript |
| `clap-num` | 1.1.1 | (custom) | Number range validation |
| `bip39` | 2.0.0 | `@scure/bip39` | BIP39 mnemonic support |
| `bytewords` | (via bc-ur) | `@bcts/uniform-resources` | Bytewords encoding |

---

## Phase 1: Core Infrastructure

### 1.1 Package Configuration

**File:** `package.json`

Update from current skeleton to proper CLI package:

```json
{
  "name": "@bcts/seedtool-cli",
  "version": "1.0.0-alpha.13",
  "type": "module",
  "description": "A command-line tool for generating and transforming cryptographic seeds.",
  "license": "BSD-2-Clause-Patent",
  "bin": {
    "seedtool": "./dist/main.js"
  },
  "keywords": ["crypto", "random", "seed", "mnemonic", "bitcoin", "cli"],
  "dependencies": {
    "@bcts/components": "workspace:*",
    "@bcts/dcbor": "workspace:*",
    "@bcts/envelope": "workspace:*",
    "@bcts/uniform-resources": "workspace:*",
    "@bcts/sskr": "workspace:*",
    "@bcts/rand": "workspace:*",
    "@bcts/known-values": "workspace:*",
    "@noble/hashes": "^1.7.3",
    "@scure/bip39": "^1.6.0",
    "commander": "^14.0.0",
    "chalk": "^5.4.1"
  }
}
```

### 1.2 CLI Argument Parsing

**File:** `src/cli.ts`

Port from `cli.rs` (238 lines):

```typescript
// Key types and interfaces to implement:

export enum InputFormatKey {
  Random = "random",
  Hex = "hex",
  Btw = "btw",
  Btwu = "btwu",
  Btwm = "btwm",
  Bits = "bits",
  Cards = "cards",
  Dice = "dice",
  Base6 = "base6",
  Base10 = "base10",
  Ints = "ints",
  Bip39 = "bip39",
  Sskr = "sskr",
  Envelope = "envelope",
  Multipart = "multipart",
  Seed = "seed",
}

export enum OutputFormatKey {
  Hex = "hex",
  Btw = "btw",
  Btwu = "btwu",
  Btwm = "btwm",
  Bits = "bits",
  Cards = "cards",
  Dice = "dice",
  Base6 = "base6",
  Base10 = "base10",
  Ints = "ints",
  Bip39 = "bip39",
  Sskr = "sskr",
  Envelope = "envelope",
  Multipart = "multipart",
  Seed = "seed",
}

export enum SSKRFormatKey {
  Envelope = "envelope",
  Btw = "btw",
  Btwm = "btwm",
  Btwu = "btwu",
  Ur = "ur",
}

export type RngSource =
  | { type: "secure"; rng: SecureRandomNumberGenerator }
  | { type: "deterministic"; rng: DeterministicRandomNumberGenerator };

export interface Cli {
  input?: string;
  count: number;               // default: 16
  in: InputFormatKey;          // default: Random
  out: OutputFormatKey;        // default: Hex
  low: number;                 // default: 0 (for ints)
  high: number;                // default: 9 (for ints)
  name?: string;
  note?: string;
  date?: Date;
  maxFragmentLen: number;      // default: 500
  additionalParts: number;     // default: 0
  groups: SSKRGroupSpec[];
  groupThreshold: number;      // default: 1
  sskrFormat: SSKRFormatKey;   // default: Envelope
  deterministic?: string;
  seed?: Seed;
  rng?: RngSource;
}

// Methods to implement:
export function expectInput(cli: Cli): string;
export function expectSeed(cli: Cli): Seed;
export function randomData(cli: Cli, size: number): Uint8Array;
export function seedWithOverrides(cli: Cli): Seed;
export function toEnvelope(cli: Cli): Envelope;
export function sskrSpec(cli: Cli): SSKRSpec;
```

### 1.3 Random Number Generation

**File:** `src/random.ts`

Port from `random.rs` (53 lines):

```typescript
import { sha256 } from "@noble/hashes/sha256";
import { hkdf } from "@noble/hashes/hkdf";

export class DeterministicRandomNumberGenerator {
  private seed: Uint8Array; // 32 bytes (SHA256_SIZE)
  private salt: bigint;

  constructor(seed: Uint8Array) {
    this.seed = seed;
    this.salt = 0n;
  }

  static newWithSeed(seedString: string): DeterministicRandomNumberGenerator {
    const seed = sha256(new TextEncoder().encode(seedString));
    return new DeterministicRandomNumberGenerator(seed);
  }

  deterministicRandomData(size: number): Uint8Array {
    this.salt += 1n;
    const saltBytes = new Uint8Array(8);
    const view = new DataView(saltBytes.buffer);
    view.setBigUint64(0, this.salt, true); // little-endian
    return hkdfHmacSha256(this.seed, saltBytes, size);
  }
}

export function sha256DeterministicRandom(entropy: Uint8Array, n: number): Uint8Array;
export function sha256DeterministicRandomString(str: string, n: number): Uint8Array;
export function deterministicRandom(entropy: Uint8Array, n: number): Uint8Array;
```

### 1.4 CLI Styles

**File:** `src/styles.ts`

Port from `styles.rs` (39 lines):

```typescript
import chalk from "chalk";

export const styles = {
  usage: chalk.bold.underline.yellow,
  header: chalk.bold.underline.yellow,
  literal: chalk.green,
  invalid: chalk.bold.red,
  error: chalk.bold.red,
  valid: chalk.bold.underline.green,
  placeholder: chalk.cyanBright,
};
```

### 1.5 Utility Functions

**File:** `src/util.ts`

Port from `util.rs` (113 lines):

```typescript
export function dataToHex(bytes: Uint8Array): string;
export function hexToData(hex: string): Uint8Array;
export function dataToBase(buf: Uint8Array, base: number): Uint8Array;
export function dataToAlphabet(
  buf: Uint8Array,
  base: number,
  toAlphabet: (n: number) => string
): string;
export function parseInts(input: string): Uint8Array;
export function dataToInts(buf: Uint8Array, low: number, high: number, separator: string): string;
export function digitsToData(inStr: string, low: number, high: number): Uint8Array;
```

---

## Phase 2: Seed Type

### 2.1 Local Seed Type

**File:** `src/seed.ts`

Port from `seed.rs` (195 lines). This extends `@bcts/components` Seed with Envelope support:

```typescript
import { Seed as ComponentsSeed } from "@bcts/components";
import { Envelope, KnownValues } from "@bcts/envelope";
import type { Date as CborDate } from "@bcts/dcbor";

/**
 * Local Seed class that extends ComponentsSeed with Envelope support.
 *
 * Key differences from Rust:
 * - In Rust, Seed has separate implementations for CBOR and Envelope
 * - In TypeScript, we extend ComponentsSeed and add Envelope conversion
 */
export class Seed {
  private _data: Uint8Array;
  private _name: string;
  private _note: string;
  private _creationDate?: Date;

  // Static factories
  static new(data: Uint8Array): Seed;
  static newOpt(data: Uint8Array, name: string, note: string, creationDate?: Date): Seed;

  // Accessors
  data(): Uint8Array;
  name(): string;
  setName(name: string): void;
  note(): string;
  setNote(note: string): void;
  creationDate(): Date | undefined;
  setCreationDate(date: Date | undefined): void;

  // Envelope conversion (matches Rust impl From<Seed> for Envelope)
  toEnvelope(): Envelope;
  static fromEnvelope(envelope: Envelope): Seed;

  // ComponentsSeed conversion
  toComponentsSeed(): ComponentsSeed;
  static fromComponentsSeed(seed: ComponentsSeed): Seed;
}
```

---

## Phase 3: Format System

### 3.1 Format Traits/Interfaces

**File:** `src/formats/format.ts`

Port from `format.rs` (107 lines):

```typescript
import type { Cli } from "../cli.js";

export interface Format {
  name(): string;
  roundTrippable(): boolean;
}

export interface InputFormat extends Format {
  processInput(state: Cli): Cli;
}

export interface OutputFormat extends Format {
  processOutput(state: Cli): string;
}

export function selectInputFormat(key: InputFormatKey): InputFormat;
export function selectOutputFormat(key: OutputFormatKey): OutputFormat;
```

### 3.2 Format Implementations

Each format file follows the same pattern:

#### Round-Trippable Formats (bidirectional conversion)

| File | Lines | Implementation Notes |
|------|-------|---------------------|
| `hex.ts` | 27 | Simple hex encode/decode |
| `bip39.ts` | 29 | Uses `@scure/bip39` |
| `sskr.ts` | 378 | Complex - multiple output sub-formats (envelope, btw, btwm, btwu, ur) |
| `envelope.ts` | 28 | Uses `@bcts/envelope` |
| `seed-format.ts` | 31 | Uses UR seed format |
| `multipart.ts` | 50 | Uses `@bcts/uniform-resources` MultipartEncoder/Decoder |
| `random.ts` | 19 | Input-only: generates random seed |
| `bytewords-standard.ts` | 32 | Uses bytewords Style.Standard |
| `bytewords-minimal.ts` | 32 | Uses bytewords Style.Minimal |
| `bytewords-uri.ts` | 32 | Uses bytewords Style.Uri |

#### Non-Round-Trippable Formats (entropy input only)

| File | Lines | Implementation Notes |
|------|-------|---------------------|
| `base6.ts` | 36 | Digits 0-5, SHA256 deterministic |
| `base10.ts` | 36 | Digits 0-9, SHA256 deterministic |
| `bits.ts` | 36 | Binary 0-1, SHA256 deterministic |
| `dice.ts` | 36 | Digits 1-6, SHA256 deterministic |
| `cards.ts` | 87 | Playing cards format (52 cards) |
| `ints.ts` | 33 | Custom integer ranges |

### 3.3 SSKR Format (Most Complex)

**File:** `src/formats/sskr.ts`

Port from `sskr.rs` (378 lines):

```typescript
import { SSKRSpec, SSKRGroupSpec, SSKRSecret, sskrGenerate, sskrCombine } from "@bcts/sskr";
import { Envelope } from "@bcts/envelope";
import { SymmetricKey } from "@bcts/components";
import { UR, bytewords } from "@bcts/uniform-resources";

export class SSKRFormat implements InputFormat, OutputFormat {
  name(): string { return "sskr"; }
  roundTrippable(): boolean { return true; }

  processInput(state: Cli): Cli {
    state.seed = parseSskrSeed(state.expectInput());
    return state;
  }

  processOutput(state: Cli): string {
    return outputSskrSeed(state.expectSeed(), state.sskrSpec(), state.sskrFormat);
  }
}

// Output helpers
function outputSskrSeed(seed: Seed, spec: SSKRSpec, format: SSKRFormatKey): string;
function makeShares(spec: SSKRSpec, seed: Seed): SSKRShare[];
function makeBytewordsShares(spec: SSKRSpec, seed: Seed, style: bytewords.Style): string;

// Input helpers (try multiple formats)
function parseEnvelopes(input: string): Seed;
function parseBytewords(input: string, style: bytewords.Style): Seed;
function parseUr(input: string, expectedTag: number, allowTaggedCbor: boolean): Seed;
function parseSskrSeed(input: string): Seed;
```

### 3.4 Module Index

**File:** `src/formats/index.ts`

Port from `mod.rs` (37 lines):

```typescript
export * from "./format.js";
export * from "./hex.js";
export * from "./bip39.js";
export * from "./sskr.js";
export * from "./envelope.js";
export * from "./seed-format.js";
export * from "./multipart.js";
export * from "./random.js";
export * from "./base6.js";
export * from "./base10.js";
export * from "./bits.js";
export * from "./dice.js";
export * from "./cards.js";
export * from "./ints.js";
export * from "./bytewords-standard.js";
export * from "./bytewords-minimal.js";
export * from "./bytewords-uri.js";
```

---

## Phase 4: Main Entry Point

**File:** `src/main.ts`

Port from `main.rs` (57 lines):

```typescript
#!/usr/bin/env node

import { Command } from "commander";
import { SecureRandomNumberGenerator } from "@bcts/rand";
import { Cli, RngSource } from "./cli.js";
import { selectInputFormat, selectOutputFormat } from "./formats/index.js";
import { DeterministicRandomNumberGenerator } from "./random.js";

// Register envelope tags
import { registerTags } from "@bcts/envelope";

async function main(): Promise<void> {
  registerTags();

  const program = new Command()
    .name("seedtool")
    .description("A tool for generating and transforming cryptographic seeds.")
    .version("0.4.0")
    // ... all CLI options from cli.ts

  program.parse();
  const options = program.opts();

  // Build Cli state
  let cli: Cli = { /* ... parse options ... */ };

  // Set up RNG
  if (cli.deterministic) {
    cli.rng = {
      type: "deterministic",
      rng: DeterministicRandomNumberGenerator.newWithSeed(cli.deterministic)
    };
  } else {
    cli.rng = {
      type: "secure",
      rng: new SecureRandomNumberGenerator()
    };
  }

  const inputFormat = selectInputFormat(cli.in);
  const outputFormat = selectOutputFormat(cli.out);

  // Validate: non-round-trippable outputs require random input
  if (!outputFormat.roundTrippable() && inputFormat.name() !== "random") {
    throw new Error(`Input for output form "${outputFormat.name()}" must be random.`);
  }

  cli = inputFormat.processInput(cli);
  const output = outputFormat.processOutput(cli);
  console.log(output);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
```

---

## Phase 5: Tests

### 5.1 Test Utilities

**File:** `tests/common.ts`

Port from `tests/common/mod.rs` (116 lines):

```typescript
import { execSync, spawnSync } from "child_process";
import { resolve } from "path";

const CLI_PATH = resolve(__dirname, "../dist/main.js");

export function runCli(args: string[]): string {
  return runCliStdin(args, "").trim();
}

export function runCliRaw(args: string[]): string {
  return runCliStdin(args, "");
}

export function runCliStdin(args: string[], stdin: string): string {
  const result = spawnSync("node", [CLI_PATH, ...args], {
    input: stdin,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${result.stderr}`);
  }
  return result.stdout;
}

export function runCliExpect(args: string[], expected: string): void {
  const output = runCli(args);
  expect(output).toBe(expected.trim());
}

export function runCliPiped(cmds: string[][]): string {
  let output = "";
  for (const cmd of cmds) {
    output = runCliStdin(cmd, output);
  }
  return output.trim();
}
```

### 5.2 Main Test Suite

**File:** `tests/main.test.ts`

Port from `tests/tests.rs` (267 lines):

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { Envelope } from "@bcts/envelope";
import { runCli, runCliExpect, runCliPiped } from "./common.js";

beforeAll(() => {
  // Register envelope tags
  import("@bcts/envelope").then(m => m.registerTags());
});

describe("Seedtool CLI", () => {
  describe("Seed Generation", () => {
    it("should generate deterministic seed", () => {
      const seed = runCli(["--deterministic", "TEST"]);
      runCliExpect(["--deterministic", "TEST"], seed);
      expect(seed).toBe("9d347f841a4e2ce6bc886e1aee74d824");
    });

    it("should generate different random seeds", () => {
      const seed1 = runCli([]);
      const seed2 = runCli([]);
      expect(seed1).not.toBe(seed2);
    });
  });

  describe("Format Conversions", () => {
    const hex = "9d347f841a4e2ce6bc886e1aee74d824";

    it("should convert to/from base6", () => {
      const base6 = "3123121543215241";
      expect(runCli(["--deterministic", "TEST", "--out", "base6", hex])).toBe(base6);
      expect(runCli(["--in", "base6", "--out", "hex", base6])).toBe("cb97f8ff03b3434258a7a8974e3187a0");
    });

    it("should convert to/from base10", () => {
      const base10 = "6245132875418481";
      expect(runCli(["--deterministic", "TEST", "--out", "base10", hex])).toBe(base10);
      expect(runCli(["--in", "base10", "--out", "hex", base10])).toBe("3f3830e7e4d4f95c3e037630c6ae811a");
    });

    it("should convert to/from bits", () => {
      const bits = "1001000111001010";
      expect(runCli(["--deterministic", "TEST", "--out", "bits", hex])).toBe(bits);
      expect(runCli(["--in", "bits", "--out", "hex", bits])).toBe("980947e4f8cd49459819d9453fca085f");
    });

    it("should convert to/from cards", () => {
      const cards = "6hjckdah6c4dtc8skh2htd6ctsjd5s8c";
      expect(runCli(["--deterministic", "TEST", "--out", "cards", hex])).toBe(cards);
      expect(runCli(["--in", "cards", "--out", "hex", cards])).toBe("1d0f2f3b502256cf56e3eaaa9f95ef71");
    });

    it("should convert to/from dice", () => {
      const dice = "4234232654326352";
      expect(runCli(["--deterministic", "TEST", "--out", "dice", hex])).toBe(dice);
      expect(runCli(["--in", "dice", "--out", "hex", dice])).toBe("eefa19b88c5846e71fcb52d007066ae4");
    });

    it("should convert to/from ints", () => {
      const ints = "6 2 4 5 1 3 2 8 7 5 4 1 8 4 8 1";
      expect(runCli(["--deterministic", "TEST", "--out", "ints", hex])).toBe(ints);
      expect(runCli(["--in", "ints", "--out", "hex", ints])).toBe("19a7830e032c0e027d176162112ee67e");
    });

    it("should round-trip hex", () => {
      expect(runCli(["--in", "hex", "--out", "hex", hex])).toBe(hex);
    });

    it("should round-trip bytewords minimal", () => {
      const btwm = "nteelblrcygldwvarflojtcywyjytpdklddyoymk";
      expect(runCli(["--in", "hex", "--out", "btwm", hex])).toBe(btwm);
      expect(runCli(["--in", "btwm", "--out", "hex", btwm])).toBe(hex);
    });

    it("should round-trip bytewords standard", () => {
      const btw = "next edge lamb liar city girl draw visa roof logo jolt city waxy jury trip dark loud duty obey monk";
      expect(runCli(["--in", "hex", "--out", "btw", hex])).toBe(btw);
      expect(runCli(["--in", "btw", "--out", "hex", btw])).toBe(hex);
    });

    it("should round-trip bytewords uri", () => {
      const btwu = "next-edge-lamb-liar-city-girl-draw-visa-roof-logo-jolt-city-waxy-jury-trip-dark-loud-duty-obey-monk";
      expect(runCli(["--in", "hex", "--out", "btwu", hex])).toBe(btwu);
      expect(runCli(["--in", "btwu", "--out", "hex", btwu])).toBe(hex);
    });

    it("should round-trip seed UR", () => {
      const seedUr = runCli(["--in", "hex", "--out", "seed", hex]);
      expect(seedUr.startsWith("ur:seed/")).toBe(true);
      expect(runCli(["--in", "seed", "--out", "hex", seedUr])).toBe(hex);
    });
  });

  describe("Envelope", () => {
    it("should create envelope with metadata", () => {
      const urString = "ur:envelope/lptpsogdnteelblrcygldwvarflojtcywyjytpdkoyadcsspoyaatpsojoghisinjkcxinjkcxjyisihcxjtjljyihoybdtpsoisguihihieglhsjnihoybetpsosecyiyjzvsayehspswda";
      expect(runCli([
        "--out", "envelope",
        "--name", "SeedName",
        "--note", "This is the note",
        "--date", "2024-06-15T01:02:00Z",
        "--deterministic", "TEST",
      ])).toBe(urString);
    });

    it("should rename envelope", () => {
      const input = "ur:envelope/lptpsogdnteelblrcygldwvarflojtcywyjytpdkoyadcsspoyaatpsojoghisinjkcxinjkcxjyisihcxjtjljyihoybdtpsoisguihihieglhsjnihoybetpsosecyiyjzvsayehspswda";
      const renamed = "ur:envelope/lptpsogdnteelblrcygldwvarflojtcywyjytpdkoyadcsspoyaatpsojoghisinjkcxinjkcxjyisihcxjtjljyihoybdtpsokpfyhsjpjecxgdkpjpjojzihcxfpjskphscxgsjlkoihoybetpsosecyiyjzvsayaoiehshl";
      expect(runCli([
        "--in", "envelope",
        "--out", "envelope",
        "--name", "Dark Purple Aqua Love",
        input
      ])).toBe(renamed);
    });
  });

  describe("SSKR", () => {
    it("should split and reconstruct seed via SSKR", () => {
      const seedEnvelope = runCli([
        "--name", "SeedName",
        "--note", "This is the note",
        "--date", "now",
        "--out", "envelope",
      ]);

      const shareStrings = runCli([
        "--in", "envelope",
        "--out", "sskr",
        "--group-threshold", "2",
        "--groups", "2-of-3", "3-of-5",
        "--", seedEnvelope,
      ]).split(/\s+/);

      // Select subset of shares: indices 0, 2, 3, 5, 7
      const selectedShares = [0, 2, 3, 5, 7].map(i => shareStrings[i]);

      const restoredEnvelope = runCli([
        "--in", "sskr",
        "--out", "envelope",
        selectedShares.join(" "),
      ]);

      expect(Envelope.fromURString(restoredEnvelope).urString()).toBe(seedEnvelope);
    });
  });

  describe("Multipart", () => {
    it("should encode and decode multipart UR", () => {
      const seedEnvelope = runCli([
        "--count", "64",
        "--name", "SeedName",
        "--note", "This is the note",
        "--date", "now",
        "--out", "envelope",
      ]);

      const shares = runCli([
        "--in", "envelope",
        "--out", "multipart",
        "--max-fragment-len", "20",
        "--additional-parts", "50",
        seedEnvelope,
      ]).split(/\s+/);

      // Skip first 5 shares (use fountain codes)
      const selectedShares = shares.slice(5);

      const restoredEnvelope = runCli([
        "--in", "multipart",
        "--out", "envelope",
        selectedShares.join(" "),
      ]);

      expect(Envelope.fromURString(restoredEnvelope).urString()).toBe(seedEnvelope);
    });
  });
});
```

---

## Phase 6: Integration

### 6.1 Module Index

**File:** `src/index.ts`

Export all public API:

```typescript
export * from "./cli.js";
export * from "./seed.js";
export * from "./random.js";
export * from "./util.js";
export * from "./formats/index.js";
```

### 6.2 Build Configuration

Update `tsdown.config.ts` to:
- Output ESM and CJS
- Include CLI shebang
- Generate type declarations

---

## Implementation Order

### Phase 1: Foundation - COMPLETED
- [x] 1.1 Package configuration updates (`package.json`, `tsdown.config.ts`)
- [x] 1.2 CLI types and interfaces (`cli.ts`)
- [x] 1.3 Random utilities (`random.ts`)
- [x] 1.4 CLI styles (`styles.ts`)
- [x] 1.5 Utility functions (`util.ts`)

### Phase 2: Seed Type - COMPLETED
- [x] 2.1 Local Seed type (`seed.ts`)

### Phase 3: Format System - COMPLETED
- [x] 3.1 Format traits (`formats/format.ts`)
- [x] 3.2 Hex format (`formats/hex.ts`)
- [x] 3.2 BIP39 format (`formats/bip39.ts`)
- [x] 3.2 Bytewords formats (bytewords-standard.ts, bytewords-minimal.ts, bytewords-uri.ts)
- [x] 3.2 Entropy formats (base6.ts, base10.ts, bits.ts, dice.ts, cards.ts, ints.ts)
- [x] 3.2 Envelope format (`formats/envelope.ts`)
- [x] 3.2 Seed UR format (`formats/seed-format.ts`)
- [x] 3.2 Multipart format (`formats/multipart.ts`)
- [x] 3.2 Random format (`formats/random.ts`)
- [x] 3.3 SSKR format (`formats/sskr.ts`) - most complex
- [x] 3.4 Module index (`formats/index.ts`)

### Phase 4: Main Entry Point - COMPLETED
- [x] 4.0 Main entry point (`main.ts`)
- [x] 4.1 Library exports (`index.ts`)

### Phase 5: Testing & Polish - COMPLETED
- [x] 5.1 Test utilities (`tests/common.ts`)
- [x] 5.2 Main test suite (`tests/main.test.ts`)
- [x] Integration testing (19 tests passing)
- [x] Documentation (PORTING_PLAN.md updated)

---

## Success Criteria

1. **Exact Output Parity:** Running `seedtool --deterministic TEST` produces identical output in both Rust and TypeScript versions
2. **All Tests Pass:** TypeScript test suite passes all tests that correspond to Rust tests
3. **CLI Feature Parity:** All CLI flags and options work identically
4. **Format Round-Trips:** All round-trippable formats produce identical output when converting to and from hex

## Test Vectors

From Rust tests, these exact outputs must be reproduced:

| Command | Expected Output |
|---------|-----------------|
| `seedtool --deterministic TEST` | `9d347f841a4e2ce6bc886e1aee74d824` |
| `seedtool --deterministic TEST --out base6` | `3123121543215241` |
| `seedtool --deterministic TEST --out base10` | `6245132875418481` |
| `seedtool --deterministic TEST --out bits` | `1001000111001010` |
| `seedtool --deterministic TEST --out cards` | `6hjckdah6c4dtc8skh2htd6ctsjd5s8c` |
| `seedtool --deterministic TEST --out dice` | `4234232654326352` |
| `seedtool --deterministic TEST --out ints` | `6 2 4 5 1 3 2 8 7 5 4 1 8 4 8 1` |
| `seedtool --in hex --out btwm <hex>` | `nteelblrcygldwvarflojtcywyjytpdklddyoymk` |
| `seedtool --in hex --out btw <hex>` | `next edge lamb liar city girl draw visa roof logo jolt city waxy jury trip dark loud duty obey monk` |

---

## Notes

### Known Issues - RESOLVED

1. ~~**Bytewords URI Format:**~~ **FIXED** - `@bcts/uniform-resources` `BytewordsStyle.Uri` now correctly uses hyphen separators. The TypeScript version produces `next-edge-lamb-...` matching the Rust output.

2. ~~**Date Encoding:**~~ **FIXED** - The Seed envelope now uses `CborDate` from `@bcts/dcbor` for CBOR Date tag 1 encoding, matching the Rust output exactly.

### Differences from Rust

1. **Error Handling:** Use standard JavaScript Error instead of anyhow
2. **CLI Framework:** Use `commander` instead of `clap`
3. **Color Output:** Use `chalk` instead of `anstyle`
4. **File Naming:** Use kebab-case (TypeScript convention) instead of snake_case

### Reusable Components from BCTS

The following components are already available and should be reused:

- `@bcts/components`: Seed, SSKR types
- `@bcts/envelope`: Envelope, UR encoding
- `@bcts/uniform-resources`: UR, bytewords, MultipartEncoder/Decoder
- `@bcts/sskr`: Core SSKR functionality
- `@bcts/rand`: SecureRandomNumberGenerator
- `@bcts/dcbor`: CBOR encoding
