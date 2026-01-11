/**
 * PNG writer for LifeHash images.
 *
 * Ported from bc-lifehash-cli C++ implementation (png-writer.hpp).
 * Uses pngjs instead of libpng.
 *
 * @module
 */

import { writeFileSync } from "fs";
import { PNG } from "pngjs";
import type { Image } from "@bcts/lifehash";

/**
 * Writes a LifeHash image to a PNG file.
 *
 * Port of `write_image()` from lifehash.cpp lines 174-186 and
 * PNGWriter class from png-writer.hpp.
 *
 * @param image - The LifeHash image to write
 * @param filename - The output filename
 * @category PNG Encoding
 *
 * @example
 * ```typescript
 * import { makeFromUtf8 } from "@bcts/lifehash";
 *
 * const image = makeFromUtf8("Hello");
 * writeImage(image, "Hello.png");
 * ```
 */
export function writeImage(image: Image, filename: string): void {
  const png = new PNG({
    width: image.width,
    height: image.height,
    colorType: 2, // RGB
    bitDepth: 8,
    inputColorType: 2,
    inputHasAlpha: false,
  });

  // Copy RGB data from image to PNG
  // PNG expects RGBA, so we need to add alpha channel
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const srcOffset = (y * image.width + x) * 3;
      const dstOffset = (y * image.width + x) * 4;

      // Copy RGB from source
      png.data[dstOffset] = image.colors[srcOffset]; // R
      png.data[dstOffset + 1] = image.colors[srcOffset + 1]; // G
      png.data[dstOffset + 2] = image.colors[srcOffset + 2]; // B
      png.data[dstOffset + 3] = 255; // A (fully opaque)
    }
  }

  // Write to file
  const buffer = PNG.sync.write(png);
  writeFileSync(filename, buffer);
}

/**
 * Generates a PNG buffer from a LifeHash image without writing to disk.
 *
 * @param image - The LifeHash image to encode
 * @returns A Buffer containing the PNG data
 * @category PNG Encoding
 *
 * @example
 * ```typescript
 * import { makeFromUtf8 } from "@bcts/lifehash";
 *
 * const image = makeFromUtf8("Hello");
 * const pngBuffer = generatePNG(image);
 * ```
 */
export function generatePNG(image: Image): Buffer {
  const png = new PNG({
    width: image.width,
    height: image.height,
    colorType: 2,
    bitDepth: 8,
    inputColorType: 2,
    inputHasAlpha: false,
  });

  // Copy RGB data from image to PNG
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const srcOffset = (y * image.width + x) * 3;
      const dstOffset = (y * image.width + x) * 4;

      png.data[dstOffset] = image.colors[srcOffset];
      png.data[dstOffset + 1] = image.colors[srcOffset + 1];
      png.data[dstOffset + 2] = image.colors[srcOffset + 2];
      png.data[dstOffset + 3] = 255;
    }
  }

  return PNG.sync.write(png);
}
