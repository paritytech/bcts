import { cbor } from "@bcts/dcbor";
import { ProvenanceMark, ProvenanceMarkGenerator, ProvenanceMarkResolution } from "../src";

// =============================================================================
// Test Vectors from Rust provenance-mark-rust/tests/mark.rs
// =============================================================================

// Expected display strings for low resolution marks
const EXPECTED_DISPLAY_LOW = [
  "ProvenanceMark(5bdcec81)",
  "ProvenanceMark(477e3ce6)",
  "ProvenanceMark(3e5da986)",
  "ProvenanceMark(41c525a1)",
  "ProvenanceMark(8095afb4)",
  "ProvenanceMark(3bcacc8d)",
  "ProvenanceMark(41486af2)",
  "ProvenanceMark(5fa35da9)",
  "ProvenanceMark(e369288f)",
  "ProvenanceMark(7ce8f8bc)",
];

// Expected bytewords for low resolution marks
const EXPECTED_BYTEWORDS_LOW = [
  "axis bald whiz yoga rich join body jazz yurt wall monk fact urge cola exam arch kick fuel omit echo",
  "gyro lung runs skew flew yank yawn lung king sets luau idle draw aunt knob high jazz veto cola road",
  "guru jade diet iris gift zoom slot list omit ruby visa noon dark vibe road stub tied waxy race huts",
  "keep rock fuel taxi jugs fish fair fish help dull hope rust claw next urge zoom monk fern maze diet",
  "limp task jury jolt vows surf cost silk yoga king huts claw vibe mint yell quiz zinc wall join cost",
  "song deli flap blue work zone jump item heat stub mint kick gems vows love rock iris undo legs yell",
  "urge high ruby vibe fish jolt iced diet safe lion webs stub exam user work part wave fish back logo",
  "bias edge very ramp free surf wasp void hawk door also zoom gray down wall tent holy waxy leaf mint",
  "gray exam draw oboe unit yawn surf junk curl eyes keno belt crux navy need cats ruby noon yell noon",
  "play skew peck idle tent many song vibe open urge slot plus bulb free dice able keno buzz girl gear",
];

// Expected bytewords identifiers for low resolution marks
const EXPECTED_ID_WORDS_LOW = [
  "HELP UNDO WASP LAZY",
  "FUEL KNOB FERN VISA",
  "FILM HILL PART LION",
  "FLAP SILK DATA OBEY",
  "LAVA MILD POSE QUIZ",
  "FAIR SONG SURF LUNG",
  "FLAP FUND ITEM WHIZ",
  "HOPE OMIT HILL PART",
  "VIAL IRON DICE MANY",
  "KITE VOWS YOGA ROOF",
];

// Expected bytemoji identifiers for low resolution marks
const EXPECTED_BYTEMOJI_IDS_LOW = [
  "🌮 🐰 🦄 💔",
  "🍍 🪐 🦶 🐵",
  "🍊 🍱 🧮 🚩",
  "🍉 🔥 👽 🪑",
  "💛 🚀 📡 🎁",
  "🤚 🩳 👔 🛑",
  "🍉 🥝 🍄 🐢",
  "🍤 💌 🍱 🧮",
  "🐮 🍁 😻 🚗",
  "💫 🐥 🪼 🏆",
];

// Expected UR strings for low resolution marks
const EXPECTED_URS_LOW = [
  "ur:provenance/lfaegdasbdwzyarhjnbyjzytwlmkftuecaemahwmfgaxcl",
  "ur:provenance/lfaegdgolgrsswfwykynlgkgssluiedwatkbhhzevlrypd",
  "ur:provenance/lfaegdgujedtisgtzmstltotryvanndkverdsbfzwsbzjk",
  "ur:provenance/lfaegdkprkfltijsfhfrfhhpdlhertcwntuezmbkfsehfr",
  "ur:provenance/lfaegdlptkjyjtvssfctskyakghscwvemtylqzjlvssnbt",
  "ur:provenance/lfaegdsgdifpbewkzejpimhtsbmtkkgsvslerkzsutcnvw",
  "ur:provenance/lfaegduehhryvefhjtiddtselnwssbemurwkptlbfmpkny",
  "ur:provenance/lfaegdbseevyrpfesfwpvdhkdraozmgydnwlttsfwscplr",
  "ur:provenance/lfaegdgyemdwoeutynsfjkcleskobtcxnyndcsdlnehglk",
  "ur:provenance/lfaegdpyswpkiettmysgveonuestpsbbfedeaevebbwyhk",
];

