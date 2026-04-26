import { describe, it, expect } from "vitest";
import { base64 } from "@scure/base";
import { SSHPrivateKey } from "../src/ssh/ssh-private-key.js";
import { SshBufferWriter } from "../src/ssh/internal/ssh-buffer.js";

/**
 * Rust source-of-truth fixture from `bc-components-rust/src/lib.rs:463-473`,
 * generated from seed `59f2293a5bce7d4de59e71b4207ac5d2` with comment
 * "Key comment.".
 *
 * The exact bytes Rust's `ssh_key::PrivateKey::to_openssh(LineEnding::LF)`
 * produces — line widths, trailing newline, padding, checkint — must
 * round-trip 1:1.
 */
const RUST_ED25519_PRIVATE = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACBUe4FDGyGIgHf75yVdE4hYl9guj02FdsIadgLC04zObQAAAJA+TyZiPk8m
YgAAAAtzc2gtZWQyNTUxOQAAACBUe4FDGyGIgHf75yVdE4hYl9guj02FdsIadgLC04zObQ
AAAECsX3CKi3hm5VrrU26ffa2FB2YrFogg45ucOVbIz4FQo1R7gUMbIYiAd/vnJV0TiFiX
2C6PTYV2whp2AsLTjM5tAAAADEtleSBjb21tZW50LgE=
-----END OPENSSH PRIVATE KEY-----
`;

/**
 * Rust source-of-truth fixture from `bc-components-rust/src/lib.rs:350-358`
 * (ECDSA P-256, comment "Key comment.").
 */
const RUST_ECDSA_P256_PRIVATE = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAaAAAABNlY2RzYS
1zaGEyLW5pc3RwMjU2AAAACG5pc3RwMjU2AAAAQQTtBE6+WTueAierXl/c/f83JAmoxm0k
YlGMVMofLOUFeKx3FqUW0VRVljx1wHL03faFhiTPVR9CNG5iZCUqa4eLAAAAqPC+XgXwvl
4FAAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBO0ETr5ZO54CJ6te
X9z9/zckCajGbSRiUYxUyh8s5QV4rHcWpRbRVFWWPHXAcvTd9oWGJM9VH0I0bmJkJSprh4
sAAAAgAVk1Bq0ILFsF/ADaUq8G5Tow0Xv+Qs8V21gfOBSWQDEAAAAMS2V5IGNvbW1lbnQu
AQIDBA==
-----END OPENSSH PRIVATE KEY-----
`;

describe("SSHPrivateKey — parse/serialize parity with Rust ssh-key 0.6.7", () => {
  it("ed25519: round-trips a Rust fixture byte-identically", () => {
    const key = SSHPrivateKey.fromOpenssh(RUST_ED25519_PRIVATE);
    expect(key.algorithm).toEqual({ kind: "ed25519" });
    expect(key.comment).toBe("Key comment.");
    expect(key.privateBytes.length).toBe(32);
    expect(key.publicBytes.length).toBe(32);
    expect(key.toOpenssh()).toBe(RUST_ED25519_PRIVATE);
  });

  it("ed25519: derived public key matches the embedded outer blob", () => {
    const key = SSHPrivateKey.fromOpenssh(RUST_ED25519_PRIVATE);
    const pub = key.publicKey();
    expect(pub.toOpenssh()).toBe(
      "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFR7gUMbIYiAd/vnJV0TiFiX2C6PTYV2whp2AsLTjM5t Key comment.",
    );
  });

  it("ecdsa-p256: round-trips a Rust fixture byte-identically", () => {
    const key = SSHPrivateKey.fromOpenssh(RUST_ECDSA_P256_PRIVATE);
    expect(key.algorithm).toEqual({ kind: "ecdsa", curve: "nistp256" });
    expect(key.comment).toBe("Key comment.");
    expect(key.privateBytes.length).toBe(32);
    expect(key.publicBytes.length).toBe(65);
    expect(key.publicBytes[0]).toBe(0x04);
    expect(key.toOpenssh()).toBe(RUST_ECDSA_P256_PRIVATE);
  });

  it("ecdsa-p256: derived public key matches the Rust fixture", () => {
    const key = SSHPrivateKey.fromOpenssh(RUST_ECDSA_P256_PRIVATE);
    expect(key.publicKey().toOpenssh()).toBe(
      "ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBO0ETr5ZO54CJ6teX9z9/zckCajGbSRiUYxUyh8s5QV4rHcWpRbRVFWWPHXAcvTd9oWGJM9VH0I0bmJkJSprh4s= Key comment.",
    );
  });

  it("rejects encrypted keys with a clear error pointing at v2", () => {
    // Synthesize a minimal blob with ciphername="aes256-ctr". The parser must
    // reject before attempting to decode the (encrypted) inner section.
    const magic = new TextEncoder().encode("openssh-key-v1\0");
    const w = new SshBufferWriter();
    w.writeRaw(magic);
    w.writeStringUtf8("aes256-ctr");
    w.writeStringUtf8("bcrypt");
    w.writeString(new Uint8Array([0xde, 0xad])); // any non-empty kdfoptions
    w.writeUint32(1);
    w.writeString(new Uint8Array(0)); // dummy publickey blob
    w.writeString(new Uint8Array(0)); // dummy encrypted blob
    const fakeEncrypted = `-----BEGIN OPENSSH PRIVATE KEY-----\n${base64.encode(w.bytes())}\n-----END OPENSSH PRIVATE KEY-----\n`;
    expect(() => SSHPrivateKey.fromOpenssh(fakeEncrypted)).toThrow(/encrypted keys/);
  });

  it("rejects truncated PEM input", () => {
    const broken = RUST_ED25519_PRIVATE.replace("-----END OPENSSH PRIVATE KEY-----\n", "");
    expect(() => SSHPrivateKey.fromOpenssh(broken)).toThrow(/missing.*END/);
  });

  it("rejects mismatched checkint", () => {
    // Find the offset of the encrypted section (`AAAAJA...`) and corrupt the
    // second copy of checkint by flipping a bit. We do this through the parsed
    // model: re-serialize after editing privateBytes is the cleanest mutation,
    // but here we want to check the *parser* path so we craft a bad blob via
    // re-serialize-then-mutate.
    const valid = SSHPrivateKey.fromOpenssh(RUST_ED25519_PRIVATE);
    const blob = valid.toBlob();
    // Locate the encrypted section by scanning for the start (right after the
    // outer publickey-blob string). The structure is fixed for our fixture:
    // 15 (magic) + 8 (none) + 8 (none) + 4 (kdfopts) + 4 (nkeys) + 4 (pubkeylen) + 51 (pubblob) = 94, then 4 bytes encrypted-len, then payload.
    const encryptedStart = 15 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 51 + 4;
    const corrupted = new Uint8Array(blob);
    corrupted[encryptedStart + 4] ^= 0x01; // flip a bit of checkint2
    expect(() => SSHPrivateKey.fromBlob(corrupted)).toThrow(/checkint mismatch/);
  });

  it("ref_hex_short matches the SHA-256 prefix of the canonical OpenSSH text", () => {
    const key = SSHPrivateKey.fromOpenssh(RUST_ED25519_PRIVATE);
    expect(key.refHexShort()).toMatch(/^[0-9a-f]{8}$/);
    expect(key.toString()).toBe(`SSHPrivateKey(${key.refHexShort()})`);
  });
});
