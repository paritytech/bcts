/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * XID Provenance
 *
 * Represents provenance information in an XID document, containing a provenance mark
 * and optional generator.
 *
 * Ported from bc-xid-rust/src/provenance.rs.
 *
 * Wire shape — mirrors Rust:
 * ```
 * ProvenanceMark [                              ← tagged-CBOR mark leaf
 *     {
 *         'provenanceGenerator': Generator      ← tagged generator envelope
 *     } [
 *         'salt': Salt
 *     ]
 * ]
 * ```
 */

import { Envelope, type EnvelopeEncodable, type EnvelopeEncodableValue } from "@bcts/envelope";
import { PROVENANCE_GENERATOR, SALT, type KnownValue } from "@bcts/known-values";
import { Salt, type KeyDerivationMethod, defaultKeyDerivationMethod } from "@bcts/components";
import type { Cbor } from "@bcts/dcbor";
import { ProvenanceMark, ProvenanceMarkGenerator } from "@bcts/provenance-mark";
import { XIDError } from "./error";

// Helper to convert KnownValue to EnvelopeEncodableValue
const kv = (v: KnownValue): EnvelopeEncodableValue => v;

/**
 * Options for handling generators in envelopes.
 */
export enum XIDGeneratorOptions {
  /** Omit the generator from the envelope (default). */
  Omit = "Omit",
  /** Include the generator in plaintext (with salt for decorrelation). */
  Include = "Include",
  /** Include the generator assertion but elide it (maintains digest tree). */
  Elide = "Elide",
  /** Include the generator encrypted with a password. */
  Encrypt = "Encrypt",
}

/**
 * Configuration for encrypting generators.
 */
export interface XIDGeneratorEncryptConfig {
  type: XIDGeneratorOptions.Encrypt;
  password: Uint8Array;
  method?: KeyDerivationMethod;
}

/**
 * Union type for all generator options.
 */
export type XIDGeneratorOptionsValue =
  | XIDGeneratorOptions.Omit
  | XIDGeneratorOptions.Include
  | XIDGeneratorOptions.Elide
  | XIDGeneratorEncryptConfig;

/**
 * Generator data that can be either decrypted or encrypted.
 */
export type GeneratorData =
  | { type: "decrypted"; generator: ProvenanceMarkGenerator }
  | { type: "encrypted"; envelope: Envelope };

/**
 * Represents provenance information in an XID document.
 */
export class Provenance implements EnvelopeEncodable {
  private _mark: ProvenanceMark;
  private _generator: { data: GeneratorData; salt: Salt } | undefined;

  private constructor(mark: ProvenanceMark, generator?: { data: GeneratorData; salt: Salt }) {
    this._mark = mark;
    this._generator = generator;
  }

  /**
   * Create a new Provenance with just a mark.
   */
  static new(mark: ProvenanceMark): Provenance {
    return new Provenance(mark);
  }

  /**
   * Create a new Provenance with a generator and mark.
   */
  static newWithGenerator(generator: ProvenanceMarkGenerator, mark: ProvenanceMark): Provenance {
    const salt = Salt.random(32);
    return new Provenance(mark, { data: { type: "decrypted", generator }, salt });
  }

  /**
   * Get the provenance mark.
   */
  mark(): ProvenanceMark {
    return this._mark;
  }

  /**
   * Get the generator, if available and decrypted.
   */
  generator(): ProvenanceMarkGenerator | undefined {
    if (this._generator === undefined) return undefined;
    if (this._generator.data.type === "decrypted") {
      return this._generator.data.generator;
    }
    return undefined;
  }

  /**
   * Check if this provenance has a decrypted generator.
   */
  hasGenerator(): boolean {
    return this._generator?.data.type === "decrypted";
  }

  /**
   * Check if this provenance has an encrypted generator.
   */
  hasEncryptedGenerator(): boolean {
    return this._generator?.data.type === "encrypted";
  }

  /**
   * Get the salt used for generator decorrelation.
   */
  generatorSalt(): Salt | undefined {
    return this._generator?.salt;
  }

  /**
   * Update the provenance mark.
   */
  setMark(mark: ProvenanceMark): void {
    this._mark = mark;
  }

  /**
   * Set or replace the generator.
   */
  setGenerator(generator: ProvenanceMarkGenerator): void {
    const salt = Salt.random(32);
    this._generator = { data: { type: "decrypted", generator }, salt };
  }

