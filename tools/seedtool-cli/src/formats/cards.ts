/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Cards format
 * Ported from seedtool-cli-rust/src/formats/cards.rs
 */

import type { Cli } from "../cli.js";
import type { InputFormat, OutputFormat } from "./format.js";
import { Seed } from "../seed.js";
import { deterministicRandom } from "../random.js";
import { dataToAlphabet } from "../util.js";

// Arrangement of cards per:
// https://github.com/iancoleman/bip39/blob/master/src/js/entropy.js
const CARD_SUITS = "cdhs";
const CARD_RANKS = "a23456789tjqk";

/**
 * Parse a card rank character.
 * Returns index 0-12.
 */
function parseRank(c: string): number {
  const lower = c.toLowerCase();
  const index = CARD_RANKS.indexOf(lower);
  if (index === -1) {
    throw new Error(`Invalid card rank: ${c}. Allowed: [A,2-9,T,J,Q,K]`);
  }
  return index;
}

/**
 * Parse a card suit character.
 * Returns index 0-3.
 */
function parseSuit(c: string): number {
  const lower = c.toLowerCase();
  const index = CARD_SUITS.indexOf(lower);
  if (index === -1) {
    throw new Error(`Invalid card suit: ${c}. Allowed: [C,D,H,S]`);
  }
  return index;
}

/**
 * Convert card string to byte array.
 * Each pair of characters represents one card.
 */
function cardsToData(cards: string): Uint8Array {
  const len = cards.length;
  if (len % 2 !== 0) {
    throw new Error("Cards string must have even number of characters.");
  }
  const count = len / 2;
  const result = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const rank = parseRank(cards[i * 2]);
    const suit = parseSuit(cards[i * 2 + 1]);
    const n = suit * 13 + rank;
    result[i] = n;
  }
  return result;
}

/**
 * Convert a card index (0-51) to card string.
 */
function toCard(n: number): string {
  if (n > 51) {
    throw new Error(`Card index out of range: ${n}`);
  }
  const rank = n % 13;
  const suit = Math.floor(n / 13);
  return CARD_RANKS[rank] + CARD_SUITS[suit];
}

/**
 * Playing cards format handler.
 * NOT round-trippable: input is entropy source.
 * Card notation: rank (A,2-9,T,J,Q,K) + suit (C,D,H,S).
 */
export class CardsFormat implements InputFormat, OutputFormat {
  name(): string {
    return "cards";
  }

  roundTrippable(): boolean {
    return false;
  }

  processInput(state: Cli): Cli {
    const input = state.expectInput();
    const entropy = cardsToData(input);
    const data = deterministicRandom(entropy, state.count);
    state.seed = Seed.new(data);
    return state;
  }

  processOutput(state: Cli): string {
    return dataToAlphabet(state.expectSeed().data(), 52, toCard);
  }
}
