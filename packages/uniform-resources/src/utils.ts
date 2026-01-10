import { InvalidTypeError } from "./error.js";

/**
 * Checks if a character is a valid UR type character.
 * Valid characters are lowercase letters, digits, and hyphens.
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
 * Valid UR types contain only lowercase letters, digits, and hyphens.
 */
export function isValidURType(urType: string): boolean {
  if (urType.length === 0) return false;
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
 * Encodes a 4-byte slice as a string of bytewords for identification.
 */
export function encodeBytewordsIdentifier(data: Uint8Array): string {
  if (data.length !== 4) {
    throw new Error("Identifier data must be exactly 4 bytes");
  }
  const words: string[] = [];
  for (let i = 0; i < 4; i++) {
    const byte = data[i];
    if (byte === undefined) throw new Error("Invalid byte");
    const word = BYTEWORDS[byte];
    if (word === "" || word === undefined) throw new Error("Invalid byteword mapping");
    words.push(word);
  }
  return words.join(" ");
}

/**
 * Encodes a 4-byte slice as a string of bytemojis for identification.
 */
export function encodeBytemojisIdentifier(data: Uint8Array): string {
  if (data.length !== 4) {
    throw new Error("Identifier data must be exactly 4 bytes");
  }
  const emojis: string[] = [];
  for (let i = 0; i < 4; i++) {
    const byte = data[i];
    if (byte === undefined) throw new Error("Invalid byte");
    const emoji = BYTEMOJIS[byte];
    if (emoji === "" || emoji === undefined) throw new Error("Invalid bytemoji mapping");
    emojis.push(emoji);
  }
  return emojis.join(" ");
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
 * Decode bytewords string back to data.
 * Validates and removes CRC32 checksum.
 */
export function decodeBytewords(
  encoded: string,
  style: BytewordsStyle = BytewordsStyle.Minimal,
): Uint8Array {
  const lowercased = encoded.toLowerCase();
  let bytes: number[];

  switch (style) {
    case BytewordsStyle.Standard: {
      const words = lowercased.split(" ");
      bytes = words.map((word) => {
        const index = BYTEWORDS_MAP.get(word);
        if (index === undefined) {
          throw new Error(`Invalid byteword: ${word}`);
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
          throw new Error(`Invalid byteword: ${word}`);
        }
        return index;
      });
      break;
    }
    case BytewordsStyle.Minimal: {
      // 2-character minimal words with no separator
      if (lowercased.length % 2 !== 0) {
        throw new Error("Invalid minimal bytewords length");
      }
      bytes = [];
      for (let i = 0; i < lowercased.length; i += 2) {
        const minimal = lowercased.slice(i, i + 2);
        const index = MINIMAL_BYTEWORDS_MAP.get(minimal);
        if (index === undefined) {
          throw new Error(`Invalid minimal byteword: ${minimal}`);
        }
        bytes.push(index);
      }
      break;
    }
  }

  if (bytes.length < 4) {
    throw new Error("Bytewords data too short (missing checksum)");
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
    throw new Error(
      `Bytewords checksum mismatch: expected ${expectedChecksum.toString(16)}, got ${actualChecksum.toString(16)}`,
    );
  }

  return data;
}
