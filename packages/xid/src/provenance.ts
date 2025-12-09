/**
 * XID Provenance
 *
 * Represents provenance information in an XID document, containing a provenance mark
 * and optional generator.
 *
 * Ported from bc-xid-rust/src/provenance.rs
 */

import { Envelope, type EnvelopeEncodable } from "@blockchain-commons/envelope";
import { PROVENANCE_GENERATOR, SALT } from "@blockchain-commons/known-values";
import { Salt } from "@blockchain-commons/components";
import { ProvenanceMark, ProvenanceMarkGenerator } from "@blockchain-commons/provenance-mark";
import { XIDError } from "./error.js";

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
    if (this._generator === undefined) return undefined;

    if (this._generator.data.type === "decrypted") {
      return this._generator.data.generator;
    }

    // Try to decrypt
    if (password !== undefined) {
      const encryptedEnvelope = this._generator.data.envelope;
      try {
        const decrypted = (
          encryptedEnvelope as unknown as { decryptSubject(p: Uint8Array): Envelope }
        ).decryptSubject(password);
        const unwrapped = (decrypted as unknown as { tryUnwrap(): Envelope }).tryUnwrap();
        // Extract generator from unwrapped envelope
        const generatorData = (
          unwrapped as unknown as { asByteString(): Uint8Array | undefined }
        ).asByteString();
        if (generatorData !== undefined) {
          const generator = ProvenanceMarkGenerator.fromCbor(generatorData);
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
   * Convert to envelope with specified options.
   */
  intoEnvelopeOpt(generatorOptions: XIDGeneratorOptionsValue = XIDGeneratorOptions.Omit): Envelope {
    // Create envelope with the mark as subject
    let envelope = Envelope.new(this._mark.toCbor());

    // Handle generator
    if (this._generator !== undefined) {
      const { data, salt } = this._generator;

      if (data.type === "encrypted") {
        // Always preserve encrypted generators
        const assertionEnvelope = Envelope.newAssertion(
          PROVENANCE_GENERATOR,
          data.envelope,
        ).addAssertion(SALT, salt.toData());
        envelope = envelope.addAssertionEnvelope(assertionEnvelope);
      } else if (data.type === "decrypted") {
        // Handle decrypted generators based on options
        const option =
          typeof generatorOptions === "object" ? generatorOptions.type : generatorOptions;

        switch (option) {
          case XIDGeneratorOptions.Include: {
            const assertionEnvelope = Envelope.newAssertion(
              PROVENANCE_GENERATOR,
              data.generator.toCbor(),
            ).addAssertion(SALT, salt.toData());
            envelope = envelope.addAssertionEnvelope(assertionEnvelope);
            break;
          }
          case XIDGeneratorOptions.Elide: {
            const assertionEnvelope = Envelope.newAssertion(
              PROVENANCE_GENERATOR,
              data.generator.toCbor(),
            )
              .addAssertion(SALT, salt.toData())
              .elide();
            envelope = envelope.addAssertionEnvelope(assertionEnvelope);
            break;
          }
          case XIDGeneratorOptions.Encrypt: {
            if (typeof generatorOptions === "object") {
              const generatorEnvelope = Envelope.new(data.generator.toCbor());
              const encrypted = generatorEnvelope.wrap().encryptSubject(generatorOptions.password);
              const assertionEnvelope = Envelope.newAssertion(
                PROVENANCE_GENERATOR,
                encrypted,
              ).addAssertion(SALT, salt.toData());
              envelope = envelope.addAssertionEnvelope(assertionEnvelope);
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
    // Extract mark from subject
    const markData = (
      envelope as unknown as { asByteString(): Uint8Array | undefined }
    ).asByteString();
    if (markData === undefined) {
      throw XIDError.provenanceMark(new Error("Could not extract mark from envelope"));
    }
    const mark = ProvenanceMark.fromCbor(markData);

    // Extract optional generator
    let generator: { data: GeneratorData; salt: Salt } | undefined;

    const generatorAssertions = (
      envelope as unknown as { assertionsWithPredicate(p: unknown): Envelope[] }
    ).assertionsWithPredicate(PROVENANCE_GENERATOR);
    if (generatorAssertions.length > 0) {
      const generatorAssertion = generatorAssertions[0] as Envelope;
      const assertionCase = generatorAssertion.case();

      if (assertionCase.type === "assertion") {
        const generatorObject = assertionCase.assertion.object() as Envelope;

        // Extract salt
        const saltAssertions = (
          generatorAssertion as unknown as { assertionsWithPredicate(p: unknown): Envelope[] }
        ).assertionsWithPredicate(SALT);
        let salt: Salt;
        if (saltAssertions.length > 0) {
          const saltAssertion = saltAssertions[0] as Envelope;
          const saltCase = saltAssertion.case();
          if (saltCase.type === "assertion") {
            const saltData = (
              saltCase.assertion.object() as Envelope as unknown as {
                asByteString(): Uint8Array | undefined;
              }
            ).asByteString();
            if (saltData !== undefined) {
              salt = Salt.from(saltData);
            } else {
              salt = Salt.random(32);
            }
          } else {
            salt = Salt.random(32);
          }
        } else {
          salt = Salt.random(32);
        }

        // Check if encrypted
        const objCase = generatorObject.case();
        if (objCase.type === "encrypted") {
          if (password !== undefined) {
            try {
              const decrypted = (
                generatorObject as unknown as { decryptSubject(p: Uint8Array): Envelope }
              ).decryptSubject(password);
              const unwrapped = (decrypted as unknown as { tryUnwrap(): Envelope }).tryUnwrap();
              const generatorData = (
                unwrapped as unknown as { asByteString(): Uint8Array | undefined }
              ).asByteString();
              if (generatorData !== undefined) {
                const gen = ProvenanceMarkGenerator.fromCbor(generatorData);
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
          const generatorData = (
            generatorObject as unknown as { asByteString(): Uint8Array | undefined }
          ).asByteString();
          if (generatorData !== undefined) {
            const gen = ProvenanceMarkGenerator.fromCbor(generatorData);
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
   */
  clone(): Provenance {
    return new Provenance(
      this._mark.clone(),
      this._generator !== undefined
        ? { data: this._generator.data, salt: this._generator.salt }
        : undefined,
    );
  }
}
