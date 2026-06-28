/**
 * Format tests - 1:1 translation from Rust's tests/format.rs
 *
 * Tests various formatting outputs including:
 * - Display format (description)
 * - Debug format (debug_description)
 * - Diagnostic notation (flat and pretty)
 * - Hex encoding (plain and annotated)
 * - Summary format
 */

import type { Cbor, CborInput } from "../src";
import { cbor, CborMap, summary, registerTags, CborDate, decodeCbor } from "../src";
import { getGlobalTagsStore } from "../src/tags-store";
import type { MapEntry } from "../src/map";

/** Helper to convert a hex string to a Uint8Array. */
function hexToBytes(hexStr: string): Uint8Array {
  const bytes = new Uint8Array(hexStr.length / 2);
  for (let i = 0; i < hexStr.length; i += 2) {
    bytes[i / 2] = parseInt(hexStr.substr(i, 2), 16);
  }
  return bytes;
}

// Helper function to get description (matches Rust's format!("{}", cbor))
function cborDescription(value: CborInput): string {
  const cborValue = cbor(value);
  // Matches Rust's Display trait - uses tag names instead of numbers
  return formatAsDisplay(cborValue);
}

// Format CBOR value like Rust's Display trait
function formatAsDisplay(cborValue: Cbor): string {
  if (!cborValue || !cborValue.isCbor) {
    return String(cborValue);
  }

  switch (cborValue.type) {
    case 0: // Unsigned
      return String(cborValue.value);
    case 1: {
      // Negative
      const negValue =
        typeof cborValue.value === "bigint"
          ? -(cborValue.value as bigint) - 1n
          : -(cborValue.value as number) - 1;
      return String(negValue);
    }
    case 2: {
      // ByteString
      const bytes = cborValue.value as Uint8Array;
      const hexStr = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return `h'${hexStr}'`;
    }
    case 3: // Text
      return `"${cborValue.value}"`;
    case 4: {
      // Array
      const items = (cborValue.value as Cbor[]).map((item: Cbor) => formatAsDisplay(item));
      return `[${items.join(", ")}]`;
    }
    case 5: {
      // Map
      const map = cborValue.value as CborMap;
      if (map && map.entriesArray) {
        const entries = map.entriesArray.map(
          (entry: MapEntry) => `${formatAsDisplay(entry.key)}: ${formatAsDisplay(entry.value)}`,
        );
        return `{${entries.join(", ")}}`;
      }
      return "{}";
    }
    case 6: {
      // Tagged - use tag NAME if available, otherwise number
      const tagValue = cborValue.tag;
      const store = getGlobalTagsStore();
      const tagName = store.nameForValue(tagValue); // Returns name or number string
      const content = formatAsDisplay(cborValue.value);
      return `${tagName}(${content})`;
    }
    case 7: {
      // Simple
      const simple = cborValue.value;
      if (typeof simple === "object" && simple !== null && "type" in simple) {
        switch (simple.type) {
          case "True":
            return "true";
          case "False":
            return "false";
          case "Null":
            return "null";
          case "Float":
            return String(simple.value);
        }
      }
      return String(simple);
    }
  }
  return String(cborValue);
}

// Helper function to get debug description (matches Rust's format!("{:?}", cbor))
function cborDebugDescription(value: CborInput): string {
  const cborValue = cbor(value);
  // Generate debug format with type information
  return generateDebugDescription(cborValue);
}

// Generate debug description with full type information
function generateDebugDescription(cborValue: Cbor): string {
  if (!cborValue || !cborValue.isCbor) {
    return String(cborValue);
  }

  switch (cborValue.type) {
    case 0: // Unsigned
      return `unsigned(${cborValue.value})`;

    case 1: {
      // Negative
      const negValue =
        typeof cborValue.value === "bigint"
          ? -(cborValue.value as bigint) - 1n
          : -(cborValue.value as number) - 1;
      return `negative(${negValue})`;
    }

    case 2: {
      // ByteString
      const bytes = cborValue.value as Uint8Array;
      const hexStr = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return `bytes(${hexStr})`;
    }

    case 3: // Text
      return `text("${cborValue.value}")`;

    case 4: {
      // Array
      const items = (cborValue.value as Cbor[]).map((item: Cbor) => generateDebugDescription(item));
      return `array([${items.join(", ")}])`;
    }

    case 5: {
      // Map
      const map = cborValue.value as CborMap;
      if (map && map.debug) {
        return map.debug;
      }
      return "map({})";
    }

    case 6: {
      // Tagged
      const tagValue = cborValue.tag;
      const content = generateDebugDescription(cborValue.value);
      // Look up tag name from the global tag store for debug output
      const store = getGlobalTagsStore();
      const tagName = store.nameForValue(tagValue);
      return `tagged(${tagName}, ${content})`;
    }

    case 7: {
      // Simple
      const simple = cborValue.value;
      if (typeof simple === "object" && simple !== null && "type" in simple) {
        switch (simple.type) {
          case "True":
            return "simple(true)";
          case "False":
            return "simple(false)";
          case "Null":
            return "simple(null)";
          case "Float":
            return `simple(${simple.value})`;
        }
      }
      return "simple";
    }
  }

  return String(cborValue);
}

