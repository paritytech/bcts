import { Key, type Privilege, type XIDDocument } from "@bcts/xid";
import type { PublicKeys, Digest } from "@bcts/components";
import { generateSideKey, type TutorialScheme } from "./identity";
import type { SideKey } from "./types";

/** Identifying material for a key being disavowed (§5.5 Step 9). The
 *  `assertionDigest` is the digest of the key's envelope as it appeared in the
 *  XID — mirrors upstream `envelope digest $(envelope xid key find name …)`. */
export interface DisavowedKey {
  nickname: string;
  pubKeys: PublicKeys;
  assertionDigest: Digest;
}

/** Read-model for the key-inventory panel (§5.1). */
export interface KeyInventoryEntry {
  nickname: string;
  scheme: string;
  permissions: Privilege[];
  isInception: boolean;
  pubKeysUr: string;
  referenceHex: string;
}

/**
 * Add an operational key (laptop / portable / …) with a nickname and a scoped
 * permission set. Mirrors the upstream §5.1 `envelope xid key add --nickname …
 * --allow …` flow — generate a fresh keypair, wrap it in a `Key`, grant the
 * requested privileges, and register it on the document.
 */
export function addOperationalKey(
  doc: XIDDocument,
  nickname: string,
  scheme: TutorialScheme,
  allow: Privilege[],
): SideKey {
  const side = generateSideKey(nickname, scheme);
  const key = Key.newWithPrivateKeys(side.prvKeys, side.pubKeys);
  for (const p of allow) key.addPermission(p);
  key.setNickname(nickname);
  doc.addKey(key);
  return side;
}

/** Find a key on the document by its nickname (§5.2 / §5.5 `key find name`). */
export function findKeyByNickname(doc: XIDDocument, name: string): Key | undefined {
  return doc.keys().find((k) => k.nickname() === name);
}

/**
 * Replace a key's allowed-permission set. Uses the Rust-style take → mutate →
 * re-add pattern so the change is unambiguously persisted on the document
 * (§5.2 `key update`).
 */
export function setKeyPermissions(
  doc: XIDDocument,
  pubKeys: PublicKeys,
  allow: Privilege[],
): boolean {
  const key = doc.takeKey(pubKeys);
  if (!key) return false;
  const perms = key.permissionsMut();
  perms.allow.clear();
  for (const p of allow) perms.allow.add(p);
  doc.addKey(key);
  return true;
}

/**
 * Rotate a key: add a fresh key with a new nickname, then remove the old one
 * (§5.2 Steps 4–6). Returns the new side key so the caller can surface its UR.
 */
export function rotateKey(
  doc: XIDDocument,
  oldPubKeys: PublicKeys,
  newNickname: string,
  scheme: TutorialScheme,
  allow: Privilege[],
): SideKey {
  const side = addOperationalKey(doc, newNickname, scheme, allow);
  doc.removeKey(oldPubKeys);
  return side;
}

/**
 * Capture a key's disavowal info (nickname + public keys + the digest of its
 * envelope in the XID) BEFORE it's revoked, so §5.5 can name it in a signed
 * disavowal statement. Mirrors the upstream pattern of running
 * `xid key find name` + `digest` ahead of `key remove`.
 */
export function keyDisavowalInfo(doc: XIDDocument, nickname: string): DisavowedKey | undefined {
  const key = findKeyByNickname(doc, nickname);
  if (!key) return undefined;
  return {
    nickname,
    pubKeys: key.publicKeys(),
    assertionDigest: key.intoEnvelope().digest(),
  };
}

/** Remove a key by nickname; returns its public keys if it existed (§5.5). */
export function removeKeyByNickname(doc: XIDDocument, name: string): PublicKeys | undefined {
  const key = findKeyByNickname(doc, name);
  if (!key) return undefined;
  const pub = key.publicKeys();
  doc.removeKey(pub);
  return pub;
}

/** Build a read-model of every key on the document for the inventory panel. */
export function keyInventory(doc: XIDDocument): KeyInventoryEntry[] {
  return doc.keys().map((k) => {
    const pub = k.publicKeys();
    let scheme = "Unknown";
    let isInception = false;
    try {
      const signing = pub.signingPublicKey();
      scheme = signing.keyType();
      isInception = doc.isInceptionSigningKey(signing);
    } catch {
      /* non-signing or malformed key */
    }
    let pubKeysUr = "";
    try {
      pubKeysUr = pub.urString();
    } catch {
      /* */
    }
    return {
      nickname: k.nickname() || "(unnamed)",
      scheme,
      permissions: [...k.permissions().allow],
      isInception,
      pubKeysUr,
      referenceHex: k.reference().toHex(),
    };
  });
}
