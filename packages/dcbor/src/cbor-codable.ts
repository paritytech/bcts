/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * CBOR Encoding and Decoding Interfaces.
 *
 * These interfaces provide functionality for converting between TypeScript types and
 * CBOR data. They form the foundation of the dCBOR serialization
 * infrastructure.
 *
 * The main interfaces are:
 *
 * - `CborEncodable`: For types that can be encoded to CBOR
 * - `CborDecodable`: For types that can be decoded from CBOR
 * - `CborCodable`: For types that can do both (a combination of the above)
 *
 * These interfaces allow for ergonomic conversions using TypeScript's type system and
 * enable seamless integration with dCBOR's deterministic encoding rules.
 *
 * @module cbor-codable
 */

import type { Cbor } from "./cbor";

/**
 * Interface for types that can be encoded to CBOR.
 *
 * This interface provides convenient methods for converting
 * instances into CBOR objects and binary data.
 *
 * @example
 * ```typescript
 * // Custom type that can convert to CBOR
 * class Person implements CborEncodable {
 *   constructor (public name: string, public age: number) {}
 *
 *   toCbor(): Cbor {
 *     const map = new CborMap();
 *     map.set(cbor('name'), cbor(this.name));
 *     map.set(cbor('age'), cbor(this.age));
 *     return cbor(map);
 *   }
 *
 *   toCborData(): Uint8Array {
 *     return cborData(this.toCbor());
 *   }
 * }
 *
 * // Use the interface
 * const person = new Person('Alice', 30);
 *
 * // Convert to CBOR
 * const cborValue = person.toCbor();
 *
 * // Convert directly to binary CBOR data
 * const data = person.toCborData();
 * ```
 */
export interface CborEncodable {
  /**
   * Converts this value to a CBOR object.
   *
   * @returns CBOR representation
   */
  toCbor(): Cbor;

  /**
   * Converts this value directly to binary CBOR data.
   *
   * This is a shorthand for `cborData(this.toCbor())`.
   *
   * @returns Binary CBOR data
   */
  toCborData(): Uint8Array;
}

/**
 * Interface for types that can be decoded from CBOR.
 *
 * This interface serves as a marker to indicate that a type
 * supports being created from CBOR data.
 *
 * @typeParam T - The type being decoded
 *
 * @example
 * ```typescript
 * // Custom type that can be decoded from CBOR
 * class Person implements CborDecodable<Person> {
 *   constructor(public name: string = '', public age: number = 0) {}
 *
 *   static fromCbor(cbor: Cbor): Person {
 *     if (cbor.type !== MajorType.Map) {
 *       throw new Error('Expected a CBOR map');
 *     }
 *     const map = cbor.value as CborMap;
 *     const name = extractCbor(map.get(cbor('name'))!) as string;
 *     const age = extractCbor(map.get(cbor('age'))!) as number;
 *     return new Person(name, age);
 *   }
 *
 *   tryFromCbor(cbor: Cbor): Person {
 *     return Person.fromCbor(cbor);
 *   }
 * }
 *
 * // Parse from CBOR
 * const cborMap = ...; // some CBOR map
 * const person = Person.fromCbor(cborMap);
 * ```
 */
export interface CborDecodable<T> {
  /**
   * Try to create an instance from a CBOR value.
   *
   * @param cbor - CBOR value to decode
   * @returns Decoded instance
   * @throws Error if decoding fails
   */
  tryFromCbor(cbor: Cbor): T;
}

/**
 * Interface for types that can be both encoded to and decoded from CBOR.
 *
 * This interface is a convenience marker for types that implement both
 * `CborEncodable` and `CborDecodable`. It serves to indicate full CBOR
 * serialization support.
 *
 * @typeParam T - The type being encoded/decoded
 *
 * @example
 * ```typescript
 * // Custom type that implements both conversion directions
 * class Person implements CborCodable<Person> {
 *   constructor(public name: string = '', public age: number = 0) {}
 *
 *   // Implement encoding to CBOR
 *   toCbor(): Cbor {
 *     const map = new CborMap();
 *     map.set(cbor('name'), cbor(this.name));
 *     map.set(cbor('age'), cbor(this.age));
 *     return cbor(map);
 *   }
 *
 *   toCborData(): Uint8Array {
 *     return cborData(this.toCbor());
 *   }
 *
 *   // Implement decoding from CBOR
 *   static fromCbor(cbor: Cbor): Person {
 *     if (cbor.type !== MajorType.Map) {
 *       throw new Error('Expected a CBOR map');
 *     }
 *     const map = cbor.value as CborMap;
 *     const name = extractCbor(map.get(cbor('name'))!) as string;
 *     const age = extractCbor(map.get(cbor('age'))!) as number;
 *     return new Person(name, age);
 *   }
 *
 *   tryFromCbor(cbor: Cbor): Person {
 *     return Person.fromCbor(cbor);
 *   }
 * }
 *
 * // Person now implements CborCodable
 * const person = new Person('Alice', 30);
 * const cborValue = person.toCbor(); // Using CborEncodable
 *
 * // Create a round-trip copy
 * const personCopy = Person.fromCbor(cborValue); // Using CborDecodable
 * ```
 */
export interface CborCodable<T> extends CborEncodable, CborDecodable<T> {}
