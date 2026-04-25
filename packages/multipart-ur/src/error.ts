/**
 * Copyright © 2026 Blockchain Commons, LLC
 * Copyright © 2026 Parity Technologies
 *
 * Port of `bc-mur::error`.
 */

export type ErrorVariant =
  | { kind: "QrEncode"; message: string }
  | { kind: "ImageEncode"; message: string }
  | { kind: "SvgRender"; message: string }
  | { kind: "InvalidColor"; message: string }
  | { kind: "InvalidParameter"; message: string }
  | { kind: "GifEncode"; message: string }
  | { kind: "FfmpegNotFound" }
  | { kind: "FfmpegFailed"; message: string }
  | { kind: "QrCodeTooDense"; moduleCount: number; maxModules: number }
  | { kind: "InsufficientFrames"; requested: number; fragments: number }
  | { kind: "Io"; message: string }
  | { kind: "Ur"; message: string };

export class MurError extends Error {
  readonly variant: ErrorVariant;

  constructor(variant: ErrorVariant) {
    super(MurError.formatMessage(variant));
    this.name = "MurError";
    this.variant = variant;
  }

  static formatMessage(v: ErrorVariant): string {
    switch (v.kind) {
      case "QrEncode":
        return `QR encoding failed: ${v.message}`;
      case "ImageEncode":
        return `Image encoding failed: ${v.message}`;
      case "SvgRender":
        return `SVG rendering failed: ${v.message}`;
      case "InvalidColor":
        return `Invalid color: ${v.message}`;
      case "InvalidParameter":
        return `Invalid parameter: ${v.message}`;
      case "GifEncode":
        return `GIF encoding failed: ${v.message}`;
      case "FfmpegNotFound":
        return "ffmpeg not found on PATH — install ffmpeg for ProRes output";
      case "FfmpegFailed":
        return `ffmpeg failed: ${v.message}`;
      case "QrCodeTooDense":
        return (
          `QR code too dense: ${v.moduleCount} modules exceeds limit of ` +
          `${v.maxModules} (reduce data size, lower error correction, ` +
          `or increase --max-modules)`
        );
      case "InsufficientFrames":
        return (
          `insufficient frames: ${v.requested} requested but message ` +
          `requires at least ${v.fragments} fragments`
        );
      case "Io":
        return `IO error: ${v.message}`;
      case "Ur":
        return `UR error: ${v.message}`;
    }
  }

  static qrEncode(message: string): MurError {
    return new MurError({ kind: "QrEncode", message });
  }
  static imageEncode(message: string): MurError {
    return new MurError({ kind: "ImageEncode", message });
  }
  static svgRender(message: string): MurError {
    return new MurError({ kind: "SvgRender", message });
  }
  static invalidColor(message: string): MurError {
    return new MurError({ kind: "InvalidColor", message });
  }
  static invalidParameter(message: string): MurError {
    return new MurError({ kind: "InvalidParameter", message });
  }
  static gifEncode(message: string): MurError {
    return new MurError({ kind: "GifEncode", message });
  }
  static ffmpegNotFound(): MurError {
    return new MurError({ kind: "FfmpegNotFound" });
  }
  static ffmpegFailed(message: string): MurError {
    return new MurError({ kind: "FfmpegFailed", message });
  }
  static qrCodeTooDense(moduleCount: number, maxModules: number): MurError {
    return new MurError({ kind: "QrCodeTooDense", moduleCount, maxModules });
  }
  static insufficientFrames(requested: number, fragments: number): MurError {
    return new MurError({ kind: "InsufficientFrames", requested, fragments });
  }
  static io(message: string): MurError {
    return new MurError({ kind: "Io", message });
  }
  static ur(message: string): MurError {
    return new MurError({ kind: "Ur", message });
  }

  isKind<K extends ErrorVariant["kind"]>(
    kind: K,
  ): this is MurError & { variant: Extract<ErrorVariant, { kind: K }> } {
    return this.variant.kind === kind;
  }
}

export { MurError as Error };
export type Result<T> = T;