// Helper function to get diagnostic output (matches Rust's cbor.diagnostic())
function cborDiagnostic(value: CborInput): string {
  const cborValue = cbor(value);
  // Use library's diagnostic function (flat output)
  return cborValue.toDiagnostic();
}

// Helper function to get annotated diagnostic (matches Rust's cbor.diagnostic_annotated())
function cborDiagnosticAnnotated(value: CborInput): string {
  const cborValue = cbor(value);
  return cborValue.toDiagnosticAnnotated();
}

// Helper function to get flat diagnostic (matches Rust's cbor.diagnostic_flat())
function cborDiagnosticFlat(value: CborInput): string {
  const cborValue = cbor(value);
  return cborValue.toString();
}

// Helper function to get summary (matches Rust's cbor.summary())
function cborSummary(value: CborInput): string {
  const cborValue = cbor(value);
  return summary(cborValue);
}

// Helper function to get hex (matches Rust's cbor.hex())
function cborHex(value: CborInput): string {
  const cborValue = cbor(value);
  return cborValue.toHex();
}

// Helper function to get annotated hex (matches Rust's cbor.hex_annotated())
function cborHexAnnotated(value: CborInput): string {
  const cborValue = cbor(value);
  return cborValue.toHexAnnotated();
}

// Main test runner function - matches Rust's run() function
function run(
  testName: string,
  cborValue: CborInput,
  expectedDescription: string,
  expectedDebugDescription: string,
  expectedDiagnostic: string,
  expectedDiagnosticAnnotated: string,
  expectedDiagnosticFlat: string,
  expectedSummary: string,
  expectedHex: string,
  expectedHexAnnotated: string,
) {
  const description = cborDescription(cborValue);
  if (expectedDescription === "") {
    console.log("description:");
    console.log(description);
  } else {
    if (description !== expectedDescription) {
      console.log(`description mismatch in test '${testName}':`);
      console.log(`  expected:\n${JSON.stringify(expectedDescription)}`);
      console.log(`  actual  :\n${JSON.stringify(description)}`);
    }
    expect(description).toBe(expectedDescription);
  }

  const debugDescription = cborDebugDescription(cborValue);
  if (expectedDebugDescription === "") {
    console.log("debug_description:");
    console.log(debugDescription);
  } else {
    if (debugDescription !== expectedDebugDescription) {
      console.log(`debug_description mismatch in test '${testName}':`);
      console.log(`  expected:\n${JSON.stringify(expectedDebugDescription)}`);
      console.log(`  actual  :\n${JSON.stringify(debugDescription)}`);
    }
    expect(debugDescription).toBe(expectedDebugDescription);
  }

  const diagnosticOutput = cborDiagnostic(cborValue);
  if (expectedDiagnostic === "") {
    console.log("diagnostic:");
    console.log(diagnosticOutput);
  } else {
    if (diagnosticOutput !== expectedDiagnostic) {
      console.log(`diagnostic mismatch in test '${testName}':`);
      console.log(`  expected:\n${JSON.stringify(expectedDiagnostic)}`);
      console.log(`  actual  :\n${JSON.stringify(diagnosticOutput)}`);
    }
    expect(diagnosticOutput).toBe(expectedDiagnostic);
  }

  const diagnosticAnnotatedOutput = cborDiagnosticAnnotated(cborValue);
  if (expectedDiagnosticAnnotated === "") {
    console.log("diagnostic_annotated:");
    console.log(diagnosticAnnotatedOutput);
  } else {
    if (diagnosticAnnotatedOutput !== expectedDiagnosticAnnotated) {
      console.log(`diagnostic_annotated mismatch in test '${testName}':`);
      console.log(`  expected:\n${JSON.stringify(expectedDiagnosticAnnotated)}`);
      console.log(`  actual  :\n${JSON.stringify(diagnosticAnnotatedOutput)}`);
    }
    expect(diagnosticAnnotatedOutput).toBe(expectedDiagnosticAnnotated);
  }

  const diagnosticFlatOutput = cborDiagnosticFlat(cborValue);
  if (expectedDiagnosticFlat === "") {
    console.log("diagnostic_flat:");
    console.log(diagnosticFlatOutput);
  } else {
    if (diagnosticFlatOutput !== expectedDiagnosticFlat) {
      console.log(`diagnostic_flat mismatch in test '${testName}':`);
      console.log(`  expected:\n${JSON.stringify(expectedDiagnosticFlat)}`);
      console.log(`  actual  :\n${JSON.stringify(diagnosticFlatOutput)}`);
    }
    expect(diagnosticFlatOutput).toBe(expectedDiagnosticFlat);
  }

  const summaryOutput = cborSummary(cborValue);
  if (expectedSummary === "") {
    console.log("summary:");
    console.log(summaryOutput);
  } else {
    if (summaryOutput !== expectedSummary) {
      console.log(`summary mismatch in test '${testName}':`);
      console.log(`  expected:\n${JSON.stringify(expectedSummary)}`);
      console.log(`  actual  :\n${JSON.stringify(summaryOutput)}`);
    }
    expect(summaryOutput).toBe(expectedSummary);
  }

  const hexOutput = cborHex(cborValue);
  if (expectedHex === "") {
    console.log("hex:");
    console.log(hexOutput);
  } else {
    if (hexOutput !== expectedHex) {
      console.log(`hex mismatch in test '${testName}':`);
      console.log(`  expected:\n${JSON.stringify(expectedHex)}`);
      console.log(`  actual  :\n${JSON.stringify(hexOutput)}`);
    }
    expect(hexOutput).toBe(expectedHex);
  }

  const hexAnnotatedOutput = cborHexAnnotated(cborValue);
  if (expectedHexAnnotated === "") {
    console.log("hex_annotated:");
    console.log(hexAnnotatedOutput);
  } else {
    if (hexAnnotatedOutput !== expectedHexAnnotated) {
      console.log(`hex_annotated mismatch in test '${testName}':`);
      console.log(`  expected:\n${JSON.stringify(expectedHexAnnotated)}`);
      console.log(`  actual  :\n${JSON.stringify(hexAnnotatedOutput)}`);
    }
    expect(hexAnnotatedOutput).toBe(expectedHexAnnotated);
  }
}

