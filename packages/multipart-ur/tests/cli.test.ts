/**
 * CLI smoke tests — spawn the built `mur` binary and verify its output.
 */
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { toByteString } from "@bcts/dcbor";
import { UR } from "@bcts/uniform-resources";

const BIN = resolve(__dirname, "..", "dist", "bin", "mur.cjs");
const HAS_BIN = existsSync(BIN);

function runMur(args: string[]): ReturnType<typeof spawnSync> {
  return spawnSync("node", [BIN, ...args], {
    encoding: "utf8",
    timeout: 30_000,
  });
}

function longUrString(): string {
  const data = new Uint8Array(1000);
  for (let i = 0; i < 1000; i++) data[i] = i % 256;
  return UR.new("bytes", toByteString(data)).string();
}

describe.skipIf(!HAS_BIN)("mur CLI", () => {
  it("single — produces PNG", () => {
    const tmp = mkdtempSync(join(tmpdir(), "bc-mur-cli-"));
    try {
      const out = join(tmp, "out.png");
      const res = runMur(["single", "ur:bytes/hdcxdwinvezm", "-o", out]);
      expect(res.status).toBe(0);
      expect(existsSync(out)).toBe(true);
      const bytes = readFileSync(out);
      expect(Array.from(bytes.slice(0, 4))).toEqual([137, 80, 78, 71]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("single — density check rejects a too-dense UR", () => {
    const ur = longUrString();
    const res = runMur(["single", ur, "-o", "/dev/null"]);
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/QR code too dense/);
  });

  it("single — --no-density-check disables the check", () => {
    const tmp = mkdtempSync(join(tmpdir(), "bc-mur-cli-"));
    try {
      const ur = longUrString();
      const out = join(tmp, "out.png");
      const res = runMur(["single", ur, "--no-density-check", "-o", out]);
      expect(res.status).toBe(0);
      expect(existsSync(out)).toBe(true);
      expect(statSync(out).size).toBeGreaterThan(100);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("single — JPEG output", () => {
    const tmp = mkdtempSync(join(tmpdir(), "bc-mur-cli-"));
    try {
      const out = join(tmp, "out.jpg");
      const res = runMur(["single", "ur:bytes/hdcxdwinvezm", "--format", "jpeg", "-o", out]);
      expect(res.status).toBe(0);
      const bytes = readFileSync(out);
      expect(Array.from(bytes.slice(0, 3))).toEqual([0xff, 0xd8, 0xff]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("animate — produces GIF", () => {
    const tmp = mkdtempSync(join(tmpdir(), "bc-mur-cli-"));
    try {
      const ur = longUrString();
      const out = join(tmp, "out.gif");
      const res = runMur([
        "animate",
        ur,
        "-o",
        out,
        "--max-fragment-len",
        "50",
        "--cycles",
        "1",
        "--fps",
        "4",
        "--size",
        "128",
      ]);
      expect(res.status).toBe(0);
      const bytes = readFileSync(out);
      expect(bytes.slice(0, 6).toString("ascii")).toBe("GIF89a");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("frames — writes numbered PNGs", () => {
    const tmp = mkdtempSync(join(tmpdir(), "bc-mur-cli-"));
    try {
      const ur = longUrString();
      const outDir = join(tmp, "out_frames");
      const res = runMur([
        "frames",
        ur,
        "-o",
        outDir,
        "--max-fragment-len",
        "50",
        "--cycles",
        "1",
        "--size",
        "128",
      ]);
      expect(res.status).toBe(0);
      const entries = readdirSync(outDir);
      expect(entries.length).toBeGreaterThan(0);
      for (const name of entries) {
        expect(name).toMatch(/^\d{4}\.png$/);
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("single — rejects invalid color", () => {
    const res = runMur(["single", "ur:bytes/hdcxdwinvezm", "--fg", "#ZZZZZZ", "-o", "/dev/null"]);
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/Invalid color/);
  });

  it("single — unknown format error", () => {
    const res = runMur(["single", "ur:bytes/hdcxdwinvezm", "--format", "bmp", "-o", "/dev/null"]);
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/unknown format: bmp/);
  });
});
