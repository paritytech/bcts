/**
 * Utility functions for the LifeHash CLI.
 *
 * Ported from bc-lifehash-cli C++ implementation.
 *
 * @module
 */

/**
 * Appends a path component to a path, handling trailing slashes correctly.
 *
 * Port of `appending_path_component()` from lifehash.cpp lines 18-24.
 *
 * @param path - The base path
 * @param component - The component to append
 * @returns The combined path
 * @category Utilities
 *
 * @example
 * ```typescript
 * appendingPathComponent("", "file.png") // => "file.png"
 * appendingPathComponent("/tmp/", "file.png") // => "/tmp/file.png"
 * appendingPathComponent("/tmp", "file.png") // => "/tmp/file.png"
 * ```
 */
export function appendingPathComponent(path: string, component: string): string {
  if (path === "") {
    return component;
  }
  if (path.endsWith("/")) {
    return `${path}${component}`;
  }
  return `${path}/${component}`;
}

/**
 * Selects a random element from an array.
 *
 * Port of `random_element()` template from lifehash.cpp lines 38-50.
 *
 * @param array - The array to select from
 * @returns A random element from the array
 * @category Utilities
 *
 * @example
 * ```typescript
 * randomElement(["A", "B", "C"]) // => "A" or "B" or "C"
 * ```
 */
export function randomElement<T>(array: T[]): T {
  const index = Math.floor(Math.random() * array.length);
  return array[index];
}

/**
 * Generates a random input string in "XXX-XXX" format where X is a random uppercase letter.
 *
 * Port of `make_random_input()` from lifehash.cpp lines 52-57.
 *
 * @returns A random string in "XXX-XXX" format
 * @category Utilities
 *
 * @example
 * ```typescript
 * makeRandomInput() // => "ABC-DEF" (random letters)
 * ```
 */
export function makeRandomInput(): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  const letter = (): string => randomElement(letters);
  const cluster = (): string => `${letter()}${letter()}${letter()}`;

  return `${cluster()}-${cluster()}`;
}
