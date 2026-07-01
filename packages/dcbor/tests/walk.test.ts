/**
 * Walk Module Integration Tests - 1:1 translation from Rust's tests/walk.rs
 *
 * This file contains comprehensive integration tests for the `walk` module.
 *
 * ## Test Coverage
 *
 * ### Basic Functionality
 * - **test_traversal_counts**: Verifies correct visit counts for different
 *   CBOR structures (arrays, maps, tagged values, nested structures)
 * - **test_visitor_state_threading**: Tests that visitor state is properly
 *   maintained through traversal
 * - **test_primitive_values**: Ensures primitive values are handled correctly
 * - **test_empty_structures**: Tests behavior with empty arrays and maps
 *
 * ### Traversal Semantics
 * - **test_traversal_order_and_edge_types**: Validates the order of visits and
 *   correct edge type labeling
 * - **test_map_keyvalue_semantics**: Verifies that map key-value pairs are
 *   visited both as semantic units and individually
 * - **test_tagged_value_traversal**: Tests traversal of tagged values and
 *   nested tagged structures
 *
 * ### Advanced Features
 * - **test_depth_limited_traversal**: Tests depth-limited traversal using the
 *   level parameter
 * - **test_early_termination**: Demonstrates controlled termination using the
 *   stop flag to prevent descent into children
 * - **test_stop_flag_prevents_descent**: Verifies that the stop flag
 *   consistently prevents descent into children while allowing sibling
 *   traversal
 *
 * ### Real-World Usage
 * - **test_text_extraction**: Extracts all text strings from a complex nested
 *   structure
 * - **test_real_world_document**: Tests traversal of a realistic JSON-like
 *   document structure converted to CBOR
 */

import type { CborInput, WalkElement, EdgeTypeVariant } from "../src";
import { cbor, CborMap, toTaggedValue, edgeLabel } from "../src";
import { EdgeType } from "../src/walk";

// Helper function to format WalkElement as diagnostic string
function formatElement(element: WalkElement): string {
  if (element.type === "single") {
    return element.cbor.toString();
  } else {
    return `${element.key.toString()}: ${element.value.toString()}`;
  }
}

// Helper function to count total visits
function countVisits(cborValue: CborInput): number {
  let count = 0;
  const visitor = (
    _element: WalkElement,
    _level: number,
    _edge: EdgeTypeVariant,
    state: void,
  ): [void, boolean] => {
    count++;
    return [state, false];
  };

  cbor(cborValue).walk(undefined, visitor);
  return count;
}

