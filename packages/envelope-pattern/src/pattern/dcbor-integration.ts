/**
 * @bcts/envelope-pattern - DCBor Pattern Integration
 *
 * This module provides integration between dcbor-pattern and
 * bc-envelope-pattern, allowing dcbor patterns to be used as envelope patterns
 * through conversion.
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust dcbor_integration.rs
 *
 * @module envelope-pattern/pattern/dcbor-integration
 */

import {
  type Pattern as DCBORPattern,
  type ValuePattern as DCBORValuePattern,
  type StructurePattern as DCBORStructurePattern,
  type MetaPattern as DCBORMetaPattern,
} from "@bcts/dcbor-pattern";

import type { Pattern } from "./index";
import type { Result } from "../error";
import { ok } from "../error";

// Import leaf pattern constructors
import {
  BoolPattern,
  NumberPattern,
  TextPattern,
  ByteStringPattern,
  DatePattern,
  KnownValuePattern,
  NullPattern,
  ArrayPattern,
  MapPattern,
  TaggedPattern,
  CBORPattern,
  leafBool,
  leafNull,
  leafNumber,
  leafText,
  leafByteString,
  leafDate,
  leafKnownValue,
  leafArray,
  leafMap,
  leafTag,
  leafCbor,
} from "./leaf";

// Import meta pattern constructors
import {
  AnyPattern,
  AndPattern,
  OrPattern,
  NotPattern,
  metaAny,
  metaAnd,
  metaOr,
  metaNot,
} from "./meta";

/**
 * Convert a dcbor-pattern Pattern to a bc-envelope-pattern Pattern.
 *
 * This function serves as the bridge between the two pattern systems,
 * allowing dcbor-pattern expressions to be used in envelope pattern contexts.
 *
 * @param dcborPattern - The dcbor-pattern Pattern to convert
 * @returns The converted envelope pattern, or an error if conversion fails
 */
export function convertDcborPatternToEnvelopePattern(
  dcborPattern: DCBORPattern
): Result<Pattern> {
  switch (dcborPattern.kind) {
    case "Value":
      return convertValuePatternToEnvelopePattern(dcborPattern.pattern);
    case "Structure":
      return convertStructurePatternToEnvelopePattern(dcborPattern.pattern);
    case "Meta":
      return convertMetaPatternToEnvelopePattern(dcborPattern.pattern, dcborPattern);
  }
}

/**
 * Convert a dcbor-pattern ValuePattern to an envelope leaf pattern.
 */
function convertValuePatternToEnvelopePattern(
  valuePattern: DCBORValuePattern
): Result<Pattern> {
  switch (valuePattern.type) {
    case "Bool": {
      const boolPattern = BoolPattern.fromDcborPattern(valuePattern.pattern);
      return ok({ type: "Leaf", pattern: leafBool(boolPattern) });
    }
    case "Number": {
      const numberPattern = NumberPattern.fromDcborPattern(valuePattern.pattern);
      return ok({ type: "Leaf", pattern: leafNumber(numberPattern) });
    }
    case "Text": {
      const textPattern = TextPattern.fromDcborPattern(valuePattern.pattern);
      return ok({ type: "Leaf", pattern: leafText(textPattern) });
    }
    case "ByteString": {
      const byteStringPattern = ByteStringPattern.fromDcborPattern(valuePattern.pattern);
      return ok({ type: "Leaf", pattern: leafByteString(byteStringPattern) });
    }
    case "Date": {
      const datePattern = DatePattern.fromDcborPattern(valuePattern.pattern);
      return ok({ type: "Leaf", pattern: leafDate(datePattern) });
    }
    case "KnownValue": {
      const knownValuePattern = KnownValuePattern.fromDcborPattern(valuePattern.pattern);
      return ok({ type: "Leaf", pattern: leafKnownValue(knownValuePattern) });
    }
    case "Null": {
      return ok({ type: "Leaf", pattern: leafNull(NullPattern.new()) });
    }
    case "Digest": {
      // Digest patterns don't have a direct envelope equivalent yet
      // For now, wrap as a generic CBOR pattern
      const cborPattern = CBORPattern.fromDcborPattern({
        kind: "Value",
        pattern: valuePattern,
      });
      return ok({ type: "Leaf", pattern: leafCbor(cborPattern) });
    }
  }
}

