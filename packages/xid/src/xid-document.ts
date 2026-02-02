/**
 * XID Document
 *
 * Represents an XID document containing keys, delegates, services, and provenance.
 *
 * Ported from bc-xid-rust/src/xid_document.rs
 */

import { Envelope, Attachments, Edges, type Edgeable, type EnvelopeEncodable, type EnvelopeEncodableValue } from "@bcts/envelope";
import type { Digest } from "@bcts/envelope";
import {
  KEY,
  DELEGATE,
  SERVICE,
  PROVENANCE,
  DEREFERENCE_VIA,
  ATTACHMENT_RAW as ATTACHMENT_RAW_VAL,
  EDGE_RAW as EDGE_RAW_VAL,
  type KnownValue,
} from "@bcts/known-values";

// Helper to convert KnownValue to EnvelopeEncodableValue
const kv = (v: KnownValue): EnvelopeEncodableValue => v as unknown as EnvelopeEncodableValue;
import {
  Reference,
  XID,
  type PublicKeys,
  PrivateKeyBase,
  type PrivateKeys,
  type Signer,
  type EncapsulationPublicKey,
  type SigningPublicKey,
  type SigningPrivateKey,
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
const ATTACHMENT_RAW_VALUE = Number(ATTACHMENT_RAW_VAL);
const EDGE_RAW_VALUE = Number(EDGE_RAW_VAL);

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
  | { type: "privateKeys"; privateKeys: PrivateKeys }
  | { type: "signingPrivateKey"; signingPrivateKey: SigningPrivateKey };

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
export class XIDDocument implements EnvelopeEncodable, Edgeable {
  private readonly _xid: XID;
  private readonly _resolutionMethods: Set<string>;
  private readonly _keys: KeyMap;
  private readonly _delegates: DelegateMap;
  private readonly _services: ServiceMap;
  private _provenance: Provenance | undefined;
  private _attachments: Attachments;
  private _edges: Edges;

  private constructor(
    xid: XID,
    resolutionMethods = new Set<string>(),
    keys: KeyMap = new Map(),
    delegates: DelegateMap = new Map(),
    services: ServiceMap = new Map(),
    provenance?: Provenance,
    attachments?: Attachments,
    edges?: Edges,
  ) {
    this._xid = xid;
    this._resolutionMethods = resolutionMethods;
    this._keys = keys;
    this._delegates = delegates;
    this._services = services;
    this._provenance = provenance;
    this._attachments = attachments ?? new Attachments();
    this._edges = edges ?? new Edges();
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

    // XID is the SHA-256 digest of the CBOR encoding of the inception signing public key
    // This matches Rust: XID::new(inception_key.public_keys().signing_public_key())
    const xid = XID.newFromSigningKey(inceptionKey.publicKeys().signingPublicKey());
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
   * Check if the given signing public key is the inception signing key.
   * Matches Rust: `is_inception_signing_key(&self, signing_public_key: &SigningPublicKey) -> bool`
   */
  isInceptionSigningKey(signingPublicKey: SigningPublicKey): boolean {
    return this._xid.validate(signingPublicKey);
  }

  /**
   * Get the inception key, if it exists in the document.
   */
  inceptionKey(): Key | undefined {
    for (const key of this._keys.values()) {
      if (this.isInceptionSigningKey(key.publicKeys().signingPublicKey())) {
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
   * Get the encryption key (encapsulation public key) for this document.
   *
   * Prefers the inception key for encryption. If no inception key is available,
   * falls back to the first key in the document.
   */
  encryptionKey(): EncapsulationPublicKey | undefined {
    // Prefer the inception key for encryption
    const inceptionKey = this.inceptionKey();
    if (inceptionKey !== undefined) {
      return inceptionKey.publicKeys().encapsulationPublicKey();
    }
    // Fall back to first key
    const firstKey = this._keys.values().next().value;
    if (firstKey !== undefined) {
      return firstKey.publicKeys().encapsulationPublicKey();
    }
    return undefined;
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
   * Set the name (nickname) for a key identified by its public keys.
   */
  setNameForKey(publicKeys: PublicKeys, name: string): void {
    const key = this.takeKey(publicKeys);
    if (key === undefined) {
      throw XIDError.notFound("key");
    }
    key.setNickname(name);
    this.addKey(key);
  }

  /**
   * Get the inception signing public key, if it exists.
   */
  inceptionSigningKey(): SigningPublicKey | undefined {
    const key = this.inceptionKey();
    return key?.publicKeys().signingPublicKey();
  }

  /**
   * Get the verification (signing) key for this document.
   * Prefers the inception key. Falls back to the first key.
   */
  verificationKey(): SigningPublicKey | undefined {
    const inceptionKey = this.inceptionKey();
    if (inceptionKey !== undefined) {
      return inceptionKey.publicKeys().signingPublicKey();
    }
    const firstKey = this._keys.values().next().value;
    return firstKey?.publicKeys().signingPublicKey();
  }

  /**
   * Extract inception private keys from an envelope (convenience static method).
   */
  static extractInceptionPrivateKeysFromEnvelope(
    envelope: Envelope,
    password: Uint8Array,
  ): PrivateKeys | undefined {
    const doc = XIDDocument.fromEnvelope(envelope, password, XIDVerifySignature.None);
    return doc.inceptionPrivateKeys();
  }

  /**
   * Get the private key envelope for a specific key, optionally decrypting it.
   */
  privateKeyEnvelopeForKey(publicKeys: PublicKeys, password?: string): Envelope | undefined {
    const key = this.findKeyByPublicKeys(publicKeys);
    if (key === undefined) {
      return undefined;
    }
    return key.privateKeyEnvelope(password);
  }

  /**
   * Check that the document contains a key with the given public keys.
   * Throws if not found.
   */
  checkContainsKey(publicKeys: PublicKeys): void {
    if (this.findKeyByPublicKeys(publicKeys) === undefined) {
      throw XIDError.keyNotFoundInDocument(publicKeys.toString());
    }
  }

  /**
   * Check that the document contains a delegate with the given XID.
   * Throws if not found.
   */
  checkContainsDelegate(xid: XID): void {
    if (this.findDelegateByXid(xid) === undefined) {
      throw XIDError.delegateNotFoundInDocument(xid.toString());
    }
  }

  // ============================================================================
  // Attachable interface implementation
  // ============================================================================

  /**
   * Get the attachments container.
   */
  getAttachments(): Attachments {
    return this._attachments;
  }

  /**
   * Add an attachment with the specified payload and metadata.
   */
  addAttachment(payload: EnvelopeEncodableValue, vendor: string, conformsTo?: string): void {
    this._attachments.add(payload, vendor, conformsTo);
  }

  /**
   * Check if the document has any attachments.
   */
  hasAttachments(): boolean {
    return !this._attachments.isEmpty();
  }

  /**
   * Remove all attachments.
   */
  clearAttachments(): void {
    this._attachments.clear();
  }

  /**
   * Get an attachment by its digest.
   */
  getAttachment(digest: Digest): Envelope | undefined {
    return this._attachments.get(digest);
  }

  /**
   * Remove an attachment by its digest.
   */
  removeAttachment(digest: Digest): Envelope | undefined {
    return this._attachments.remove(digest);
  }

  // ============================================================================
  // Edgeable interface implementation
  // ============================================================================

  /**
   * Get the edges container (read-only).
   */
  edges(): Edges {
    return this._edges;
  }

  /**
   * Get the edges container (mutable).
   */
  edgesMut(): Edges {
    return this._edges;
  }

  /**
   * Add an edge envelope.
   */
  addEdge(edgeEnvelope: Envelope): void {
    this._edges.add(edgeEnvelope);
  }

  /**
   * Get an edge by its digest.
   */
  getEdge(digest: Digest): Envelope | undefined {
    return this._edges.get(digest);
  }

  /**
   * Remove an edge by its digest.
   */
  removeEdge(digest: Digest): Envelope | undefined {
    return this._edges.remove(digest);
  }

  /**
   * Remove all edges.
   */
  clearEdges(): void {
    this._edges.clear();
  }

  /**
   * Check if the document has any edges.
   */
  hasEdges(): boolean {
    return !this._edges.isEmpty();
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
      // keyRef is already a hex representation of a Reference, don't hash again
      const ref = Reference.fromHex(keyRef);
      if (this.findKeyByReference(ref) === undefined) {
        throw XIDError.unknownKeyReference(keyRef, service.uri());
      }
    }

    for (const delegateRef of service.delegateReferences()) {
      // delegateRef is already a hex representation of a Reference, don't hash again
      const ref = Reference.fromHex(delegateRef);
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
    // Use tagged CBOR representation, matching Rust's Envelope::new(self.xid)
    let envelope = Envelope.newLeaf(this._xid.taggedCbor());

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

    // Add attachments before signing so they are included in the signature
    envelope = this._attachments.addToEnvelope(envelope);

    // Add edges before signing so they are included in the signature
    envelope = this._edges.addToEnvelope(envelope);

    // Apply signing (uses sign() which wraps the envelope first)
    // PrivateKeys implements Signer from @bcts/components, which is compatible with envelope's sign()
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
        envelope = (envelope as unknown as { sign(s: Signer): Envelope }).sign(privateKeys);
        break;
      }
      case "privateKeys": {
        envelope = (envelope as unknown as { sign(s: Signer): Envelope }).sign(
          signingOptions.privateKeys,
        );
        break;
      }
      case "signingPrivateKey": {
        envelope = (envelope as unknown as { sign(s: Signer): Envelope }).sign(
          signingOptions.signingPrivateKey,
        );
        break;
      }
      case "none":
      default:
        break;
    }

    return envelope;
  }

  // EnvelopeEncodable implementation
  intoEnvelope(): Envelope {
    if (this.isEmpty()) {
      return Envelope.new(this._xid.toData());
    }
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

        // Extract attachments from the envelope
        const attachments = Attachments.fromEnvelope(envelopeToParse);
        // Extract edges from the envelope
        const edges = Edges.fromEnvelope(envelopeToParse);

        const doc = XIDDocument.fromEnvelopeInner(envelopeToParse, password);
        doc._attachments = attachments;
        doc._edges = edges;
        return doc;
      }
      case XIDVerifySignature.Inception: {
        if (!envelopeExt.subject().isWrapped()) {
          throw XIDError.envelopeNotSigned();
        }

        const unwrapped = envelopeExt.tryUnwrap();

        // Extract attachments from the unwrapped envelope
        const attachments = Attachments.fromEnvelope(unwrapped);
        // Extract edges from the unwrapped envelope
        const edges = Edges.fromEnvelope(unwrapped);

        const doc = XIDDocument.fromEnvelopeInner(unwrapped, password);

        const inceptionKey = doc.inceptionKey();
        if (inceptionKey === undefined) {
          throw XIDError.missingInceptionKey();
        }

        // Verify signature using the PublicKeys (implements Verifier from @bcts/components)
        if (!envelopeExt.hasSignatureFrom(inceptionKey.publicKeys())) {
          throw XIDError.signatureVerificationFailed();
        }

        // Verify XID matches inception key
        if (!doc.isInceptionSigningKey(inceptionKey.publicKeys().signingPublicKey())) {
          throw XIDError.invalidXid();
        }

        doc._attachments = attachments;
        doc._edges = edges;
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

    // Try to extract XID from the subject leaf.
    // Rust-generated documents store the XID as tagged CBOR (Tag 40015 + byte string).
    // TS-generated documents may store it as a raw byte string.
    const leaf = (subject as unknown as { asLeaf(): Cbor | undefined }).asLeaf?.();
    if (leaf === undefined) {
      throw XIDError.invalidXid();
    }
    let xid: XID;
    try {
      // Try tagged CBOR first (matches Rust's Envelope::new(xid))
      xid = XID.fromTaggedCbor(leaf);
    } catch {
      // Fall back to raw byte string
      const xidData = (
        subject as unknown as { asByteString(): Uint8Array | undefined }
      ).asByteString();
      if (xidData === undefined) {
        throw XIDError.invalidXid();
      }
      xid = XID.from(xidData);
    }
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
        case ATTACHMENT_RAW_VALUE:
          // Handled separately by Attachments.fromEnvelope()
          break;
        case EDGE_RAW_VALUE:
          // Handled separately by Edges.fromEnvelope()
          break;
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
    return this.toSignedEnvelopeOpt(signingKey, XIDPrivateKeyOptions.Omit);
  }

  /**
   * Create a signed envelope with private key options.
   */
  toSignedEnvelopeOpt(
    signingKey: Signer,
    privateKeyOptions: XIDPrivateKeyOptionsValue = XIDPrivateKeyOptions.Omit,
  ): Envelope {
    const envelope = this.toEnvelope(privateKeyOptions, XIDGeneratorOptions.Omit, {
      type: "none",
    });
    return (envelope as unknown as { sign(s: Signer): Envelope }).sign(signingKey);
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
    // Match Rust's PartialEq which compares all fields
    if (!this._xid.equals(other._xid)) return false;

    // Compare resolution methods
    if (this._resolutionMethods.size !== other._resolutionMethods.size) return false;
    for (const m of this._resolutionMethods) {
      if (!other._resolutionMethods.has(m)) return false;
    }

    // Compare keys
    if (this._keys.size !== other._keys.size) return false;
    for (const [hash, key] of this._keys) {
      const otherKey = other._keys.get(hash);
      if (otherKey === undefined || !key.equals(otherKey)) return false;
    }

    // Compare delegates
    if (this._delegates.size !== other._delegates.size) return false;
    for (const [hash, delegate] of this._delegates) {
      const otherDelegate = other._delegates.get(hash);
      if (otherDelegate === undefined || !delegate.equals(otherDelegate)) return false;
    }

    // Compare services
    if (this._services.size !== other._services.size) return false;
    for (const [uri, service] of this._services) {
      const otherService = other._services.get(uri);
      if (otherService === undefined || !service.equals(otherService)) return false;
    }

    // Compare provenance
    if (this._provenance === undefined && other._provenance !== undefined) return false;
    if (this._provenance !== undefined && other._provenance === undefined) return false;
    if (this._provenance !== undefined && other._provenance !== undefined) {
      if (!this._provenance.equals(other._provenance)) return false;
    }

    // Compare attachments
    if (!this._attachments.equals(other._attachments)) return false;

    // Compare edges
    if (!this._edges.equals(other._edges)) return false;

    return true;
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

    // Clone attachments by iterating and re-adding
    for (const [, env] of this._attachments.iter()) {
      doc._attachments.addEnvelope(env);
    }

    // Clone edges by iterating and re-adding
    for (const [, env] of this._edges.iter()) {
      doc._edges.add(env);
    }

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
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
