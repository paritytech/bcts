/**
 * XID Key
 *
 * Represents a key in an XID document, containing public keys, optional private keys,
 * nickname, endpoints, and permissions.
 *
 * Ported from bc-xid-rust/src/key.rs
 */

import {
  Envelope,
  PrivateKeyBase,
  PublicKeyBase,
  type EnvelopeEncodable,
} from "@blockchain-commons/envelope";
import { ENDPOINT, NICKNAME, PRIVATE_KEY, SALT } from "@blockchain-commons/known-values";
import { Salt, Reference } from "@blockchain-commons/components";
import { Permissions, type HasPermissions } from "./permissions.js";
import { type Privilege } from "./privilege.js";
import { type HasNickname } from "./name.js";
import { XIDError } from "./error.js";

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
  | { type: "decrypted"; privateKeyBase: PrivateKeyBase }
  | { type: "encrypted"; envelope: Envelope };

/**
 * Represents a key in an XID document.
 */
export class Key implements HasNickname, HasPermissions, EnvelopeEncodable {
  private readonly _publicKeyBase: PublicKeyBase;
  private readonly _privateKeys: { data: PrivateKeyData; salt: Salt } | undefined;
  private _nickname: string;
  private readonly _endpoints: Set<string>;
  private readonly _permissions: Permissions;

  private constructor(
    publicKeyBase: PublicKeyBase,
    privateKeys?: { data: PrivateKeyData; salt: Salt },
    nickname = "",
    endpoints = new Set<string>(),
    permissions = Permissions.new(),
  ) {
    this._publicKeyBase = publicKeyBase;
    this._privateKeys = privateKeys;
    this._nickname = nickname;
    this._endpoints = endpoints;
    this._permissions = permissions;
  }

  /**
   * Create a new Key with only public keys.
   */
  static new(publicKeyBase: PublicKeyBase): Key {
    return new Key(publicKeyBase);
  }

  /**
   * Create a new Key with public keys and allow-all permissions.
   */
  static newAllowAll(publicKeyBase: PublicKeyBase): Key {
    return new Key(publicKeyBase, undefined, "", new Set(), Permissions.newAllowAll());
  }

  /**
   * Create a new Key with private key base.
   */
  static newWithPrivateKeyBase(privateKeyBase: PrivateKeyBase): Key {
    const salt = Salt.random(32);
    return new Key(
      privateKeyBase.publicKeys(),
      { data: { type: "decrypted", privateKeyBase }, salt },
      "",
      new Set(),
      Permissions.newAllowAll(),
    );
  }

  /**
   * Get the public key base.
   */
  publicKeyBase(): PublicKeyBase {
    return this._publicKeyBase;
  }

  /**
   * Get the private key base, if available and decrypted.
   */
  privateKeyBase(): PrivateKeyBase | undefined {
    if (this._privateKeys === undefined) return undefined;
    if (this._privateKeys.data.type === "decrypted") {
      return this._privateKeys.data.privateKeyBase;
    }
    return undefined;
  }

  /**
   * Check if this key has decrypted private keys.
   */
  hasPrivateKeys(): boolean {
    return this._privateKeys?.data.type === "decrypted";
  }

  /**
   * Check if this key has encrypted private keys.
   */
  hasEncryptedPrivateKeys(): boolean {
    return this._privateKeys?.data.type === "encrypted";
  }

  /**
   * Get the salt used for private key decorrelation.
   */
  privateKeySalt(): Salt | undefined {
    return this._privateKeys?.salt;
  }

