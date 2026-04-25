/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * @bcts/envelope-pattern - CBOR pattern matching
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust cbor_pattern.rs
 *
 * @module envelope-pattern/pattern/leaf/cbor-pattern
 */

import { Envelope } from "@bcts/envelope";
import type { Cbor } from "@bcts/dcbor";
import { cbor as toCbor, cborData, cborEquals, type CborInput } from "@bcts/dcbor";
import {
  type Pattern as DCBORPattern,
  patternPathsWithCaptures as dcborPatternPathsWithCaptures,
  patternDisplay as dcborPatternDisplay,
} from "@bcts/dcbor-pattern";
import type { Path } from "../../format";
import type { Matcher } from "../matcher";
import { compileAsAtomic } from "../matcher";
import type { Instr } from "../vm";
import type { Pattern } from "../index";

// Forward declaration for Pattern factory
let createLeafCBORPattern: ((pattern: CBORPattern) => Pattern) | undefined;

export function registerCBORPatternFactory(factory: (pattern: CBORPattern) => Pattern): void {
  createLeafCBORPattern = factory;
}

/**
 * Pattern type for CBOR pattern matching.
 *
 * Corresponds to the Rust `CBORPattern` enum in cbor_pattern.rs
 */
export type CBORPatternType =
  | { readonly type: "Any" }
  | { readonly type: "Value"; readonly cbor: Cbor }
  | { readonly type: "Pattern"; readonly pattern: DCBORPattern };

/**
 * Pattern for matching CBOR values with support for exact values and advanced pattern matching.
 *
 * Corresponds to the Rust `CBORPattern` enum in cbor_pattern.rs
 */
export class CBORPattern implements Matcher {
  private readonly _pattern: CBORPatternType;

  private constructor(pattern: CBORPatternType) {
    this._pattern = pattern;
  }

  /**
   * Creates a new CBORPattern that matches any CBOR value.
   */
  static any(): CBORPattern {
    return new CBORPattern({ type: "Any" });
  }

  /**
   * Creates a new CBORPattern that matches a specific CBOR value.
   */
  static value(value: CborInput): CBORPattern {
    return new CBORPattern({ type: "Value", cbor: toCbor(value) });
  }

  /**
   * Creates a new CBORPattern that matches CBOR values using dcbor-pattern expressions.
   */
  static pattern(dcborPattern: DCBORPattern): CBORPattern {
    return new CBORPattern({ type: "Pattern", pattern: dcborPattern });
  }

  /**
   * Creates a new CBORPattern from a dcbor-pattern Pattern.
   */
  static fromDcborPattern(dcborPattern: DCBORPattern): CBORPattern {
    return new CBORPattern({ type: "Pattern", pattern: dcborPattern });
  }

  /**
   * Gets the pattern type.
   */
  get pattern(): CBORPatternType {
    return this._pattern;
  }

  /**
   * Convert dcbor captures to envelope captures.
   */
  private _convertDcborCapturesToEnvelopeCaptures(
    dcborCaptures: Map<string, Cbor[][]>,
    baseEnvelope: Envelope,
    baseCbor: Cbor,
  ): Map<string, Path[]> {
    const envelopeCaptures = new Map<string, Path[]>();

    for (const [captureName, dcborCapturePaths] of dcborCaptures) {
      const envelopeCapturePaths: Path[] = dcborCapturePaths.map((dcborPath) =>
        this._convertDcborPathToEnvelopePath(dcborPath, baseEnvelope, baseCbor),
      );
      envelopeCaptures.set(captureName, envelopeCapturePaths);
    }

    return envelopeCaptures;
  }

