/**
 * Copyright © 2025-2026 Parity Technologies
 *
 * Minimal PEM (RFC 7468 §3) reader/writer with the byte-shape conventions
 * used by Rust `ssh-key` 0.6.7:
 *
 *   - Wrap base64 at **70 columns** for OpenSSH private keys
 *     (`pem-rfc7468` default for that format).
 *   - Wrap base64 at **76 columns** for SSHSIG (`PROTOCOL.sshsig` rubric).
 *   - LF newlines (matches `LineEnding::LF`, which is the rubric used for
 *     all parity fixtures in `bc-components-rust/src/lib.rs`).
 *   - Trailing newline after the END line.
 */

import { base64 } from "@scure/base";

const BEGIN = "-----BEGIN ";
const END = "-----END ";
const SUFFIX = "-----";

export interface PemBlock {
  label: string;
  data: Uint8Array;
}

/**
 * Parse a single PEM block. Tolerant of CRLF, trailing whitespace, leading
 * whitespace lines and `Proc-Type` / `DEK-Info` headers (the SSHSIG/OpenSSH
 * formats don't use those, but we ignore them to be robust).
 */
export function parsePem(text: string, expectedLabel?: string): PemBlock {
  const lines = text.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i >= lines.length) {
    throw new Error("PEM: empty input");
  }
  const beginLine = lines[i];
  if (!beginLine.startsWith(BEGIN) || !beginLine.endsWith(SUFFIX)) {
    throw new Error(`PEM: expected '-----BEGIN <label>-----' header, got '${beginLine}'`);
  }
  const label = beginLine.slice(BEGIN.length, beginLine.length - SUFFIX.length);
  if (expectedLabel !== undefined && label !== expectedLabel) {
    throw new Error(`PEM: expected label '${expectedLabel}', got '${label}'`);
  }
  i++;
  // Skip any RFC 1421 headers (`Key:` lines before the blank-line separator).
  while (i < lines.length && /^[A-Za-z][A-Za-z0-9-]*:/.test(lines[i].trim())) {
    i++;
  }
  if (i < lines.length && lines[i].trim() === "") i++;

  const bodyLines: string[] = [];
  let endLine: string | undefined;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith(END)) {
      endLine = line;
      break;
    }
    bodyLines.push(line);
  }
  if (endLine === undefined) {
    throw new Error("PEM: missing '-----END <label>-----' footer");
  }
  if (!endLine.endsWith(SUFFIX)) {
    throw new Error(`PEM: malformed END line '${endLine}'`);
  }
  const endLabel = endLine.slice(END.length, endLine.length - SUFFIX.length);
  if (endLabel !== label) {
    throw new Error(`PEM: BEGIN/END label mismatch ('${label}' vs '${endLabel}')`);
  }

  const body = bodyLines.join("").replace(/\s+/g, "");
  return { label, data: base64.decode(body) };
}

/**
 * Encode a PEM block. `width` is the base64 column width (70 for OpenSSH
 * private keys; 76 for SSHSIG signatures). Trailing newline is included
 * to match the Rust fixtures.
 */
export function encodePem(label: string, data: Uint8Array, width: number): string {
  const b64 = base64.encode(data);
  const lines: string[] = [];
  lines.push(`${BEGIN}${label}${SUFFIX}`);
  for (let i = 0; i < b64.length; i += width) {
    lines.push(b64.slice(i, i + width));
  }
  lines.push(`${END}${label}${SUFFIX}`);
  return `${lines.join("\n")  }\n`;
}
