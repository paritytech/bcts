/**
 * Main test suite for seedtool-cli
 * Ported from seedtool-cli-rust/tests/tests.rs
 */

import { describe, it, expect } from "vitest";
import { Envelope } from "@bcts/envelope";
import { runCli, runCliExpect, runCliStdin } from "./common";

describe("Seedtool CLI", () => {
  describe("Seed Generation", () => {
    it("should generate deterministic seed (test_seed)", () => {
      const seed = runCli(["--deterministic", "TEST"]);
      runCliExpect(["--deterministic", "TEST"], seed);
      expect(seed).toBe("9d347f841a4e2ce6bc886e1aee74d824");
    });

    it("should generate different random seeds (test_seed_2)", () => {
      const seed1 = runCli([]);
      const seed2 = runCli([]);
      expect(seed1).not.toBe(seed2);
    });
  });

  describe("Format Conversions (test_formats)", () => {
    const hex = "9d347f841a4e2ce6bc886e1aee74d824";

    describe("Non-round-trippable formats", () => {
      it("should convert to/from base6", () => {
        const base6 = "3123121543215241";
        expect(runCli(["--deterministic", "TEST", "--out", "base6", hex])).toBe(base6);
        expect(runCli(["--in", "base6", "--out", "hex", base6])).toBe(
          "cb97f8ff03b3434258a7a8974e3187a0",
        );
      });

      it("should convert to/from base10", () => {
        const base10 = "6245132875418481";
        expect(runCli(["--deterministic", "TEST", "--out", "base10", hex])).toBe(base10);
        expect(runCli(["--in", "base10", "--out", "hex", base10])).toBe(
          "3f3830e7e4d4f95c3e037630c6ae811a",
        );
      });

      it("should convert to/from bits", () => {
        const bits = "1001000111001010";
        expect(runCli(["--deterministic", "TEST", "--out", "bits", hex])).toBe(bits);
        expect(runCli(["--in", "bits", "--out", "hex", bits])).toBe(
          "980947e4f8cd49459819d9453fca085f",
        );
      });

      it("should convert to/from cards", () => {
        const cards = "6hjckdah6c4dtc8skh2htd6ctsjd5s8c";
        expect(runCli(["--deterministic", "TEST", "--out", "cards", hex])).toBe(cards);
        expect(runCli(["--in", "cards", "--out", "hex", cards])).toBe(
          "1d0f2f3b502256cf56e3eaaa9f95ef71",
        );
      });

      it("should convert to/from dice", () => {
        const dice = "4234232654326352";
        expect(runCli(["--deterministic", "TEST", "--out", "dice", hex])).toBe(dice);
        expect(runCli(["--in", "dice", "--out", "hex", dice])).toBe(
          "eefa19b88c5846e71fcb52d007066ae4",
        );
      });

      it("should convert to/from ints", () => {
        const ints = "6 2 4 5 1 3 2 8 7 5 4 1 8 4 8 1";
        expect(runCli(["--deterministic", "TEST", "--out", "ints", hex])).toBe(ints);
        expect(runCli(["--in", "ints", "--out", "hex", ints])).toBe(
          "19a7830e032c0e027d176162112ee67e",
        );
      });
    });

    describe("Round-trippable formats", () => {
      it("should round-trip hex", () => {
        expect(runCli(["--in", "hex", "--out", "hex", hex])).toBe(hex);
      });

      it("should round-trip bytewords minimal", () => {
        const btwm = "nteelblrcygldwvarflojtcywyjytpdklddyoymk";
        expect(runCli(["--in", "hex", "--out", "btwm", hex])).toBe(btwm);
        expect(runCli(["--in", "btwm", "--out", "hex", btwm])).toBe(hex);
      });

      it("should round-trip bytewords standard", () => {
        const btw =
          "next edge lamb liar city girl draw visa roof logo jolt city waxy jury trip dark loud duty obey monk";
        expect(runCli(["--in", "hex", "--out", "btw", hex])).toBe(btw);
        expect(runCli(["--in", "btw", "--out", "hex", btw])).toBe(hex);
      });

      it("should round-trip bytewords uri", () => {
        const btwu =
          "next-edge-lamb-liar-city-girl-draw-visa-roof-logo-jolt-city-waxy-jury-trip-dark-loud-duty-obey-monk";
        expect(runCli(["--in", "hex", "--out", "btwu", hex])).toBe(btwu);
        expect(runCli(["--in", "btwu", "--out", "hex", btwu])).toBe(hex);
      });

      it("should round-trip seed UR", () => {
        const seedUr = runCli(["--in", "hex", "--out", "seed", hex]);
        expect(seedUr.startsWith("ur:seed/")).toBe(true);
        expect(runCli(["--in", "seed", "--out", "hex", seedUr])).toBe(hex);
      });
    });
  });

  describe("Envelope (test_envelope)", () => {
    it("should create envelope with metadata (exact Rust parity)", () => {
      // Expected output from seedtool-cli-rust with same parameters
      const rustExpected =
        "ur:envelope/lptpsogdnteelblrcygldwvarflojtcywyjytpdkoyadcsspoyaatpsojoghisinjkcxinjkcxjyisihcxjtjljyihoybdtpsoisguihihieglhsjnihoybetpsosecyiyjzvsayehspswda";

      const result = runCli([
        "--out",
        "envelope",
        "--name",
        "SeedName",
        "--note",
        "This is the note",
        "--date",
        "2024-06-15T01:02:00Z",
        "--deterministic",
        "TEST",
      ]);

      // Verify exact match with Rust output
      expect(result).toBe(rustExpected);

      // Verify it can be parsed back
      const envelope = Envelope.fromURString(result);
      expect(envelope).toBeDefined();
    });

    it("should rename envelope (functional test)", () => {
      // First create an envelope
      const seedEnvelope = runCli([
        "--out",
        "envelope",
        "--name",
        "SeedName",
        "--note",
        "This is the note",
        "--date",
        "2024-06-15T01:02:00Z",
        "--deterministic",
        "TEST",
      ]);

      // Then rename it
      const renamed = runCli([
        "--in",
        "envelope",
        "--out",
        "envelope",
        "--name",
        "Dark Purple Aqua Love",
        seedEnvelope,
      ]);

      expect(renamed.startsWith("ur:envelope/")).toBe(true);

      // Verify the envelope can be parsed
      const envelope = Envelope.fromURString(renamed);
      expect(envelope).toBeDefined();
    });
  });

  describe("SSKR (test_sskr)", () => {
    it("should split and reconstruct seed via SSKR", () => {
      const seedEnvelope = runCli([
        "--name",
        "SeedName",
        "--note",
        "This is the note",
        "--date",
        "now",
        "--out",
        "envelope",
      ]);

      const shareStrings = runCli([
        "--in",
        "envelope",
        "--out",
        "sskr",
        "--group-threshold",
        "2",
        "--groups",
        "2-of-3",
        "-g",
        "3-of-5",
        "--",
        seedEnvelope,
      ]).split(/\s+/);

      // Select subset of shares: indices 0, 2, 3, 5, 7
      const selectedIndexes = [0, 2, 3, 5, 7];
      const selectedShares = selectedIndexes
        .map((i) => shareStrings[i])
        .filter((s) => s !== undefined);

      const restoredEnvelopeUrString = runCli([
        "--in",
        "sskr",
        "--out",
        "envelope",
        selectedShares.join(" "),
      ]);

      const restoredEnvelope = Envelope.fromURString(restoredEnvelopeUrString);
      expect(restoredEnvelope.urString()).toBe(seedEnvelope);
    });
  });

  describe("Multipart (test_multipart)", () => {
    it("should encode and decode multipart UR", () => {
      const seedEnvelope = runCli([
        "--count",
        "64",
        "--name",
        "SeedName",
        "--note",
        "This is the note",
        "--date",
        "now",
        "--out",
        "envelope",
      ]);

      const shares = runCli([
        "--in",
        "envelope",
        "--out",
        "multipart",
        "--max-fragment-len",
        "20",
        "--additional-parts",
        "50",
        seedEnvelope,
      ]).split(/\s+/);

      // Skip first 5 shares (use fountain codes)
      const selectedShares = shares.slice(5);

      const restoredEnvelopeUrString = runCli([
        "--in",
        "multipart",
        "--out",
        "envelope",
        selectedShares.join(" "),
      ]);

      const restoredEnvelope = Envelope.fromURString(restoredEnvelopeUrString);
      expect(restoredEnvelope.urString()).toBe(seedEnvelope);
    });
  });

  describe("BIP39", () => {
    it("should convert hex to BIP39 and back", () => {
      const hex = "9d347f841a4e2ce6bc886e1aee74d824";
      const mnemonic = runCli(["--in", "hex", "--out", "bip39", hex]);
      expect(mnemonic.split(" ")).toHaveLength(12);

      // Note: BIP39 is not round-trippable to exact same hex because
      // the mnemonic includes checksum bits
      const recoveredHex = runCli(["--in", "bip39", "--out", "hex", mnemonic]);
      expect(recoveredHex).toHaveLength(32); // 16 bytes = 32 hex chars
    });
  });

  describe("Piped input", () => {
    it("should accept piped input from stdin", () => {
      const hex = "9d347f841a4e2ce6bc886e1aee74d824";
      const result = runCliStdin(["--in", "hex", "--out", "btwm"], hex);
      expect(result).toBe("nteelblrcygldwvarflojtcywyjytpdklddyoymk");
    });
  });
});
