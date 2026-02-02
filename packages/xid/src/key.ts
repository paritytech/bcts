/**
 * XID Key
 *
 * Represents a key in an XID document, containing public keys, optional private keys,
 * nickname, endpoints, and permissions.
 *
 * Ported from bc-xid-rust/src/key.rs
 */

import { Envelope, type EnvelopeEncodable } from "@bcts/envelope";
import { ENDPOINT, NICKNAME, PRIVATE_KEY, SALT, type KnownValue } from "@bcts/known-values";
import type { EnvelopeEncodableValue } from "@bcts/envelope";
import { type Cbor } from "@bcts/dcbor";

// Helper to convert KnownValue to EnvelopeEncodableValue
const kv = (v: KnownValue): EnvelopeEncodableValue => v as unknown as EnvelopeEncodableValue;
import {
  Salt,
  type Reference,
  PublicKeys,
  PrivateKeys,
  type PrivateKeyBase,
  type SigningPublicKey,
  type EncapsulationPublicKey,
  type Verifier,
  type Signature,
  type KeyDerivationMethod,
  defaultKeyDerivationMethod,
} from "@bcts/components";
import { Permissions, type HasPermissions } from "./permissions";
import { type Privilege } from "./privilege";
import { type HasNickname } from "./name";
import { XIDError } from "./error";

/**
 * Options for handling private keys in envelopes.
 */
export enum XIDPrivateKeyOptions {
  /** Omit the private key from the envelope (default). */
  Omit = "Omit",
  /** Include the private key in plaintext (with salt for decorrelation). */
  Include = "Include",
  /** Include the private key assertion but elide it (maintains digest tree). */
  Elide = "Elide",
  /** Include the private key encrypted with a password. */
  Encrypt = "Encrypt",
}

/**
 * Configuration for encrypting private keys.
 */
export interface XIDPrivateKeyEncryptConfig {
  type: XIDPrivateKeyOptions.Encrypt;
  password: Uint8Array;
  method?: KeyDerivationMethod;
}

/**
 * Union type for all private key options.
 */
export type XIDPrivateKeyOptionsValue =
  | XIDPrivateKeyOptions.Omit
  | XIDPrivateKeyOptions.Include
  | XIDPrivateKeyOptions.Elide
  | XIDPrivateKeyEncryptConfig;

/**
 * Private key data that can be either decrypted or encrypted.
 */
export type PrivateKeyData =
  | { type: "decrypted"; privateKeys: PrivateKeys }
  | { type: "encrypted"; envelope: Envelope };

/**
 * Represents a key in an XID document.
 */
export class Key implements HasNickname, HasPermissions, EnvelopeEncodable, Verifier {
  private readonly _publicKeys: PublicKeys;
  private readonly _privateKeyData: { data: PrivateKeyData; salt: Salt } | undefined;
  private _nickname: string;
  private readonly _endpoints: Set<string>;
  private readonly _permissions: Permissions;

  private constructor(
    publicKeys: PublicKeys,
    privateKeyData?: { data: PrivateKeyData; salt: Salt },
    nickname = "",
    endpoints = new Set<string>(),
    permissions = Permissions.new(),
  ) {
    this._publicKeys = publicKeys;
    this._privateKeyData = privateKeyData;
    this._nickname = nickname;
    this._endpoints = endpoints;
    this._permissions = permissions;
  }

  /**
   * Create a new Key with only public keys.
   */
  static new(publicKeys: PublicKeys): Key {
    return new Key(publicKeys);
  }

  /**
   * Create a new Key with public keys and allow-all permissions.
   */
  static newAllowAll(publicKeys: PublicKeys): Key {
    return new Key(publicKeys, undefined, "", new Set(), Permissions.newAllowAll());
  }

  /**
   * Create a new Key with private keys.
   */
  static newWithPrivateKeys(privateKeys: PrivateKeys, publicKeys: PublicKeys): Key {
    const salt = Salt.random(32);
    return new Key(
      publicKeys,
      { data: { type: "decrypted", privateKeys }, salt },
      "",
      new Set(),
      Permissions.newAllowAll(),
    );
  }

