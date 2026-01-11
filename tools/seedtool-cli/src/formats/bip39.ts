/**
 * BIP39 mnemonic format
 * Ported from seedtool-cli-rust/src/formats/bip39.rs
 */

import type { Cli } from "../cli.js";
import type { InputFormat, OutputFormat } from "./format.js";
import { Seed } from "../seed.js";
import { mnemonicToEntropy, entropyToMnemonic, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";

/**
 * BIP39 mnemonic format handler.
 * Round-trippable: mnemonic → seed → mnemonic.
 */
export class Bip39Format implements InputFormat, OutputFormat {
  name(): string {
    return "bip39";
  }

  roundTrippable(): boolean {
    return true;
  }

  processInput(state: Cli): Cli {
    const input = state.expectInput();
    // Normalize the mnemonic (lowercase, single spaces)
    const normalized = input.toLowerCase().trim().replace(/\s+/g, " ");

    if (!validateMnemonic(normalized, wordlist)) {
      throw new Error("Invalid BIP39 mnemonic");
    }

    const entropy = mnemonicToEntropy(normalized, wordlist);
    state.seed = Seed.new(entropy);
    return state;
  }

  processOutput(state: Cli): string {
    const mnemonic = entropyToMnemonic(state.expectSeed().data(), wordlist);
    return mnemonic;
  }
}
