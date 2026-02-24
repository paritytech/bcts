/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

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
  toTaggedValue,
} from "@bcts/dcbor";
import {
  type KnownValuesStore,
  KnownValuesStore as KnownValuesStoreClass,
  KnownValue,
  KNOWN_VALUES,
  TAG_KNOWN_VALUE,
} from "@bcts/known-values";
import {
  registerTags as registerBcTags,
  DIGEST as TAG_DIGEST,
  ARID as TAG_ARID,
  URI as TAG_URI,
  UUID as TAG_UUID,
  NONCE as TAG_NONCE,
  SALT as TAG_SALT,
  SEED as TAG_SEED,
  SIGNATURE as TAG_SIGNATURE,
  SEALED_MESSAGE as TAG_SEALED_MESSAGE,
  ENCRYPTED_KEY as TAG_ENCRYPTED_KEY,
  PRIVATE_KEY_BASE as TAG_PRIVATE_KEY_BASE,
  PRIVATE_KEYS as TAG_PRIVATE_KEYS,
  PUBLIC_KEYS as TAG_PUBLIC_KEYS,
  SIGNING_PRIVATE_KEY as TAG_SIGNING_PRIVATE_KEY,
  SIGNING_PUBLIC_KEY as TAG_SIGNING_PUBLIC_KEY,
  SSKR_SHARE as TAG_SSKR_SHARE,
  XID as TAG_XID,
} from "@bcts/tags";
import {
  Digest,
  ARID,
  URI,
  UUID,
  Nonce,
  Salt,
  Seed,
  Signature,
  SignatureScheme,
  SealedMessage,
  EncapsulationScheme,
  EncryptedKey,
  PrivateKeyBase,
  PrivateKeys,
  PublicKeys,
  SigningPrivateKey,
  SigningPublicKey,
  SSKRShareCbor,
  XID,
} from "@bcts/components";

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
  private readonly _tags: TagsStore;
  private readonly _knownValues: KnownValuesStore;

  constructor(tags?: TagsStore, knownValues?: KnownValuesStore) {
    this._tags = tags ?? new TagsStoreClass();
    this._knownValues = knownValues ?? new KnownValuesStoreClass();
  }

  /// Returns a reference to the CBOR tags registry.
  tags(): TagsStore {
    return this._tags;
  }

  /// Returns a reference to the known values registry.
  knownValues(): KnownValuesStore {
    return this._knownValues;
  }

  // Implement TagsStoreTrait by delegating to internal tags store
  assignedNameForTag(tag: Tag): string | undefined {
    return this._tags.assignedNameForTag(tag);
  }

  nameForTag(tag: Tag): string {
    return this._tags.nameForTag(tag);
  }

  tagForValue(value: CborNumber): Tag | undefined {
    return this._tags.tagForValue(value);
  }

  tagForName(name: string): Tag | undefined {
    return this._tags.tagForName(name);
  }

  nameForValue(value: CborNumber): string {
    return this._tags.nameForValue(value);
  }

  summarizer(tag: CborNumber): CborSummarizer | undefined {
    return this._tags.summarizer(tag);
  }

  /// Register a tag with a name
  registerTag(value: number | bigint, name: string): void {
    this._tags.insert({ value: BigInt(value), name });
  }

  /// Create a clone of this context
  clone(): FormatContext {
    // Note: This creates a shallow copy - tags and knownValues are shared
    // For a full deep copy, we would need to clone the stores
    return new FormatContext(this._tags, this._knownValues);
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
    // Register all known tags (dcbor + BC component tags) in the global tags store
    registerBcTags();

    // Get the global stores
    const tags = getGlobalTagsStore();
    const knownValues = KNOWN_VALUES.get();

    _globalFormatContextInstance = new FormatContext(tags, knownValues);
    isInitialized = true;

    // Set up known value summarizer
    setupKnownValueSummarizer(_globalFormatContextInstance);

    // Set up component tag summarizers
    setupComponentSummarizers(_globalFormatContextInstance);
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Safe: initialized in the if block above
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
      return { ok: true, value: `'${name}'` };
    } catch {
      return { ok: true, value: "'<unknown>'" };
    }
  };

  tags.setSummarizer(BigInt(TAG_KNOWN_VALUE), summarizer);
};