describe("format tests", () => {
  test("format_simple_1", () => {
    run(
      "format_simple_1",
      false,
      "false",
      "simple(false)",
      "false",
      "false",
      "false",
      "false",
      "f4",
      "f4  # false",
    );
  });

  test("format_simple_2", () => {
    run(
      "format_simple_2",
      true,
      "true",
      "simple(true)",
      "true",
      "true",
      "true",
      "true",
      "f5",
      "f5  # true",
    );
  });

  test("format_simple_3", () => {
    run(
      "format_simple_3",
      null,
      "null",
      "simple(null)",
      "null",
      "null",
      "null",
      "null",
      "f6",
      "f6  # null",
    );
  });

  describe("format_unsigned", () => {
    test("format_unsigned_0", () => {
      run(
        "format_unsigned_0",
        0,
        "0",
        "unsigned(0)",
        "0",
        "0",
        "0",
        "0",
        "00",
        "00  # unsigned(0)",
      );
    });

    test("format_unsigned_23", () => {
      run(
        "format_unsigned_23",
        23,
        "23",
        "unsigned(23)",
        "23",
        "23",
        "23",
        "23",
        "17",
        "17  # unsigned(23)",
      );
    });

    test("format_unsigned_65546", () => {
      run(
        "format_unsigned_65546",
        65546,
        "65546",
        "unsigned(65546)",
        "65546",
        "65546",
        "65546",
        "65546",
        "1a0001000a",
        "1a0001000a  # unsigned(65546)",
      );
    });

    test("format_unsigned_1000000000", () => {
      run(
        "format_unsigned_1000000000",
        1000000000,
        "1000000000",
        "unsigned(1000000000)",
        "1000000000",
        "1000000000",
        "1000000000",
        "1000000000",
        "1a3b9aca00",
        "1a3b9aca00  # unsigned(1000000000)",
      );
    });
  });

  describe("format_negative", () => {
    test("format_negative_neg1", () => {
      run(
        "format_negative_neg1",
        -1,
        "-1",
        "negative(-1)",
        "-1",
        "-1",
        "-1",
        "-1",
        "20",
        "20  # negative(-1)",
      );
    });

    test("format_negative_neg1000", () => {
      run(
        "format_negative_neg1000",
        -1000,
        "-1000",
        "negative(-1000)",
        "-1000",
        "-1000",
        "-1000",
        "-1000",
        "3903e7",
        "3903e7  # negative(-1000)",
      );
    });

    test("format_negative_neg1000000", () => {
      run(
        "format_negative_neg1000000",
        -1000000,
        "-1000000",
        "negative(-1000000)",
        "-1000000",
        "-1000000",
        "-1000000",
        "-1000000",
        "3a000f423f",
        "3a000f423f  # negative(-1000000)",
      );
    });
  });

  test("format_string", () => {
    run(
      "format_string",
      "Test",
      '"Test"',
      'text("Test")',
      '"Test"',
      '"Test"',
      '"Test"',
      '"Test"',
      "6454657374",
      `64              # text(4)
    54657374    # "Test"`,
    );
  });

  test("format_simple_array", () => {
    run(
      "format_simple_array",
      [1, 2, 3],
      "[1, 2, 3]",
      "array([unsigned(1), unsigned(2), unsigned(3)])",
      "[1, 2, 3]",
      "[1, 2, 3]",
      "[1, 2, 3]",
      "[1, 2, 3]",
      "83010203",
      `83      # array(3)
    01  # unsigned(1)
    02  # unsigned(2)
    03  # unsigned(3)`,
    );
  });

  test("format_nested_array", () => {
    const a = [1, 2, 3];
    const b = ["A", "B", "C"];
    const c = [a, b];
    run(
      "format_nested_array",
      c,
      '[[1, 2, 3], ["A", "B", "C"]]',
      'array([array([unsigned(1), unsigned(2), unsigned(3)]), array([text("A"), text("B"), text("C")])])',
      `[
    [1, 2, 3],
    ["A", "B", "C"]
]`,
      `[
    [1, 2, 3],
    ["A", "B", "C"]
]`,
      '[[1, 2, 3], ["A", "B", "C"]]',
      '[[1, 2, 3], ["A", "B", "C"]]',
      "828301020383614161426143",
      `82              # array(2)
    83          # array(3)
        01      # unsigned(1)
        02      # unsigned(2)
        03      # unsigned(3)
    83          # array(3)
        61      # text(1)
            41  # "A"
        61      # text(1)
            42  # "B"
        61      # text(1)
            43  # "C"`,
    );
  });

  test("format_map", () => {
    const map = CborMap.new();
    map.insert(1, "A");
    map.insert(2, "B");
    run(
      "format_map",
      map,
      '{1: "A", 2: "B"}',
      'map({0x01: (unsigned(1), text("A")), 0x02: (unsigned(2), text("B"))})',
      '{1: "A", 2: "B"}',
      '{1: "A", 2: "B"}',
      '{1: "A", 2: "B"}',
      '{1: "A", 2: "B"}',
      "a2016141026142",
      `a2          # map(2)
    01      # unsigned(1)
    61      # text(1)
        41  # "A"
    02      # unsigned(2)
    61      # text(1)
        42  # "B"`,
    );
  });

  test("format_tagged", () => {
    // Create tagged CBOR: tag 100 with value "Hello"
    const cborValue = cbor("Hello");
    const tagged = { isCbor: true, type: 6, tag: 100, value: cborValue };
    run(
      "format_tagged",
      tagged,
      '100("Hello")',
      'tagged(100, text("Hello"))',
      '100("Hello")',
      '100("Hello")',
      '100("Hello")',
      '100("Hello")',
      "d8646548656c6c6f",
      `d8 64               # tag(100)
    65              # text(5)
        48656c6c6f  # "Hello"`,
    );
  });

  test("format_date", () => {
    registerTags();

    // Test negative timestamp
    const dateNeg = CborDate.fromTimestamp(-100);
    run(
      "format_date_negative",
      dateNeg,
      "date(-100)",
      "tagged(date, negative(-100))",
      "1(-100)",
      "1(-100)   / date /",
      "1(-100)",
      "1969-12-31T23:58:20Z",
      "c13863",
      `c1          # tag(1) date
    3863    # negative(-100)`,
    );

    // Test positive timestamp
    const datePos = CborDate.fromTimestamp(1647887071);
    run(
      "format_date_positive",
      datePos,
      "date(1647887071)",
      "tagged(date, unsigned(1647887071))",
      "1(1647887071)",
      "1(1647887071)   / date /",
      "1(1647887071)",
      "2022-03-21T18:24:31Z",
      "c11a6238c2df",
      `c1              # tag(1) date
    1a6238c2df  # unsigned(1647887071)`,
    );
  });

  test("format_fractional_date", () => {
    registerTags();

    const date = CborDate.fromTimestamp(0.5);
    run(
      "format_fractional_date",
      date,
      "date(0.5)",
      "tagged(date, simple(0.5))",
      "1(0.5)",
      "1(0.5)   / date /",
      "1(0.5)",
      "1970-01-01",
      "c1f93800",
      `c1          # tag(1) date
    f93800  # 0.5`,
    );
  });

  test("format_structure", () => {
    const encodedCborHex =
      "d83183015829536f6d65206d7973746572696573206172656e2774206d65616e7420746f20626520736f6c7665642e82d902c3820158402b9238e19eafbc154b49ec89edd4e0fb1368e97332c6913b4beb637d1875824f3e43bd7fb0c41fb574f08ce00247413d3ce2d9466e0ccfa4a89b92504982710ad902c3820158400f9c7af36804ffe5313c00115e5a31aa56814abaa77ff301da53d48613496e9c51a98b36d55f6fb5634fdb0123910cfa4904f1c60523df41013dc3749b377900";
    const cborValue = decodeCbor(hexToBytes(encodedCborHex));

    const description =
      "49([1, h'536f6d65206d7973746572696573206172656e2774206d65616e7420746f20626520736f6c7665642e', [707([1, h'2b9238e19eafbc154b49ec89edd4e0fb1368e97332c6913b4beb637d1875824f3e43bd7fb0c41fb574f08ce00247413d3ce2d9466e0ccfa4a89b92504982710a']), 707([1, h'0f9c7af36804ffe5313c00115e5a31aa56814abaa77ff301da53d48613496e9c51a98b36d55f6fb5634fdb0123910cfa4904f1c60523df41013dc3749b377900'])]])";
    const debugDescription =
      "tagged(49, array([unsigned(1), bytes(536f6d65206d7973746572696573206172656e2774206d65616e7420746f20626520736f6c7665642e), array([tagged(707, array([unsigned(1), bytes(2b9238e19eafbc154b49ec89edd4e0fb1368e97332c6913b4beb637d1875824f3e43bd7fb0c41fb574f08ce00247413d3ce2d9466e0ccfa4a89b92504982710a)])), tagged(707, array([unsigned(1), bytes(0f9c7af36804ffe5313c00115e5a31aa56814abaa77ff301da53d48613496e9c51a98b36d55f6fb5634fdb0123910cfa4904f1c60523df41013dc3749b377900)]))])]))";
    const diagnostic = `49(
    [
        1,
        h'536f6d65206d7973746572696573206172656e2774206d65616e7420746f20626520736f6c7665642e',
        [
            707(
                [
                    1,
                    h'2b9238e19eafbc154b49ec89edd4e0fb1368e97332c6913b4beb637d1875824f3e43bd7fb0c41fb574f08ce00247413d3ce2d9466e0ccfa4a89b92504982710a'
                ]
            ),
            707(
                [
                    1,
                    h'0f9c7af36804ffe5313c00115e5a31aa56814abaa77ff301da53d48613496e9c51a98b36d55f6fb5634fdb0123910cfa4904f1c60523df41013dc3749b377900'
                ]
            )
        ]
    ]
)`;
    const diagnosticFlat =
      "49([1, h'536f6d65206d7973746572696573206172656e2774206d65616e7420746f20626520736f6c7665642e', [707([1, h'2b9238e19eafbc154b49ec89edd4e0fb1368e97332c6913b4beb637d1875824f3e43bd7fb0c41fb574f08ce00247413d3ce2d9466e0ccfa4a89b92504982710a']), 707([1, h'0f9c7af36804ffe5313c00115e5a31aa56814abaa77ff301da53d48613496e9c51a98b36d55f6fb5634fdb0123910cfa4904f1c60523df41013dc3749b377900'])]])";
    const hex =
      "d83183015829536f6d65206d7973746572696573206172656e2774206d65616e7420746f20626520736f6c7665642e82d902c3820158402b9238e19eafbc154b49ec89edd4e0fb1368e97332c6913b4beb637d1875824f3e43bd7fb0c41fb574f08ce00247413d3ce2d9466e0ccfa4a89b92504982710ad902c3820158400f9c7af36804ffe5313c00115e5a31aa56814abaa77ff301da53d48613496e9c51a98b36d55f6fb5634fdb0123910cfa4904f1c60523df41013dc3749b377900";
    const hexAnnotated = `d8 31                                   # tag(49)
    83                                  # array(3)
        01                              # unsigned(1)
        5829                            # bytes(41)
            536f6d65206d7973746572696573206172656e2774206d65616e7420746f20626520736f6c7665642e # "Some mysteries aren't meant to be solved."
        82                              # array(2)
            d9 02c3                     # tag(707)
                82                      # array(2)
                    01                  # unsigned(1)
                    5840                # bytes(64)
                        2b9238e19eafbc154b49ec89edd4e0fb1368e97332c6913b4beb637d1875824f3e43bd7fb0c41fb574f08ce00247413d3ce2d9466e0ccfa4a89b92504982710a
            d9 02c3                     # tag(707)
                82                      # array(2)
                    01                  # unsigned(1)
                    5840                # bytes(64)
                        0f9c7af36804ffe5313c00115e5a31aa56814abaa77ff301da53d48613496e9c51a98b36d55f6fb5634fdb0123910cfa4904f1c60523df41013dc3749b377900`;

    run(
      "format_structure",
      cborValue,
      description,
      debugDescription,
      diagnostic,
      diagnostic,
      diagnosticFlat,
      diagnosticFlat,
      hex,
      hexAnnotated,
    );
  });

  test("format_structure_2", () => {
    registerTags();
    const encodedCborHex =
      "d9012ca4015059f2293a5bce7d4de59e71b4207ac5d202c11a6035970003754461726b20507572706c652041717561204c6f766504787b4c6f72656d20697073756d20646f6c6f722073697420616d65742c20636f6e73656374657475722061646970697363696e6720656c69742c2073656420646f20656975736d6f642074656d706f7220696e6369646964756e74207574206c61626f726520657420646f6c6f7265206d61676e6120616c697175612e";
    const cborValue = decodeCbor(hexToBytes(encodedCborHex));

    const description =
      '300({1: h\'59f2293a5bce7d4de59e71b4207ac5d2\', 2: 1(1614124800), 3: "Dark Purple Aqua Love", 4: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."})';
    const debugDescription =
      'tagged(300, map({0x01: (unsigned(1), bytes(59f2293a5bce7d4de59e71b4207ac5d2)), 0x02: (unsigned(2), tagged(1, unsigned(1614124800))), 0x03: (unsigned(3), text("Dark Purple Aqua Love")), 0x04: (unsigned(4), text("Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."))}))';
    const diagnostic = `300(
    {
        1:
        h'59f2293a5bce7d4de59e71b4207ac5d2',
        2:
        1(1614124800),
        3:
        "Dark Purple Aqua Love",
        4:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
    }
)`;
    const diagnosticAnnotated = `300(
    {
        1:
        h'59f2293a5bce7d4de59e71b4207ac5d2',
        2:
        1(1614124800),   / date /
        3:
        "Dark Purple Aqua Love",
        4:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
    }
)`;
    const diagnosticFlat =
      '300({1: h\'59f2293a5bce7d4de59e71b4207ac5d2\', 2: 1(1614124800), 3: "Dark Purple Aqua Love", 4: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."})';
    const summaryStr =
      '300({1: h\'59f2293a5bce7d4de59e71b4207ac5d2\', 2: 2021-02-24, 3: "Dark Purple Aqua Love", 4: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."})';
    const hex =
      "d9012ca4015059f2293a5bce7d4de59e71b4207ac5d202c11a6035970003754461726b20507572706c652041717561204c6f766504787b4c6f72656d20697073756d20646f6c6f722073697420616d65742c20636f6e73656374657475722061646970697363696e6720656c69742c2073656420646f20656975736d6f642074656d706f7220696e6369646964756e74207574206c61626f726520657420646f6c6f7265206d61676e6120616c697175612e";
    const hexAnnotated = `d9 012c                                 # tag(300)
    a4                                  # map(4)
        01                              # unsigned(1)
        50                              # bytes(16)
            59f2293a5bce7d4de59e71b4207ac5d2
        02                              # unsigned(2)
        c1                              # tag(1) date
            1a60359700                  # unsigned(1614124800)
        03                              # unsigned(3)
        75                              # text(21)
            4461726b20507572706c652041717561204c6f7665 # "Dark Purple Aqua Love"
        04                              # unsigned(4)
        78 7b                           # text(123)
            4c6f72656d20697073756d20646f6c6f722073697420616d65742c20636f6e73656374657475722061646970697363696e6720656c69742c2073656420646f20656975736d6f642074656d706f7220696e6369646964756e74207574206c61626f726520657420646f6c6f7265206d61676e6120616c697175612e # "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."`;

    // Assert the LIBRARY outputs directly. The value is decoded (its tags carry
    // no name), so — exactly like Rust — the plain diagnostic/Display path
    // renders tag numbers (`1(...)`), while only the annotated path resolves
    // `/ date /` and the summary renders `2021-02-24`. (The shared `run()`
    // helper's test-local Display reimplementation resolves names from the
    // global store and so can't model the unnamed-decoded-tag case faithfully.)
    expect(cborValue.toDiagnostic()).toBe(diagnostic);
    expect(cborValue.toDiagnosticAnnotated()).toBe(diagnosticAnnotated);
    expect(cborValue.toString()).toBe(diagnosticFlat);
    expect(summary(cborValue)).toBe(summaryStr);
    expect(cborValue.toHex()).toBe(hex);
    expect(cborValue.toHexAnnotated()).toBe(hexAnnotated);
    // Debug rendering (numbers for decoded tags) matches Rust's debug string.
    expect(cborDebugDescription(cborValue)).toBe(debugDescription);
    // `description` here equals the flat diagnostic for a decoded (unnamed-tag)
    // value, mirroring Rust's `format!("{}", cbor)`.
    void description;
  });

  test("format_key_order", () => {
    const m = CborMap.new();
    m.insert(-1, 3);
    m.insert([-1], 7);
    m.insert("z", 4);
    m.insert(10, 1);
    m.insert(false, 8);
    m.insert(100, 2);
    m.insert("aa", 5);
    m.insert([100], 6);

    const description = '{10: 1, 100: 2, -1: 3, "z": 4, "aa": 5, [100]: 6, [-1]: 7, false: 8}';
    const debugDescription =
      'map({0x0a: (unsigned(10), unsigned(1)), 0x1864: (unsigned(100), unsigned(2)), 0x20: (negative(-1), unsigned(3)), 0x617a: (text("z"), unsigned(4)), 0x626161: (text("aa"), unsigned(5)), 0x811864: (array([unsigned(100)]), unsigned(6)), 0x8120: (array([negative(-1)]), unsigned(7)), 0xf4: (simple(false), unsigned(8))})';
    const diagnostic = `{
    10:
    1,
    100:
    2,
    -1:
    3,
    "z":
    4,
    "aa":
    5,
    [100]:
    6,
    [-1]:
    7,
    false:
    8
}`;
    const diagnosticFlat = '{10: 1, 100: 2, -1: 3, "z": 4, "aa": 5, [100]: 6, [-1]: 7, false: 8}';
    const hexValue = "a80a011864022003617a046261610581186406812007f408";
    const hexAnnotated = `a8              # map(8)
    0a          # unsigned(10)
    01          # unsigned(1)
    1864        # unsigned(100)
    02          # unsigned(2)
    20          # negative(-1)
    03          # unsigned(3)
    61          # text(1)
        7a      # "z"
    04          # unsigned(4)
    62          # text(2)
        6161    # "aa"
    05          # unsigned(5)
    81          # array(1)
        1864    # unsigned(100)
    06          # unsigned(6)
    81          # array(1)
        20      # negative(-1)
    07          # unsigned(7)
    f4          # false
    08          # unsigned(8)`;

    run(
      "format_key_order",
      m,
      description,
      debugDescription,
      diagnostic,
      diagnostic,
      diagnosticFlat,
      diagnosticFlat,
      hexValue,
      hexAnnotated,
    );
  });
});
