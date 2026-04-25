import {
  XIDDocument,
  XIDPrivateKeyOptions,
  XIDGeneratorOptions,
  XIDVerifySignature,
  Key,
  type Privilege,
  type XIDGenesisMarkOptions,
  type XIDPrivateKeyEncryptConfig,
  type XIDGeneratorEncryptConfig,
} from "@bcts/xid";
import { Envelope } from "@bcts/envelope";
import {
  PrivateKeyBase,
  PrivateKeys,
  PublicKeys,
  SignatureScheme,
  createKeypair,
  createEncapsulationKeypair,
  EncapsulationScheme,
} from "@bcts/components";
import { ProvenanceMarkResolution } from "@bcts/provenance-mark";
import type { SideKey } from "./types";

const textEncoder = new TextEncoder();

export type TutorialScheme = "Ed25519" | "Schnorr" | "ECDSA" | "SshEd25519";

function schemeEnum(s: TutorialScheme): SignatureScheme {
  switch (s) {
    case "Ed25519":
      return SignatureScheme.Ed25519;
    case "Schnorr":
      return SignatureScheme.Schnorr;
    case "ECDSA":
      return SignatureScheme.Ecdsa;
    case "SshEd25519":
      return SignatureScheme.SshEd25519;
  }
}

/** Create a XID with password-encrypted private key and provenance generator (§1.3). */
export function createEncryptedXid(
  nickname: string,
  scheme: TutorialScheme,
  password: string,
  withProvenance: boolean,
): XIDDocument {
  const markOptions: XIDGenesisMarkOptions =
    withProvenance && password
      ? {
          type: "passphrase",
          passphrase: password,
          resolution: ProvenanceMarkResolution.High,
          date: new Date(),
        }
      : { type: "none" };

  if (scheme === "Schnorr") {
    // PrivateKeyBase.new() gives Schnorr keys directly via .schnorrPrivateKeys()/.schnorrPublicKeys()
    const doc = XIDDocument.new({ type: "default" }, markOptions);
    const key = doc.inceptionKey();
    if (key) doc.setNameForKey(key.publicKeys(), nickname);
    return doc;
  }
  const [signingPrv, signingPub] = createKeypair(schemeEnum(scheme));
  const [encPrv, encPub] = createEncapsulationKeypair(EncapsulationScheme.X25519);
  const privateKeys = PrivateKeys.withKeys(signingPrv, encPrv);
  const publicKeys = PublicKeys.new(signingPub, encPub);
  const doc = XIDDocument.new({ type: "privateKeys", privateKeys, publicKeys }, markOptions);
  const key = doc.inceptionKey();
  if (key) doc.setNameForKey(key.publicKeys(), nickname);
  return doc;
}

function passwordBytes(password: string): Uint8Array {
  return textEncoder.encode(password);
}

/** Build the private-key options block for serialization. */
export function privateKeyOptions(password: string) {
  if (!password) return XIDPrivateKeyOptions.Omit;
  const cfg: XIDPrivateKeyEncryptConfig = {
    type: XIDPrivateKeyOptions.Encrypt,
    password: passwordBytes(password),
  };
  return cfg;
}

export function generatorOptions(password: string) {
  if (!password) return XIDGeneratorOptions.Omit;
  const cfg: XIDGeneratorEncryptConfig = {
    type: XIDGeneratorOptions.Encrypt,
    password: passwordBytes(password),
  };
  return cfg;
}

/** Export a private (encrypted) envelope for saving or restoring. */
export function exportPrivateEnvelope(doc: XIDDocument, password: string): Envelope {
  return doc.toEnvelope(privateKeyOptions(password), generatorOptions(password), {
    type: "inception",
  });
}

/** Export a public envelope (elided private keys + generator, still signed).
 *  Uses XIDPrivateKeyOptions.Elide + XIDGeneratorOptions.Elide which preserves the digest
 *  tree so the inception signature still verifies. */
export function exportPublicEnvelope(doc: XIDDocument): Envelope {
  return doc.toEnvelope(XIDPrivateKeyOptions.Elide, XIDGeneratorOptions.Elide, {
    type: "inception",
  });
}

/** Reload a XID from a UR string, optionally using a password to decrypt private keys. */
export function loadXidFromUr(urString: string, password?: string): XIDDocument {
  const envelope = (Envelope as unknown as { fromURString(s: string): Envelope }).fromURString(
    urString,
  );
  const pw = password ? passwordBytes(password) : undefined;
  return XIDDocument.fromEnvelope(envelope, pw, XIDVerifySignature.None);
}

/** Verify the inception signature on a public envelope. */
export function verifyInceptionSignature(publicUr: string): boolean {
  try {
    const envelope = (Envelope as unknown as { fromURString(s: string): Envelope }).fromURString(
      publicUr,
    );
    XIDDocument.fromEnvelope(envelope, undefined, XIDVerifySignature.Inception);
    return true;
  } catch {
    return false;
  }
}

/** Generate a side keypair (e.g. attestation / contract / SSH signing key). */
export function generateSideKey(nickname: string, scheme: TutorialScheme): SideKey {
  if (scheme === "Schnorr") {
    const base = PrivateKeyBase.new();
    return {
      nickname,
      prvKeys: base.schnorrPrivateKeys(),
      pubKeys: base.schnorrPublicKeys(),
    };
  }
  const [signingPrv, signingPub] = createKeypair(schemeEnum(scheme));
  const [encPrv, encPub] = createEncapsulationKeypair(EncapsulationScheme.X25519);
  return {
    nickname,
    prvKeys: PrivateKeys.withKeys(signingPrv, encPrv),
    pubKeys: PublicKeys.new(signingPub, encPub),
  };
}

/** Register a side key inside the XID with a nickname + limited permissions. */
export function addSideKeyToXid(doc: XIDDocument, side: SideKey, allow: Privilege[]): void {
  const key = Key.newWithPrivateKeys(side.prvKeys, side.pubKeys);
  for (const p of allow) key.addPermission(p);
  key.setNickname(side.nickname);
  doc.addKey(key);
}

/** Export the SSH public key as its human-readable `ssh-ed25519 …` string. */
export function sshPublicKeyText(pubKeys: PublicKeys): string {
  // The signing public key's toString() for SSH schemes returns the text form.
  const signing = pubKeys.signingPublicKey();
  const s = signing.toString();
  return s;
}
