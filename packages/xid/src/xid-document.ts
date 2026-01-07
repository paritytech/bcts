/**
 * XID Document
 *
 * Represents an XID document containing keys, delegates, services, and provenance.
 *
 * Ported from bc-xid-rust/src/xid_document.rs
 */

import { Envelope, type EnvelopeEncodable, type EnvelopeEncodableValue } from "@bcts/envelope";
import {
  KEY,
  DELEGATE,
  SERVICE,
  PROVENANCE,
  DEREFERENCE_VIA,
  type KnownValue,
} from "@bcts/known-values";

// Helper to convert KnownValue to EnvelopeEncodableValue
const kv = (v: KnownValue): EnvelopeEncodableValue => v as unknown as EnvelopeEncodableValue;
import {
  Reference,
  XID,
  PublicKeys,
  PrivateKeyBase,
  PrivateKeys,
  type Signer,
  type Verifier,
} from "@bcts/components";
import {
  type ProvenanceMark,
  ProvenanceMarkGenerator,
  ProvenanceMarkResolution,
} from "@bcts/provenance-mark";
import { type Cbor } from "@bcts/dcbor";

import { Key, XIDPrivateKeyOptions, type XIDPrivateKeyOptionsValue } from "./key";
import { Delegate, registerXIDDocumentClass } from "./delegate";
import { Service } from "./service";
import { Provenance, XIDGeneratorOptions, type XIDGeneratorOptionsValue } from "./provenance";
import { XIDError } from "./error";

// Raw values for predicate matching
const KEY_RAW = KEY.value();
const DELEGATE_RAW = DELEGATE.value();
const SERVICE_RAW = SERVICE.value();
const PROVENANCE_RAW = PROVENANCE.value();
const DEREFERENCE_VIA_RAW = DEREFERENCE_VIA.value();

/**
 * Options for creating the inception key.
 */
export type XIDInceptionKeyOptions =
  | { type: "default" }
  | { type: "publicKeys"; publicKeys: PublicKeys }
  | { type: "privateKeyBase"; privateKeyBase: PrivateKeyBase }
  | { type: "privateKeys"; privateKeys: PrivateKeys; publicKeys: PublicKeys };

/**
 * Options for creating the genesis mark.
 */
export type XIDGenesisMarkOptions =
  | { type: "none" }
  | {
      type: "passphrase";
      passphrase: string;
      resolution?: ProvenanceMarkResolution;
      date?: Date;
      info?: Cbor;
    }
  | {
      type: "seed";
      seed: Uint8Array;
      resolution?: ProvenanceMarkResolution;
      date?: Date;
      info?: Cbor;
    };

/**
 * Options for signing an envelope.
 */
export type XIDSigningOptions =
  | { type: "none" }
  | { type: "inception" }
  | { type: "privateKeyBase"; privateKeyBase: PrivateKeyBase }
  | { type: "privateKeys"; privateKeys: PrivateKeys };

/**
 * Options for verifying the signature on an envelope when loading.
 */
export enum XIDVerifySignature {
  /** Do not verify the signature (default). */
  None = "None",
  /** Verify that the envelope is signed with the inception key. */
  Inception = "Inception",
}

// Map to store keys by their hash for efficient lookup
type KeyMap = Map<string, Key>;
type DelegateMap = Map<string, Delegate>;
type ServiceMap = Map<string, Service>;

/**
 * Represents an XID document.
 */
export class XIDDocument implements EnvelopeEncodable {
  private readonly _xid: XID;
  private readonly _resolutionMethods: Set<string>;
  private readonly _keys: KeyMap;
  private readonly _delegates: DelegateMap;
  private readonly _services: ServiceMap;
  private _provenance: Provenance | undefined;

  private constructor(
    xid: XID,
    resolutionMethods = new Set<string>(),
    keys: KeyMap = new Map(),
    delegates: DelegateMap = new Map(),
    services: ServiceMap = new Map(),
    provenance?: Provenance,
  ) {
    this._xid = xid;
    this._resolutionMethods = resolutionMethods;
    this._keys = keys;
    this._delegates = delegates;
    this._services = services;
    this._provenance = provenance;
  }

