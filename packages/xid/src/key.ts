/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
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
import type { Cbor } from "@bcts/dcbor";
import {
  Salt,
  URI,
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

// Helper to convert KnownValue to EnvelopeEncodableValue
const kv = (v: KnownValue): EnvelopeEncodableValue => v;

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
 *
 * Mirrors `bc-xid-rust/src/key.rs`. The on-the-wire shape:
 *
 * ```
 * PublicKeys [
 *     {
 *         'privateKey': PrivateKeys     ← (or encrypted/elided)
 *     } [
 *         'salt': Salt
 *     ]
 *     'nickname': "..."
 *     'endpoint': URI(...)
 *     'allow': '...'
 * ]
 * ```
 *
 * Notably the private-key assertion is itself a node — the `'salt'`
 * lives nested under the assertion, not as a sibling on the parent
 * envelope. This is what `add_salt_instance(salt)` produces in Rust and
 * what `Envelope.prototype.addSaltInstance` produces in TS.
 */
export class Key implements HasNickname, HasPermissions, EnvelopeEncodable, Verifier {
  private readonly _publicKeys: PublicKeys;
  private readonly _privateKeyData: { data: PrivateKeyData; salt: Salt } | undefined;
  private _nickname: string;
  private readonly _endpoints: Set<URI>;
  private readonly _permissions: Permissions;

  private constructor(
    publicKeys: PublicKeys,
    privateKeyData?: { data: PrivateKeyData; salt: Salt },
    nickname = "",
    endpoints = new Set<URI>(),
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
   * Get the endpoints set. The set holds typed `URI` values (mirrors
   * Rust `HashSet<URI>`); use `.toString()` on a URI for a plain
   * string view.
   */
  endpoints(): Set<URI> {
    return this._endpoints;
  }

  /**
   * Get the endpoints set for mutation.
   */
  endpointsMut(): Set<URI> {
    return this._endpoints;
  }

  /**
   * Add an endpoint. Accepts either a URI value or a string (for
   * ergonomic test/REPL use). The URI is the canonical form.
   */
  addEndpoint(endpoint: URI | string): void {
    const uri = endpoint instanceof URI ? endpoint : URI.from(endpoint);
    this._endpoints.add(uri);
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
   * Build the nested salt-bearing assertion envelope:
   * ```
   * { 'privateKey': PrivateKeys } [ 'salt': Salt ]
   * ```
   * Mirrors Rust `Key::private_key_assertion_envelope()`.
   */
  private privateKeyAssertionEnvelope(): Envelope {
    if (this._privateKeyData === undefined) {
      throw new Error("privateKeyAssertionEnvelope called with no private key data");
    }
    const { data, salt } = this._privateKeyData;
    if (data.type === "decrypted") {
      return Envelope.newAssertion(kv(PRIVATE_KEY), data.privateKeys).addSaltInstance(salt);
    }
    return Envelope.newAssertion(kv(PRIVATE_KEY), data.envelope).addSaltInstance(salt);
  }

  /**
   * Convert to envelope with specified options.
   */
  intoEnvelopeOpt(
    privateKeyOptions: XIDPrivateKeyOptionsValue = XIDPrivateKeyOptions.Omit,
  ): Envelope {
    // Subject: tagged CBOR PublicKeys leaf (mirrors Rust
    // `Envelope::new(self.public_keys().clone())`).
    let envelope = Envelope.new(this._publicKeys);

    if (this._privateKeyData !== undefined) {
      const { data, salt } = this._privateKeyData;

      if (data.type === "encrypted") {
        // Always preserve encrypted keys regardless of options.
        envelope = envelope.addAssertionEnvelope(this.privateKeyAssertionEnvelope());
      } else {
        const option =
          typeof privateKeyOptions === "object" ? privateKeyOptions.type : privateKeyOptions;

        switch (option) {
          case XIDPrivateKeyOptions.Include: {
            envelope = envelope.addAssertionEnvelope(this.privateKeyAssertionEnvelope());
            break;
          }
          case XIDPrivateKeyOptions.Elide: {
            const elided = (
              this.privateKeyAssertionEnvelope() as unknown as { elide(): Envelope }
            ).elide();
            envelope = envelope.addAssertionEnvelope(elided);
            break;
          }
          case XIDPrivateKeyOptions.Encrypt: {
            if (typeof privateKeyOptions === "object") {
              const privateKeysEnvelope = Envelope.new(data.privateKeys);
              const method: KeyDerivationMethod =
                privateKeyOptions.method ?? defaultKeyDerivationMethod();
              const encrypted = (
                privateKeysEnvelope as unknown as {
                  lockSubject(m: KeyDerivationMethod, p: Uint8Array): Envelope;
                }
              ).lockSubject(method, privateKeyOptions.password);
              const assertion = Envelope.newAssertion(kv(PRIVATE_KEY), encrypted).addSaltInstance(
                salt,
              );
              envelope = envelope.addAssertionEnvelope(assertion);
            }
            break;
          }
          case XIDPrivateKeyOptions.Omit:
          default:
            // Omit decrypted private keys.
            break;
        }
      }
    }

    if (this._nickname !== "") {
      envelope = envelope.addAssertion(kv(NICKNAME), this._nickname);
    }

    for (const endpoint of this._endpoints) {
      envelope = envelope.addAssertion(kv(ENDPOINT), endpoint);
    }

    envelope = this._permissions.addToEnvelope(envelope);

    return envelope;
  }

  // EnvelopeEncodable implementation
  intoEnvelope(): Envelope {
    return this.intoEnvelopeOpt(XIDPrivateKeyOptions.Omit);
  }

  /**
   * Try to extract a Key from an envelope, optionally with password for decryption.
   *
   * Mirrors Rust `Key::try_from_envelope` exactly:
   * - Subject must be a tagged-CBOR PublicKeys leaf.
   * - Optional private-key assertion follows the
   *   `{predicate: object} [ 'salt': Salt ]` shape.
   * - Endpoints are tagged URIs, not bare text.
   * - Missing salt under a present private-key assertion is an error.
   */
  static tryFromEnvelope(envelope: Envelope, password?: Uint8Array): Key {
    type EnvelopeExt = Envelope & {
      asByteString(): Uint8Array | undefined;
      subject(): Envelope;
      assertions(): Envelope[];
      assertionsWithPredicate(p: unknown): Envelope[];
      optionalAssertionWithPredicate(p: unknown): Envelope | undefined;
      tryObject(): Envelope;
      tryLeaf(): Cbor;
      unlockSubject(p: Uint8Array): Envelope;
      isLockedWithPassword(): boolean;
    };
    const env = envelope as EnvelopeExt;

    // Extract PublicKeys from subject — must be a tagged CBOR leaf.
    const subjectLeaf = (env.subject() as EnvelopeExt).tryLeaf();
    const publicKeys = PublicKeys.fromTaggedCbor(subjectLeaf);

    // Extract optional private key — mirrors Rust
    // `extract_optional_private_key_with_password`.
    let privateKeyData: { data: PrivateKeyData; salt: Salt } | undefined;
    const privateKeyAssertion = env.optionalAssertionWithPredicate(PRIVATE_KEY);
    if (privateKeyAssertion !== undefined) {
      const ext = privateKeyAssertion as EnvelopeExt;
      const privateKeyObject = (ext.subject() as EnvelopeExt).tryObject() as EnvelopeExt;
      // Salt must live nested on the assertion node (Rust contract).
      const saltAssertionInner = ext.optionalAssertionWithPredicate(SALT);
      if (saltAssertionInner === undefined) {
        throw XIDError.envelopeParsing(new Error("missing 'salt' assertion on private-key node"));
      }
      const saltObj = (saltAssertionInner as EnvelopeExt).tryObject() as EnvelopeExt;
      const salt = Salt.fromTaggedCbor(saltObj.tryLeaf());

      if (privateKeyObject.isLockedWithPassword()) {
        if (password !== undefined) {
          try {
            const decrypted = privateKeyObject.unlockSubject(password) as EnvelopeExt;
            const decryptedLeaf = (decrypted.subject() as EnvelopeExt).tryLeaf();
            const privateKeys = PrivateKeys.fromTaggedCbor(decryptedLeaf);
            privateKeyData = {
              data: { type: "decrypted", privateKeys },
              salt,
            };
          } catch {
            privateKeyData = {
              data: { type: "encrypted", envelope: privateKeyObject },
              salt,
            };
          }
        } else {
          privateKeyData = {
            data: { type: "encrypted", envelope: privateKeyObject },
            salt,
          };
        }
      } else {
        const privateKeys = PrivateKeys.fromTaggedCbor(privateKeyObject.tryLeaf());
        privateKeyData = {
          data: { type: "decrypted", privateKeys },
          salt,
        };
      }
    }

    // Nickname (optional, defaults to "").
    let nickname = "";
    try {
      const nicknameObj = (
        env as unknown as { objectForPredicate(p: unknown): EnvelopeExt }
      ).objectForPredicate(NICKNAME);
      nickname = (nicknameObj as unknown as { asText(): string | undefined }).asText() ?? "";
    } catch {
      // No nickname assertion.
    }

    // Endpoints (each a tagged URI).
    const endpoints = new Set<URI>();
    const endpointAssertions = env.assertionsWithPredicate(ENDPOINT);
    for (const assertion of endpointAssertions) {
      const obj = (assertion as EnvelopeExt).tryObject() as EnvelopeExt;
      const uri = URI.fromTaggedCbor(obj.tryLeaf());
      endpoints.add(uri);
    }

    const permissions = Permissions.tryFromEnvelope(envelope);

    return new Key(publicKeys, privateKeyData, nickname, endpoints, permissions);
  }

  /**
   * Get the private key envelope, optionally decrypting it.
   *
   * Mirrors Rust `Key::private_key_envelope(password: Option<&[u8]>)`.
   * Password is bytes; the legacy `string` form is accepted as a
   * convenience for callers that have not yet migrated.
   */
  privateKeyEnvelope(password?: Uint8Array | string): Envelope | undefined {
    if (this._privateKeyData === undefined) {
      return undefined;
    }
    const { data } = this._privateKeyData;
    if (data.type === "decrypted") {
      return Envelope.new(data.privateKeys);
    }
    if (password !== undefined) {
      const passwordBytes =
        typeof password === "string" ? new TextEncoder().encode(password) : password;
      try {
        const decrypted = (
          data.envelope as unknown as { unlockSubject(p: Uint8Array): Envelope }
        ).unlockSubject(passwordBytes);
        return decrypted;
      } catch {
        throw XIDError.invalidPassword();
      }
    }
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
