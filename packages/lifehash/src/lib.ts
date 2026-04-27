/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

import { Version } from "./version";
import type { Data } from "./data";
import { CellGrid } from "./cell-grid";
import { ChangeGrid } from "./change-grid";
import { FracGrid } from "./frac-grid";
import { ColorGrid } from "./color-grid";
import { BitEnumerator } from "./bit-enumerator";
import { selectGradient } from "./gradients";
import { selectPattern } from "./patterns";
import { sha256 } from "./sha256";
import { toData } from "./format-utils";
import { clamped, lerpFrom, min, max } from "./color";
import { dataToHex } from "./hex";

export { Version } from "./version";

/**
 * An RGB(A) image returned from the functions that make LifeHashes.
 */
export interface Image {
  width: number;
  height: number;
  colors: Uint8Array;
}

function makeImage(
  width: number,
  height: number,
  floatColors: number[],
  moduleSize: number,
  hasAlpha: boolean,
): Image {
  if (!Number.isInteger(moduleSize) || moduleSize <= 0) {
    throw new Error("Invalid module size");
  }

  const scaledWidth = width * moduleSize;
  const scaledHeight = height * moduleSize;
  const resultComponents = hasAlpha ? 4 : 3;
  const scaledCapacity = scaledWidth * scaledHeight * resultComponents;

  const resultColors = new Uint8Array(scaledCapacity);

  // Match C++/Rust loop order: outer uses scaledWidth, inner uses
  // scaledHeight (variables intentionally swapped relative to their names —
  // harmless because LifeHash images are always square).
  for (let targetY = 0; targetY < scaledWidth; targetY++) {
    for (let targetX = 0; targetX < scaledHeight; targetX++) {
      const sourceX = Math.floor(targetX / moduleSize);
      const sourceY = Math.floor(targetY / moduleSize);
      const sourceOffset = (sourceY * width + sourceX) * 3;
      const targetOffset = (targetY * scaledWidth + targetX) * resultComponents;

      // Rust `(x as u8)` truncates an f64 toward zero and saturates to
      // [0, 255]; Math.trunc + Uint8Array assignment does the same in JS.
      resultColors[targetOffset] = Math.trunc(clamped(floatColors[sourceOffset]) * 255);
      resultColors[targetOffset + 1] = Math.trunc(clamped(floatColors[sourceOffset + 1]) * 255);
      resultColors[targetOffset + 2] = Math.trunc(clamped(floatColors[sourceOffset + 2]) * 255);

      if (hasAlpha) {
        resultColors[targetOffset + 3] = 255;
      }
    }
  }

  return { width: scaledWidth, height: scaledHeight, colors: resultColors };
}

/**
 * Make a LifeHash from a UTF-8 string, which may be of any length.
 * The caller is responsible to ensure that the string has undergone any
 * necessary Unicode normalization in order to produce consistent results.
 */
export function makeFromUtf8(
  s: string,
  version: Version = Version.version2,
  moduleSize = 1,
  hasAlpha = false,
): Image {
  return makeFromData(toData(s), version, moduleSize, hasAlpha);
}

/**
 * Make a LifeHash from given data, which may be of any size.
 */
export function makeFromData(
  data: Data,
  version: Version = Version.version2,
  moduleSize = 1,
  hasAlpha = false,
): Image {
  const digest = sha256(data);
  return makeFromDigest(digest, version, moduleSize, hasAlpha);
}

/**
 * Make a LifeHash from the SHA256 digest of some other data.
 * The digest must be exactly 32 pseudorandom bytes. This is the base
 * LifeHash creation algorithm, but if you don't already have a SHA256 hash of
 * some data, then you should access it by calling `makeFromData()`. If you
 * are starting with a UTF-8 string, call `makeFromUtf8()`.
 */