  /**
   * Create a new XIDDocument with the given options.
   */
  static new(
    keyOptions: XIDInceptionKeyOptions = { type: "default" },
    markOptions: XIDGenesisMarkOptions = { type: "none" },
  ): XIDDocument {
    const inceptionKey = XIDDocument.inceptionKeyForOptions(keyOptions);
    const provenance = XIDDocument.genesisMarkWithOptions(markOptions);

    // Use the reference from PublicKeys (which uses tagged CBOR hash)
    // XID is created from the digest data of the reference
    const xid = XID.from(inceptionKey.publicKeys().reference().getDigest().toData());
    const doc = new XIDDocument(xid, new Set(), new Map(), new Map(), new Map(), provenance);

    doc.addKey(inceptionKey);
    return doc;
  }

  private static inceptionKeyForOptions(options: XIDInceptionKeyOptions): Key {
    switch (options.type) {
      case "default": {
        const privateKeyBase = PrivateKeyBase.new();
        return Key.newWithPrivateKeyBase(privateKeyBase);
      }
      case "publicKeys":
        return Key.newAllowAll(options.publicKeys);
      case "privateKeyBase":
        return Key.newWithPrivateKeyBase(options.privateKeyBase);
      case "privateKeys":
        return Key.newWithPrivateKeys(options.privateKeys, options.publicKeys);
    }
  }

  private static genesisMarkWithOptions(options: XIDGenesisMarkOptions): Provenance | undefined {
    switch (options.type) {
      case "none":
        return undefined;
      case "passphrase": {
        const resolution = options.resolution ?? ProvenanceMarkResolution.High;
        const generator = ProvenanceMarkGenerator.newWithPassphrase(resolution, options.passphrase);
        const date = options.date ?? new Date();
        const mark = generator.next(date, options.info);
        return Provenance.newWithGenerator(generator, mark);
      }
      case "seed": {
        const resolution = options.resolution ?? ProvenanceMarkResolution.High;
        const generator = ProvenanceMarkGenerator.newUsing(resolution, options.seed);
        const date = options.date ?? new Date();
        const mark = generator.next(date, options.info);
        return Provenance.newWithGenerator(generator, mark);
      }
    }
  }

  /**
   * Create an XIDDocument from just an XID.
   */
  static fromXid(xid: XID): XIDDocument {
    return new XIDDocument(xid);
  }

  /**
   * Get the XID.
   */
  xid(): XID {
    return this._xid;
  }

  /**
   * Get the resolution methods.
   */
  resolutionMethods(): Set<string> {
    return this._resolutionMethods;
  }

  /**
   * Add a resolution method.
   */
  addResolutionMethod(method: string): void {
    this._resolutionMethods.add(method);
  }

  /**
   * Remove a resolution method.
   */
  removeResolutionMethod(method: string): boolean {
    return this._resolutionMethods.delete(method);
  }

  /**
   * Get all keys.
   */
  keys(): Key[] {
    return Array.from(this._keys.values());
  }

  /**
   * Add a key.
   */
  addKey(key: Key): void {
    const hashKey = key.hashKey();
    if (this._keys.has(hashKey)) {
      throw XIDError.duplicate("key");
    }
    this._keys.set(hashKey, key);
  }

  /**
   * Find a key by its public keys.
   */
  findKeyByPublicKeys(publicKeys: PublicKeys): Key | undefined {
    const hashKey = publicKeys.reference().toHex();
    return this._keys.get(hashKey);
  }

  /**
   * Find a key by its reference.
   */
  findKeyByReference(reference: Reference): Key | undefined {
    for (const key of this._keys.values()) {
      if (key.reference().equals(reference)) {
        return key;
      }
    }
    return undefined;
  }

  /**
   * Take and remove a key.
   */
  takeKey(publicKeys: PublicKeys): Key | undefined {
    const hashKey = publicKeys.reference().toHex();
    const key = this._keys.get(hashKey);
    if (key !== undefined) {
      this._keys.delete(hashKey);
    }
    return key;
  }