  /**
   * Create a new Key with private key base (derives keys from it).
   */
  static newWithPrivateKeyBase(privateKeyBase: PrivateKeyBase): Key {
    const privateKeys = privateKeyBase.schnorrPrivateKeys();
    const publicKeys = privateKeyBase.schnorrPublicKeys();
    return Key.newWithPrivateKeys(privateKeys, publicKeys);
  }

  /**
   * Get the public keys.
   */
  publicKeys(): PublicKeys {
    return this._publicKeys;
  }

  /**
   * Get the private keys, if available and decrypted.
   */
  privateKeys(): PrivateKeys | undefined {
    if (this._privateKeyData === undefined) return undefined;
    if (this._privateKeyData.data.type === "decrypted") {
      return this._privateKeyData.data.privateKeys;
    }
    return undefined;
  }

  /**
   * Check if this key has decrypted private keys.
   */
  hasPrivateKeys(): boolean {
    return this._privateKeyData?.data.type === "decrypted";
  }

  /**
   * Check if this key has encrypted private keys.
   */
  hasEncryptedPrivateKeys(): boolean {
    return this._privateKeyData?.data.type === "encrypted";
  }

  /**
   * Get the salt used for private key decorrelation.
   */
  privateKeySalt(): Salt | undefined {
    return this._privateKeyData?.salt;
  }

  /**
   * Get the reference for this key (based on public keys tagged CBOR).
   */
  reference(): Reference {
    return this._publicKeys.reference();
  }

  /**
   * Get the signing public key.
   */
  signingPublicKey(): SigningPublicKey {
    return this._publicKeys.signingPublicKey();
  }

  /**
   * Get the encapsulation public key.
   */
  encapsulationPublicKey(): EncapsulationPublicKey {
    return this._publicKeys.encapsulationPublicKey();
  }

  // ============================================================================
  // Verifier Interface
  // ============================================================================

  /**
   * Verify a signature against a message.
   */
  verify(signature: Signature, message: Uint8Array): boolean {
    return this._publicKeys.verify(signature, message);
  }

  /**
   * Get the endpoints set.
   */
  endpoints(): Set<string> {
    return this._endpoints;
  }

  /**
   * Get the endpoints set for mutation.
   */
  endpointsMut(): Set<string> {
    return this._endpoints;
  }

  /**
   * Add an endpoint.
   */
  addEndpoint(endpoint: string): void {
    this._endpoints.add(endpoint);
  }

  /**
   * Add a permission.
   */
  addPermission(privilege: Privilege): void {
    this._permissions.addAllow(privilege);
  }

  // HasNickname implementation
  nickname(): string {
    return this._nickname;
  }

  setNickname(name: string): void {
    this._nickname = name;
  }

  // HasPermissions implementation
  permissions(): Permissions {
    return this._permissions;
  }

  permissionsMut(): Permissions {
    return this._permissions;
  }

