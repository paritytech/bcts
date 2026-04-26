/**
 * Copyright © 2025-2026 Parity Technologies
 *
 * SSHSIG (PROTOCOL.sshsig) parser/serializer — the OpenSSH armored
 * signature format used by `ssh-keygen -Y sign`.
 *
 * Mirrors `ssh_key::SshSig` (crate `ssh-key` v0.6.7), so blobs round-trip
 * byte-identically with bytes Rust emits.
 *
 * Outer PEM:
 *
 *     -----BEGIN SSH SIGNATURE-----
 *     <base64, 76-char wrap, LF newlines>
 *     -----END SSH SIGNATURE-----
 *
 * Inner blob (`PROTOCOL.sshsig` §2):
 *
 *     6 bytes "SSHSIG" magic
 *     uint32  version          (must be 1)
 *     string  publickey         (SSH wire-format pubkey blob)
 *     string  namespace         (UTF-8)
 *     string  reserved          (currently empty)
 *     string  hash_algorithm    ("sha256" | "sha512")
 *     string  signature         (algorithm-specific signature blob):
 *
 *   ssh-ed25519 signature blob:
 *     string  algorithm "ssh-ed25519"
 *     string  raw 64-byte signature
 *
 *   ecdsa-sha2-nistp256 / ecdsa-sha2-nistp384 signature blob:
 *     string  algorithm "ecdsa-sha2-nistp256" | "ecdsa-sha2-nistp384"
 *     string  inner-blob:
 *         mpint r
 *         mpint s
 *
 *   ssh-dss signature blob:
 *     string  algorithm "ssh-dss"
 *     string  raw 40-byte signature  (r || s, 20 bytes each, q = 160 bits)
 */

import { sha256 } from "@noble/hashes/sha2.js";
import { SshBufferReader, SshBufferWriter } from "./internal/ssh-buffer.js";
import { encodePem, parsePem } from "./internal/ssh-pem.js";
import {
  parseSshAlgorithm,
  sshAlgorithmName,
  sshEcdsaScalarLen,
  type SshAlgorithm,
} from "./ssh-algorithm.js";
import { SSHPublicKey } from "./ssh-public-key.js";

const PEM_LABEL = "SSH SIGNATURE";
const PEM_LINE_WIDTH = 76;
const MAGIC = new TextEncoder().encode("SSHSIG");
const SUPPORTED_VERSION = 1;
export type SshHashAlgorithm = "sha256" | "sha512";

const ED25519_SIGNATURE_LEN = 64;
const DSA_SIGNATURE_LEN = 40; // r (20) || s (20), q = 160 bits

export class SSHSignature {
  readonly publicKey: SSHPublicKey;
  readonly namespace: string;
  readonly reserved: Uint8Array;
  readonly hashAlgorithm: SshHashAlgorithm;
  /**
   * Raw signature bytes specific to the algorithm:
   *   ed25519 → 64-byte concatenation `r || s`
   *   ecdsa-p256 → 64-byte concatenation `r || s` (we strip the SSH
   *     mpint sign bytes on parse and re-add them on serialize, so this
   *     stays a fixed 64-byte canonical form internally)
   */
  readonly signatureBytes: Uint8Array;

  private constructor(
    publicKey: SSHPublicKey,
    namespace: string,
    reserved: Uint8Array,
    hashAlgorithm: SshHashAlgorithm,
    signatureBytes: Uint8Array,
  ) {
    this.publicKey = publicKey;
    this.namespace = namespace;
    this.reserved = reserved;
    this.hashAlgorithm = hashAlgorithm;
    this.signatureBytes = signatureBytes;
  }

  static fromPem(text: string): SSHSignature {
    const { data } = parsePem(text, PEM_LABEL);
    return SSHSignature.fromBlob(data);
  }

