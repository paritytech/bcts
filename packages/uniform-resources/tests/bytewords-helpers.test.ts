import { describe, it, expect } from "vitest";
import {
  BYTEWORDS,
  BYTEMOJIS,
  encodeBytewordsIdentifier,
  encodeBytemojisIdentifier,
  encodeToWords,
  encodeToBytemojis,
  encodeToMinimalBytewords,
  isValidBytemoji,
  canonicalizeByteword,
} from "../src";

const bytes = (...xs: number[]) => Uint8Array.from(xs);

describe("encodeToWords", () => {
  it("matches encodeBytewordsIdentifier for the 4-byte case", () => {
    const data = bytes(0, 1, 2, 3);
    expect(encodeToWords(data)).toBe(encodeBytewordsIdentifier(data));
  });

  it("encodes various lengths", () => {
    expect(encodeToWords(bytes(0))).toBe("able");
    expect(encodeToWords(bytes(0, 255))).toBe("able zoom");
    expect(encodeToWords(bytes(0, 1, 2, 3))).toBe("able acid also apex");

    const eight = encodeToWords(bytes(0, 1, 2, 3, 4, 5, 6, 7));
    expect(eight.split(" ")).toHaveLength(8);
  });

  it("returns empty string for empty input", () => {
    expect(encodeToWords(new Uint8Array())).toBe("");
  });

  it("maps all 256 bytes to distinct words", () => {
    const all = new Uint8Array(256);
    for (let i = 0; i < 256; i++) all[i] = i;
    const encoded = encodeToWords(all);
    const words = encoded.split(" ");
    expect(words).toHaveLength(256);
    expect(new Set(words).size).toBe(256);
  });
});

describe("encodeToBytemojis", () => {
  it("matches encodeBytemojisIdentifier for the 4-byte case", () => {
    const data = bytes(0, 1, 2, 3);
    expect(encodeToBytemojis(data)).toBe(encodeBytemojisIdentifier(data));
  });

  it("encodes various lengths", () => {
    expect(encodeToBytemojis(bytes(0))).toBe(BYTEMOJIS[0]);
    const eight = encodeToBytemojis(bytes(0, 1, 2, 3, 4, 5, 6, 7));
    expect(eight.split(" ")).toHaveLength(8);
  });

  it("returns empty string for empty input", () => {
    expect(encodeToBytemojis(new Uint8Array())).toBe("");
  });
});

describe("encodeToMinimalBytewords", () => {
  it("encodes using first+last letter of each byteword with no separator", () => {
    // "able" → "ae", "acid" → "ad", "also" → "ao", "apex" → "ax"
    expect(encodeToMinimalBytewords(bytes(0, 1, 2, 3))).toBe("aeadaoax");
    expect(encodeToMinimalBytewords(bytes(0))).toBe("ae");
    expect(encodeToMinimalBytewords(new Uint8Array())).toBe("");
  });

  it("matches first+last letter of encodeToWords for every single byte", () => {
    for (let b = 0; b < 256; b++) {
      const word = BYTEWORDS[b];
      const minimal = encodeToMinimalBytewords(bytes(b));
      expect(minimal).toBe(word[0] + word[word.length - 1]);
    }
  });
});

describe("isValidBytemoji", () => {
  it("returns true for every entry in BYTEMOJIS", () => {
    for (const e of BYTEMOJIS) {
      expect(isValidBytemoji(e)).toBe(true);
    }
  });

  it("returns false for unknown emojis and plain text", () => {
    expect(isValidBytemoji("")).toBe(false);
    expect(isValidBytemoji("able")).toBe(false);
    expect(isValidBytemoji("🫶🫶")).toBe(false); // two emojis
    expect(isValidBytemoji("🪫")).toBe(false); // not in table
  });
});

describe("canonicalizeByteword", () => {
  it("returns the exact lowercase form for full 4-letter words", () => {
    expect(canonicalizeByteword("able")).toBe("able");
    expect(canonicalizeByteword("ABLE")).toBe("able");
    expect(canonicalizeByteword("Zoom")).toBe("zoom");
  });

  it("returns undefined for 4-letter tokens that are not bytewords", () => {
    expect(canonicalizeByteword("zzzz")).toBeUndefined();
    expect(canonicalizeByteword("hell")).toBeUndefined();
  });

  it("canonicalises 2-letter (first+last) short forms", () => {
    // "able" → "ae", "zoom" → "zm"
    expect(canonicalizeByteword("ae")).toBe("able");
    expect(canonicalizeByteword("AE")).toBe("able");
    expect(canonicalizeByteword("zm")).toBe("zoom");
  });

  it("returns undefined for unknown 2-letter short forms", () => {
    expect(canonicalizeByteword("zz")).toBeUndefined();
  });

  it("canonicalises 3-letter (first 3 or last 3) short forms", () => {
    // "able" → first3 "abl", last3 "ble"
    expect(canonicalizeByteword("abl")).toBe("able");
    expect(canonicalizeByteword("ble")).toBe("able");
    expect(canonicalizeByteword("ABL")).toBe("able");
    expect(canonicalizeByteword("BLE")).toBe("able");
  });

  it("returns undefined for unknown 3-letter tokens", () => {
    expect(canonicalizeByteword("zzz")).toBeUndefined();
  });

  it("returns undefined for empty or out-of-range lengths", () => {
    expect(canonicalizeByteword("")).toBeUndefined();
    expect(canonicalizeByteword("a")).toBeUndefined();
    expect(canonicalizeByteword("abcde")).toBeUndefined();
  });

  it("round-trips every full byteword through itself", () => {
    for (const word of BYTEWORDS) {
      expect(canonicalizeByteword(word)).toBe(word);
      expect(canonicalizeByteword(word.toUpperCase())).toBe(word);
    }
  });
});