  /**
   * Get the reference for this key (based on public key).
   */
  reference(): Reference {
    return Reference.hash(this._publicKeyBase.data());
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
    let envelope = Envelope.new(this._publicKeyBase.data());

    // Handle private keys
    if (this._privateKeys !== undefined) {
      const { data, salt } = this._privateKeys;

      if (data.type === "encrypted") {
        // Always preserve encrypted keys
        const assertionEnvelope = Envelope.newAssertion(PRIVATE_KEY, data.envelope).addAssertion(
          SALT,
          salt.toData(),
        );
        envelope = envelope.addAssertionEnvelope(assertionEnvelope);
      } else if (data.type === "decrypted") {
        // Handle decrypted keys based on options
        const option =
          typeof privateKeyOptions === "object" ? privateKeyOptions.type : privateKeyOptions;

        switch (option) {
          case XIDPrivateKeyOptions.Include: {
            const assertionEnvelope = Envelope.newAssertion(
              PRIVATE_KEY,
              data.privateKeyBase.data(),
            ).addAssertion(SALT, salt.toData());
            envelope = envelope.addAssertionEnvelope(assertionEnvelope);
            break;
          }
          case XIDPrivateKeyOptions.Elide: {
            const assertionEnvelope = Envelope.newAssertion(PRIVATE_KEY, data.privateKeyBase.data())
              .addAssertion(SALT, salt.toData())
              .elide();
            envelope = envelope.addAssertionEnvelope(assertionEnvelope);
            break;
          }
          case XIDPrivateKeyOptions.Encrypt: {
            if (typeof privateKeyOptions === "object") {
              const privateKeysEnvelope = Envelope.new(data.privateKeyBase.data());
              const encrypted = privateKeysEnvelope.encryptSubject(privateKeyOptions.password);
              const assertionEnvelope = Envelope.newAssertion(PRIVATE_KEY, encrypted).addAssertion(
                SALT,
                salt.toData(),
              );
              envelope = envelope.addAssertionEnvelope(assertionEnvelope);
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
      envelope = envelope.addAssertion(NICKNAME, this._nickname);
    }

    // Add endpoints
    for (const endpoint of this._endpoints) {
      envelope = envelope.addAssertion(ENDPOINT, endpoint);
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
    // Extract public key base from subject
    const publicKeyData = envelope.asByteString() as Uint8Array | undefined;
    if (publicKeyData === undefined) {
      throw XIDError.component(new Error("Could not extract public key from envelope"));
    }
    const publicKeyBase = new PublicKeyBase(publicKeyData);

    // Extract optional private key
    let privateKeys: { data: PrivateKeyData; salt: Salt } | undefined;

    const privateKeyAssertions = envelope.assertionsWithPredicate(PRIVATE_KEY) as Envelope[];
    if (privateKeyAssertions.length > 0) {
      const privateKeyAssertion = privateKeyAssertions[0] as Envelope;
      const assertionCase = privateKeyAssertion.case();

      if (assertionCase.type === "assertion") {
        const privateKeyObject = assertionCase.assertion.object() as Envelope;

        // Extract salt
        const saltAssertions = privateKeyAssertion.assertionsWithPredicate(SALT) as Envelope[];
        let salt: Salt;
        if (saltAssertions.length > 0) {
          const saltAssertion = saltAssertions[0] as Envelope;
          const saltCase = saltAssertion.case();
          if (saltCase.type === "assertion") {
            const saltData = (saltCase.assertion.object() as Envelope).asByteString() as
              | Uint8Array
              | undefined;
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
        const objCase = privateKeyObject.case();
        if (objCase.type === "encrypted") {
          if (password !== undefined) {
            try {
              const decrypted = privateKeyObject.decryptSubject(password) as Envelope;
              const decryptedData = decrypted.asByteString() as Uint8Array | undefined;
              if (decryptedData !== undefined) {
                const privateKeyBase = PrivateKeyBase.fromBytes(decryptedData, publicKeyData);
                privateKeys = {
                  data: { type: "decrypted", privateKeyBase },
                  salt,
                };
              }
            } catch {
              // Wrong password - store as encrypted
              privateKeys = {
                data: { type: "encrypted", envelope: privateKeyObject },
                salt,
              };
            }
          } else {
            // No password - store as encrypted
            privateKeys = {
              data: { type: "encrypted", envelope: privateKeyObject },
              salt,
            };
          }
        } else {
          // Plain text private key
          const privateKeyData = privateKeyObject.asByteString() as Uint8Array | undefined;
          if (privateKeyData !== undefined) {
            const privateKeyBase = PrivateKeyBase.fromBytes(privateKeyData, publicKeyData);
            privateKeys = {
              data: { type: "decrypted", privateKeyBase },
              salt,
            };
          }
        }
      }
    }

    // Extract nickname
    let nickname = "";
    try {
      const nicknameObj = envelope.objectForPredicate(NICKNAME) as Envelope;
      nickname = (nicknameObj.asText() as string | undefined) ?? "";
    } catch {
      // No nickname
    }

    // Extract endpoints
    const endpoints = new Set<string>();
    const endpointObjects = envelope.objectsForPredicate(ENDPOINT) as Envelope[];
    for (const obj of endpointObjects) {
      const text = obj.asText() as string | undefined;
      if (text !== undefined) {
        endpoints.add(text);
      }
    }

    // Extract permissions
    const permissions = Permissions.tryFromEnvelope(envelope);

    return new Key(publicKeyBase, privateKeys, nickname, endpoints, permissions);
  }

  /**
   * Check equality with another Key.
   */
  equals(other: Key): boolean {
    return this._publicKeyBase.hex() === other._publicKeyBase.hex();
  }

  /**
   * Get a hash key for use in Sets/Maps.
   */
  hashKey(): string {
    return this._publicKeyBase.hex();
  }

  /**
   * Clone this Key.
   */
  clone(): Key {
    return new Key(
      this._publicKeyBase,
      this._privateKeys !== undefined
        ? { data: this._privateKeys.data, salt: this._privateKeys.salt }
        : undefined,
      this._nickname,
      new Set(this._endpoints),
      this._permissions.clone(),
    );
  }
}