// Expected URLs for low resolution marks
const EXPECTED_URLS_LOW = [
  "https://example.com/validate?provenance=tngdgmgwhflfaegdasbdwzyarhjnbyjzytwlmkftuecaemahdpbswmkb",
  "https://example.com/validate?provenance=tngdgmgwhflfaegdgolgrsswfwykynlgkgssluiedwatkbhhetpkgoyl",
  "https://example.com/validate?provenance=tngdgmgwhflfaegdgujedtisgtzmstltotryvanndkverdsblnolzcdw",
  "https://example.com/validate?provenance=tngdgmgwhflfaegdkprkfltijsfhfrfhhpdlhertcwntuezmsfjytaie",
  "https://example.com/validate?provenance=tngdgmgwhflfaegdlptkjyjtvssfctskyakghscwvemtylqzptoydagm",
  "https://example.com/validate?provenance=tngdgmgwhflfaegdsgdifpbewkzejpimhtsbmtkkgsvslerkfnmwsbrd",
  "https://example.com/validate?provenance=tngdgmgwhflfaegduehhryvefhjtiddtselnwssbemurwkptrhktfwsk",
  "https://example.com/validate?provenance=tngdgmgwhflfaegdbseevyrpfesfwpvdhkdraozmgydnwlttbkolsguy",
  "https://example.com/validate?provenance=tngdgmgwhflfaegdgyemdwoeutynsfjkcleskobtcxnyndcswltbrste",
  "https://example.com/validate?provenance=tngdgmgwhflfaegdpyswpkiettmysgveonuestpsbbfedeaecphlamam",
];

// Expected display strings for low resolution marks with info
const EXPECTED_DISPLAY_LOW_WITH_INFO = [
  "ProvenanceMark(baee34c2)",
  "ProvenanceMark(7b80837c)",
  "ProvenanceMark(548fecfb)",
  "ProvenanceMark(f3365320)",
  "ProvenanceMark(bd61dc41)",
  "ProvenanceMark(e7d3f969)",
  "ProvenanceMark(4921b6e9)",
  "ProvenanceMark(f3d069fd)",
  "ProvenanceMark(bc4ca470)",
  "ProvenanceMark(5e798c9a)",
];

