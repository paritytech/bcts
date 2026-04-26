import { describe, it, expect } from "vitest";
import { SSHCertificate } from "../src/ssh/ssh-certificate.js";

describe("SSHCertificate — placeholder parity with Rust tags_registry.rs:231-238", () => {
  it("round-trips OpenSSH cert text verbatim", () => {
    // A representative SSH user certificate (text shape only — we don't validate).
    const text =
      "ssh-ed25519-cert-v01@openssh.com AAAAIHNzaC1lZDI1NTE5LWNlcnQtdjAxQG9wZW5zc2guY29tAAAAIBOpaque user@host";
    const cert = SSHCertificate.fromText(text);
    expect(cert.toText()).toBe(text);
  });

  it("toString returns the fixed Rust summarizer string", () => {
    const cert = SSHCertificate.fromText("ssh-rsa-cert-v01@openssh.com AAAA= user");
    expect(cert.toString()).toBe("SSHCertificate");
  });

  it("rejects empty input", () => {
    expect(() => SSHCertificate.fromText("   \n\t  ")).toThrow(/empty/);
  });
});