  /**
   * Take and remove the generator.
   */
  takeGenerator(): { data: GeneratorData; salt: Salt } | undefined {
    const gen = this._generator;
    this._generator = undefined;
    return gen;
  }

  /**
   * Get a mutable reference to the generator, decrypting if necessary.
   */
  generatorMut(password?: Uint8Array): ProvenanceMarkGenerator | undefined {
    type EnvelopeExt = Envelope & {
      unlockSubject(p: Uint8Array): Envelope;
      subject(): Envelope;
      tryUnwrap(): Envelope;
    };

    if (this._generator === undefined) return undefined;

    if (this._generator.data.type === "decrypted") {
      return this._generator.data.generator;
    }

    if (password !== undefined) {
      const encryptedEnvelope = this._generator.data.envelope as EnvelopeExt;
      try {
        const decrypted = encryptedEnvelope.unlockSubject(password);
        const unwrapped = (decrypted as EnvelopeExt).tryUnwrap();
        const generator = ProvenanceMarkGenerator.fromEnvelope(unwrapped);
        // Replace encrypted with decrypted
        this._generator = {
          data: { type: "decrypted", generator },
          salt: this._generator.salt,
        };
        return generator;
      } catch {
        throw XIDError.invalidPassword();
      }
    }

    throw XIDError.invalidPassword();
  }

  /**
   * Build the salted assertion envelope:
   * ```
   * { 'provenanceGenerator': <generator> } [ 'salt': Salt ]
   * ```
   * Mirrors Rust `Provenance::generator_assertion_envelope()`.
   */
  private generatorAssertionEnvelope(): Envelope {
    if (this._generator === undefined) {
      throw new Error("generatorAssertionEnvelope called with no generator");
    }
    const { data, salt } = this._generator;
    if (data.type === "decrypted") {
      return Envelope.newAssertion(kv(PROVENANCE_GENERATOR), data.generator).addSaltInstance(salt);
    }
    return Envelope.newAssertion(kv(PROVENANCE_GENERATOR), data.envelope).addSaltInstance(salt);
  }

  /**
   * Get the generator envelope, optionally decrypting it.
   *
   * Mirrors Rust `Provenance::generator_envelope(password)`. The
   * unencrypted variant returns the same structured envelope produced
   * by `ProvenanceMarkGenerator::into_envelope()` — never the legacy
   * JSON-bytes form.
   */
  generatorEnvelope(password?: Uint8Array | string): Envelope | undefined {
    type EnvelopeExt = Envelope & {
      unlockSubject(p: Uint8Array): Envelope;
      subject(): Envelope;
      tryUnwrap(): Envelope;
    };

    if (this._generator === undefined) {
      return undefined;
    }
    const { data } = this._generator;
    if (data.type === "decrypted") {
      return data.generator.intoEnvelope();
    }
    if (password !== undefined) {
      const passwordBytes =
        typeof password === "string" ? new TextEncoder().encode(password) : password;
      try {
        const decrypted = (data.envelope as EnvelopeExt).unlockSubject(passwordBytes);
        const unwrapped = (decrypted as EnvelopeExt).tryUnwrap();
        return unwrapped;
      } catch {
        throw XIDError.invalidPassword();
      }
    }
    return data.envelope;
  }

  /**
   * Convert to envelope with specified options.
   */
  intoEnvelopeOpt(generatorOptions: XIDGeneratorOptionsValue = XIDGeneratorOptions.Omit): Envelope {
    type EnvelopeExt = Envelope & {
      elide(): Envelope;
      wrap(): Envelope;
      lockSubject(m: KeyDerivationMethod, p: Uint8Array): Envelope;
    };

    // Subject: tagged-CBOR ProvenanceMark leaf — mirrors Rust
    // `Envelope::new(self.mark().clone())`.
    let envelope = Envelope.new(this._mark);

    if (this._generator !== undefined) {
      const { data, salt } = this._generator;

      if (data.type === "encrypted") {
        // Always preserve encrypted generators regardless of options.
        envelope = envelope.addAssertionEnvelope(this.generatorAssertionEnvelope());
      } else {
        const option =
          typeof generatorOptions === "object" ? generatorOptions.type : generatorOptions;

        switch (option) {
          case XIDGeneratorOptions.Include: {
            envelope = envelope.addAssertionEnvelope(this.generatorAssertionEnvelope());
            break;
          }
          case XIDGeneratorOptions.Elide: {
            const elided = (
              this.generatorAssertionEnvelope() as unknown as { elide(): Envelope }
            ).elide();
            envelope = envelope.addAssertionEnvelope(elided);
            break;
          }
          case XIDGeneratorOptions.Encrypt: {
            if (typeof generatorOptions === "object") {
              const generatorEnvelope = data.generator.intoEnvelope() as EnvelopeExt;
              const wrapped = generatorEnvelope.wrap() as EnvelopeExt;
              const method: KeyDerivationMethod =
                generatorOptions.method ?? defaultKeyDerivationMethod();
              const encrypted = wrapped.lockSubject(method, generatorOptions.password);
              const assertion = Envelope.newAssertion(
                kv(PROVENANCE_GENERATOR),
                encrypted,
              ).addSaltInstance(salt);
              envelope = envelope.addAssertionEnvelope(assertion);
            }
            break;
          }
          case XIDGeneratorOptions.Omit:
          default:
            // Omit decrypted generators.
            break;
        }
      }
    }

    return envelope;
  }

