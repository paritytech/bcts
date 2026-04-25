/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

import { BytewordsError, InvalidTypeError } from "./error.js";

/**
 * Checks if a character is a valid UR type character.
 *
 * Mirrors Rust's `URTypeChar::is_ur_type` (`bc-ur-rust/src/utils.rs:6-19`):
 * lowercase a-z, digits 0-9, and the hyphen `-`.
 */
export function isURTypeChar(char: string): boolean {
  const code = char.charCodeAt(0);
  // Check for lowercase letters (a-z)
  if (code >= 97 && code <= 122) return true;
  // Check for digits (0-9)
  if (code >= 48 && code <= 57) return true;
  // Check for hyphen (-)
  if (code === 45) return true;
  return false;
}

/**
 * Checks if a string is a valid UR type.
 *
 * Mirrors Rust's `URTypeString::is_ur_type` (`bc-ur-rust/src/utils.rs:26-32`)
 * which is `self.chars().all(...)` — meaning **the empty string is accepted**
 * (a vacuously-true `all` over no chars). We mirror that here so that
 * `URType::new("")` succeeds in both ports; the round-trip then fails at
 * decode-time with `TypeUnspecified`.
 */
export function isValidURType(urType: string): boolean {
  return Array.from(urType).every((char) => isURTypeChar(char));
}

/**
 * Validates and returns a UR type, or throws an error if invalid.
 */
export function validateURType(urType: string): string {
  if (!isValidURType(urType)) {
    throw new InvalidTypeError();
  }
  return urType;
}

/**
 * Bytewords for encoding/decoding bytes as words.
 * See: https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2020-004-bytewords.md
 */
export const BYTEWORDS: string[] = [
  "able",
  "acid",
  "also",
  "apex",
  "aqua",
  "arch",
  "atom",
  "aunt",
  "away",
  "axis",
  "back",
  "bald",
  "barn",
  "belt",
  "beta",
  "bias",
  "blue",
  "body",
  "brag",
  "brew",
  "bulb",
  "buzz",
  "calm",
  "cash",
  "cats",
  "chef",
  "city",
  "claw",
  "code",
  "cola",
  "cook",
  "cost",
  "crux",
  "curl",
  "cusp",
  "cyan",
  "dark",
  "data",
  "days",
  "deli",
  "dice",
  "diet",
  "door",
  "down",
  "draw",
  "drop",
  "drum",
  "dull",
  "duty",
  "each",
  "easy",
  "echo",
  "edge",
  "epic",
  "even",
  "exam",
  "exit",
  "eyes",
  "fact",
  "fair",
  "fern",
  "figs",
  "film",
  "fish",
  "fizz",
  "flap",
  "flew",
  "flux",
  "foxy",
  "free",
  "frog",
  "fuel",
  "fund",
  "gala",
  "game",
  "gear",
  "gems",
  "gift",
  "girl",
  "glow",
  "good",
  "gray",
  "grim",
  "guru",
  "gush",
  "gyro",
  "half",
  "hang",
  "hard",
  "hawk",
  "heat",
  "help",
  "high",
  "hill",
  "holy",
  "hope",
  "horn",
  "huts",
  "iced",
  "idea",
  "idle",
  "inch",
  "inky",
  "into",
  "iris",
  "iron",
  "item",
  "jade",
  "jazz",
  "join",
  "jolt",
  "jowl",
  "judo",
  "jugs",
  "jump",
  "junk",
  "jury",
  "keep",
  "keno",
  "kept",
  "keys",
  "kick",
  "kiln",
  "king",
  "kite",
  "kiwi",
  "knob",
  "lamb",
  "lava",
  "lazy",
  "leaf",
  "legs",
  "liar",
  "limp",
  "lion",
  "list",
  "logo",
  "loud",
  "love",
  "luau",
  "luck",
  "lung",
  "main",
  "many",
  "math",
  "maze",
  "memo",
  "menu",
  "meow",
  "mild",
  "mint",
  "miss",
  "monk",
  "nail",
  "navy",
  "need",
  "news",
  "next",
  "noon",
  "note",
  "numb",
  "obey",
  "oboe",
  "omit",
  "onyx",
  "open",
  "oval",
  "owls",
  "paid",
  "part",
  "peck",
  "play",
  "plus",
  "poem",
  "pool",
  "pose",
  "puff",
  "puma",
  "purr",
  "quad",
  "quiz",
  "race",
  "ramp",
  "real",
  "redo",
  "rich",
  "road",
  "rock",
  "roof",
  "ruby",
  "ruin",
  "runs",
  "rust",
  "safe",
  "saga",
  "scar",
  "sets",
  "silk",
  "skew",
  "slot",
  "soap",
  "solo",
  "song",
  "stub",
  "surf",
  "swan",
  "taco",
  "task",
  "taxi",
  "tent",
  "tied",
  "time",
  "tiny",
  "toil",
  "tomb",
  "toys",
  "trip",
  "tuna",
  "twin",
  "ugly",
  "undo",
  "unit",
  "urge",
  "user",
  "vast",
  "very",
  "veto",
  "vial",
  "vibe",
  "view",
  "visa",
  "void",
  "vows",
  "wall",
  "wand",
  "warm",
  "wasp",
  "wave",
  "waxy",
  "webs",
  "what",
  "when",
  "whiz",
  "wolf",
  "work",
  "yank",
  "yawn",
  "yell",
  "yoga",
  "yurt",
  "zaps",
  "zero",
  "zest",
  "zinc",
  "zone",
  "zoom",
];

