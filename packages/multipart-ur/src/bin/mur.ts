#!/usr/bin/env node
/**
 * `mur` — Multipart UR QR code generator CLI.
 *
 * Port of `bc-mur::main`.
 */

import { Command } from "commander";

import { AnimateCommand, ANIMATE_DEFAULTS } from "../cmd/animate.js";
import { FramesCommand, FRAMES_DEFAULTS } from "../cmd/frames.js";
import { SingleCommand, SINGLE_DEFAULTS } from "../cmd/single.js";

async function main(): Promise<void> {
  const program = new Command();
  program
    .name("mur")
    .description("Multipart UR QR code generator.")
    .version("1.0.0-alpha.0");

  program
    .command("single")
    .description("Render a single-frame QR code.")
    .argument("<ur-string>", "UR string to encode, or `-` to read from stdin.")
    .option("-o, --output <path>", "Output file path (default: stdout as raw PNG).")
    .option("-s, --size <px>", "Image size in pixels.", parseIntArg, SINGLE_DEFAULTS.size)
    .option("--fg <hex>", "Foreground color (hex).", SINGLE_DEFAULTS.fg)
    .option("--bg <hex>", "Background color (hex).", SINGLE_DEFAULTS.bg)
    .option("--logo <path>", "Path to SVG logo file.")
    .option("--logo-fraction <n>", "Logo fraction of QR width (0.01–0.99).", parseFloatArg, SINGLE_DEFAULTS.logoFraction)
    .option("--logo-border <n>", "Logo clear border in modules (0–5).", parseIntArg, SINGLE_DEFAULTS.logoBorder)
    .option("--logo-shape <shape>", "Logo clear shape (square or circle).", SINGLE_DEFAULTS.logoShape)
    .option("-c, --correction <level>", "Error correction level (low, medium, quartile, high).")
    .option("--quiet-zone <n>", "Quiet zone modules around the QR code.", parseIntArg, SINGLE_DEFAULTS.quietZone)
    .option("--dark", "Dark mode (white-on-black).", false)
    .option("--format <fmt>", "Output format (png or jpeg).", SINGLE_DEFAULTS.format)
    .option("--jpeg-quality <n>", "JPEG quality (1–100).", parseIntArg, SINGLE_DEFAULTS.jpegQuality)
    .option("--max-modules <n>", "Maximum QR module count for reliable scanning.", parseIntArg, SINGLE_DEFAULTS.maxModules)
    .option("--no-density-check", "Disable the QR density check.", false)
    .action(async (urString: string, opts: Record<string, unknown>) => {
      const cmd = new SingleCommand({
        urString,
        ...SINGLE_DEFAULTS,
        ...(opts as Partial<typeof SINGLE_DEFAULTS>),
      });
      const out = await cmd.exec();
      if (out !== "") console.log(out);
    });

  program
    .command("animate")
    .description("Generate an animated multipart QR sequence.")
    .argument("<ur-string>", "UR string to encode, or `-` to read from stdin.")
    .requiredOption("-o, --output <path>", "Output file path.")
    .option("-s, --size <px>", "Image size in pixels.", parseIntArg, ANIMATE_DEFAULTS.size)
    .option("--fg <hex>", "Foreground color (hex).", ANIMATE_DEFAULTS.fg)
    .option("--bg <hex>", "Background color (hex).", ANIMATE_DEFAULTS.bg)
    .option("--logo <path>", "Path to SVG logo file.")
    .option("--logo-fraction <n>", "Logo fraction of QR width (0.01–0.99).", parseFloatArg, ANIMATE_DEFAULTS.logoFraction)
    .option("--logo-border <n>", "Logo clear border in modules (0–5).", parseIntArg, ANIMATE_DEFAULTS.logoBorder)
    .option("--logo-shape <shape>", "Logo clear shape (square or circle).", ANIMATE_DEFAULTS.logoShape)
    .option("-c, --correction <level>", "Error correction level (low, medium, quartile, high).")
    .option("--quiet-zone <n>", "Quiet zone modules around the QR code.", parseIntArg, ANIMATE_DEFAULTS.quietZone)
    .option("--dark", "Dark mode (white-on-black).", false)
    .option("--max-fragment-len <n>", "Maximum fragment length for fountain coding.", parseIntArg, ANIMATE_DEFAULTS.maxFragmentLen)
    .option("--fps <n>", "Frames per second.", parseFloatArg, ANIMATE_DEFAULTS.fps)
    .option("--cycles <n>", "Number of complete cycles through all fragments.", parseIntArg, ANIMATE_DEFAULTS.cycles)
    .option("--format <fmt>", "Output format (gif or prores).", ANIMATE_DEFAULTS.format)
    .option("--frame-count <n>", "Exact number of frames (overrides --cycles).", parseIntArg)
    .option("--max-modules <n>", "Maximum QR module count for reliable scanning.", parseIntArg, ANIMATE_DEFAULTS.maxModules)
    .option("--no-density-check", "Disable the QR density check.", false)
    .action(async (urString: string, opts: Record<string, unknown>) => {
      const cmd = new AnimateCommand({
        urString,
        ...ANIMATE_DEFAULTS,
        ...(opts as Partial<typeof ANIMATE_DEFAULTS>),
        output: (opts as { output: string }).output,
      });
      const out = await cmd.exec();
      if (out !== "") console.log(out);
    });

  program
    .command("frames")
    .description("Dump multipart QR frames as numbered PNGs.")
    .argument("<ur-string>", "UR string to encode, or `-` to read from stdin.")
    .requiredOption("-o, --output <path>", "Output directory for numbered PNGs.")
    .option("-s, --size <px>", "Image size in pixels.", parseIntArg, FRAMES_DEFAULTS.size)
    .option("--fg <hex>", "Foreground color (hex).", FRAMES_DEFAULTS.fg)
    .option("--bg <hex>", "Background color (hex).", FRAMES_DEFAULTS.bg)
    .option("--logo <path>", "Path to SVG logo file.")
    .option("--logo-fraction <n>", "Logo fraction of QR width (0.01–0.99).", parseFloatArg, FRAMES_DEFAULTS.logoFraction)
    .option("--logo-border <n>", "Logo clear border in modules (0–5).", parseIntArg, FRAMES_DEFAULTS.logoBorder)
    .option("--logo-shape <shape>", "Logo clear shape (square or circle).", FRAMES_DEFAULTS.logoShape)
    .option("-c, --correction <level>", "Error correction level (low, medium, quartile, high).")
    .option("--quiet-zone <n>", "Quiet zone modules around the QR code.", parseIntArg, FRAMES_DEFAULTS.quietZone)
    .option("--dark", "Dark mode (white-on-black).", false)
    .option("--max-fragment-len <n>", "Maximum fragment length for fountain coding.", parseIntArg, FRAMES_DEFAULTS.maxFragmentLen)
    .option("--fps <n>", "Frames per second (affects cycle count).", parseFloatArg, FRAMES_DEFAULTS.fps)
    .option("--cycles <n>", "Number of complete cycles through all fragments.", parseIntArg, FRAMES_DEFAULTS.cycles)
    .option("--frame-count <n>", "Exact number of frames (overrides --cycles).", parseIntArg)
    .option("--max-modules <n>", "Maximum QR module count for reliable scanning.", parseIntArg, FRAMES_DEFAULTS.maxModules)
    .option("--no-density-check", "Disable the QR density check.", false)
    .action(async (urString: string, opts: Record<string, unknown>) => {
      const cmd = new FramesCommand({
        urString,
        ...FRAMES_DEFAULTS,
        ...(opts as Partial<typeof FRAMES_DEFAULTS>),
        output: (opts as { output: string }).output,
      });
      const out = await cmd.exec();
      if (out !== "") console.log(out);
    });

  await program.parseAsync(process.argv);
}

function parseIntArg(value: string): number {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) {
    throw new Error(`expected integer, got: ${value}`);
  }
  return n;
}

function parseFloatArg(value: string): number {
  const n = parseFloat(value);
  if (Number.isNaN(n)) {
    throw new Error(`expected number, got: ${value}`);
  }
  return n;
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Error: ${msg}\n`);
  process.exit(1);
});