  // EnvelopeEncodable implementation
  intoEnvelope(): Envelope {
    return this.intoEnvelopeOpt(XIDGeneratorOptions.Omit);
  }

  /**
   * Try to extract a Provenance from an envelope, optionally with password for decryption.
   *
   * Mirrors Rust `Provenance::try_from_envelope`:
   * - Subject is a tagged-CBOR ProvenanceMark leaf.
   * - The optional generator assertion follows the
   *   `{ predicate: object } [ 'salt': Salt ]` shape.
   * - Missing salt under a present generator assertion is an error.
   */
  static tryFromEnvelope(envelope: Envelope, password?: Uint8Array): Provenance {
    type EnvelopeExt = Envelope & {
      asByteString(): Uint8Array | undefined;
      subject(): Envelope;
      assertionsWithPredicate(p: unknown): Envelope[];
      optionalAssertionWithPredicate(p: unknown): Envelope | undefined;
      tryObject(): Envelope;
      tryLeaf(): Cbor;
      unlockSubject(p: Uint8Array): Envelope;
      isLockedWithPassword(): boolean;
      tryUnwrap(): Envelope;
    };
    const env = envelope as EnvelopeExt;

    // Mark from subject — tagged CBOR leaf.
    const subjectLeaf = (env.subject() as EnvelopeExt).tryLeaf();
    const mark = ProvenanceMark.fromTaggedCbor(subjectLeaf);

    // Optional generator assertion mirrors Rust
    // `extract_optional_generator_with_password`.
    let generator: { data: GeneratorData; salt: Salt } | undefined;
    const generatorAssertion = env.optionalAssertionWithPredicate(PROVENANCE_GENERATOR);
    if (generatorAssertion !== undefined) {
      const ext = generatorAssertion as EnvelopeExt;
      const generatorObject = (ext.subject() as EnvelopeExt).tryObject() as EnvelopeExt;

      const saltAssertionInner = ext.optionalAssertionWithPredicate(SALT);
      if (saltAssertionInner === undefined) {
        throw XIDError.envelopeParsing(
          new Error("missing 'salt' assertion on provenance-generator node"),
        );
      }
      const saltObj = (saltAssertionInner as EnvelopeExt).tryObject() as EnvelopeExt;
      const salt = Salt.fromTaggedCbor(saltObj.tryLeaf());

      if (generatorObject.isLockedWithPassword()) {
        if (password !== undefined) {
          try {
            const decrypted = generatorObject.unlockSubject(password) as EnvelopeExt;
            const unwrapped = decrypted.tryUnwrap();
            const gen = ProvenanceMarkGenerator.fromEnvelope(unwrapped);
            generator = { data: { type: "decrypted", generator: gen }, salt };
          } catch {
            generator = { data: { type: "encrypted", envelope: generatorObject }, salt };
          }
        } else {
          generator = { data: { type: "encrypted", envelope: generatorObject }, salt };
        }
      } else {
        const gen = ProvenanceMarkGenerator.fromEnvelope(generatorObject);
        generator = { data: { type: "decrypted", generator: gen }, salt };
      }
    }

    return new Provenance(mark, generator);
  }

  /**
   * Check equality with another Provenance.
   */
  equals(other: Provenance): boolean {
    return this._mark.equals(other._mark);
  }

  /**
   * Clone this Provenance.
   * Note: ProvenanceMark is immutable so we can use the same instance.
   */
  clone(): Provenance {
    return new Provenance(
      this._mark,
      this._generator !== undefined
        ? { data: this._generator.data, salt: this._generator.salt }
        : undefined,
    );
  }
}