/**
 * Create a reverse mapping for fast byteword lookup.
 */
function createBytewordsMap(): Map<string, number> {
  const map = new Map<string, number>();
  BYTEWORDS.forEach((word, index) => {
    map.set(word, index);
  });
  return map;
}

export const BYTEWORDS_MAP = createBytewordsMap();

/**
 * Bytemojis for encoding/decoding bytes as emojis.
 * See: https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2024-008-bytemoji.md
 */
export const BYTEMOJIS: string[] = [
  "😀",
  "😂",
  "😆",
  "😉",
  "🙄",
  "😋",
  "😎",
  "😍",
  "😘",
  "😭",
  "🫠",
  "🥱",
  "🤩",
  "😶",
  "🤨",
  "🫥",
  "🥵",
  "🥶",
  "😳",
  "🤪",
  "😵",
  "😡",
  "🤢",
  "😇",
  "🤠",
  "🤡",
  "🥳",
  "🥺",
  "😬",
  "🤑",
  "🙃",
  "🤯",
  "😈",
  "👹",
  "👺",
  "💀",
  "👻",
  "👽",
  "😺",
  "😹",
  "😻",
  "😽",
  "🙀",
  "😿",
  "🫶",
  "🤲",
  "🙌",
  "🤝",
  "👍",
  "👎",
  "👈",
  "👆",
  "💪",
  "👄",
  "🦷",
  "👂",
  "👃",
  "🧠",
  "👀",
  "🤚",
  "🦶",
  "🍎",
  "🍊",
  "🍋",
  "🍌",
  "🍉",
  "🍇",
  "🍓",
  "🫐",
  "🍒",
  "🍑",
  "🍍",
  "🥝",
  "🍆",
  "🥑",
  "🥦",
  "🍅",
  "🌽",
  "🥕",
  "🫒",
  "🧄",
  "🥐",
  "🥯",
  "🍞",
  "🧀",
  "🥚",
  "🍗",
  "🌭",
  "🍔",
  "🍟",
  "🍕",
  "🌮",
  "🥙",
  "🍱",
  "🍜",
  "🍤",
  "🍚",
  "🥠",
  "🍨",
  "🍦",
  "🎂",
  "🪴",
  "🌵",
  "🌱",
  "💐",
  "🍁",
  "🍄",
  "🌹",
  "🌺",
  "🌼",
  "🌻",
  "🌸",
  "💨",
  "🌊",
  "💧",
  "💦",
  "🌀",
  "🌈",
  "🌞",
  "🌝",
  "🌛",
  "🌜",
  "🌙",
  "🌎",
  "💫",
  "⭐",
  "🪐",
  "🌐",
  "💛",
  "💔",
  "💘",
  "💖",
  "💕",
  "🏁",
  "🚩",
  "💬",
  "💯",
  "🚫",
  "🔴",
  "🔷",
  "🟩",
  "🛑",
  "🔺",
  "🚗",
  "🚑",
  "🚒",
  "🚜",
  "🛵",
  "🚨",
  "🚀",
  "🚁",
  "🛟",
  "🚦",
  "🏰",
  "🎡",
  "🎢",
  "🎠",
  "🏠",
  "🔔",
  "🔑",
  "🚪",
  "🪑",
  "🎈",
  "💌",
  "📦",
  "📫",
  "📖",
  "📚",
  "📌",
  "🧮",
  "🔒",
  "💎",
  "📷",
  "⏰",
  "⏳",
  "📡",
  "💡",
  "💰",
  "🧲",
  "🧸",
  "🎁",
  "🎀",
  "🎉",
  "🪭",
  "👑",
  "🫖",
  "🔭",
  "🛁",
  "🏆",
  "🥁",
  "🎷",
  "🎺",
  "🏀",
  "🏈",
  "🎾",
  "🏓",
  "✨",
  "🔥",
  "💥",
  "👕",
  "👚",
  "👖",
  "🩳",
  "👗",
  "👔",
  "🧢",
  "👓",
  "🧶",
  "🧵",
  "💍",
  "👠",
  "👟",
  "🧦",
  "🧤",
  "👒",
  "👜",
  "🐱",
  "🐶",
  "🐭",
  "🐹",
  "🐰",
  "🦊",
  "🐻",
  "🐼",
  "🐨",
  "🐯",
  "🦁",
  "🐮",
  "🐷",
  "🐸",
  "🐵",
  "🐔",
  "🐥",
  "🦆",
  "🦉",
  "🐴",
  "🦄",
  "🐝",
  "🐛",
  "🦋",
  "🐌",
  "🐞",
  "🐢",
  "🐺",
  "🐍",
  "🪽",
  "🐙",
  "🦑",
  "🪼",
  "🦞",
  "🦀",
  "🐚",
  "🦭",
  "🐟",
  "🐬",
  "🐳",
];

