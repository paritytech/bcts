/**
 * XID utilities - 1:1 port of cmd/xid/xid_utils.rs
 */

import {
  PrivateKeyBase,
  PrivateKeys,
  PublicKeys,
  URI,
} from "@bcts/components";
import { Envelope } from "@bcts/envelope";
import { UR } from "@bcts/uniform-resources";
import {
  Key,
  XIDDocument,
  XIDPrivateKeyOptions,
  XIDGeneratorOptions,
  XIDVerifySignature,
  type XIDSigningOptions,
  type XIDPrivateKeyOptionsValue,
  type XIDGeneratorOptionsValue,
  type XIDPrivateKeyEncryptConfig,
  type XIDGeneratorEncryptConfig,
} from "@bcts/xid";
import { readEnvelope, readStdinLine, readPassword } from "../../utils.js";
import type { OutputOptions } from "./output-options.js";
import type { ReadPasswordArgs, WritePasswordArgs } from "./password-args.js";
import { isEncrypt as isPrivateEncrypt, toXIDPrivateKeyOptions } from "./private-options.js";
import { isEncrypt as isGeneratorEncrypt, toXIDGeneratorOptions } from "./generator-options.js";
import { type XIDPrivilege, toPrivilege } from "./xid-privilege.js";

// ============================================================================
// InputKey - union type for parsed key input
// ============================================================================

/**
 * Represents the different types of keys that can be read from CLI input.
 */
export type InputKey =
  | { type: "Public"; publicKeys: PublicKeys }
  | { type: "PrivateBase"; privateKeyBase: PrivateKeyBase }
  | { type: "PrivateKeys"; privateKeys: PrivateKeys }
  | { type: "PrivateAndPublicKeys"; privateKeys: PrivateKeys; publicKeys: PublicKeys };

// ============================================================================
// Key reading functions
// ============================================================================

/**
 * Parse a single key string into an InputKey.
 */
function parseSingleKey(keyString: string): InputKey {
  // Try PublicKeys first
  try {
    const publicKeys = PublicKeys.fromURString(keyString);
    return { type: "Public", publicKeys };
  } catch {
    // Not PublicKeys
  }

  // Try PrivateKeyBase
  try {
    const privateKeyBase = PrivateKeyBase.fromURString(keyString);
    return { type: "PrivateBase", privateKeyBase };
  } catch {
    // Not PrivateKeyBase
  }

  // Try PrivateKeys
  try {
    const privateKeys = PrivateKeys.fromURString(keyString);
    return { type: "PrivateKeys", privateKeys };
  } catch {
    // Not PrivateKeys
  }

  throw new Error("Invalid public keys, private key base, or private keys");
}

/**
 * Read a key from a string or stdin.
 *
 * Supports:
 * - Single key: ur:crypto-pubkeys, ur:prvkeys, ur:crypto-prvkeys
 * - Two space-separated keys: ur:crypto-prvkeys + ur:crypto-pubkeys pair
 */
export function readKey(key?: string): InputKey {
  let keyString: string;
  if (key !== undefined && key !== "") {
    keyString = key;
  } else {
    // Read from stdin
    keyString = readStdinLine().trim();
  }

  if (!keyString) {
    throw new Error("No key provided");
  }

  // Check if the input contains two space-separated URs
  const parts = keyString.split(/\s+/);

  if (parts.length === 2) {
    // Try to parse as two separate keys
    try {
      const key1 = parseSingleKey(parts[0]);
      const key2 = parseSingleKey(parts[1]);

      // Ensure we have exactly one PrivateKeys and one PublicKeys
      if (key1.type === "PrivateKeys" && key2.type === "Public") {
        return {
          type: "PrivateAndPublicKeys",
          privateKeys: key1.privateKeys,
          publicKeys: key2.publicKeys,
        };
      }
      if (key1.type === "Public" && key2.type === "PrivateKeys") {
        return {
          type: "PrivateAndPublicKeys",
          privateKeys: key2.privateKeys,
          publicKeys: key1.publicKeys,
        };
      }

      throw new Error(
        "When providing two keys, one must be crypto-prvkeys and one must be crypto-pubkeys",
      );
    } catch (e) {
      // Two-key parse failed — fall through to single key
      if (
        e instanceof Error &&
        e.message.includes("When providing two keys")
      ) {
        throw e;
      }
    }
  }

  // Single key or the two-key parse failed
  return parseSingleKey(keyString);
}

/**
 * Read and validate a key as public key only.
 */
export function readPublicKey(key?: string): PublicKeys {
  const inputKey = readKey(key);
  if (inputKey.type === "Public") {
    return inputKey.publicKeys;
  }
  throw new Error("Expected a public key, but found a private key.");
}

// ============================================================================
// Key update helper
// ============================================================================

/**
 * Apply modifications to a Key object.
 */
export function updateKey(
  key: Key,
  nickname: string,
  endpoints: string[],
  permissions: XIDPrivilege[],
): void {
  if (nickname !== "") {
    key.setNickname(nickname);
  }

  if (endpoints.length > 0) {
    for (const uri of endpoints) {
      key.addEndpoint(uri);
    }
  }

  if (permissions.length > 0) {
    key.permissionsMut().allow.clear();
    key.permissionsMut().deny.clear();
    for (const privilege of permissions) {
      key.addPermission(toPrivilege(privilege));
    }
  }
}

// ============================================================================
// XID Document reading helpers
// ============================================================================

/**
 * Read an XID document from an envelope string, optionally verifying.
 */