describe("walk tests", () => {
  /// Test basic traversal counts for different CBOR structures
  test("test_traversal_counts", () => {
    // Simple array
    const array = [1, 2, 3];
    const count1 = countVisits(array);
    // Root + 3 array elements = 4
    expect(count1).toBe(4);

    // Simple map
    const map = CborMap.new();
    map.insert("a", 1);
    map.insert("b", 2);
    const count2 = countVisits(map);
    // Root + 2 key-value pairs + 4 individual keys/values = 7
    expect(count2).toBe(7);

    // Tagged value
    const tagged = { isCbor: true as const, type: 6 as const, tag: 42, value: cbor(100) };
    const count3 = countVisits(tagged);
    // Root tagged value + content = 2
    expect(count3).toBe(2);

    // Nested structure
    const innerMap = CborMap.new();
    innerMap.insert("x", [1, 2]);
    const outerMap = CborMap.new();
    outerMap.insert("inner", innerMap);
    outerMap.insert("simple", 42);
    const count4 = countVisits(outerMap);
    // Should visit:
    // 1. root map
    // 2-3. 2 kv pairs in outer (inner and simple)
    // 4-5. 2 individual keys in outer (inner, simple)
    // 6. inner map value
    // 7. 1 kv pair in inner map (x)
    // 8-9. 2 individual key/value in inner (x key, array value)
    // 10-11. 2 array elements (1, 2)
    // 12. simple value (42)
    // = 12 total
    expect(count4).toBe(12);
  });

  /// Test that visitor state is properly threaded through traversal
  test("test_visitor_state_threading", () => {
    const array = [1, 2, 3, 4, 5];

    // Count only even numbers using visitor state
    let evenCount = 0;
    const visitor = (
      element: WalkElement,
      _level: number,
      _edge: EdgeTypeVariant,
      state: void,
    ): [void, boolean] => {
      if (element.type === "single") {
        const cborValue = element.cbor;
        if (cborValue.type === 0) {
          // Unsigned
          const n = cborValue.value as number;
          if (n % 2 === 0) {
            evenCount++;
          }
        }
      }
      return [state, false];
    };

    cbor(array).walk(undefined, visitor);
    expect(evenCount).toBe(2); // 2 and 4 are even
  });

  /// Test early termination using visitor pattern
  test("test_early_termination", () => {
    // Test shows that stop flag prevents descent into children but doesn't
    // abort entire walk
    const nestedStructure = [
      ["should", "see", "this"], // This array's children will be visited
      "abort_marker", // This will set stop flag
      ["should", "not", "see"], // This array will be visited but not its children
    ];

    const visitLog: string[] = [];
    let foundAbort = false;

    const visitor = (
      element: WalkElement,
      level: number,
      edge: EdgeTypeVariant,
      state: void,
    ): [void, boolean] => {
      const edgeStr = edge.type === "array_element" ? `ArrayElement(${edge.index})` : edge.type;
      const desc = `L${level}: ${edgeStr} - ${formatElement(element)}`;
      visitLog.push(desc);

      // Check if this is our abort marker
      if (element.type === "single") {
        const cborValue = element.cbor;
        if (cborValue.type === 3) {
          // Text
          const text = cborValue.value as string;
          if (text === "abort_marker") {
            foundAbort = true;
            // Return stop=true to prevent descent into this element's
            // children (though strings don't have children anyway)
            return [state, true];
          }
        }
      }

      // If we've seen the abort marker and this is an array at level 1, stop
      // descent
      const stop =
        foundAbort &&
        element.type === "single" &&
        edge.type === "array_element" &&
        edge.index === 2;

      return [state, stop];
    };

    cbor(nestedStructure).walk(undefined, visitor);

    const logStr = visitLog.join("\n");

    // Should visit the abort marker
    expect(logStr).toContain("abort_marker");

    // Should visit the first array and its children (before abort marker)
    expect(logStr).toContain("should");
    expect(logStr).toContain("see");
    expect(logStr).toContain("this");

    // Should visit the third array but NOT its children (after abort marker
    // with stop=true)
    expect(logStr).toContain('["should", "not", "see"]'); // The array itself

    // Should NOT visit the individual strings "should", "not", "see" that come
    // from the third array
    // Find the index of the third array visit
    const thirdArrayIndex = visitLog.findIndex(
      (line) => line.includes("ArrayElement(2)") && line.includes('["should", "not", "see"]'),
    );

    expect(thirdArrayIndex).toBeGreaterThanOrEqual(0);

    // Check that there are no Level 2 visits after this index
    const visitsAfterThirdArray = visitLog.slice(thirdArrayIndex + 1);
    const level2AfterThird = visitsAfterThirdArray.filter((line) => line.startsWith("L2:"));

    // Should be no Level 2 visits after the third array due to stop flag
    expect(level2AfterThird.length).toBe(0);
  });

  /// Test depth-limited traversal using level parameter
  test("test_depth_limited_traversal", () => {
    // Create deeply nested structure
    const level3 = CborMap.new();
    level3.insert("deep", "value");

    const level2 = CborMap.new();
    level2.insert("level3", level3);

    const level1 = CborMap.new();
    level1.insert("level2", level2);

    // Collect elements at each level
    const elementsByLevel: Record<number, number> = {};

    const visitor = (
      _element: WalkElement,
      level: number,
      _edge: EdgeTypeVariant,
      state: void,
    ): [void, boolean] => {
      elementsByLevel[level] = (elementsByLevel[level] || 0) + 1;
      // Stop descent if we're at level 2 or deeper
      const stop = level >= 2;
      return [state, stop];
    };

    cbor(level1).walk(undefined, visitor);

    expect(elementsByLevel[0] || 0).toBe(1); // Root
    expect(elementsByLevel[1] || 0).toBe(3); // 1 kv pair + 2 individual key/value
    expect(elementsByLevel[2] || 0).toBe(1); // Just the nested map, no descent
    expect(elementsByLevel[3] || 0).toBe(0); // No visits at level 3 due to stop
  });

  /// Test text extraction from complex CBOR structures
  test("test_text_extraction", () => {
    // Create a complex structure with text at various levels
    const metadata = CborMap.new();
    metadata.insert("title", "Important Document");
    metadata.insert("author", "Alice Smith");

    const content = CborMap.new();
    content.insert("body", "Lorem ipsum dolor sit amet");
    content.insert("footer", "Copyright 2024");

    const document = CborMap.new();
    document.insert("metadata", metadata);
    document.insert("content", content);
    document.insert("tags", ["urgent", "confidential", "draft"]);

    // Extract all text strings
    const texts: string[] = [];

    const visitor = (
      element: WalkElement,
      _level: number,
      _edge: EdgeTypeVariant,
      state: void,
    ): [void, boolean] => {
      if (element.type === "single") {
        const cborValue = element.cbor;
        if (cborValue.type === 3) {
          // Text
          texts.push(cborValue.value as string);
        }
      } else if (element.type === "keyvalue") {
        if (element.key.type === 3) {
          // Text
          texts.push(element.key.value as string);
        }
        if (element.value.type === 3) {
          // Text
          texts.push(element.value.value as string);
        }
      }
      return [state, false];
    };

    cbor(document).walk(undefined, visitor);

    // Should find all text strings in the structure
    expect(texts).toContain("Important Document");
    expect(texts).toContain("Alice Smith");
    expect(texts).toContain("Lorem ipsum dolor sit amet");
    expect(texts).toContain("Copyright 2024");
    expect(texts).toContain("urgent");
    expect(texts).toContain("confidential");
    expect(texts).toContain("draft");
    // Also keys
    expect(texts).toContain("title");
    expect(texts).toContain("author");
    expect(texts).toContain("body");
    expect(texts).toContain("footer");
    expect(texts).toContain("metadata");
    expect(texts).toContain("content");
    expect(texts).toContain("tags");
  });

  /// Test traversal order and edge types
  test("test_traversal_order_and_edge_types", () => {
    const map = CborMap.new();
    map.insert("a", [1, 2]);
    map.insert("b", 42);

    const traversalLog: Array<[string, EdgeTypeVariant]> = [];

    const visitor = (
      element: WalkElement,
      _level: number,
      edge: EdgeTypeVariant,
      state: void,
    ): [void, boolean] => {
      const desc =
        element.type === "single"
          ? `Single(${formatElement(element)})`
          : `KeyValue(${formatElement(element)})`;
      traversalLog.push([desc, edge]);
      return [state, false];
    };

    cbor(map).walk(undefined, visitor);

    // Verify root visit
    const firstLog = traversalLog[0];
    if (firstLog === undefined) {
      throw new Error("Expected at least one traversal log entry");
    }
    expect(firstLog[1].type).toBe("none");

    // Check that we have the expected edge types
    const edgeTypes = traversalLog.map(([_, edge]) => edge.type);
    expect(edgeTypes).toContain("map_key_value");
    expect(edgeTypes).toContain("map_key");
    expect(edgeTypes).toContain("map_value");

    // Check for array element edges with indices
    const hasArrayElement0 = traversalLog.some(
      ([_, edge]) => edge.type === "array_element" && "index" in edge && edge.index === 0,
    );
    const hasArrayElement1 = traversalLog.some(
      ([_, edge]) => edge.type === "array_element" && "index" in edge && edge.index === 1,
    );
    expect(hasArrayElement0).toBe(true);
    expect(hasArrayElement1).toBe(true);
  });

  /// Test tagged value traversal
  test("test_tagged_value_traversal", () => {
    // Create nested tagged values
    const innerTagged = toTaggedValue(123, [1, 2, 3]);
    const outerTagged = toTaggedValue(456, innerTagged);

    const edgeLog: EdgeTypeVariant[] = [];

    const visitor = (
      _element: WalkElement,
      _level: number,
      edge: EdgeTypeVariant,
      state: void,
    ): [void, boolean] => {
      edgeLog.push(edge);
      return [state, false];
    };

    outerTagged.walk(undefined, visitor);

    // Should see: None (root), TaggedContent, TaggedContent, ArrayElement(0),
    // ArrayElement(1), ArrayElement(2)
    const edge0 = edgeLog[0];
    const edge1 = edgeLog[1];
    const edge2 = edgeLog[2];
    const edge3 = edgeLog[3];
    const edge4 = edgeLog[4];
    const edge5 = edgeLog[5];

    if (
      edge0 === undefined ||
      edge1 === undefined ||
      edge2 === undefined ||
      edge3 === undefined ||
      edge4 === undefined ||
      edge5 === undefined
    ) {
      throw new Error("Expected 6 edges in log");
    }

    expect(edge0.type).toBe("none"); // Root tagged value
    expect(edge1.type).toBe("tagged_content"); // Inner tagged value
    expect(edge2.type).toBe("tagged_content"); // Array content of inner tagged
    expect(edge3.type).toBe("array_element"); // First array element
    if (edge3.type === "array_element") expect(edge3.index).toBe(0);
    expect(edge4.type).toBe("array_element"); // Second array element
    if (edge4.type === "array_element") expect(edge4.index).toBe(1);
    expect(edge5.type).toBe("array_element"); // Third array element
    if (edge5.type === "array_element") expect(edge5.index).toBe(2);
  });

  /// Test map key-value semantics
  test("test_map_keyvalue_semantics", () => {
    const map = CborMap.new();
    map.insert("simple", 42);
    map.insert("nested", [1, 2]);

    let keyvalueCount = 0;
    let individualCount = 0;

    const visitor = (
      element: WalkElement,
      _level: number,
      edge: EdgeTypeVariant,
      state: void,
    ): [void, boolean] => {
      if (element.type === "keyvalue") {
        keyvalueCount++;
        expect(edge.type).toBe("map_key_value");
      } else if (element.type === "single") {
        if (edge.type === "map_key" || edge.type === "map_value") {
          individualCount++;
        }
      }
      return [state, false];
    };

    cbor(map).walk(undefined, visitor);

    // Should have 2 key-value pairs and 4 individual key/value visits
    expect(keyvalueCount).toBe(2);
    expect(individualCount).toBe(4);
  });

  /// Test stop flag prevents descent consistently
  test("test_stop_flag_prevents_descent", () => {
    const nested = [
      [1, 2, 3], // Index 0: prevent descent into this
      [4, 5, 6], // Index 1: allow descent into this
      [7, 8, 9], // Index 2: allow descent into this
    ];

    const visitLog: string[] = [];

    const visitor = (
      element: WalkElement,
      level: number,
      edge: EdgeTypeVariant,
      state: void,
    ): [void, boolean] => {
      const edgeStr = edge.type === "array_element" ? `ArrayElement(${edge.index})` : edge.type;
      const desc = `L${level}: ${edgeStr} - ${formatElement(element)}`;
      visitLog.push(desc);

      // Stop descent into the first nested array (at index 0)
      const stop = level === 1 && edge.type === "array_element" && edge.index === 0;
      return [state, stop];
    };

    cbor(nested).walk(undefined, visitor);

    const logStr = visitLog.join("\n");

    // Should visit the first array but not descend into it
    expect(logStr).toContain("ArrayElement(0) - [1, 2, 3]"); // First array is visited

    // Should NOT find any level 2 visits that came from the first array
    // The elements 1, 2, 3 should not appear at level 2
    const level2Lines = visitLog.filter((line) => line.startsWith("L2:"));

    // None of the level 2 visits should contain the values from the first array
    for (const line of level2Lines) {
      expect(line).not.toContain(" - 1");
      expect(line).not.toContain(" - 2");
      expect(line).not.toContain(" - 3");
    }

    // Should visit second and third arrays with descent
    expect(logStr).toContain("ArrayElement(1) - [4, 5, 6]"); // Second array is visited
    expect(logStr).toContain("ArrayElement(2) - [7, 8, 9]"); // Third array is visited

    // Should find level 2 visits from second and third arrays
    const hasLevel2From456 =
      logStr.includes("L2:") &&
      (logStr.includes(" - 4") || logStr.includes(" - 5") || logStr.includes(" - 6"));
    expect(hasLevel2From456).toBe(true);

    const hasLevel2From789 =
      logStr.includes("L2:") &&
      (logStr.includes(" - 7") || logStr.includes(" - 8") || logStr.includes(" - 9"));
    expect(hasLevel2From789).toBe(true);
  });

  /// Test empty structures
  test("test_empty_structures", () => {
    // Empty array
    const emptyArray: number[] = [];
    const count1 = countVisits(emptyArray);
    expect(count1).toBe(1); // Just the root

    // Empty map
    const emptyMap = CborMap.new();
    const count2 = countVisits(emptyMap);
    expect(count2).toBe(1); // Just the root
  });

  /// Test primitive values
  test("test_primitive_values", () => {
    const primitives = [42, "hello", 3.2222, true, null];

    for (const primitive of primitives) {
      const count = countVisits(primitive);
      expect(count).toBe(1); // Just the primitive itself
    }
  });

  /// Test real-world document structure
  test("test_real_world_document", () => {
    // Simulate a JSON-like document converted to CBOR
    const person = CborMap.new();
    person.insert("name", "John Doe");
    person.insert("age", 30);
    person.insert("email", "john@example.com");

    const address = CborMap.new();
    address.insert("street", "123 Main St");
    address.insert("city", "Anytown");
    address.insert("zipcode", "12345");

    person.insert("address", address);
    person.insert("hobbies", ["reading", "cycling", "cooking"]);

    const skills = CborMap.new();
    skills.insert("programming", ["Rust", "Python", "JavaScript"]);
    skills.insert("languages", ["English", "Spanish"]);

    person.insert("skills", skills);

    // Extract all string values for search/indexing
    const strings: string[] = [];

    const visitor = (
      element: WalkElement,
      _level: number,
      _edge: EdgeTypeVariant,
      state: void,
    ): [void, boolean] => {
      if (element.type === "single") {
        const cborValue = element.cbor;
        if (cborValue.type === 3) {
          // Text
          strings.push(cborValue.value as string);
        }
      } else if (element.type === "keyvalue") {
        if (element.key.type === 3) {
          // Text
          strings.push(element.key.value as string);
        }
        if (element.value.type === 3) {
          // Text
          strings.push(element.value.value as string);
        }
      }
      return [state, false];
    };

    cbor(person).walk(undefined, visitor);

    // Verify we found all expected strings
    expect(strings).toContain("John Doe");
    expect(strings).toContain("john@example.com");
    expect(strings).toContain("123 Main St");
    expect(strings).toContain("Anytown");
    expect(strings).toContain("12345");
    expect(strings).toContain("reading");
    expect(strings).toContain("cycling");
    expect(strings).toContain("cooking");
    expect(strings).toContain("Rust");
    expect(strings).toContain("Python");
    expect(strings).toContain("JavaScript");
    expect(strings).toContain("English");
    expect(strings).toContain("Spanish");

    // Should also find all field names
    expect(strings).toContain("name");
    expect(strings).toContain("age");
    expect(strings).toContain("email");
    expect(strings).toContain("address");
    expect(strings).toContain("hobbies");
    expect(strings).toContain("skills");
    expect(strings).toContain("programming");
    expect(strings).toContain("languages");
  });

  /// Root array: visit count and exact positional edge ordering
  /// (port of src/walk.rs `test_walk_array`)
  test("test_walk_array", () => {
    const edges: EdgeTypeVariant[] = [];
    let count = 0;
    const visitor = (
      _element: WalkElement,
      _level: number,
      edge: EdgeTypeVariant,
      state: void,
    ): [void, boolean] => {
      count++;
      edges.push(edge);
      return [state, false];
    };

    cbor([1, 2, 3]).walk(undefined, visitor);

    // Array + 3 elements = 4
    expect(count).toBe(4);
    expect(edges[0]?.type).toBe("none"); // Root array
    for (let i = 0; i < 3; i++) {
      const edge = edges[i + 1];
      expect(edge?.type).toBe("array_element");
      if (edge?.type === "array_element") expect(edge.index).toBe(i);
    }
  });

  /// Single-level tagged value: visit count and edge sequence
  /// (port of src/walk.rs `test_walk_tagged`)
  test("test_walk_tagged", () => {
    const tagged = toTaggedValue(0, "2023-01-01T00:00:00Z");

    const edges: EdgeTypeVariant[] = [];
    let count = 0;
    const visitor = (
      _element: WalkElement,
      _level: number,
      edge: EdgeTypeVariant,
      state: void,
    ): [void, boolean] => {
      count++;
      edges.push(edge);
      return [state, false];
    };

    tagged.walk(undefined, visitor);

    // Tagged value + content = 2
    expect(count).toBe(2);
    expect(edges[0]?.type).toBe("none"); // Root tagged value
    expect(edges[1]?.type).toBe("tagged_content"); // Content
  });

  /// Nested map-with-array visit count (port of src/walk.rs
  /// `test_walk_nested_structure`)
  test("test_walk_nested_structure", () => {
    const map = CborMap.new();
    map.insert("numbers", [1, 2, 3]);
    map.insert("text", "hello");

    // map + 2 key-value pairs + 4 individual keys/values + array + 3 elements
    // = 10
    expect(countVisits(map)).toBe(10);
  });

  /// Edge-type labels (port of src/walk.rs `test_edge_type_labels`)
  test("test_edge_type_labels", () => {
    expect(edgeLabel({ type: EdgeType.None })).toBeUndefined();
    expect(edgeLabel({ type: EdgeType.ArrayElement, index: 5 })).toBe("arr[5]");
    expect(edgeLabel({ type: EdgeType.MapKey })).toBe("key");
    expect(edgeLabel({ type: EdgeType.MapValue })).toBe("val");
    expect(edgeLabel({ type: EdgeType.TaggedContent })).toBe("content");
    // Rust's `label()` also maps MapKeyValue -> "kv" (its test omits this case).
    expect(edgeLabel({ type: EdgeType.MapKeyValue })).toBe("kv");
  });
});
