/**
 * Copyright © 2025-2026 Parity Technologies
 *
 * SSH private-key parser/serializer for the OpenSSH binary key format
 * (`-----BEGIN OPENSSH PRIVATE KEY-----`), spec: PROTOCOL.key in
 * https://github.com/openssh/openssh-portable.
 *
 * Mirrors `ssh_key::PrivateKey` (crate `ssh-key` v0.6.7) byte-for-byte for
 * unencrypted Ed25519, DSA, ECDSA P-256, and ECDSA P-384 keys. Encrypted
 * keys (bcrypt-pbkdf + AES-256-CTR), RSA, and P-521 are deferred to v2 —
 * see `SSH_PLAN.md` V2.A-V2.D.
 *
 * Wire-format summary (after base64-decoding the PEM body):
 *
 *     "openssh-key-v1\0"                  (15 bytes magic)
 *     string  ciphername                  (must be "none" in v1)
 *     string  kdfname                     (must be "none" in v1)
 *     string  kdfoptions                  (empty when ciphername = "none")
 *     uint32  nkeys                       (must be 1 in v1)
 *     string  publickey-blob              (`SSHPublicKey.toBlob` payload)
 *     string  encrypted-section:
 *                 uint32  checkint
 *                 uint32  checkint        (must equal first checkint)
 *                 algorithm-specific keypair fields
 *                 string  comment
 *                 padding 0x01, 0x02, ... up to 8-byte block boundary
 *
 *   ed25519 keypair fields:
 *     string  algorithm  ("ssh-ed25519")
 *     string  public_key (32 bytes)
 *     string  private_key (64 bytes — seed (32) || public (32))
 *
 *   ecdsa-sha2-nistp{256,384} keypair fields:
 *     string  algorithm  ("ecdsa-sha2-nistp{256,384}")
 *     string  curve      ("nistp{256,384}")
 *     string  public_point (65 / 97 bytes — 0x04 || X || Y)
 *     mpint   private_scalar (canonical: 32/48 bytes, with 0x00 sign byte if MSB set)
 *
 *   ssh-dss keypair fields:
 *     string  algorithm  ("ssh-dss")
 *     mpint   p (re-stated)
 *     mpint   q (re-stated)
 *     mpint   g (re-stated)
 *     mpint   y (re-stated)
 *     mpint   x (private)
 */

import { sha256, sha512 } from "@noble/hashes/sha2.js";
import { sha1 } from "@noble/hashes/legacy.js";
import { ed25519 } from "@noble/curves/ed25519.js";
import { p256, p384 } from "@noble/curves/nist.js";
import {
  SshBufferReader,
  SshBufferWriter,
  stripMpintSignByte,
  padLeftToLength,
} from "./internal/ssh-buffer.js";
import { encodePem, parsePem } from "./internal/ssh-pem.js";
import { dsaSign } from "./internal/dsa.js";
import {
  parseSshAlgorithm,
  sshAlgorithmName,
  sshCurveName,
  sshEcdsaPointLen,
  sshEcdsaScalarLen,
  type SshAlgorithm,
  type SshEcdsaCurve,
} from "./ssh-algorithm.js";
import { SSHPublicKey } from "./ssh-public-key.js";
import { SSHSignature, type SshHashAlgorithm } from "./ssh-signature.js";

const PEM_LABEL = "OPENSSH PRIVATE KEY";
const PEM_LINE_WIDTH = 70;
const MAGIC = new TextEncoder().encode("openssh-key-v1\0");
const CIPHER_NONE = "none";
const KDF_NONE = "none";
const NKEYS = 1;
const BLOCK_SIZE_NONE = 8;
const ED25519_SEED_LEN = 32;
const ED25519_PUBLIC_LEN = 32;

/**
 * Algorithm-specific private-key data.
 *
 *   - ed25519: 32-byte seed.
 *   - ecdsa:   curve + canonical scalar (32 / 48 bytes, no sign byte).
 *   - dsa:     canonical positive p, q, g, y (re-stated from the public
 *              key blob), plus the secret exponent x.
 */
