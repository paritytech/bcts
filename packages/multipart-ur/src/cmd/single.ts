/** Port of `bc-mur::cmd::single`. */
import {
  Color,
  CorrectionLevel,
  DEFAULT_MAX_MODULES,
  Logo,
  checkQrDensity,
  correctionLevelFromString,
  logoClearShapeFromString,
  qrModuleCount,
  renderUrQr,
} from "../index.js";
import type { Exec } from "./exec.js";
import { readInput } from "./input.js";

export interface SingleArgs {
  urString: string;
  output?: string;
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
  format: string;
  jpegQuality: number;
  maxModules: number;
  noDensityCheck: boolean;
}

export class SingleCommand implements Exec {
  constructor(private readonly args: SingleArgs) {}

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
      logo = await Logo.fromSvg(
        svgData,
        args.logoFraction,
        args.logoBorder,
        shape,
      );
    }

    const correction: CorrectionLevel = args.correction
      ? correctionLevelFromString(args.correction)
      : logo
        ? CorrectionLevel.High
        : CorrectionLevel.Low;

    if (!args.noDensityCheck) {
      const upper = urString.toUpperCase();
      const modules = qrModuleCount(
        new TextEncoder().encode(upper),
        correction,
      );
      checkQrDensity(modules, args.maxModules);
    }

    const img = renderUrQr(
      urString,
      correction,
      args.size,
      fg,
      bg,
      args.quietZone,
      logo,
    );

    let data: Uint8Array;
    switch (args.format) {
      case "png":
        data = img.toPng();
        break;
      case "jpeg":
      case "jpg":
        data = img.toJpeg(args.jpegQuality);
        break;
      default:
        throw new Error(`unknown format: ${args.format} (expected png or jpeg)`);
    }

    if (args.output) {
      const fs = await import("node:fs/promises");
      await fs.writeFile(args.output, data);
      return `Wrote ${data.length} bytes to ${args.output}`;
    }

    process.stdout.write(data);
    return "";
  }
}

// Default args for tests / programmatic use.
export const SINGLE_DEFAULTS: Omit<SingleArgs, "urString"> = {
  size: 512,
  fg: "#000000",
  bg: "#FFFFFF",
  logoFraction: 0.25,
  logoBorder: 1,
  logoShape: "square",
  quietZone: 1,
  dark: false,
  format: "png",
  jpegQuality: 90,
  maxModules: DEFAULT_MAX_MODULES,
  noDensityCheck: false,
};