/**
 * Encodes an arbitrary byte slice as a string of space-separated bytewords.
 *
 * Mirrors `bytewords::encode_to_words` in `bc-ur-rust` (≥ v0.19.1). Does not
 * add a CRC32 checksum — use {@link encodeBytewords} for UR-style encoding.
 */
export function encodeToWords(data: Uint8Array): string {
  const words: string[] = [];
  for (const byte of data) {
    const word = BYTEWORDS[byte];
    if (word === undefined) throw new Error(`Invalid byte value: ${byte}`);
    words.push(word);
  }
  return words.join(" ");
}

/**
 * Encodes an arbitrary byte slice as a string of space-separated bytemojis.
 *
 * Mirrors `bytewords::encode_to_bytemojis` in `bc-ur-rust` (≥ v0.19.1).
 */
export function encodeToBytemojis(data: Uint8Array): string {
  const emojis: string[] = [];
  for (const byte of data) {
    const emoji = BYTEMOJIS[byte];
    if (emoji === undefined) throw new Error(`Invalid byte value: ${byte}`);
    emojis.push(emoji);
  }
  return emojis.join(" ");
}

/**
 * Encodes an arbitrary byte slice as minimal bytewords (first + last letter of
 * each word, concatenated with no separator).
 *
 * Mirrors `bytewords::encode_to_minimal_bytewords` in `bc-ur-rust`
 * (≥ v0.19.1). Does not add a CRC32 checksum.
 */
export function encodeToMinimalBytewords(data: Uint8Array): string {
  let out = "";
  for (const byte of data) {
    const word = BYTEWORDS[byte];
    if (word === undefined) throw new Error(`Invalid byte value: ${byte}`);
    out += word[0] + word[word.length - 1];
  }
  return out;
}

/**
 * Encodes a 4-byte slice as a string of bytewords for identification.
 *
 * Thin wrapper over {@link encodeToWords} that enforces the 4-byte length
 * contract historically used by `bc-ur-rust`'s `bytewords::identifier`.
 */
export function encodeBytewordsIdentifier(data: Uint8Array): string {
  if (data.length !== 4) {
    throw new Error("Identifier data must be exactly 4 bytes");
  }
  return encodeToWords(data);
}

/**
 * Encodes a 4-byte slice as a string of bytemojis for identification.
 *
 * Thin wrapper over {@link encodeToBytemojis} that enforces the 4-byte length
 * contract historically used by `bc-ur-rust`'s `bytewords::bytemoji_identifier`.
 */
export function encodeBytemojisIdentifier(data: Uint8Array): string {
  if (data.length !== 4) {
    throw new Error("Identifier data must be exactly 4 bytes");
  }
  return encodeToBytemojis(data);
}