describe("ProvenanceMark", () => {
  describe("Low resolution", () => {
    it("should generate expected marks with passphrase 'Wolf'", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      const dates = Array.from(
        { length: 10 },
        (_, i) => new Date(Date.UTC(2023, 5, 20 + i, 0, 0, 0, 0)),
      );

      let currentGenerator = generator;
      const marks: ProvenanceMark[] = [];

      for (const date of dates) {
        // Serialize and deserialize generator to test persistence
        const json = JSON.stringify(currentGenerator.toJSON());
        currentGenerator = ProvenanceMarkGenerator.fromJSON(JSON.parse(json));

        const mark = currentGenerator.next(date);
        marks.push(mark);
      }

      // Test expected identifiers
      const expectedIds = [
        "5bdcec81",
        "477e3ce6",
        "3e5da986",
        "41c525a1",
        "8095afb4",
        "3bcacc8d",
        "41486af2",
        "5fa35da9",
        "e369288f",
        "7ce8f8bc",
      ];

      expect(marks.map((m) => m.identifier())).toEqual(expectedIds);

      // Verify sequence is valid
      expect(ProvenanceMark.isSequenceValid(marks)).toBe(true);

      // Verify marks don't work in reverse
      expect(marks[1].precedes(marks[0])).toBe(false);
    });

    it("should serialize and deserialize via bytewords", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      const date = new Date(Date.UTC(2023, 5, 20, 0, 0, 0, 0));
      const mark = generator.next(date);

      const bytewords = mark.toBytewords();
      const restored = ProvenanceMark.fromBytewords(ProvenanceMarkResolution.Low, bytewords);

      expect(mark.equals(restored)).toBe(true);
    });

    it("should serialize and deserialize via CBOR", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      const date = new Date(Date.UTC(2023, 5, 20, 0, 0, 0, 0));
      const mark = generator.next(date);

      const cborData = mark.toCborData();
      const restored = ProvenanceMark.fromCborData(cborData);

      expect(mark.equals(restored)).toBe(true);
    });

    it("should serialize and deserialize via URL encoding", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      const date = new Date(Date.UTC(2023, 5, 20, 0, 0, 0, 0));
      const mark = generator.next(date);

      const urlEncoding = mark.toUrlEncoding();
      const restored = ProvenanceMark.fromUrlEncoding(urlEncoding);

      expect(mark.equals(restored)).toBe(true);
    });

    it("should build and parse URLs", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      const date = new Date(Date.UTC(2023, 5, 20, 0, 0, 0, 0));
      const mark = generator.next(date);

      const url = mark.toUrl("https://example.com/validate");
      const restored = ProvenanceMark.fromUrl(url);

      expect(mark.equals(restored)).toBe(true);
    });
  });

  describe("Medium resolution", () => {
    it("should generate expected marks", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Medium,
        "Wolf",
      );

      const date = new Date(Date.UTC(2023, 5, 20, 12, 0, 0, 0));
      const mark = generator.next(date);

      // Medium resolution has 8-byte links
      expect(mark.key().length).toBe(8);
      expect(mark.hash().length).toBe(8);
      expect(mark.chainId().length).toBe(8);
    });
  });

  describe("Quartile resolution", () => {
    it("should generate expected marks", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Quartile,
        "Wolf",
      );

      const date = new Date(Date.UTC(2023, 5, 20, 12, 0, 0, 0));
      const mark = generator.next(date);

      // Quartile resolution has 16-byte links
      expect(mark.key().length).toBe(16);
      expect(mark.hash().length).toBe(16);
      expect(mark.chainId().length).toBe(16);
    });
  });

  describe("High resolution", () => {
    it("should generate expected marks", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.High,
        "Wolf",
      );

      const date = new Date(Date.UTC(2023, 5, 20, 12, 0, 0, 0));
      const mark = generator.next(date);

      // High resolution has 32-byte links
      expect(mark.key().length).toBe(32);
      expect(mark.hash().length).toBe(32);
      expect(mark.chainId().length).toBe(32);
    });
  });

  describe("Genesis mark", () => {
    it("should correctly identify genesis marks", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      const date = new Date(Date.UTC(2023, 5, 20, 0, 0, 0, 0));
      const genesisMark = generator.next(date);

      expect(genesisMark.isGenesis()).toBe(true);
      expect(genesisMark.seq()).toBe(0);

      // Key should equal chain ID for genesis mark
      expect(genesisMark.key()).toEqual(genesisMark.chainId());

      // Second mark should not be genesis
      const secondMark = generator.next(new Date(Date.UTC(2023, 5, 21)));
      expect(secondMark.isGenesis()).toBe(false);
      expect(secondMark.seq()).toBe(1);
    });
  });

  describe("JSON serialization", () => {
    it("should serialize and deserialize via JSON", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      const date = new Date(Date.UTC(2023, 5, 20, 0, 0, 0, 0));
      const mark = generator.next(date);

      const json = mark.toJSON();
      const restored = ProvenanceMark.fromJSON(json);

      expect(mark.identifier()).toEqual(restored.identifier());
      expect(mark.seq()).toEqual(restored.seq());
    });
  });

  // ===========================================================================
  // Rust Parity Tests (test vectors from mark.rs)
  // ===========================================================================

  describe("test_low (Rust parity)", () => {
    it("should match Rust expected display strings", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date));
      }

      // Verify display strings
      expect(marks.map((m) => m.toString())).toEqual(EXPECTED_DISPLAY_LOW);
    });

    it("should match Rust expected bytewords", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date));
      }

      // Verify bytewords encoding
      expect(marks.map((m) => m.toBytewords())).toEqual(EXPECTED_BYTEWORDS_LOW);

      // Verify roundtrip
      for (let i = 0; i < marks.length; i++) {
        const restored = ProvenanceMark.fromBytewords(
          ProvenanceMarkResolution.Low,
          EXPECTED_BYTEWORDS_LOW[i],
        );
        expect(marks[i].equals(restored)).toBe(true);
      }
    });

    it("should match Rust expected bytewords identifiers", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date));
      }

      // Verify bytewords identifiers
      expect(marks.map((m) => m.bytewordsIdentifier(false))).toEqual(EXPECTED_ID_WORDS_LOW);
    });

    it("should match Rust expected bytemoji identifiers", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date));
      }

      // Verify bytemoji identifiers
      expect(marks.map((m) => m.bytemojiIdentifier(false))).toEqual(EXPECTED_BYTEMOJI_IDS_LOW);
    });

    it("should match Rust expected UR strings", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date));
      }

      // Verify UR strings
      expect(marks.map((m) => m.urString())).toEqual(EXPECTED_URS_LOW);

      // Verify roundtrip
      for (let i = 0; i < marks.length; i++) {
        const restored = ProvenanceMark.fromURString(EXPECTED_URS_LOW[i]);
        expect(marks[i].equals(restored)).toBe(true);
      }
    });

    it("should match Rust expected URLs", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date));
      }

      const baseUrl = "https://example.com/validate";

      // Verify URLs (toUrl returns URL object, convert to string for comparison)
      expect(marks.map((m) => m.toUrl(baseUrl).toString())).toEqual(EXPECTED_URLS_LOW);

      // Verify roundtrip
      for (let i = 0; i < marks.length; i++) {
        const restored = ProvenanceMark.fromUrl(new URL(EXPECTED_URLS_LOW[i]));
        expect(marks[i].equals(restored)).toBe(true);
      }
    });
  });

  describe("test_low_with_info (Rust parity)", () => {
    it("should match Rust expected display strings with info", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date, cbor("Lorem ipsum sit dolor amet.")));
      }

      // Verify display strings
      expect(marks.map((m) => m.toString())).toEqual(EXPECTED_DISPLAY_LOW_WITH_INFO);

      // Verify sequence is valid
      expect(ProvenanceMark.isSequenceValid(marks)).toBe(true);
    });
  });

  describe("Seed serialization (Rust parity)", () => {
    it("should serialize and deserialize seed via JSON", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      // Serialize generator state
      const json = JSON.stringify(generator.toJSON());

      // Deserialize
      const restored = ProvenanceMarkGenerator.fromJSON(JSON.parse(json));

      // Generate a mark from each and compare
      const date = new Date(Date.UTC(2023, 5, 20, 12, 0, 0, 0));
      const mark1 = generator.next(date);
      const mark2 = restored.next(date);

      expect(mark1.identifier()).toEqual(mark2.identifier());
    });
  });
});