export function readXidDocument(
  envelope?: string,
  verify: XIDVerifySignature = XIDVerifySignature.None,
): XIDDocument {
  const env = readEnvelope(envelope);
  return XIDDocument.fromEnvelope(env, undefined, verify);
}

/**
 * Read an XID document with password support.
 */
export async function readXidDocumentWithPassword(
  envelope: string | undefined,
  passwordArgs: ReadPasswordArgs,
  verify: XIDVerifySignature = XIDVerifySignature.None,
): Promise<XIDDocument> {
  const env = readEnvelope(envelope);
  let password: Uint8Array | undefined;
  if (passwordArgs.password !== undefined) {
    const pwd = await readPassword(
      "Decryption password:",
      passwordArgs.password || undefined,
      passwordArgs.askpass,
    );
    password = new TextEncoder().encode(pwd);
  }
  return XIDDocument.fromEnvelope(env, password, verify);
}

// ============================================================================
// Private key UR extraction
// ============================================================================

/**
 * Get the private key from a key, optionally decrypting it.
 *
 * Returns the UR string:
 * - For unencrypted keys: ur:crypto-prvkeys
 * - For encrypted keys without password: ur:envelope of the encrypted envelope
 * - For encrypted keys with correct password: ur:crypto-prvkeys
 * - For encrypted keys with wrong password: Returns an error
 */
export async function getPrivateKeyUr(
  key: Key,
  passwordArgs: ReadPasswordArgs,
): Promise<string> {
  let password: string | undefined;
  if (passwordArgs.password !== undefined) {
    password = await readPassword(
      "Decryption password:",
      passwordArgs.password || undefined,
      passwordArgs.askpass,
    );
  }

  const envelope = key.privateKeyEnvelope(password);
  if (envelope === undefined) {
    throw new Error("No private key present in this key");
  }

  // Try to extract PrivateKeys from the subject.
  // Matches Rust: PrivateKeys::try_from(envelope.subject())
  // If successful, we have decrypted keys - return as ur:crypto-prvkeys
  // If it fails, we have an encrypted envelope - return as ur:envelope
  try {
    // Private keys are stored as tagged CBOR bytes in a leaf envelope.
    // After unlockSubject, the subject is a byte string leaf.
    const subject = envelope.subject();
    const bytes = subject.asByteString();
    if (bytes !== undefined) {
      const privateKeys = PrivateKeys.fromTaggedCborData(bytes);
      return privateKeys.urString();
    }
    // Fallback: try extractSubject for other subject types
    const privateKeys = envelope.extractSubject(
      (cbor) => PrivateKeys.fromTaggedCbor(cbor),
    );
    return privateKeys.urString();
  } catch {
    // Subject is not PrivateKeys (it's ENCRYPTED) - return the envelope
    return envelope.urString();
  }
}

// ============================================================================
// URI reading helper
// ============================================================================

/**
 * Read a URI from an argument or stdin.
 */
export function readUri(uri?: string): URI {
  let uriString: string;
  if (uri !== undefined && uri !== "") {
    uriString = uri;
  } else {
    uriString = readStdinLine();
  }
  if (!uriString || uriString.trim() === "") {
    throw new Error("No URI provided");
  }
  return URI.new(uriString.trim());
}

// ============================================================================
// XID document output helpers
// ============================================================================

/**
 * Convert an envelope to a XID UR string.
 */
export function envelopeToXidUrString(envelope: Envelope): string {
  return UR.new("xid", envelope.untaggedCbor()).string();
}

/**
 * Convert an XID document to a UR string.
 *
 * This is the consolidated function for all XIDDocument to UR string
 * conversions. It handles private key options, generator options, signing
 * options, and optional password encryption.
 */
export async function xidDocumentToUrString(
  xidDocument: XIDDocument,
  outputOpts: OutputOptions,
  passwordArgs?: WritePasswordArgs,
  sharedPassword?: string,
  signingOptions: XIDSigningOptions = { type: "none" },
): Promise<string> {
  const privateOpts = outputOpts.privateOpts;
  const generatorOpts = outputOpts.generatorOpts;

  let privateKeyOptions: XIDPrivateKeyOptionsValue;

  if (isPrivateEncrypt(privateOpts)) {
    if (passwordArgs === undefined) {
      throw new Error("Password args required for encryption");
    }
    // Use shared password if available, otherwise read it
    const password = sharedPassword ?? await readPassword(
      "Encryption password:",
      passwordArgs.encryptPassword,
      passwordArgs.encryptAskpass,
    );
    privateKeyOptions = {
      type: XIDPrivateKeyOptions.Encrypt,
      password: new TextEncoder().encode(password),
    } satisfies XIDPrivateKeyEncryptConfig;
  } else {
    privateKeyOptions = toXIDPrivateKeyOptions(privateOpts);
  }

  let generatorOptions: XIDGeneratorOptionsValue;

  if (isGeneratorEncrypt(generatorOpts)) {
    if (passwordArgs === undefined) {
      throw new Error("Password args required for encryption");
    }
    // Use shared password if available, otherwise read it
    const password = sharedPassword ?? await readPassword(
      "Generator password:",
      passwordArgs.encryptPassword,
      passwordArgs.encryptAskpass,
    );
    generatorOptions = {
      type: XIDGeneratorOptions.Encrypt,
      password: new TextEncoder().encode(password),
    } satisfies XIDGeneratorEncryptConfig;
  } else {
    generatorOptions = toXIDGeneratorOptions(generatorOpts);
  }

  const envelope = xidDocument.toEnvelope(
    privateKeyOptions,
    generatorOptions,
    signingOptions,
  );
  return envelopeToXidUrString(envelope);
}