/**
 * Returns `true` if `emoji` is one of the 256 bytemojis.
 *
 * Mirrors `bytewords::is_valid_bytemoji` in `bc-ur-rust` (≥ v0.19.1).
 */
export function isValidBytemoji(emoji: string): boolean {
  return BYTEMOJI_SET.has(emoji);
}

/**
 * Canonicalises a byteword token (2–4 ASCII letters, case-insensitive) to its
 * full 4-letter lowercase form. Returns `undefined` if the token is not a
 * valid byteword or any of its short forms.
 *
 * Mirrors `bytewords::canonicalize_byteword` in `bc-ur-rust` (≥ v0.19.1).
 *
 * - 2-letter tokens are matched against the first + last letter of each
 *   byteword (identical to the minimal bytewords encoding).
 * - 3-letter tokens are matched against the first 3 and the last 3 letters of
 *   each byteword; if both match different entries, the first-3 match wins
 *   (matching rust's `or_else` priority).
 * - 4-letter tokens must exactly match a full byteword (after lower-casing).
 */
export function canonicalizeByteword(token: string): string | undefined {
  const lower = token.toLowerCase();
  switch (lower.length) {
    case 4:
      return BYTEWORDS_MAP.has(lower) ? lower : undefined;
    case 2:
      return BYTEWORD_FIRST_LAST_MAP.get(lower);
    case 3: {
      return BYTEWORD_FIRST_THREE_MAP.get(lower) ?? BYTEWORD_LAST_THREE_MAP.get(lower);
    }
    default:
      return undefined;
  }
}

/**
 * Bytewords encoding style.
 */
export enum BytewordsStyle {
  /** Full 4-letter words separated by spaces */
  Standard = "standard",
  /** Full 4-letter words separated by hyphens (URI-safe) */
  Uri = "uri",
  /** First and last character only (minimal) - used by UR encoding */
  Minimal = "minimal",
}

/**
 * Create a reverse mapping for minimal bytewords (first+last char) lookup.
 */
function createMinimalBytewordsMap(): Map<string, number> {
  const map = new Map<string, number>();
  BYTEWORDS.forEach((word, index) => {
    // Minimal encoding uses first and last character
    const minimal = word[0] + word[3];
    map.set(minimal, index);
  });
  return map;
}

export const MINIMAL_BYTEWORDS_MAP = createMinimalBytewordsMap();

/**
 * Set of all 256 bytemojis for fast membership testing. Backs
 * {@link isValidBytemoji}.
 */
const BYTEMOJI_SET: ReadonlySet<string> = new Set(BYTEMOJIS);

/**
 * Lookup from a 2-letter (first+last) byteword short-form to its full
 * lowercase 4-letter form. Backs {@link canonicalizeByteword}.
 */
const BYTEWORD_FIRST_LAST_MAP: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const word of BYTEWORDS) {
    map.set(word[0] + word[word.length - 1], word);
  }
  return map;
})();

/**
 * Lookup from the first 3 letters of a byteword to its full lowercase 4-letter
 * form. Backs {@link canonicalizeByteword}.
 */
const BYTEWORD_FIRST_THREE_MAP: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const word of BYTEWORDS) {
    map.set(word.slice(0, 3), word);
  }
  return map;
})();

/**
 * Lookup from the last 3 letters of a byteword to its full lowercase 4-letter
 * form. Backs {@link canonicalizeByteword}.
 */
const BYTEWORD_LAST_THREE_MAP: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const word of BYTEWORDS) {
    map.set(word.slice(1), word);
  }
  return map;
})();

/**
 * CRC32 lookup table (IEEE polynomial).
 */
const CRC32_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table.push(c >>> 0);
  }
  return table;
})();

/**
 * Calculate CRC32 checksum of data.
 */
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Convert a 32-bit number to 4 bytes (big-endian).
 */
function uint32ToBytes(value: number): Uint8Array {
  return new Uint8Array([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ]);
}

/**
 * Encode data as bytewords with the specified style.
 * Includes CRC32 checksum.
 */