  static fromBlob(blob: Uint8Array): SSHSignature {
    if (blob.length < MAGIC.length || !bytesEqual(blob.subarray(0, MAGIC.length), MAGIC)) {
      throw new Error("SSHSignature: missing 'SSHSIG' magic");
    }
    const reader = new SshBufferReader(blob.subarray(MAGIC.length));
    const version = reader.readUint32();
    if (version !== SUPPORTED_VERSION) {
      throw new Error(
        `SSHSignature: unsupported SSHSIG version ${version} (expected ${SUPPORTED_VERSION})`,
      );
    }
    const publicKeyBlob = reader.readString();
    const publicKey = SSHPublicKey.fromBlob(publicKeyBlob);
    const namespace = decodeUtf8(reader.readString());
    const reserved = reader.readString();
    const hashAlgRaw = decodeUtf8(reader.readString());
    if (hashAlgRaw !== "sha256" && hashAlgRaw !== "sha512") {
      throw new Error(`SSHSignature: unsupported hash algorithm '${hashAlgRaw}'`);
    }
    const sigBlob = reader.readString();
    if (!reader.isAtEnd()) {
      throw new Error("SSHSignature: trailing bytes after signature blob");
    }
    const signatureBytes = decodeAlgorithmSignature(publicKey.algorithm, sigBlob);
    return new SSHSignature(publicKey, namespace, reserved, hashAlgRaw, signatureBytes);
  }

  toPem(): string {
    return encodePem(PEM_LABEL, this.toBlob(), PEM_LINE_WIDTH);
  }

  toBlob(): Uint8Array {
    const writer = new SshBufferWriter();
    writer.writeRaw(MAGIC);
    writer.writeUint32(SUPPORTED_VERSION);
    writer.writeString(this.publicKey.toBlob());
    writer.writeStringUtf8(this.namespace);
    writer.writeString(this.reserved);
    writer.writeStringUtf8(this.hashAlgorithm);
    writer.writeString(encodeAlgorithmSignature(this.publicKey.algorithm, this.signatureBytes));
    return writer.bytes();
  }

  /**
   * Build the message that gets signed/verified: the **signed-data** blob
   * defined by `PROTOCOL.sshsig` §3.1.
   *
   *     "SSHSIG" magic
   *     string  namespace
   *     string  reserved
   *     string  hash_algorithm
   *     string  H(message)        ← *digest*, not the raw message
   */
  static signedDataBlob(
    namespace: string,
    hashAlgorithm: SshHashAlgorithm,
    messageDigest: Uint8Array,
  ): Uint8Array {
    const w = new SshBufferWriter();
    w.writeRaw(MAGIC);
    w.writeStringUtf8(namespace);
    w.writeString(new Uint8Array(0));
    w.writeStringUtf8(hashAlgorithm);
    w.writeString(messageDigest);
    return w.bytes();
  }

  /** Construct from already-decoded parts (used by Phase 7 sign path). */
  static fromParts(
    publicKey: SSHPublicKey,
    namespace: string,
    hashAlgorithm: SshHashAlgorithm,
    signatureBytes: Uint8Array,
  ): SSHSignature {
    return new SSHSignature(
      publicKey,
      namespace,
      new Uint8Array(0),
      hashAlgorithm,
      new Uint8Array(signatureBytes),
    );
  }

  /** Fixed-string mirror of Rust summarizer for `TAG_SSH_TEXT_SIGNATURE`. */
  toString(): string {
    return "SSHSignature";
  }

  /** SHA-256 digest of canonical PEM bytes — kept for parity with key types. */
  digest(): Uint8Array {
    return sha256(new TextEncoder().encode(this.toPem()));
  }
}

// ---- helpers ---------------------------------------------------------------

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Strip the algorithm wrapping from a signature blob and return the raw
 * algorithm-specific bytes (concatenation form):
 *   ed25519 → 64 bytes raw
 *   ecdsa   → `r || s`, fixed-width per curve (32 for P-256, 48 for P-384)
 *   dsa     → 40 bytes raw `r || s` (q = 160 bits)
 */
