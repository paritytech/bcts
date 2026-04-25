/**
 * Copyright © 2026 Blockchain Commons, LLC
 * Copyright © 2026 Parity Technologies
 *
 * Port of `bc-mur::prores`. Node-only — invokes ffmpeg as a subprocess.
 */

import type { QrFrame } from "./animate.js";
import { writeFramePngs } from "./animate.js";
import { MurError } from "./error.js";

/**
 * Encode frames to ProRes 4444 via ffmpeg subprocess.
 *
 * Writes frames as temporary PNGs, invokes ffmpeg, and cleans up the
 * temp directory. Requires `ffmpeg` on PATH.
 */
export async function encodeProres(
  frames: readonly QrFrame[],
  fps: number,
  outputPath: string,
): Promise<void> {
  const ffmpeg = await whichFfmpeg();

  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const { spawn } = await import("node:child_process");

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bc-mur-"));

  try {
    await writeFramePngs(frames, tmpDir);

    const inputPattern = path.join(tmpDir, "%04d.png");
    const args = [
      "-y",
      "-r",
      String(fps),
      "-i",
      inputPattern,
      "-c:v",
      "prores_ks",
      "-profile:v",
      "4444",
      "-pix_fmt",
      "yuva444p10le",
      outputPath,
    ];

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ffmpeg, args, {
        stdio: ["ignore", "ignore", "pipe"],
      });
      let stderr = "";
      proc.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });
      proc.on("error", (err) => {
        reject(MurError.ffmpegFailed(err.message));
      });
      proc.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          // Keep the stderr output visible on the console for debuggability,
          // but mirror rust's exact error-message format (no stderr suffix).
          if (stderr.length > 0) process.stderr.write(stderr);
          reject(MurError.ffmpegFailed(`ffmpeg exited with status ${code}`));
        }
      });
    });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

async function whichFfmpeg(): Promise<string> {
  const { spawn } = await import("node:child_process");
  return new Promise<string>((resolve, reject) => {
    const proc = spawn("which", ["ffmpeg"], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    let stdout = "";
    proc.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    proc.on("error", () => reject(MurError.ffmpegNotFound()));
    proc.on("close", (code) => {
      if (code === 0 && stdout.trim() !== "") {
        resolve(stdout.trim());
      } else {
        reject(MurError.ffmpegNotFound());
      }
    });
  });
}