/// Registers standard tags and summarizers in a format context.
export const registerTagsIn = (context: FormatContext): void => {
  // Register all known tags (dcbor + BC component tags)
  registerBcTags();

  // Set up known value summarizer
  setupKnownValueSummarizer(context);

  // Set up component tag summarizers
  setupComponentSummarizers(context);
};

/// Registers standard tags in the global format context.
export const registerTags = (): void => {
  withFormatContextMut((context) => {
    registerTagsIn(context);
  });
};

// ============================================================================
// Component Tag Summarizers
// ============================================================================

/// Helper to create an error result for summarizers
const summarizerError = (e: unknown): { ok: false; error: { type: "Custom"; message: string } } => {
  const message = e instanceof Error ? e.message : String(e);
  return { ok: false as const, error: { type: "Custom" as const, message } };
};

/// Set up component tag summarizers matching Rust bc-components-rust/src/tags_registry.rs
const setupComponentSummarizers = (context: FormatContext): void => {
  const tags = context.tags();

  // Digest: "Digest(shortDesc)"
  tags.setSummarizer(TAG_DIGEST.value, (cbor, _flat) => {
    try {
      const tagged = toTaggedValue(TAG_DIGEST.value, cbor);
      const digest = Digest.fromTaggedCbor(tagged);
      return { ok: true, value: `Digest(${digest.shortDescription()})` };
    } catch (e) {
      return summarizerError(e);
    }
  });

  // ARID: "ARID(shortDesc)"
  tags.setSummarizer(TAG_ARID.value, (cbor, _flat) => {
    try {
      const tagged = toTaggedValue(TAG_ARID.value, cbor);
      const arid = ARID.fromTaggedCbor(tagged);
      return { ok: true, value: `ARID(${arid.shortDescription()})` };
    } catch (e) {
      return summarizerError(e);
    }
  });

  // URI: "URI(uri)"
  tags.setSummarizer(TAG_URI.value, (cbor, _flat) => {
    try {
      const tagged = toTaggedValue(TAG_URI.value, cbor);
      const uri = URI.fromTaggedCbor(tagged);
      return { ok: true, value: `URI(${uri.toString()})` };
    } catch (e) {
      return summarizerError(e);
    }
  });

  // UUID: "UUID(uuid)"
  tags.setSummarizer(TAG_UUID.value, (cbor, _flat) => {
    try {
      const tagged = toTaggedValue(TAG_UUID.value, cbor);
      const uuid = UUID.fromTaggedCbor(tagged);
      return { ok: true, value: `UUID(${uuid.toString()})` };
    } catch (e) {
      return summarizerError(e);
    }
  });

  // Nonce: "Nonce"
  tags.setSummarizer(TAG_NONCE.value, (cbor, _flat) => {
    try {
      const tagged = toTaggedValue(TAG_NONCE.value, cbor);
      Nonce.fromTaggedCbor(tagged);
      return { ok: true, value: "Nonce" };
    } catch (e) {
      return summarizerError(e);
    }
  });

  // Salt: "Salt"
  tags.setSummarizer(TAG_SALT.value, (cbor, _flat) => {
    try {
      const tagged = toTaggedValue(TAG_SALT.value, cbor);
      Salt.fromTaggedCbor(tagged);
      return { ok: true, value: "Salt" };
    } catch (e) {
      return summarizerError(e);
    }
  });

  // Seed: "Seed"
  tags.setSummarizer(TAG_SEED.value, (cbor, _flat) => {
    try {
      const tagged = toTaggedValue(TAG_SEED.value, cbor);
      Seed.fromTaggedCbor(tagged);
      return { ok: true, value: "Seed" };
    } catch (e) {
      return summarizerError(e);
    }
  });

  // Signature: "Signature" for Ed25519/Schnorr (defaults), "Signature(scheme)" otherwise
  tags.setSummarizer(TAG_SIGNATURE.value, (cbor, _flat) => {
    try {
      const tagged = toTaggedValue(TAG_SIGNATURE.value, cbor);
      const sig = Signature.fromTaggedCbor(tagged);
      const scheme = sig.scheme();
      // Match Rust: default scheme shows just "Signature"
      if (scheme === SignatureScheme.Ed25519 || scheme === SignatureScheme.Schnorr) {
        return { ok: true, value: "Signature" };
      }
      return { ok: true, value: `Signature(${sig.signatureType()})` };
    } catch (e) {
      return summarizerError(e);
    }
  });

  // SealedMessage: "SealedMessage" for X25519 (default), "SealedMessage(scheme)" otherwise
  tags.setSummarizer(TAG_SEALED_MESSAGE.value, (cbor, _flat) => {
    try {
      const tagged = toTaggedValue(TAG_SEALED_MESSAGE.value, cbor);
      const msg = SealedMessage.fromTaggedCbor(tagged);
      const scheme = msg.encapsulationScheme();
      if (scheme === EncapsulationScheme.X25519) {
        return { ok: true, value: "SealedMessage" };
      }
      return { ok: true, value: `SealedMessage(${scheme})` };
    } catch (e) {
      return summarizerError(e);
    }
  });

  // EncryptedKey: toString()
  tags.setSummarizer(TAG_ENCRYPTED_KEY.value, (cbor, _flat) => {
    try {
      const tagged = toTaggedValue(TAG_ENCRYPTED_KEY.value, cbor);
      const ek = EncryptedKey.fromTaggedCbor(tagged);
      return { ok: true, value: ek.toString() };
    } catch (e) {
      return summarizerError(e);
    }
  });

  // PrivateKeyBase: toString()
  tags.setSummarizer(TAG_PRIVATE_KEY_BASE.value, (cbor, _flat) => {
    try {
      const tagged = toTaggedValue(TAG_PRIVATE_KEY_BASE.value, cbor);
      const pkb = PrivateKeyBase.fromTaggedCbor(tagged);
      return { ok: true, value: pkb.toString() };
    } catch (e) {
      return summarizerError(e);
    }
  });

  // PrivateKeys: toString()
  tags.setSummarizer(TAG_PRIVATE_KEYS.value, (cbor, _flat) => {
    try {
      const tagged = toTaggedValue(TAG_PRIVATE_KEYS.value, cbor);
      const pk = PrivateKeys.fromTaggedCbor(tagged);
      return { ok: true, value: pk.toString() };
    } catch (e) {
      return summarizerError(e);
    }
  });

  // PublicKeys: toString()
  tags.setSummarizer(TAG_PUBLIC_KEYS.value, (cbor, _flat) => {
    try {
      const tagged = toTaggedValue(TAG_PUBLIC_KEYS.value, cbor);
      const pk = PublicKeys.fromTaggedCbor(tagged);
      return { ok: true, value: pk.toString() };
    } catch (e) {
      return summarizerError(e);
    }
  });

  // SigningPrivateKey: toString()
  tags.setSummarizer(TAG_SIGNING_PRIVATE_KEY.value, (cbor, _flat) => {
    try {
      const tagged = toTaggedValue(TAG_SIGNING_PRIVATE_KEY.value, cbor);
      const spk = SigningPrivateKey.fromTaggedCbor(tagged);
      return { ok: true, value: spk.toString() };
    } catch (e) {
      return summarizerError(e);
    }
  });

  // SigningPublicKey: toString()
  tags.setSummarizer(TAG_SIGNING_PUBLIC_KEY.value, (cbor, _flat) => {
    try {
      const tagged = toTaggedValue(TAG_SIGNING_PUBLIC_KEY.value, cbor);
      const spk = SigningPublicKey.fromTaggedCbor(tagged);
      return { ok: true, value: spk.toString() };
    } catch (e) {
      return summarizerError(e);
    }
  });

  // SSKRShare: "SSKRShare"
  tags.setSummarizer(TAG_SSKR_SHARE.value, (cbor, _flat) => {
    try {
      const tagged = toTaggedValue(TAG_SSKR_SHARE.value, cbor);
      SSKRShareCbor.fromTaggedCbor(tagged);
      return { ok: true, value: "SSKRShare" };
    } catch (e) {
      return summarizerError(e);
    }
  });

  // XID: "XID(shortDesc)"
  tags.setSummarizer(TAG_XID.value, (cbor, _flat) => {
    try {
      const tagged = toTaggedValue(TAG_XID.value, cbor);
      const xid = XID.fromTaggedCbor(tagged);
      return { ok: true, value: `XID(${xid.shortDescription()})` };
    } catch (e) {
      return summarizerError(e);
    }
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