  /**
   * Remove a key.
   */
  removeKey(publicKeys: PublicKeys): void {
    if (this.servicesReferenceKey(publicKeys)) {
      throw XIDError.stillReferenced("key");
    }
    const hashKey = publicKeys.reference().toHex();
    if (!this._keys.delete(hashKey)) {
      throw XIDError.notFound("key");
    }
  }

  /**
   * Check if the given public keys is the inception signing key.
   */
  isInceptionKey(publicKeys: PublicKeys): boolean {
    // The XID is derived from the reference of the inception PublicKeys
    const xidReference = publicKeys.reference();
    return bytesEqual(xidReference.getDigest().toData(), this._xid.toData());
  }

  /**
   * Get the inception key, if it exists in the document.
   */
  inceptionKey(): Key | undefined {
    for (const key of this._keys.values()) {
      if (this.isInceptionKey(key.publicKeys())) {
        return key;
      }
    }
    return undefined;
  }

  /**
   * Get the inception private keys, if available.
   */
  inceptionPrivateKeys(): PrivateKeys | undefined {
    return this.inceptionKey()?.privateKeys();
  }

  /**
   * Remove the inception key from the document.
   */
  removeInceptionKey(): Key | undefined {
    const inceptionKey = this.inceptionKey();
    if (inceptionKey !== undefined) {
      this._keys.delete(inceptionKey.hashKey());
    }
    return inceptionKey;
  }

  /**
   * Check if the document is empty (no keys, delegates, services, or provenance).
   */
  isEmpty(): boolean {
    return (
      this._resolutionMethods.size === 0 &&
      this._keys.size === 0 &&
      this._delegates.size === 0 &&
      this._provenance === undefined
    );
  }

  /**
   * Get all delegates.
   */
  delegates(): Delegate[] {
    return Array.from(this._delegates.values());
  }

  /**
   * Add a delegate.
   */
  addDelegate(delegate: Delegate): void {
    const hashKey = delegate.hashKey();
    if (this._delegates.has(hashKey)) {
      throw XIDError.duplicate("delegate");
    }
    this._delegates.set(hashKey, delegate);
  }

  /**
   * Find a delegate by XID.
   */
  findDelegateByXid(xid: XID): Delegate | undefined {
    return this._delegates.get(xid.toHex());
  }

  /**
   * Find a delegate by reference.
   */
  findDelegateByReference(reference: Reference): Delegate | undefined {
    for (const delegate of this._delegates.values()) {
      if (delegate.reference().equals(reference)) {
        return delegate;
      }
    }
    return undefined;
  }

  /**
   * Take and remove a delegate.
   */
  takeDelegate(xid: XID): Delegate | undefined {
    const hashKey = xid.toHex();
    const delegate = this._delegates.get(hashKey);
    if (delegate !== undefined) {
      this._delegates.delete(hashKey);
    }
    return delegate;
  }

  /**
   * Remove a delegate.
   */
  removeDelegate(xid: XID): void {
    if (this.servicesReferenceDelegate(xid)) {
      throw XIDError.stillReferenced("delegate");
    }
    const hashKey = xid.toHex();
    if (!this._delegates.delete(hashKey)) {
      throw XIDError.notFound("delegate");
    }
  }

  /**
   * Get all services.
   */
  services(): Service[] {
    return Array.from(this._services.values());
  }

  /**
   * Find a service by URI.
   */
  findServiceByUri(uri: string): Service | undefined {
    return this._services.get(uri);
  }

  /**
   * Add a service.
   */
  addService(service: Service): void {
    const hashKey = service.hashKey();
    if (this._services.has(hashKey)) {
      throw XIDError.duplicate("service");
    }
    this._services.set(hashKey, service);
  }

  /**
   * Take and remove a service.
   */
  takeService(uri: string): Service | undefined {
    const service = this._services.get(uri);
    if (service !== undefined) {
      this._services.delete(uri);
    }
    return service;
  }

  /**
   * Remove a service.
   */
  removeService(uri: string): void {
    if (!this._services.delete(uri)) {
      throw XIDError.notFound("service");
    }
  }

  /**
   * Check service consistency.
   */
  checkServicesConsistency(): void {
    for (const service of this._services.values()) {
      this.checkServiceConsistency(service);
    }
  }