export type SshPrivateKeyData =
  | { kind: "ed25519"; seed: Uint8Array; pubBytes: Uint8Array }
  | { kind: "ecdsa"; curve: SshEcdsaCurve; scalar: Uint8Array; point: Uint8Array }
  | {
      kind: "dsa";
      p: Uint8Array;
      q: Uint8Array;
      g: Uint8Array;
      y: Uint8Array;
      x: Uint8Array;
    };

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function stripPositiveMpint(mpint: Uint8Array): Uint8Array {
  if (mpint.length > 0 && mpint[0] === 0x00) {
    return new Uint8Array(mpint.subarray(1));
  }
  return new Uint8Array(mpint);
}

export class SSHPrivateKey {
  readonly data: SshPrivateKeyData;
  readonly comment: string;
  /**
   * 32-bit checkint preserved on round-trip — `ssh-key` retains the parsed
   * value, so to round-trip byte-identically we do too.
   */
  readonly checkint: number;

  private constructor(data: SshPrivateKeyData, comment: string, checkint: number) {
    this.data = data;
    this.comment = comment;
    this.checkint = checkint >>> 0;
  }

  /**
   * Construct an `SSHPrivateKey` from already-decoded parts. Used by
   * `PrivateKeyBase.sshSigningPrivateKey` after generating key material
   * from an HKDF-seeded RNG. The `checkint` should be derived
   * deterministically from the private bytes (matching Rust's
   * `ssh-key` 0.6.7 `KeypairData::checkint`).
   */
  static fromParts(data: SshPrivateKeyData, comment: string, checkint: number): SSHPrivateKey {
    return new SSHPrivateKey(data, comment, checkint);
  }

