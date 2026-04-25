/**
 * Copyright © 2026 Blockchain Commons, LLC
 * Copyright © 2026 Parity Technologies
 *
 * Port of `bc-mur::color`.
 */

import { MurError } from "./error.js";

/** RGBA color with 8-bit channels. */
export class Color {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;

  constructor(r: number, g: number, b: number, a: number) {
    this.r = r & 0xff;
    this.g = g & 0xff;
    this.b = b & 0xff;
    this.a = a & 0xff;
  }

  static readonly BLACK: Color = new Color(0, 0, 0, 255);
  static readonly WHITE: Color = new Color(255, 255, 255, 255);
  static readonly TRANSPARENT: Color = new Color(0, 0, 0, 0);

  /** Mirror of Rust `Color::new`. */
  static new(r: number, g: number, b: number, a: number): Color {
    return new Color(r, g, b, a);
  }

  /** Parse hex color: `#RGB`, `#RRGGBB`, or `#RRGGBBAA`. */
  static fromHex(s: string): Color {
    const stripped = s.startsWith("#") ? s.slice(1) : s;
    switch (stripped.length) {
      case 3: {
        const r = hexNibble(stripped.charCodeAt(0));
        const g = hexNibble(stripped.charCodeAt(1));
        const b = hexNibble(stripped.charCodeAt(2));
        return new Color((r << 4) | r, (g << 4) | g, (b << 4) | b, 255);
      }
      case 6: {
        const r = hexByte(stripped.slice(0, 2));
        const g = hexByte(stripped.slice(2, 4));
        const b = hexByte(stripped.slice(4, 6));
        return new Color(r, g, b, 255);
      }
      case 8: {
        const r = hexByte(stripped.slice(0, 2));
        const g = hexByte(stripped.slice(2, 4));
        const b = hexByte(stripped.slice(4, 6));
        const a = hexByte(stripped.slice(6, 8));
        return new Color(r, g, b, a);
      }
      default:
        throw MurError.invalidColor(`expected #RGB, #RRGGBB, or #RRGGBBAA, got: #${stripped}`);
    }
  }

  /** True if alpha < 3 (effectively transparent). */
  isTransparent(): boolean {
    return this.a < 3;
  }

  toString(): string {
    const r = this.r.toString(16).padStart(2, "0").toUpperCase();
    const g = this.g.toString(16).padStart(2, "0").toUpperCase();
    const b = this.b.toString(16).padStart(2, "0").toUpperCase();
    if (this.a === 255) {
      return `#${r}${g}${b}`;
    }
    const a = this.a.toString(16).padStart(2, "0").toUpperCase();
    return `#${r}${g}${b}${a}`;
  }
}

function hexNibble(b: number): number {
  if (b >= 0x30 && b <= 0x39) return b - 0x30; // '0'-'9'
  if (b >= 0x61 && b <= 0x66) return b - 0x61 + 10; // 'a'-'f'
  if (b >= 0x41 && b <= 0x46) return b - 0x41 + 10; // 'A'-'F'
  throw MurError.invalidColor(`invalid hex digit: ${b}`);
}

function hexByte(s: string): number {
  const hi = hexNibble(s.charCodeAt(0));
  const lo = hexNibble(s.charCodeAt(1));
  return (hi << 4) | lo;
}