function decodeAlgorithmSignature(algorithm: SshAlgorithm, sigBlob: Uint8Array): Uint8Array {
  const r = new SshBufferReader(sigBlob);
  const algoName = decodeUtf8(r.readString());
  const expected = sshAlgorithmName(algorithm);
  if (algoName !== expected) {
    throw new Error(
      `SSHSignature: signature algorithm '${algoName}' does not match key algorithm '${expected}'`,
    );
  }
  switch (algorithm.kind) {
    case "ed25519": {
      const sig = r.readString();
      if (!r.isAtEnd()) {
        throw new Error("SSHSignature ed25519: trailing bytes after raw signature");
      }
      if (sig.length !== ED25519_SIGNATURE_LEN) {
        throw new Error(
          `SSHSignature ed25519: expected ${ED25519_SIGNATURE_LEN}-byte signature, got ${sig.length}`,
        );
      }
      return new Uint8Array(sig);
    }
    case "ecdsa": {
      const inner = r.readString();
      if (!r.isAtEnd()) {
        throw new Error("SSHSignature ecdsa: trailing bytes after inner signature blob");
      }
      const innerR = new SshBufferReader(inner);
      const scalarLen = sshEcdsaScalarLen(algorithm.curve);
      const rBytes = stripAndPad(innerR.readMpint(), scalarLen, "ecdsa");
      const sBytes = stripAndPad(innerR.readMpint(), scalarLen, "ecdsa");
      if (!innerR.isAtEnd()) {
        throw new Error("SSHSignature ecdsa: trailing bytes after r,s");
      }
      const out = new Uint8Array(scalarLen * 2);
      out.set(rBytes, 0);
      out.set(sBytes, scalarLen);
      return out;
    }
    case "dsa": {
      const sig = r.readString();
      if (!r.isAtEnd()) {
        throw new Error("SSHSignature dsa: trailing bytes after raw signature");
      }
      if (sig.length !== DSA_SIGNATURE_LEN) {
        throw new Error(
          `SSHSignature dsa: expected ${DSA_SIGNATURE_LEN}-byte signature, got ${sig.length}`,
        );
      }
      return new Uint8Array(sig);
    }
  }
}

function encodeAlgorithmSignature(algorithm: SshAlgorithm, signatureBytes: Uint8Array): Uint8Array {
  const w = new SshBufferWriter();
  w.writeStringUtf8(sshAlgorithmName(algorithm));
  switch (algorithm.kind) {
    case "ed25519": {
      if (signatureBytes.length !== ED25519_SIGNATURE_LEN) {
        throw new Error(
          `SSHSignature ed25519: signatureBytes length ${signatureBytes.length} != ${ED25519_SIGNATURE_LEN}`,
        );
      }
      w.writeString(signatureBytes);
      break;
    }
    case "ecdsa": {
      const scalarLen = sshEcdsaScalarLen(algorithm.curve);
      const expectedLen = scalarLen * 2;
      if (signatureBytes.length !== expectedLen) {
        throw new Error(
          `SSHSignature ecdsa: signatureBytes length ${signatureBytes.length} != ${expectedLen} (r||s)`,
        );
      }
      const inner = new SshBufferWriter();
      inner.writeMpintUnsigned(signatureBytes.subarray(0, scalarLen));
      inner.writeMpintUnsigned(signatureBytes.subarray(scalarLen));
      w.writeString(inner.bytes());
      break;
    }
    case "dsa": {
      if (signatureBytes.length !== DSA_SIGNATURE_LEN) {
        throw new Error(
          `SSHSignature dsa: signatureBytes length ${signatureBytes.length} != ${DSA_SIGNATURE_LEN} (r||s)`,
        );
      }
      w.writeString(signatureBytes);
      break;
    }
  }
  return w.bytes();
}

function stripAndPad(mpint: Uint8Array, len: number, label: string): Uint8Array {
  // EC signature components (r, s) are < curve order, so they fit in `len` bytes.
  const stripped = mpint[0] === 0x00 ? mpint.subarray(1) : mpint;
  if (stripped.length > len) {
    throw new Error(`SSHSignature ${label}: r/s component too large (${stripped.length} bytes)`);
  }
  if (stripped.length === len) return new Uint8Array(stripped);
  const out = new Uint8Array(len);
  out.set(stripped, len - stripped.length);
  return out;
}

// `parseSshAlgorithm` is exported by ssh-algorithm.js; we re-export here so that
// callers wanting to feed raw algorithm strings into SSHSignature builders can
// import a single module. (Kept as a re-export to avoid a long import path.)
export { parseSshAlgorithm };