  /** Algorithm tag for this key. */
  get algorithm(): SshAlgorithm {
    const data = this.data;
    switch (data.kind) {
      case "ed25519":
        return { kind: "ed25519" };
      case "dsa":
        return { kind: "dsa" };
      case "ecdsa":
        return { kind: "ecdsa", curve: data.curve };
      default: {
        const _exhaustive: never = data;
        throw new Error(`SSHPrivateKey: unreachable kind ${String(_exhaustive)}`);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Legacy accessors (kept for compatibility with earlier SSH suite tests
  // that read `publicBytes` / `privateBytes` directly).
  // --------------------------------------------------------------------------

  get publicBytes(): Uint8Array {
    const data = this.data;
    switch (data.kind) {
      case "ed25519":
        return data.pubBytes;
      case "ecdsa":
        return data.point;
      case "dsa":
        throw new Error(
          "SSHPrivateKey.publicBytes is not defined for DSA — use `data.p/q/g/y` instead",
        );
      default: {
        const _exhaustive: never = data;
        throw new Error(`SSHPrivateKey: unreachable kind ${String(_exhaustive)}`);
      }
    }
  }

  get privateBytes(): Uint8Array {
    const data = this.data;
    switch (data.kind) {
      case "ed25519":
        return data.seed;
      case "ecdsa":
        return data.scalar;
      case "dsa":
        throw new Error("SSHPrivateKey.privateBytes is not defined for DSA — use `data.x` instead");
      default: {
        const _exhaustive: never = data;
        throw new Error(`SSHPrivateKey: unreachable kind ${String(_exhaustive)}`);
      }
    }
  }

  // --------------------------------------------------------------------------
  // OpenSSH armored format (PEM)
  // --------------------------------------------------------------------------

  static fromOpenssh(text: string): SSHPrivateKey {
    const { data } = parsePem(text, PEM_LABEL);
    return SSHPrivateKey.fromBlob(data);
  }

  static fromBlob(blob: Uint8Array): SSHPrivateKey {
    if (blob.length < MAGIC.length || !bytesEqual(blob.subarray(0, MAGIC.length), MAGIC)) {
      throw new Error("SSHPrivateKey: missing 'openssh-key-v1' magic");
    }
    const reader = new SshBufferReader(blob.subarray(MAGIC.length));

    const ciphername = decodeUtf8(reader.readString());
    const kdfname = decodeUtf8(reader.readString());
    if (ciphername !== CIPHER_NONE || kdfname !== KDF_NONE) {
      throw new Error(
        `SSHPrivateKey: encrypted keys are not supported in v1 (ciphername='${ciphername}', kdfname='${kdfname}'). See SSH_PLAN.md V2.B.`,
      );
    }
    const kdfoptions = reader.readString();
    if (kdfoptions.length !== 0) {
      throw new Error(
        `SSHPrivateKey: expected empty kdfoptions for ciphername='none', got ${kdfoptions.length} bytes`,
      );
    }
    const nkeys = reader.readUint32();
    if (nkeys !== NKEYS) {
      throw new Error(`SSHPrivateKey: expected exactly ${NKEYS} key, got ${nkeys}`);
    }
    const publicKeyBlob = reader.readString();
    const publicKey = SSHPublicKey.fromBlob(publicKeyBlob);

    const encryptedBlob = reader.readString();
    if (!reader.isAtEnd()) {
      throw new Error("SSHPrivateKey: trailing bytes after encrypted section");
    }
    if (encryptedBlob.length % BLOCK_SIZE_NONE !== 0) {
      throw new Error(
        `SSHPrivateKey: encrypted section length ${encryptedBlob.length} is not a multiple of ${BLOCK_SIZE_NONE}`,
      );
    }

    const innerReader = new SshBufferReader(encryptedBlob);
    const checkint1 = innerReader.readUint32();
    const checkint2 = innerReader.readUint32();
    if (checkint1 !== checkint2) {
      throw new Error(
        `SSHPrivateKey: checkint mismatch (0x${checkint1.toString(16)} vs 0x${checkint2.toString(16)}) — file is corrupted or encrypted`,
      );
    }

    const algoName = decodeUtf8(innerReader.readString());
    const algorithm = parseSshAlgorithm(algoName);
    if (sshAlgorithmName(publicKey.algorithm) !== algoName) {
      throw new Error(
        `SSHPrivateKey: outer/inner algorithm mismatch ('${sshAlgorithmName(publicKey.algorithm)}' vs '${algoName}')`,
      );
    }

    let data: SshPrivateKeyData;
    switch (algorithm.kind) {
      case "ed25519": {
        const pubBytes = innerReader.readString();
        if (pubBytes.length !== ED25519_PUBLIC_LEN) {
          throw new Error(
            `SSHPrivateKey ed25519: public key length ${pubBytes.length} != ${ED25519_PUBLIC_LEN}`,
          );
        }
        if (publicKey.data.kind !== "ed25519" || !bytesEqual(pubBytes, publicKey.data.pubBytes)) {
          throw new Error("SSHPrivateKey ed25519: outer/inner public-key mismatch");
        }
        const combined = innerReader.readString();
        if (combined.length !== ED25519_SEED_LEN + ED25519_PUBLIC_LEN) {
          throw new Error(
            `SSHPrivateKey ed25519: combined seed||public length ${combined.length} != ${ED25519_SEED_LEN + ED25519_PUBLIC_LEN}`,
          );
        }
        const tail = combined.subarray(ED25519_SEED_LEN);
        if (!bytesEqual(tail, pubBytes)) {
          throw new Error(
            "SSHPrivateKey ed25519: combined-blob public tail does not match public field",
          );
        }
        data = {
          kind: "ed25519",
          seed: new Uint8Array(combined.subarray(0, ED25519_SEED_LEN)),
          pubBytes: new Uint8Array(pubBytes),
        };
        break;
      }
      case "ecdsa": {
        const expectedCurve = sshCurveName(algorithm.curve);
        const curveName = decodeUtf8(innerReader.readString());
        if (curveName !== expectedCurve) {
          throw new Error(
            `SSHPrivateKey ecdsa: blob curve '${curveName}' does not match algorithm '${expectedCurve}'`,
          );
        }
        const point = innerReader.readString();
        const expectedPointLen = sshEcdsaPointLen(algorithm.curve);
        if (point.length !== expectedPointLen || point[0] !== 0x04) {
          throw new Error(
            `SSHPrivateKey ecdsa: expected ${expectedPointLen}-byte uncompressed point (0x04 prefix), got ${point.length} bytes prefix=0x${point[0]?.toString(16) ?? "?"}`,
          );
        }
        if (publicKey.data.kind !== "ecdsa" || !bytesEqual(point, publicKey.data.point)) {
          throw new Error("SSHPrivateKey ecdsa: outer/inner public-key mismatch");
        }
        const mpint = innerReader.readMpint();
        const stripped = stripMpintSignByte(mpint);
        const scalar = padLeftToLength(stripped, sshEcdsaScalarLen(algorithm.curve));
        data = {
          kind: "ecdsa",
          curve: algorithm.curve,
          point: new Uint8Array(point),
          scalar,
        };
        break;
      }
      case "dsa": {
        const p = stripPositiveMpint(innerReader.readMpint());
        const q = stripPositiveMpint(innerReader.readMpint());
        const g = stripPositiveMpint(innerReader.readMpint());
        const y = stripPositiveMpint(innerReader.readMpint());
        const x = stripPositiveMpint(innerReader.readMpint());
        if (publicKey.data.kind !== "dsa") {
          throw new Error("SSHPrivateKey dsa: outer key is not DSA");
        }
        // Re-stated public params must match the outer pubkey blob.
        if (
          !bytesEqual(p, publicKey.data.p) ||
          !bytesEqual(q, publicKey.data.q) ||
          !bytesEqual(g, publicKey.data.g) ||
          !bytesEqual(y, publicKey.data.y)
        ) {
          throw new Error("SSHPrivateKey dsa: outer/inner public-parameter mismatch");
        }
        data = { kind: "dsa", p, q, g, y, x };
        break;
      }
    }

    const comment = decodeUtf8(innerReader.readString());

    // Validate padding 0x01, 0x02, ... up to block-size boundary.
    let pad = 1;
    while (!innerReader.isAtEnd()) {
      const b = innerReader.readByte();
      if (b !== pad) {
        throw new Error(
          `SSHPrivateKey: bad padding byte at offset ${innerReader.position()} (expected 0x${pad.toString(16)}, got 0x${b.toString(16)})`,
        );
      }
      pad++;
    }

    return new SSHPrivateKey(data, comment, checkint1);
  }

  /**
   * Re-serialize to the canonical OpenSSH armored format.
   *
   * Matches Rust `ssh_key::PrivateKey::to_openssh(LineEnding::LF)`.
   */
  toOpenssh(): string {
    return encodePem(PEM_LABEL, this.toBlob(), PEM_LINE_WIDTH);
  }

  toBlob(): Uint8Array {
    const writer = new SshBufferWriter();
    writer.writeRaw(MAGIC);
    writer.writeStringUtf8(CIPHER_NONE);
    writer.writeStringUtf8(KDF_NONE);
    writer.writeString(new Uint8Array(0));
    writer.writeUint32(NKEYS);
    writer.writeString(this.publicBlob());
    writer.writeString(this.encryptedSection());
    return writer.bytes();
  }

  publicKey(): SSHPublicKey {
    switch (this.data.kind) {
      case "ed25519":
        return SSHPublicKey.ed25519(this.data.pubBytes, this.comment);
      case "ecdsa":
        return SSHPublicKey.ecdsa(this.data.curve, this.data.point, this.comment);
      case "dsa":
        return SSHPublicKey.dsa(this.data.p, this.data.q, this.data.g, this.data.y, this.comment);
    }
  }

  private publicBlob(): Uint8Array {
    return this.publicKey().toBlob();
  }

  private encryptedSection(): Uint8Array {
    const w = new SshBufferWriter();
    w.writeUint32(this.checkint);
    w.writeUint32(this.checkint);
    w.writeStringUtf8(sshAlgorithmName(this.algorithm));
    switch (this.data.kind) {
      case "ed25519": {
        w.writeString(this.data.pubBytes);
        const combined = new Uint8Array(ED25519_SEED_LEN + ED25519_PUBLIC_LEN);
        combined.set(this.data.seed, 0);
        combined.set(this.data.pubBytes, ED25519_SEED_LEN);
        w.writeString(combined);
        break;
      }
      case "ecdsa": {
        w.writeStringUtf8(sshCurveName(this.data.curve));
        w.writeString(this.data.point);
        w.writeMpintUnsigned(this.data.scalar);
        break;
      }
      case "dsa": {
        w.writeMpintUnsigned(this.data.p);
        w.writeMpintUnsigned(this.data.q);
        w.writeMpintUnsigned(this.data.g);
        w.writeMpintUnsigned(this.data.y);
        w.writeMpintUnsigned(this.data.x);
        break;
      }
    }
    w.writeStringUtf8(this.comment);
    const body = w.bytes();
    const padLen = (BLOCK_SIZE_NONE - (body.length % BLOCK_SIZE_NONE)) % BLOCK_SIZE_NONE;
    if (padLen === 0) return body;
    const out = new Uint8Array(body.length + padLen);
    out.set(body, 0);
    for (let i = 0; i < padLen; i++) out[body.length + i] = i + 1;
    return out;
  }

  // --------------------------------------------------------------------------
  // Reference / display
  // --------------------------------------------------------------------------

  digest(): Uint8Array {
    return sha256(new TextEncoder().encode(this.toOpenssh()));
  }

  refHexShort(): string {
    const d = this.digest();
    let s = "";
    for (let i = 0; i < 4; i++) s += d[i].toString(16).padStart(2, "0");
    return s;
  }

  toString(): string {
    return `SSHPrivateKey(${this.refHexShort()})`;
  }

  // --------------------------------------------------------------------------
  // SSHSIG sign (PROTOCOL.sshsig §3.1)
  // --------------------------------------------------------------------------

  sign(namespace: string, hashAlgorithm: SshHashAlgorithm, message: Uint8Array): SSHSignature {
    const messageDigest = digestForHash(hashAlgorithm, message);
    const signedData = SSHSignature.signedDataBlob(namespace, hashAlgorithm, messageDigest);
    let signatureBytes: Uint8Array;
    switch (this.data.kind) {
      case "ed25519":
        signatureBytes = ed25519.sign(signedData, this.data.seed);
        break;
      case "ecdsa": {
        switch (this.data.curve) {
          case "nistp256":
            // p256 default: prehash=true (SHA-256), format='compact' (r||s as 64 bytes).
            signatureBytes = p256.sign(signedData, this.data.scalar, { format: "compact" });
            break;
          case "nistp384":
            signatureBytes = p384.sign(signedData, this.data.scalar, { format: "compact" });
            break;
        }
        break;
      }
      case "dsa": {
        // SSH-DSA always inner-hashes with SHA-1 regardless of the SSHSIG
        // hash_algorithm. Matches Rust `ssh-key`/`dsa` 0.6.7.
        const innerDigest = sha1(signedData);
        signatureBytes = dsaSign({
          p: this.data.p,
          q: this.data.q,
          g: this.data.g,
          y: this.data.y,
          x: this.data.x,
          messageDigest: innerDigest,
        });
        break;
      }
    }
    return SSHSignature.fromParts(this.publicKey(), namespace, hashAlgorithm, signatureBytes);
  }
}

function digestForHash(alg: SshHashAlgorithm, message: Uint8Array): Uint8Array {
  switch (alg) {
    case "sha256":
      return sha256(message);
    case "sha512":
      return sha512(message);
  }
}