/**
 * Convert a dcbor-pattern StructurePattern to an envelope pattern.
 */
function convertStructurePatternToEnvelopePattern(
  structurePattern: DCBORStructurePattern
): Result<Pattern> {
  switch (structurePattern.type) {
    case "Array": {
      // Wrap the full dcbor pattern for array matching
      const arrayPattern = ArrayPattern.fromDcborPattern({
        kind: "Structure",
        pattern: structurePattern,
      });
      return ok({ type: "Leaf", pattern: leafArray(arrayPattern) });
    }
    case "Map": {
      // MapPattern only supports interval-based matching currently
      // Use any() for general map patterns from dcbor
      const mapPattern = MapPattern.any();
      return ok({ type: "Leaf", pattern: leafMap(mapPattern) });
    }
    case "Tagged": {
      const taggedPattern = TaggedPattern.fromDcborPattern(structurePattern.pattern);
      return ok({ type: "Leaf", pattern: leafTag(taggedPattern) });
    }
  }
}

/**
 * Convert a dcbor-pattern MetaPattern to an envelope meta pattern.
 */
function convertMetaPatternToEnvelopePattern(
  metaPattern: DCBORMetaPattern,
  originalPattern: DCBORPattern
): Result<Pattern> {
  switch (metaPattern.type) {
    case "Any": {
      // The dcbor "any" pattern corresponds to our "any" meta pattern
      return ok({ type: "Meta", pattern: metaAny(AnyPattern.new()) });
    }
    case "And": {
      // Convert AND pattern by recursively converting each sub-pattern
      // dcbor-pattern structure: { type: "And", pattern: AndPattern }
      // where AndPattern is { variant: "And", patterns: Pattern[] }
      const convertedPatterns: Pattern[] = [];
      for (const pattern of metaPattern.pattern.patterns) {
        const result = convertDcborPatternToEnvelopePattern(pattern);
        if (!result.ok) return result;
        convertedPatterns.push(result.value);
      }
      return ok({ type: "Meta", pattern: metaAnd(AndPattern.new(convertedPatterns)) });
    }
    case "Or": {
      // Convert OR pattern by recursively converting each sub-pattern
      // dcbor-pattern structure: { type: "Or", pattern: OrPattern }
      // where OrPattern is { variant: "Or", patterns: Pattern[] }
      const convertedPatterns: Pattern[] = [];
      for (const pattern of metaPattern.pattern.patterns) {
        const result = convertDcborPatternToEnvelopePattern(pattern);
        if (!result.ok) return result;
        convertedPatterns.push(result.value);
      }
      return ok({ type: "Meta", pattern: metaOr(OrPattern.new(convertedPatterns)) });
    }
    case "Not": {
      // Convert NOT pattern by recursively converting the inner pattern
      // dcbor-pattern structure: { type: "Not", pattern: NotPattern }
      // where NotPattern is { variant: "Not", pattern: Pattern }
      const innerResult = convertDcborPatternToEnvelopePattern(metaPattern.pattern.pattern);
      if (!innerResult.ok) return innerResult;
      return ok({ type: "Meta", pattern: metaNot(NotPattern.new(innerResult.value)) });
    }
    case "Capture":
    case "Repeat":
    case "Search":
    case "Sequence": {
      // These patterns don't have direct envelope equivalents yet
      // For now, wrap as a generic CBOR pattern
      const cborPattern = CBORPattern.fromDcborPattern(originalPattern);
      return ok({ type: "Leaf", pattern: leafCbor(cborPattern) });
    }
  }
}
