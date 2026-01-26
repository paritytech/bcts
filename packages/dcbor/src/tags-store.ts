/**
 * Tag registry and management system.
 *
 * The TagsStore provides a centralized registry for CBOR tags,
 * including name resolution and custom summarizer functions.
 *
 * @module tags-store
 */

import type { Cbor, CborNumber } from "./cbor";
import type { Tag } from "./tag";
import type { Error as CborErrorType } from "./error";

/**
 * Result type for summarizer functions, matching Rust's Result<String, Error>.
 */
export type SummarizerResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly error: CborErrorType };

/**
 * Function type for custom CBOR value summarizers.
 *
 * Summarizers provide custom string representations for tagged values.
 * Returns a Result type matching Rust's `Result<String, Error>`.
 *
 * @param cbor - The CBOR value to summarize
 * @param flat - If true, produce single-line output
 * @returns Result with summary string on success, or error on failure
 */
export type CborSummarizer = (cbor: Cbor, flat: boolean) => SummarizerResult;

/**
 * Interface for tag store operations.
 */
export interface TagsStoreTrait {
  /**
   * Get the assigned name for a tag, if any.
   *
   * @param tag - The tag to look up
   * @returns The assigned name, or undefined if no name is registered
   */
  assignedNameForTag(tag: Tag): string | undefined;

  /**
   * Get a display name for a tag.
   *
   * @param tag - The tag to get a name for
   * @returns The assigned name if available, otherwise the tag value as a string
   */
  nameForTag(tag: Tag): string;

  /**
   * Look up a tag by its numeric value.
   *
   * @param value - The numeric tag value
   * @returns The Tag object if found, undefined otherwise
   */
  tagForValue(value: CborNumber): Tag | undefined;

  /**
   * Look up a tag by its name.
   *
   * @param name - The tag name
   * @returns The Tag object if found, undefined otherwise
   */
  tagForName(name: string): Tag | undefined;

  /**
   * Get a display name for a tag value.
   *
   * @param value - The numeric tag value
   * @returns The tag name if registered, otherwise the value as a string
   */
  nameForValue(value: CborNumber): string;

  /**
   * Get a custom summarizer function for a tag, if registered.
   *
   * @param tag - The numeric tag value
   * @returns The summarizer function if registered, undefined otherwise
   */
  summarizer(tag: CborNumber): CborSummarizer | undefined;
}

/**
 * Tag registry implementation.
 *
 * Stores tags with their names and optional summarizer functions.
 */
export class TagsStore implements TagsStoreTrait {
  private readonly _tagsByValue = new Map<string, Tag>();
  private readonly _tagsByName = new Map<string, Tag>();
  private readonly _summarizers = new Map<string, CborSummarizer>();

  constructor() {
    // Start with empty store, matching Rust's Default implementation
    // Tags must be explicitly registered using insert() or registerTags()
  }

  /**
   * Insert a tag into the registry.
   *
   * Matches Rust's TagsStore::insert() behavior:
   * - Throws if the tag name is undefined or empty
   * - Throws if a tag with the same value exists with a different name
   * - Allows re-registering the same tag value with the same name
   *
   * @param tag - The tag to register (must have a non-empty name)
   * @throws Error if tag has no name, empty name, or conflicts with existing registration
   *
   * @example
   * ```typescript
   * const store = new TagsStore();
   * store.insert(createTag(12345, 'myCustomTag'));
   * ```
   */
  insert(tag: Tag): void {
    const name = tag.name;

    // Rust: let name = tag.name().unwrap(); assert!(!name.is_empty());
    if (name === undefined || name === "") {
      throw new Error(`Tag ${tag.value} must have a non-empty name`);
    }

    const key = this._valueKey(tag.value);
    const existing = this._tagsByValue.get(key);

    // Rust: if old_name != name { panic!(...) }
    if (existing?.name !== undefined && existing.name !== name) {
      throw new Error(
        `Attempt to register tag: ${tag.value} '${existing.name}' with different name: '${name}'`,
      );
    }

    this._tagsByValue.set(key, tag);
    this._tagsByName.set(name, tag);
  }

  /**
   * Insert multiple tags into the registry.
   * Matches Rust's insert_all() method.
   *
   * @param tags - Array of tags to register
   *
   * @example
   * ```typescript
   * const store = new TagsStore();
   * store.insertAll([
   *   createTag(1, 'date'),
   *   createTag(100, 'custom')
   * ]);
   * ```
   */
  insertAll(tags: Tag[]): void {
    for (const tag of tags) {
      this.insert(tag);
    }
  }

  /**
   * Register a custom summarizer function for a tag.
   *
   * @param tagValue - The numeric tag value
   * @param summarizer - The summarizer function
   *
   * @example
   * ```typescript
   * store.setSummarizer(1, (cbor, flat) => {
   *   // Custom date formatting
   *   return `Date(${extractCbor(cbor)})`;
   * });
   * ```
   */
  setSummarizer(tagValue: CborNumber, summarizer: CborSummarizer): void {
    const key = this._valueKey(tagValue);
    this._summarizers.set(key, summarizer);
  }

  assignedNameForTag(tag: Tag): string | undefined {
    const key = this._valueKey(tag.value);
    const stored = this._tagsByValue.get(key);
    return stored?.name;
  }

  nameForTag(tag: Tag): string {
    return this.assignedNameForTag(tag) ?? tag.value.toString();
  }

  tagForValue(value: CborNumber): Tag | undefined {
    const key = this._valueKey(value);
    return this._tagsByValue.get(key);
  }

  tagForName(name: string): Tag | undefined {
    return this._tagsByName.get(name);
  }

  nameForValue(value: CborNumber): string {
    const tag = this.tagForValue(value);
    return tag !== undefined ? this.nameForTag(tag) : value.toString();
  }

  summarizer(tag: CborNumber): CborSummarizer | undefined {
    const key = this._valueKey(tag);
    return this._summarizers.get(key);
  }

  /**
   * Create a string key for a numeric tag value.
   * Handles both number and bigint types.
   *
   * @private
   */
  private _valueKey(value: CborNumber): string {
    return value.toString();
  }
}

// ============================================================================
// Global Tags Store Singleton
// ============================================================================

/**
 * Global singleton instance of the tags store.
 */
let globalTagsStore: TagsStore | undefined;

/**
 * Get the global tags store instance.
 *
 * Creates the instance on first access.
 *
 * @returns The global TagsStore instance
 *
 * @example
 * ```typescript
 * const store = getGlobalTagsStore();
 * store.insert(createTag(999, 'myTag'));
 * ```
 */
export const getGlobalTagsStore = (): TagsStore => {
  globalTagsStore ??= new TagsStore();
  return globalTagsStore;
};

/**
 * Execute a function with access to the global tags store.
 *
 * @template T - Return type of the action function
 * @param action - Function to execute with the tags store
 * @returns Result of the action function
 *
 * @example
 * ```typescript
 * const tagName = withTags(store => store.nameForValue(1));
 * console.log(tagName); // 'date'
 * ```
 */
export const withTags = <T>(action: (tags: TagsStore) => T): T => {
  return action(getGlobalTagsStore());
};

/**
 * Execute a function with mutable access to the global tags store.
 *
 * This is an alias for withTags() for consistency with Rust API.
 *
 * @template T - Return type of the action function
 * @param action - Function to execute with the tags store
 * @returns Result of the action function
 */
export const withTagsMut = <T>(action: (tags: TagsStore) => T): T => {
  return action(getGlobalTagsStore());
};