export function makeFromDigest(
  digest: Data,
  version: Version = Version.version2,
  moduleSize = 1,
  hasAlpha = false,
): Image {
  if (digest.length !== 32) {
    throw new Error("Digest must be 32 bytes");
  }

  let length: number;
  let maxGenerations: number;

  switch (version) {
    case Version.version1:
    case Version.version2:
      length = 16;
      maxGenerations = 150;
      break;
    case Version.detailed:
    case Version.fiducial:
    case Version.grayscale_fiducial:
      length = 32;
      maxGenerations = 300;
      break;
    default:
      throw new Error("Invalid version");
  }

  // These get reused from generation to generation by swapping them.
  let currentCellGrid = new CellGrid(length, length);
  let nextCellGrid = new CellGrid(length, length);
  let currentChangeGrid = new ChangeGrid(length, length);
  let nextChangeGrid = new ChangeGrid(length, length);

  const historySet = new Set<string>();
  const history: Data[] = [];

  // Initialize the cell grid based on version
  switch (version) {
    case Version.version1:
      nextCellGrid.setData(new Uint8Array(digest));
      break;
    case Version.version2:
      // Ensure that .version2 in no way resembles .version1
      nextCellGrid.setData(sha256(new Uint8Array(digest)));
      break;
    case Version.detailed:
    case Version.fiducial:
    case Version.grayscale_fiducial: {
      let digest1: Data = new Uint8Array(digest);
      // Ensure that grayscale fiducials in no way resemble the regular color fiducials
      if (version === Version.grayscale_fiducial) {
        digest1 = sha256(digest1);
      }
      const digest2 = sha256(digest1);
      const digest3 = sha256(digest2);
      const digest4 = sha256(digest3);

      const digestFinal = new Uint8Array(128);
      digestFinal.set(digest1, 0);
      digestFinal.set(digest2, 32);
      digestFinal.set(digest3, 64);
      digestFinal.set(digest4, 96);

      nextCellGrid.setData(digestFinal);
      break;
    }
  }

  nextChangeGrid.grid.setAll(true);

  // Run the Game of Life
  while (history.length < maxGenerations) {
    // Swap grids
    [currentCellGrid, nextCellGrid] = [nextCellGrid, currentCellGrid];
    [currentChangeGrid, nextChangeGrid] = [nextChangeGrid, currentChangeGrid];

    const data = currentCellGrid.data();
    const hash = sha256(data);
    const hashHex = dataToHex(hash);

    if (historySet.has(hashHex)) {
      break;
    }
    historySet.add(hashHex);
    history.push(data);

    currentCellGrid.nextGeneration(currentChangeGrid, nextCellGrid, nextChangeGrid);
  }

  // Build the frac grid from history
  const fracGrid = new FracGrid(length, length);
  for (let i = 0; i < history.length; i++) {
    currentCellGrid.setData(history[i]);
    const frac = clamped(lerpFrom(0, history.length, i + 1));
    fracGrid.overlay(currentCellGrid, frac);
  }

  // Normalizing the frac_grid to the range 0..1 was a step left out of .version1
  // In some cases it can cause the full range of the gradient to go unused.
  // This fixes the problem for the other versions, while remaining compatible
  // with .version1.
  if (version !== Version.version1) {
    let minValue = Infinity;
    let maxValue = -Infinity;

    fracGrid.grid.forAll((x, y) => {
      const value = fracGrid.grid.getValue(x, y);
      minValue = min(minValue, value);
      maxValue = max(maxValue, value);
    });

    fracGrid.grid.forAll((x, y) => {
      const value = lerpFrom(minValue, maxValue, fracGrid.grid.getValue(x, y));
      fracGrid.grid.setValue(value, x, y);
    });
  }

  // Select gradient and pattern
  const entropy = new BitEnumerator(new Uint8Array(digest));

  switch (version) {
    case Version.detailed:
      // Throw away a bit of entropy to ensure we generate different colors and patterns from .version1
      entropy.next();
      break;
    case Version.version2:
      // Throw away two bits of entropy to ensure we generate different colors and patterns from .version1 or .detailed.
      entropy.nextUint2();
      break;
    case Version.version1:
    case Version.fiducial:
    case Version.grayscale_fiducial:
      // No entropy adjustment needed
      break;
  }

  const gradient = selectGradient(entropy, version);
  const pattern = selectPattern(entropy, version);
  const colorGrid = new ColorGrid(fracGrid, gradient, pattern);

  return makeImage(
    colorGrid.grid.width,
    colorGrid.grid.height,
    colorGrid.colors(),
    moduleSize,
    hasAlpha,
  );
}
