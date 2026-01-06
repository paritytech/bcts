/// Format context for Gordian Envelopes with annotations.
///
/// The FormatContext provides information about CBOR tags, known values,
/// functions, and parameters that are used to annotate the output of envelope
/// formatting functions. This context enables human-readable output when
/// converting envelopes to string representations like diagnostic notation.

import {
  type TagsStore,
  type TagsStoreTrait,
  type Tag,
  type CborNumber,
  type CborSummarizer,
  TagsStore as TagsStoreClass,
  getGlobalTagsStore,
  registerTags as registerDcborTags,
} from "@bcts/dcbor";
import {
  type KnownValuesStore,
  KnownValuesStore as KnownValuesStoreClass,
  KnownValue,
  KNOWN_VALUES,
  TAG_KNOWN_VALUE,
} from "@bcts/known-values";

// ============================================================================
// FormatContextOpt - Option type for format context
// ============================================================================

/// Option type for format context, similar to Rust's FormatContextOpt<'a>.
export type FormatContextOpt =
  | { type: "none" }
  | { type: "global" }
  | { type: "custom"; context: FormatContext };

/// Create a FormatContextOpt with no context
export const formatContextNone = (): FormatContextOpt => ({ type: "none" });

/// Create a FormatContextOpt with global context
export const formatContextGlobal = (): FormatContextOpt => ({ type: "global" });

/// Create a FormatContextOpt with custom context
export const formatContextCustom = (context: FormatContext): FormatContextOpt => ({
  type: "custom",
  context,
});

// ============================================================================
// FormatContext - Main formatting context class
// ============================================================================

/// Context object for formatting Gordian Envelopes with annotations.
///
/// The FormatContext provides information about CBOR tags, known values,
/// functions, and parameters that are used to annotate the output of envelope
/// formatting functions.
export class FormatContext implements TagsStoreTrait {
  readonly #tags: TagsStore;
  readonly #knownValues: KnownValuesStore;

  constructor(tags?: TagsStore, knownValues?: KnownValuesStore) {
    this.#tags = tags ?? new TagsStoreClass();
    this.#knownValues = knownValues ?? new KnownValuesStoreClass();
  }

  /// Returns a reference to the CBOR tags registry.
  tags(): TagsStore {
    return this.#tags;
  }

  /// Returns a reference to the known values registry.
  knownValues(): KnownValuesStore {
    return this.#knownValues;
  }

  // Implement TagsStoreTrait by delegating to internal tags store
  assignedNameForTag(tag: Tag): string | undefined {
    return this.#tags.assignedNameForTag(tag);
  }

  nameForTag(tag: Tag): string {
    return this.#tags.nameForTag(tag);
  }

  tagForValue(value: CborNumber): Tag | undefined {
    return this.#tags.tagForValue(value);
  }

  tagForName(name: string): Tag | undefined {
    return this.#tags.tagForName(name);
  }

  nameForValue(value: CborNumber): string {
    return this.#tags.nameForValue(value);
  }

  summarizer(tag: CborNumber): CborSummarizer | undefined {
    return this.#tags.summarizer(tag);
  }

  /// Register a tag with a name
  registerTag(value: number | bigint, name: string): void {
    this.#tags.insert({ value: BigInt(value), name });
  }

  /// Create a clone of this context
  clone(): FormatContext {
    // Note: This creates a shallow copy - tags and knownValues are shared
    // For a full deep copy, we would need to clone the stores
    return new FormatContext(this.#tags, this.#knownValues);
  }
}

// ============================================================================
// Global Format Context
// ============================================================================

/// Global singleton instance of FormatContext for application-wide use.
let _globalFormatContextInstance: FormatContext | undefined;
let isInitialized = false;

/// Get the global format context instance, initializing it if necessary.
export const getGlobalFormatContext = (): FormatContext => {
  if (!isInitialized) {
    // Register all known tags in the global tags store
    registerDcborTags();

    // Get the global stores
    const tags = getGlobalTagsStore();
    const knownValues = KNOWN_VALUES;

    _globalFormatContextInstance = new FormatContext(tags, knownValues);
    isInitialized = true;

    // Set up known value summarizer
    setupKnownValueSummarizer(_globalFormatContextInstance);
  }
  return _globalFormatContextInstance!;
};

/// Execute a function with access to the global format context.
export const withFormatContext = <T>(action: (context: FormatContext) => T): T => {
  return action(getGlobalFormatContext());
};

/// Execute a function with mutable access to the global format context.
export const withFormatContextMut = <T>(action: (context: FormatContext) => T): T => {
  return action(getGlobalFormatContext());
};

// ============================================================================
// Tag Registration
// ============================================================================

/// Set up the known value summarizer in a format context
const setupKnownValueSummarizer = (context: FormatContext): void => {
  const knownValues = context.knownValues();
  const tags = context.tags();

  // Known value summarizer - formats known values with single quotes
  const summarizer: CborSummarizer = (cbor, _flat) => {
    try {
      // Try to extract the known value from the CBOR
      const kv = KnownValue.fromUntaggedCbor(cbor);
      const name = knownValues.name(kv);
      return `'${name}'`;
    } catch {
      return "'<unknown>'";
    }
  };

  tags.setSummarizer(BigInt(TAG_KNOWN_VALUE), summarizer);
};

/// Registers standard tags and summarizers in a format context.
export const registerTagsIn = (context: FormatContext): void => {
  // Register all known tags
  registerDcborTags();

  // Set up known value summarizer
  setupKnownValueSummarizer(context);
};

/// Registers standard tags in the global format context.
export const registerTags = (): void => {
  withFormatContextMut((context) => {
    registerTagsIn(context);
  });
};

// ============================================================================
// Exports
// ============================================================================

/// Alias function for getGlobalFormatContext
export const globalFormatContext = getGlobalFormatContext;

/// Object-style access to global format context
export const GLOBAL_FORMAT_CONTEXT = {
  get: getGlobalFormatContext,
};
