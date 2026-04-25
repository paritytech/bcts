/** Port of `bc-mur::cmd::animate_cmd`. */
import { UR } from "@bcts/uniform-resources";

import {
  type AnimateParams,
  Color,
  type CorrectionLevel,
  DEFAULT_MAX_MODULES,
  Logo,
  correctionLevelFromString,
  encodeAnimatedGif,
  encodeProres,
  generateFrames,
  logoClearShapeFromString,
} from "../index.js";
import type { Exec } from "./exec.js";
import { readInput } from "./single.js";

export interface AnimateCommandArgs {
  urString: string;
  output: string;
  size: number;
  fg: string;
  bg: string;
  logo?: string;
  logoFraction: number;
  logoBorder: number;
  logoShape: string;
  correction?: string;
  quietZone: number;
  dark: boolean;
  maxFragmentLen: number;
  fps: number;
  cycles: number;
  format: string;
  frameCount?: number;
  maxModules: number;
  /**
   * When `true` (default), reject QR codes whose module count exceeds
   * `maxModules`. Matches commander's `--no-density-check` flag behaviour.
   */
  densityCheck: boolean;
}

export class AnimateCommand implements Exec {
  constructor(private readonly args: AnimateCommandArgs) {}

  async exec(): Promise<string> {
    const args = this.args;
    const urString = await readInput(args.urString);
    const fg = args.dark ? Color.fromHex(args.bg) : Color.fromHex(args.fg);
    const bg = args.dark ? Color.fromHex(args.fg) : Color.fromHex(args.bg);

    let logo: Logo | null = null;
    if (args.logo) {
      const fs = await import("node:fs/promises");
      const svgData = new Uint8Array(await fs.readFile(args.logo));
      const shape = logoClearShapeFromString(args.logoShape);
      logo = await Logo.fromSvg(svgData, args.logoFraction, args.logoBorder, shape);
    }

    const correction: CorrectionLevel | null = args.correction
      ? correctionLevelFromString(args.correction)
      : null;

    const ur = UR.fromURString(urString);

    const params: AnimateParams = {
      maxFragmentLen: args.maxFragmentLen,
      correction,
      size: args.size,
      foreground: fg,
      background: bg,
      quietZone: args.quietZone,
      logo,
      fps: args.fps,
      cycles: args.cycles,
      frameCount: args.frameCount ?? null,
      maxModules: args.densityCheck ? args.maxModules : null,
    };

    const frames = generateFrames(ur, params);

    switch (args.format) {
      case "gif": {
        const data = encodeAnimatedGif(frames, args.fps);
        const fs = await import("node:fs/promises");
        await fs.writeFile(args.output, data);
        return `Wrote ${frames.length} frames (${data.length} bytes) to ${args.output}`;
      }
      case "prores": {
        await encodeProres(frames, args.fps, args.output);
        return `Wrote ${frames.length} frames as ProRes to ${args.output}`;
      }
      default:
        throw new Error(`unknown format: ${args.format} (expected gif or prores)`);
    }
  }
}

export const ANIMATE_DEFAULTS: Omit<AnimateCommandArgs, "urString" | "output"> = {
  size: 512,
  fg: "#000000",
  bg: "#FFFFFF",
  logoFraction: 0.25,
  logoBorder: 1,
  logoShape: "square",
  quietZone: 1,
  dark: false,
  maxFragmentLen: 100,
  fps: 8,
  cycles: 3,
  format: "gif",
  maxModules: DEFAULT_MAX_MODULES,
  densityCheck: true,
};