  /**
   * Convert to envelope with specified options.
   */
  intoEnvelopeOpt(
    privateKeyOptions: XIDPrivateKeyOptionsValue = XIDPrivateKeyOptions.Omit,
  ): Envelope {
    // Use tagged CBOR representation of PublicKeys as subject
    let envelope = Envelope.new(this._publicKeys.taggedCborData());

    // Handle private keys
    if (this._privateKeyData !== undefined) {
      const { data, salt } = this._privateKeyData;

      if (data.type === "encrypted") {
        // Always preserve encrypted keys
        envelope = envelope.addAssertion(kv(PRIVATE_KEY), data.envelope);
        envelope = envelope.addAssertion(kv(SALT), salt.toData());
      } else if (data.type === "decrypted") {
        // Handle decrypted keys based on options
        const option =
          typeof privateKeyOptions === "object" ? privateKeyOptions.type : privateKeyOptions;

        switch (option) {
          case XIDPrivateKeyOptions.Include: {
            // Store PrivateKeys as tagged CBOR
            envelope = envelope.addAssertion(kv(PRIVATE_KEY), data.privateKeys.taggedCborData());
            envelope = envelope.addAssertion(kv(SALT), salt.toData());
            break;
          }
          case XIDPrivateKeyOptions.Elide: {
            const baseAssertion = Envelope.newAssertion(
              kv(PRIVATE_KEY),
              data.privateKeys.taggedCborData(),
            );
            const elidedAssertion = (baseAssertion as unknown as { elide(): Envelope }).elide();
            envelope = envelope.addAssertionEnvelope(elidedAssertion);
            envelope = envelope.addAssertion(kv(SALT), salt.toData());
            break;
          }
          case XIDPrivateKeyOptions.Encrypt: {
            if (typeof privateKeyOptions === "object") {
              const privateKeysEnvelope = Envelope.new(data.privateKeys.taggedCborData());
              const method: KeyDerivationMethod = privateKeyOptions.method ?? defaultKeyDerivationMethod();
              const encrypted = (
                privateKeysEnvelope as unknown as {
                  lockSubject(m: KeyDerivationMethod, p: Uint8Array): Envelope;
                }
              ).lockSubject(method, privateKeyOptions.password);
              envelope = envelope.addAssertion(kv(PRIVATE_KEY), encrypted);
              envelope = envelope.addAssertion(kv(SALT), salt.toData());
            }
            break;
          }
          case XIDPrivateKeyOptions.Omit:
          default:
            // Do nothing - omit private keys
            break;
        }
      }
    }

    // Add nickname if not empty
    if (this._nickname !== "") {
      envelope = envelope.addAssertion(kv(NICKNAME), this._nickname);
    }

    // Add endpoints
    for (const endpoint of this._endpoints) {
      envelope = envelope.addAssertion(kv(ENDPOINT), endpoint);
    }

    // Add permissions
    envelope = this._permissions.addToEnvelope(envelope);

    return envelope;
  }

  // EnvelopeEncodable implementation
  intoEnvelope(): Envelope {
    return this.intoEnvelopeOpt(XIDPrivateKeyOptions.Omit);
  }