  /**
   * Check consistency of a single service.
   */
  checkServiceConsistency(service: Service): void {
    if (service.keyReferences().size === 0 && service.delegateReferences().size === 0) {
      throw XIDError.noReferences(service.uri());
    }

    for (const keyRef of service.keyReferences()) {
      const refBytes = hexToBytes(keyRef);
      const ref = Reference.hash(refBytes);
      if (this.findKeyByReference(ref) === undefined) {
        throw XIDError.unknownKeyReference(keyRef, service.uri());
      }
    }

    for (const delegateRef of service.delegateReferences()) {
      const refBytes = hexToBytes(delegateRef);
      const ref = Reference.hash(refBytes);
      if (this.findDelegateByReference(ref) === undefined) {
        throw XIDError.unknownDelegateReference(delegateRef, service.uri());
      }
    }

    if (service.permissions().allow.size === 0) {
      throw XIDError.noPermissions(service.uri());
    }
  }

  /**
   * Check if any service references the given key.
   */
  servicesReferenceKey(publicKeys: PublicKeys): boolean {
    const keyRef = publicKeys.reference().toHex();
    for (const service of this._services.values()) {
      if (service.keyReferences().has(keyRef)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if any service references the given delegate.
   */
  servicesReferenceDelegate(xid: XID): boolean {
    const delegateRef = Reference.hash(xid.toData()).toHex();
    for (const service of this._services.values()) {
      if (service.delegateReferences().has(delegateRef)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get the provenance mark.
   */
  provenance(): ProvenanceMark | undefined {
    return this._provenance?.mark();
  }

  /**
   * Get the provenance generator.
   */
  provenanceGenerator(): ProvenanceMarkGenerator | undefined {
    return this._provenance?.generator();
  }

  /**
   * Set the provenance.
   */
  setProvenance(provenance: ProvenanceMark | undefined): void {
    this._provenance = provenance !== undefined ? Provenance.new(provenance) : undefined;
  }

  /**
   * Set provenance with generator.
   */
  setProvenanceWithGenerator(generator: ProvenanceMarkGenerator, mark: ProvenanceMark): void {
    this._provenance = Provenance.newWithGenerator(generator, mark);
  }

  /**
   * Advance the provenance mark using the embedded generator.
   */
  nextProvenanceMarkWithEmbeddedGenerator(password?: Uint8Array, date?: Date, info?: Cbor): void {
    if (this._provenance === undefined) {
      throw XIDError.noProvenanceMark();
    }

    const currentMark = this._provenance.mark();
    const generator = this._provenance.generatorMut(password);
    if (generator === undefined) {
      throw XIDError.noGenerator();
    }

    // Validate chain ID matches
    if (!bytesEqual(generator.chainId(), currentMark.chainId())) {
      throw XIDError.chainIdMismatch(currentMark.chainId(), generator.chainId());
    }

    // Validate sequence number
    const expectedSeq = currentMark.seq() + 1;
    if (generator.nextSeq() !== expectedSeq) {
      throw XIDError.sequenceMismatch(expectedSeq, generator.nextSeq());
    }

    // Generate next mark
    const nextDate = date ?? new Date();
    const nextMark = generator.next(nextDate, info);
    this._provenance.setMark(nextMark);
  }

  /**
   * Advance the provenance mark using a provided generator.
   */
  nextProvenanceMarkWithProvidedGenerator(
    generator: ProvenanceMarkGenerator,
    date?: Date,
    info?: Cbor,
  ): void {
    if (this._provenance === undefined) {
      throw XIDError.noProvenanceMark();
    }

    // Check that document doesn't have embedded generator
    if (this._provenance.hasGenerator() || this._provenance.hasEncryptedGenerator()) {
      throw XIDError.generatorConflict();
    }

    const currentMark = this._provenance.mark();

    // Validate chain ID matches
    if (!bytesEqual(generator.chainId(), currentMark.chainId())) {
      throw XIDError.chainIdMismatch(currentMark.chainId(), generator.chainId());
    }

    // Validate sequence number
    const expectedSeq = currentMark.seq() + 1;
    if (generator.nextSeq() !== expectedSeq) {
      throw XIDError.sequenceMismatch(expectedSeq, generator.nextSeq());
    }

    // Generate next mark
    const nextDate = date ?? new Date();
    const nextMark = generator.next(nextDate, info);
    this._provenance.setMark(nextMark);
  }

  /**
   * Convert to envelope with options.
   */
  toEnvelope(
    privateKeyOptions: XIDPrivateKeyOptionsValue = XIDPrivateKeyOptions.Omit,
    generatorOptions: XIDGeneratorOptionsValue = XIDGeneratorOptions.Omit,
    signingOptions: XIDSigningOptions = { type: "none" },
  ): Envelope {
    let envelope = Envelope.new(this._xid.toData());

    // Add resolution methods
    for (const method of this._resolutionMethods) {
      envelope = envelope.addAssertion(kv(DEREFERENCE_VIA), method);
    }

    // Add keys
    for (const key of this._keys.values()) {
      envelope = envelope.addAssertion(kv(KEY), key.intoEnvelopeOpt(privateKeyOptions));
    }

    // Add delegates
    for (const delegate of this._delegates.values()) {
      envelope = envelope.addAssertion(kv(DELEGATE), delegate.intoEnvelope());
    }

    // Add services
    for (const service of this._services.values()) {
      envelope = envelope.addAssertion(kv(SERVICE), service.intoEnvelope());
    }

    // Add provenance
    if (this._provenance !== undefined) {
      envelope = envelope.addAssertion(
        kv(PROVENANCE),
        this._provenance.intoEnvelopeOpt(generatorOptions),
      );
    }

    // Apply signing
    switch (signingOptions.type) {
      case "inception": {
        const inceptionKey = this.inceptionKey();
        if (inceptionKey === undefined) {
          throw XIDError.missingInceptionKey();
        }
        const privateKeys = inceptionKey.privateKeys();
        if (privateKeys === undefined) {
          throw XIDError.missingInceptionKey();
        }
        envelope = (envelope as unknown as { addSignature(s: Signer): Envelope }).addSignature(
          privateKeys as unknown as Signer,
        );
        break;
      }
      case "privateKeyBase": {
        // Derive PrivateKeys from PrivateKeyBase and use for signing
        const privateKeys = signingOptions.privateKeyBase.ed25519PrivateKeys();
        envelope = (envelope as unknown as { addSignature(s: Signer): Envelope }).addSignature(
          privateKeys as unknown as Signer,
        );
        break;
      }
      case "privateKeys":
        envelope = (envelope as unknown as { addSignature(s: Signer): Envelope }).addSignature(
          signingOptions.privateKeys as unknown as Signer,
        );
        break;
      case "none":
      default:
        break;
    }

    return envelope;
  }

  // EnvelopeEncodable implementation
  intoEnvelope(): Envelope {
    return this.toEnvelope();
  }

  /**
   * Extract an XIDDocument from an envelope.
   */
  static fromEnvelope(
    envelope: Envelope,
    password?: Uint8Array,
    verifySignature: XIDVerifySignature = XIDVerifySignature.None,
  ): XIDDocument {
    const envelopeExt = envelope as unknown as {
      subject(): Envelope & { isWrapped(): boolean; tryUnwrap(): Envelope };
      tryUnwrap(): Envelope;
      hasSignatureFrom(verifier: unknown): boolean;
    };
    switch (verifySignature) {
      case XIDVerifySignature.None: {
        const subject = envelopeExt.subject();
        const envelopeToParse = subject.isWrapped() ? subject.tryUnwrap() : envelope;
        return XIDDocument.fromEnvelopeInner(envelopeToParse, password);
      }
      case XIDVerifySignature.Inception: {
        if (!envelopeExt.subject().isWrapped()) {
          throw XIDError.envelopeNotSigned();
        }

        const unwrapped = envelopeExt.tryUnwrap();
        const doc = XIDDocument.fromEnvelopeInner(unwrapped, password);

        const inceptionKey = doc.inceptionKey();
        if (inceptionKey === undefined) {
          throw XIDError.missingInceptionKey();
        }

        // Verify signature using the PublicKeys (which implements Verifier)
        if (!envelopeExt.hasSignatureFrom(inceptionKey.publicKeys() as unknown as Verifier)) {
          throw XIDError.signatureVerificationFailed();
        }

        // Verify XID matches inception key
        if (!doc.isInceptionKey(inceptionKey.publicKeys())) {
          throw XIDError.invalidXid();
        }

        return doc;
      }
    }
  }

  private static fromEnvelopeInner(envelope: Envelope, password?: Uint8Array): XIDDocument {
    const envelopeExt = envelope as unknown as {
      asByteString(): Uint8Array | undefined;
      subject(): Envelope;
      assertions(): Envelope[];
    };

    // Extract XID from subject
    // The envelope may be a node (with assertions) or a leaf
    const envCase = envelope.case();
    const subject = envCase.type === "node" ? envelopeExt.subject() : envelope;
    const xidData = (
      subject as unknown as { asByteString(): Uint8Array | undefined }
    ).asByteString();
    if (xidData === undefined) {
      throw XIDError.invalidXid();
    }
    const xid = XID.from(xidData);
    const doc = XIDDocument.fromXid(xid);

    // Process assertions
    for (const assertion of envelopeExt.assertions()) {
      const assertionCase = assertion.case();
      if (assertionCase.type !== "assertion") {
        continue;
      }

      const predicateEnv = assertionCase.assertion.predicate();
      const predicateCase = predicateEnv.case();
      if (predicateCase.type !== "knownValue") {
        continue;
      }

      const predicate = predicateCase.value.value();
      const object = assertionCase.assertion.object();

      switch (predicate) {
        case DEREFERENCE_VIA_RAW: {
          const method = (object as unknown as { asText(): string | undefined }).asText();
          if (method === undefined) {
            throw XIDError.invalidResolutionMethod();
          }
          doc.addResolutionMethod(method);
          break;
        }
        case KEY_RAW: {
          const key = Key.tryFromEnvelope(object, password);
          doc.addKey(key);
          break;
        }
        case DELEGATE_RAW: {
          const delegate = Delegate.tryFromEnvelope(object);
          doc.addDelegate(delegate);
          break;
        }
        case SERVICE_RAW: {
          const service = Service.tryFromEnvelope(object);
          doc.addService(service);
          break;
        }
        case PROVENANCE_RAW: {
          if (doc._provenance !== undefined) {
            throw XIDError.multipleProvenanceMarks();
          }
          doc._provenance = Provenance.tryFromEnvelope(object, password);
          break;
        }
        default:
          throw XIDError.unexpectedPredicate(String(predicate));
      }
    }

    doc.checkServicesConsistency();
    return doc;
  }

  /**
   * Create a signed envelope.
   */
  toSignedEnvelope(signingKey: Signer): Envelope {
    const envelope = this.toEnvelope(XIDPrivateKeyOptions.Omit, XIDGeneratorOptions.Omit, {
      type: "none",
    });
    return (envelope as unknown as { addSignature(s: Signer): Envelope }).addSignature(signingKey);
  }

  /**
   * Get the reference for this document.
   */
  reference(): Reference {
    return Reference.hash(this._xid.toData());
  }

  /**
   * Check equality with another XIDDocument.
   */
  equals(other: XIDDocument): boolean {
    return this._xid.equals(other._xid);
  }

  /**
   * Clone this XIDDocument.
   */
  clone(): XIDDocument {
    const doc = new XIDDocument(
      this._xid,
      new Set(this._resolutionMethods),
      new Map(Array.from(this._keys.entries()).map(([k, v]) => [k, v.clone()])),
      new Map(Array.from(this._delegates.entries()).map(([k, v]) => [k, v.clone()])),
      new Map(Array.from(this._services.entries()).map(([k, v]) => [k, v.clone()])),
      this._provenance?.clone(),
    );
    return doc;
  }

  /**
   * Try to extract from envelope (alias for fromEnvelope with default options).
   */
  static tryFromEnvelope(envelope: Envelope): XIDDocument {
    return XIDDocument.fromEnvelope(envelope, undefined, XIDVerifySignature.None);
  }
}

// Register XIDDocument class with Delegate to resolve circular dependency
registerXIDDocumentClass(XIDDocument);

// Helper functions
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