  /**
   * Convert a single dcbor path to an envelope path.
   *
   * Uses canonical CBOR-byte equality (`cborEquals`) for the "skip the
   * dcbor root if it duplicates our base envelope" check, mirroring
   * Rust's `dcbor_path.first().map(|first| first == &base_cbor)`. The
   * earlier port compared diagnostic strings, which collapses values
   * that share a textual representation but differ structurally
   * (e.g. NaN payloads).
   */
  private _convertDcborPathToEnvelopePath(
    dcborPath: Cbor[],
    baseEnvelope: Envelope,
    baseCbor: Cbor,
  ): Envelope[] {
    const envelopePath: Envelope[] = [baseEnvelope];

    const first = dcborPath[0];
    const skipFirst = first !== undefined && cborEquals(first, baseCbor);

    const elementsToAdd = skipFirst ? dcborPath.slice(1) : dcborPath;

    for (const cborElement of elementsToAdd) {
      envelopePath.push(Envelope.newLeaf(cborElement));
    }

    return envelopePath;
  }

  /**
   * Collect capture names from a dcbor pattern.
   */
  private _collectDcborCaptureNames(dcborPattern: DCBORPattern, names: string[]): void {
    // Parse the pattern string to extract capture names
    const patternStr = dcborPatternDisplay(dcborPattern);

    // Simple parsing to find @name( patterns
    let i = 0;
    while (i < patternStr.length) {
      if (patternStr[i] === "@") {
        i++;
        let name = "";
        // Collect characters until we hit '('
        while (i < patternStr.length && patternStr[i] !== "(") {
          name += patternStr[i];
          i++;
        }
        if (name.length > 0 && !names.includes(name)) {
          names.push(name);
        }
      } else {
        i++;
      }
    }
  }

  pathsWithCaptures(haystack: Envelope): [Path[], Map<string, Path[]>] {
    const envCase = haystack.subject().case();

    // Special case for KnownValue envelope. Rust uses `known_value.to_cbor()`,
    // and the `From<KnownValue> for CBOR` impl returns
    // `tagged_cbor()` — i.e. the same tagged form `taggedCbor()` produces
    // here.
    if (envCase.type === "knownValue") {
      const knownValue = envCase.value;
      const knownValueCbor = knownValue.taggedCbor();

      switch (this._pattern.type) {
        case "Any":
          return [[[haystack]], new Map<string, Path[]>()];
        case "Value": {
          // Use canonical CBOR equality (mirrors Rust `==`).
          if (cborEquals(knownValueCbor, this._pattern.cbor)) {
            return [[[haystack]], new Map<string, Path[]>()];
          }
          return [[], new Map<string, Path[]>()];
        }
        case "Pattern": {
          const { paths: dcborPaths, captures: dcborCaptures } = dcborPatternPathsWithCaptures(
            this._pattern.pattern,
            knownValueCbor,
          );

          if (dcborPaths.length > 0) {
            const basePath: Path = [haystack];
            const envelopePaths: Path[] = dcborPaths.map((dcborPath: Cbor[]) => {
              const extendedPath = [...basePath];
              // Skip the first element as it represents the root CBOR
              for (let i = 1; i < dcborPath.length; i++) {
                const elem = dcborPath[i];
                if (elem !== undefined) {
                  extendedPath.push(Envelope.newLeaf(elem));
                }
              }
              return extendedPath;
            });

            const envelopeCaptures = this._convertDcborCapturesToEnvelopeCaptures(
              dcborCaptures,
              haystack,
              knownValueCbor,
            );
            return [envelopePaths, envelopeCaptures];
          }
          return [[], new Map<string, Path[]>()];
        }
      }
    }

    // Standard case for CBOR leaf
    const leafCbor = haystack.subject().asLeaf();
    if (leafCbor === undefined) {
      return [[], new Map<string, Path[]>()];
    }

    switch (this._pattern.type) {
      case "Any":
        return [[[haystack]], new Map<string, Path[]>()];

      case "Value":
        // Canonical CBOR-byte equality, mirroring Rust `==`.
        if (cborEquals(leafCbor, this._pattern.cbor)) {
          return [[[haystack]], new Map<string, Path[]>()];
        }
        return [[], new Map<string, Path[]>()];

      case "Pattern": {
        const { paths: dcborPaths, captures: dcborCaptures } = dcborPatternPathsWithCaptures(
          this._pattern.pattern,
          leafCbor,
        );

        if (dcborPaths.length > 0) {
          const basePath: Path = [haystack];

          const envelopePaths: Path[] = dcborPaths.map((dcborPath: Cbor[]) => {
            const extendedPath = [...basePath];
            const first = dcborPath[0];
            const skipFirst = first !== undefined && cborEquals(first, leafCbor);

            const elementsToAdd = skipFirst ? dcborPath.slice(1) : dcborPath;

            for (const cborElement of elementsToAdd) {
              extendedPath.push(Envelope.newLeaf(cborElement));
            }
            return extendedPath;
          });

          const envelopeCaptures = this._convertDcborCapturesToEnvelopeCaptures(
            dcborCaptures,
            haystack,
            leafCbor,
          );
          return [envelopePaths, envelopeCaptures];
        }
        return [[], new Map<string, Path[]>()];
      }
    }
  }