export function encodeBytewords(
  data: Uint8Array,
  style: BytewordsStyle = BytewordsStyle.Minimal,
): string {
  // Append CRC32 checksum
  const checksum = crc32(data);
  const checksumBytes = uint32ToBytes(checksum);
  const dataWithChecksum = new Uint8Array(data.length + 4);
  dataWithChecksum.set(data);
  dataWithChecksum.set(checksumBytes, data.length);

  const words: string[] = [];
  for (const byte of dataWithChecksum) {
    const word = BYTEWORDS[byte];
    if (word === undefined) throw new Error(`Invalid byte value: ${byte}`);

    switch (style) {
      case BytewordsStyle.Standard:
        words.push(word);
        break;
      case BytewordsStyle.Uri:
        words.push(word);
        break;
      case BytewordsStyle.Minimal:
        // First and last character
        words.push(word[0] + word[3]);
        break;
    }
  }

  switch (style) {
    case BytewordsStyle.Standard:
      return words.join(" ");
    case BytewordsStyle.Uri:
      return words.join("-");
    case BytewordsStyle.Minimal:
      return words.join("");
  }
}

/**
 * Returns true if every code unit of `s` is in the ASCII range (0..=127).
 *
 * Mirrors Rust's `str::is_ascii` used at `ur::bytewords::decode` line 105.
 * We test the raw code units (rather than Array.from + codepoint) because
 * any non-BMP character has surrogate pairs both ≥ 0xD800, which already
 * exceed 0x7F.
 */
function isAsciiString(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 0x7f) return false;
  }
  return true;
}

/**
 * Decode bytewords string back to data.
 * Validates and removes CRC32 checksum.
 *
 * Errors mirror the upstream Rust `ur::bytewords::Error` enum
 * (`ur-0.4.1/src/bytewords.rs`):
 * - `NonAscii` — input contains non-ASCII characters (checked first).
 * - `InvalidLength` — minimal-style input has odd length.
 * - `InvalidWord` — a token does not map to a byteword index.
 * - `InvalidChecksum` — the trailing 4-byte CRC32 does not match.
 *
 * All variants are surfaced as {@link BytewordsError} with the same default
 * `Display` strings as Rust (e.g. "invalid checksum", "non-ASCII"), so
 * callers can branch on the error class rather than the bare `Error`
 * thrown by earlier revisions of this port.
 */
export function decodeBytewords(
  encoded: string,
  style: BytewordsStyle = BytewordsStyle.Minimal,
): Uint8Array {
  // Rust rejects non-ASCII input up-front (`bytewords.rs:105-107`).
  if (!isAsciiString(encoded)) {
    throw new BytewordsError("bytewords string contains non-ASCII characters");
  }
  const lowercased = encoded.toLowerCase();
  let bytes: number[];

  switch (style) {
    case BytewordsStyle.Standard: {
      const words = lowercased.split(" ");
      bytes = words.map((word) => {
        const index = BYTEWORDS_MAP.get(word);
        if (index === undefined) {
          throw new BytewordsError("invalid word");
        }
        return index;
      });
      break;
    }
    case BytewordsStyle.Uri: {
      // 4-character words separated by hyphens
      const words = lowercased.split("-");
      bytes = words.map((word) => {
        const index = BYTEWORDS_MAP.get(word);
        if (index === undefined) {
          throw new BytewordsError("invalid word");
        }
        return index;
      });
      break;
    }
    case BytewordsStyle.Minimal: {
      // 2-character minimal words with no separator
      if (lowercased.length % 2 !== 0) {
        throw new BytewordsError("invalid length");
      }
      bytes = [];
      for (let i = 0; i < lowercased.length; i += 2) {
        const minimal = lowercased.slice(i, i + 2);
        const index = MINIMAL_BYTEWORDS_MAP.get(minimal);
        if (index === undefined) {
          throw new BytewordsError("invalid word");
        }
        bytes.push(index);
      }
      break;
    }
  }

  if (bytes.length < 4) {
    throw new BytewordsError("invalid checksum");
  }

  // Extract data and checksum
  const dataWithChecksum = new Uint8Array(bytes);
  const data = dataWithChecksum.slice(0, -4);
  const checksumBytes = dataWithChecksum.slice(-4);

  // Verify checksum
  const expectedChecksum = crc32(data);
  const actualChecksum =
    ((checksumBytes[0] << 24) |
      (checksumBytes[1] << 16) |
      (checksumBytes[2] << 8) |
      checksumBytes[3]) >>>
    0;

  if (expectedChecksum !== actualChecksum) {
    throw new BytewordsError("invalid checksum");
  }

  return data;
}