  /**
   * Try to extract a Key from an envelope, optionally with password for decryption.
   */
  static tryFromEnvelope(envelope: Envelope, password?: Uint8Array): Key {
    type EnvelopeExt = Envelope & {
      asByteString(): Uint8Array | undefined;
      subject(): Envelope;
      assertionsWithPredicate(p: unknown): Envelope[];
      unlockSubject(p: Uint8Array): Envelope;
      isLockedWithPassword(): boolean;
    };
    const env = envelope as EnvelopeExt;

    // Extract PublicKeys from subject.
    // Rust-generated documents store PublicKeys as tagged CBOR directly in the leaf.
    // TS-generated documents may store the tagged CBOR binary inside a byte string.
    const envCase = env.case();
    const subject = envCase.type === "node" ? env.subject() : env;
    let publicKeys: PublicKeys;
    const publicKeysData = (subject as EnvelopeExt).asByteString();
    if (publicKeysData !== undefined) {
      // TS format: tagged CBOR binary stored as a byte string
      publicKeys = PublicKeys.fromTaggedCborData(publicKeysData);
    } else {
      // Rust format: tagged CBOR stored directly as the leaf CBOR value
      const leaf = (subject as unknown as { asLeaf(): Cbor | undefined }).asLeaf?.();
      if (leaf === undefined) {
        throw XIDError.component(new Error("Could not extract public keys from envelope"));
      }
      publicKeys = PublicKeys.fromTaggedCbor(leaf);
    }

    // Extract optional private key
    let privateKeyData: { data: PrivateKeyData; salt: Salt } | undefined;

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

    const privateKeyAssertions = env.assertionsWithPredicate(PRIVATE_KEY);
    if (privateKeyAssertions.length > 0) {
      const privateKeyAssertion = privateKeyAssertions[0] as EnvelopeExt;
      const assertionCase = privateKeyAssertion.case();

      if (assertionCase.type === "assertion") {
        const privateKeyObject = assertionCase.assertion.object() as EnvelopeExt;

        // Check if locked with password (uses hasSecret assertion with EncryptedKey)
        if (privateKeyObject.isLockedWithPassword()) {
          if (password !== undefined) {
            try {
              const decrypted = privateKeyObject.unlockSubject(password) as EnvelopeExt;
              const decryptedData = (decrypted.subject() as EnvelopeExt).asByteString();
              if (decryptedData !== undefined) {
                // Parse PrivateKeys from tagged CBOR
                const privateKeys = PrivateKeys.fromTaggedCborData(decryptedData);
                privateKeyData = {
                  data: { type: "decrypted", privateKeys },
                  salt,
                };
              }
            } catch {
              // Wrong password - store as encrypted
              privateKeyData = {
                data: { type: "encrypted", envelope: privateKeyObject },
                salt,
              };
            }
          } else {
            // No password - store as encrypted
            privateKeyData = {
              data: { type: "encrypted", envelope: privateKeyObject },
              salt,
            };
          }
        } else {
          // Plain text private key - stored as tagged CBOR
          const privateKeysBytes = privateKeyObject.asByteString();
          if (privateKeysBytes !== undefined) {
            const privateKeys = PrivateKeys.fromTaggedCborData(privateKeysBytes);
            privateKeyData = {
              data: { type: "decrypted", privateKeys },
              salt,
            };
          }
        }
      }
    }

    // Extract nickname
    let nickname = "";
    try {
      const nicknameObj = (
        env as unknown as { objectForPredicate(p: unknown): EnvelopeExt }
      ).objectForPredicate(NICKNAME);
      nickname =
        nicknameObj.asByteString() !== undefined
          ? ""
          : ((nicknameObj as unknown as { asText(): string | undefined }).asText() ?? "");
    } catch {
      // No nickname
    }

    // Extract endpoints
    const endpoints = new Set<string>();
    const endpointObjects = (
      env as unknown as { objectsForPredicate(p: unknown): EnvelopeExt[] }
    ).objectsForPredicate(ENDPOINT);
    for (const obj of endpointObjects) {
      const text = (obj as unknown as { asText(): string | undefined }).asText();
      if (text !== undefined) {
        endpoints.add(text);
      }
    }

    // Extract permissions
    const permissions = Permissions.tryFromEnvelope(envelope);

    return new Key(publicKeys, privateKeyData, nickname, endpoints, permissions);
  }

  /**
   * Get the private key envelope, optionally decrypting it.
   *
   * Returns:
   * - undefined if no private keys
   * - The decrypted private key envelope if unencrypted
   * - The decrypted envelope if encrypted + correct password
   * - The encrypted envelope as-is if encrypted + no password
   * - Throws on wrong password
   */
  privateKeyEnvelope(password?: string): Envelope | undefined {
    if (this._privateKeyData === undefined) {
      return undefined;
    }
    const { data } = this._privateKeyData;
    if (data.type === "decrypted") {
      return Envelope.new(data.privateKeys.taggedCborData());
    }
    // Encrypted case
    if (password !== undefined) {
      try {
        const decrypted = (
          data.envelope as unknown as { unlockSubject(p: Uint8Array): Envelope }
        ).unlockSubject(new TextEncoder().encode(password));
        return decrypted;
      } catch {
        throw XIDError.invalidPassword();
      }
    }
    // No password — return encrypted envelope as-is
    return data.envelope;
  }

  /**
   * Check equality with another Key.
   */
  equals(other: Key): boolean {
    return this._publicKeys.equals(other._publicKeys);
  }

  /**
   * Get a hash key for use in Sets/Maps.
   */
  hashKey(): string {
    return this._publicKeys.reference().toHex();
  }

  /**
   * Clone this Key.
   */
  clone(): Key {
    return new Key(
      this._publicKeys,
      this._privateKeyData !== undefined
        ? { data: this._privateKeyData.data, salt: this._privateKeyData.salt }
        : undefined,
      this._nickname,
      new Set(this._endpoints),
      this._permissions.clone(),
    );
  }
}
