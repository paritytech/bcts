/**
 * XID Provenance
 *
 * Represents provenance information in an XID document, containing a provenance mark
 * and optional generator.
 *
 * Ported from bc-xid-rust/src/provenance.rs
 */

import { Envelope, type EnvelopeEncodable, type EnvelopeEncodableValue } from "@bcts/envelope";
import { PROVENANCE_GENERATOR, SALT, type KnownValue } from "@bcts/known-values";
import { Salt, type KeyDerivationMethod, defaultKeyDerivationMethod } from "@bcts/components";

// Helper to convert KnownValue to EnvelopeEncodableValue
const kv = (v: KnownValue): EnvelopeEncodableValue => v as unknown as EnvelopeEncodableValue;
import { ProvenanceMark, ProvenanceMarkGenerator } from "@bcts/provenance-mark";
import { XIDError } from "./error";

// Encode generator JSON as bytes for storage in envelope
const encodeGeneratorJSON = (json: Record<string, unknown>): Uint8Array =>
  new TextEncoder().encode(JSON.stringify(json));

// Decode generator JSON from bytes stored in envelope
const decodeGeneratorJSON = (data: Uint8Array): Record<string, unknown> =>
  JSON.parse(new TextDecoder().decode(data)) as Record<string, unknown>;

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
      asByteString(): Uint8Array | undefined;
    };

    if (this._generator === undefined) return undefined;

    if (this._generator.data.type === "decrypted") {
      return this._generator.data.generator;
    }

    // Try to decrypt
    if (password !== undefined) {
      const encryptedEnvelope = this._generator.data.envelope as EnvelopeExt;
      try {
        const decrypted = encryptedEnvelope.unlockSubject(password) as EnvelopeExt;
        const unwrapped = (decrypted.subject() as EnvelopeExt).tryUnwrap() as EnvelopeExt;
        // Extract generator from unwrapped envelope
        const generatorData = unwrapped.asByteString();
        if (generatorData !== undefined) {
          const json = decodeGeneratorJSON(generatorData);
          const generator = ProvenanceMarkGenerator.fromJSON(json);
          // Replace encrypted with decrypted
          this._generator = {
            data: { type: "decrypted", generator },
            salt: this._generator.salt,
          };
          return generator;
        }
      } catch {
        throw XIDError.invalidPassword();
      }
    }

    throw XIDError.invalidPassword();
  }

  /**
   * Get the generator envelope, optionally decrypting it.
   *
   * Returns:
   * - undefined if no generator
   * - An envelope containing the generator if unencrypted
   * - The decrypted envelope if encrypted + correct password
   * - The encrypted envelope as-is if encrypted + no password
   * - Throws on wrong password
   */
  generatorEnvelope(password?: string): Envelope | undefined {
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
      const generatorBytes = encodeGeneratorJSON(data.generator.toJSON());
      return Envelope.new(generatorBytes);
    }
    // Encrypted case
    if (password !== undefined) {
      try {
        const decrypted = (data.envelope as EnvelopeExt).unlockSubject(
          new TextEncoder().encode(password),
        ) as EnvelopeExt;
        const unwrapped = (decrypted.subject() as EnvelopeExt).tryUnwrap();
        return unwrapped;
      } catch {
        throw XIDError.invalidPassword();
      }
    }
    // No password — return encrypted envelope as-is
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

    // Create envelope with the mark as subject
    let envelope = Envelope.new(this._mark.toCborData());

    // Handle generator
    if (this._generator !== undefined) {
      const { data, salt } = this._generator;

      if (data.type === "encrypted") {
        // Always preserve encrypted generators
        envelope = envelope.addAssertion(kv(PROVENANCE_GENERATOR), data.envelope);
        envelope = envelope.addAssertion(kv(SALT), salt.toData());
      } else if (data.type === "decrypted") {
        // Handle decrypted generators based on options
        const option =
          typeof generatorOptions === "object" ? generatorOptions.type : generatorOptions;

        switch (option) {
          case XIDGeneratorOptions.Include: {
            const generatorBytes = encodeGeneratorJSON(data.generator.toJSON());
            envelope = envelope.addAssertion(kv(PROVENANCE_GENERATOR), generatorBytes);
            envelope = envelope.addAssertion(kv(SALT), salt.toData());
            break;
          }
          case XIDGeneratorOptions.Elide: {
            const generatorBytes2 = encodeGeneratorJSON(data.generator.toJSON());
            const baseAssertion = Envelope.newAssertion(kv(PROVENANCE_GENERATOR), generatorBytes2);
            const elidedAssertion = (baseAssertion as EnvelopeExt).elide();
            envelope = envelope.addAssertionEnvelope(elidedAssertion);
            envelope = envelope.addAssertion(kv(SALT), salt.toData());
            break;
          }
          case XIDGeneratorOptions.Encrypt: {
            if (typeof generatorOptions === "object") {
              const generatorBytes3 = encodeGeneratorJSON(data.generator.toJSON());
              const generatorEnvelope = Envelope.new(generatorBytes3) as EnvelopeExt;
              const wrapped = generatorEnvelope.wrap() as EnvelopeExt;
              const method: KeyDerivationMethod = generatorOptions.method ?? defaultKeyDerivationMethod();
              const encrypted = (wrapped as unknown as EnvelopeExt).lockSubject(
                method,
                generatorOptions.password,
              );
              envelope = envelope.addAssertion(kv(PROVENANCE_GENERATOR), encrypted);
              envelope = envelope.addAssertion(kv(SALT), salt.toData());
            }
            break;
          }
          case XIDGeneratorOptions.Omit:
          default:
            // Do nothing - omit generator
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
   */
  static tryFromEnvelope(envelope: Envelope, password?: Uint8Array): Provenance {
    type EnvelopeExt = Envelope & {
      asByteString(): Uint8Array | undefined;
      subject(): Envelope;
      assertionsWithPredicate(p: unknown): Envelope[];
      unlockSubject(p: Uint8Array): Envelope;
      isLockedWithPassword(): boolean;
      tryUnwrap(): Envelope;
    };
    const env = envelope as EnvelopeExt;

    // Extract mark from subject
    // The envelope may be a node (with assertions) or a leaf
    const envCase = env.case();
    const subject =
      envCase.type === "node" ? (env as unknown as { subject(): Envelope }).subject() : envelope;
    const markData = (subject as EnvelopeExt).asByteString();
    if (markData === undefined) {
      throw XIDError.provenanceMark(new Error("Could not extract mark from envelope"));
    }
    const mark = ProvenanceMark.fromCborData(markData);

    // Extract optional generator
    let generator: { data: GeneratorData; salt: Salt } | undefined;

    // Extract salt from top level (if present)
    let salt: Salt = Salt.random(32);
    const saltAssertions = env.assertionsWithPredicate(SALT);
    if (saltAssertions.length > 0) {
      const saltAssertion = saltAssertions[0];
      const saltCase = saltAssertion.case();
      if (saltCase.type === "assertion") {
        const saltObj = saltCase.assertion.object() as EnvelopeExt;
        const saltData = saltObj.asByteString();
        if (saltData !== undefined) {
          salt = Salt.from(saltData);
        }
      }
    }

    const generatorAssertions = env.assertionsWithPredicate(PROVENANCE_GENERATOR);
    if (generatorAssertions.length > 0) {
      const generatorAssertion = generatorAssertions[0] as EnvelopeExt;
      const assertionCase = generatorAssertion.case();

      if (assertionCase.type === "assertion") {
        const generatorObject = assertionCase.assertion.object() as EnvelopeExt;

        // Check if locked with password (uses hasSecret assertion with EncryptedKey)
        if (generatorObject.isLockedWithPassword()) {
          if (password !== undefined) {
            try {
              const decrypted = generatorObject.unlockSubject(password) as EnvelopeExt;
              const unwrapped = (decrypted.subject() as EnvelopeExt).tryUnwrap() as EnvelopeExt;
              const generatorData = unwrapped.asByteString();
              if (generatorData !== undefined) {
                const json = decodeGeneratorJSON(generatorData);
                const gen = ProvenanceMarkGenerator.fromJSON(json);
                generator = {
                  data: { type: "decrypted", generator: gen },
                  salt,
                };
              }
            } catch {
              // Wrong password - store as encrypted
              generator = {
                data: { type: "encrypted", envelope: generatorObject },
                salt,
              };
            }
          } else {
            // No password - store as encrypted
            generator = {
              data: { type: "encrypted", envelope: generatorObject },
              salt,
            };
          }
        } else {
          // Plain text generator
          const generatorData = generatorObject.asByteString();
          if (generatorData !== undefined) {
            const json2 = decodeGeneratorJSON(generatorData);
            const gen = ProvenanceMarkGenerator.fromJSON(json2);
            generator = {
              data: { type: "decrypted", generator: gen },
              salt,
            };
          }
        }
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