  paths(haystack: Envelope): Path[] {
    return this.pathsWithCaptures(haystack)[0];
  }

  matches(haystack: Envelope): boolean {
    return this.paths(haystack).length > 0;
  }

  compile(code: Instr[], literals: Pattern[], captures: string[]): void {
    // Register any capture names from this CBOR pattern
    if (this._pattern.type === "Pattern") {
      const captureNames: string[] = [];
      this._collectDcborCaptureNames(this._pattern.pattern, captureNames);
      for (const name of captureNames) {
        if (!captures.includes(name)) {
          captures.push(name);
        }
      }
    }

    if (createLeafCBORPattern === undefined) {
      throw new Error("CBORPattern factory not registered");
    }
    compileAsAtomic(createLeafCBORPattern(this), code, literals, captures);
  }

  isComplex(): boolean {
    return false;
  }

  toString(): string {
    switch (this._pattern.type) {
      case "Any":
        return "cbor";
      case "Value":
        return `cbor(${this._pattern.cbor.toDiagnostic()})`;
      case "Pattern":
        return `cbor(/${dcborPatternDisplay(this._pattern.pattern)}/)`;
    }
  }

  /**
   * Equality comparison. `Value` variants compare by canonical CBOR
   * byte sequence (mirrors Rust `==` on `CBOR`); `Pattern` variants fall
   * back to display-string compare since `DCBORPattern` doesn't expose
   * structural equality outside the crate.
   */
  equals(other: CBORPattern): boolean {
    if (this._pattern.type !== other._pattern.type) {
      return false;
    }
    switch (this._pattern.type) {
      case "Any":
        return true;
      case "Value":
        return cborEquals(
          this._pattern.cbor,
          (other._pattern as { type: "Value"; cbor: Cbor }).cbor,
        );
      case "Pattern":
        return (
          dcborPatternDisplay(this._pattern.pattern) ===
          dcborPatternDisplay(
            (other._pattern as { type: "Pattern"; pattern: DCBORPattern }).pattern,
          )
        );
    }
  }

  /**
   * Hash code for use in Maps/Sets.
   */
  hashCode(): number {
    switch (this._pattern.type) {
      case "Any":
        return 0;
      case "Value": {
        // Hash the canonical CBOR-byte representation so two values
        // that compare equal under `cborEquals` always hash the same.
        const bytes = cborData(this._pattern.cbor);
        let hash = 0;
        for (const byte of bytes) {
          hash = (hash * 31 + byte) | 0;
        }
        return hash;
      }
      case "Pattern":
        return simpleStringHash(dcborPatternDisplay(this._pattern.pattern));
    }
  }
}

/**
 * Simple string hash function for hashCode implementations.
 */
function simpleStringHash(str: string): number {
  let hash = 0;
  for (const char of str) {
    hash = (hash << 5) - hash + char.charCodeAt(0);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash;
}
