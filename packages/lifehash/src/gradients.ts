/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

import { Color } from "./color";
import { HSBColor } from "./hsb-color";
import { blend, reverse, type ColorFunc } from "./color-func";
import { type BitEnumerator } from "./bit-enumerator";
import { Version } from "./version";
import { lerp, modulo } from "./numeric";

// Grayscale gradient
const grayscale: ColorFunc = blend(Color.black, Color.white);

function selectGrayscale(entropy: BitEnumerator): ColorFunc {
  return entropy.next() ? grayscale : reverse(grayscale);
}

function makeHue(t: number): Color {
  return new HSBColor(t).toColor();
}

// Spectrum gradients
const spectrum: ColorFunc = blend([
  Color.fromUint8Values(0, 168, 222),
  Color.fromUint8Values(51, 51, 145),
  Color.fromUint8Values(233, 19, 136),
  Color.fromUint8Values(235, 45, 46),
  Color.fromUint8Values(253, 233, 43),
  Color.fromUint8Values(0, 158, 84),
  Color.fromUint8Values(0, 168, 222),
]);

const spectrumCmykSafe: ColorFunc = blend([
  Color.fromUint8Values(0, 168, 222),
  Color.fromUint8Values(41, 60, 130),
  Color.fromUint8Values(210, 59, 130),
  Color.fromUint8Values(217, 63, 53),
  Color.fromUint8Values(244, 228, 81),
  Color.fromUint8Values(0, 158, 84),
  Color.fromUint8Values(0, 168, 222),
]);

function adjustForLuminance(color: Color, contrastColor: Color): Color {
  const lum = color.luminance();
  const contrastLum = contrastColor.luminance();
  const threshold = 0.6;
  const offset = Math.abs(lum - contrastLum);

  if (offset > threshold) {
    return color;
  }

  const boost = 0.7;
  const t = lerp(0, threshold, boost, 0, offset);

  if (contrastLum > lum) {
    // Darken this color
    return color.darken(t).burn(t * 0.6);
  } else {
    // Lighten this color
    return color.lighten(t).burn(t * 0.6);
  }
}

// Monochromatic gradient functions
function monochromatic(entropy: BitEnumerator, hueGenerator: ColorFunc): ColorFunc {
  const hue = entropy.nextFrac();
  const isTint = entropy.next();
  const isReversed = entropy.next();
  const keyAdvance = entropy.nextFrac() * 0.3 + 0.05;
  const neutralAdvance = entropy.nextFrac() * 0.3 + 0.05;

  let keyColor = hueGenerator(hue);
  let contrastBrightness: number;

  if (isTint) {
    contrastBrightness = 1;
    keyColor = keyColor.darken(0.5);
  } else {
    contrastBrightness = 0;
  }

  const neutralColor = grayscale(contrastBrightness);
  const keyColor2 = keyColor.lerpTo(neutralColor, keyAdvance);
  const neutralColor2 = neutralColor.lerpTo(keyColor, neutralAdvance);

  const gradient = blend(keyColor2, neutralColor2);
  return isReversed ? reverse(gradient) : gradient;
}

function monochromaticFiducial(entropy: BitEnumerator): ColorFunc {
  const hue = entropy.nextFrac();
  const isReversed = entropy.next();
  const isTint = entropy.next();

  const contrastColor = isTint ? Color.white : Color.black;
  const keyColor = adjustForLuminance(spectrumCmykSafe(hue), contrastColor);

  const gradient = blend([keyColor, contrastColor, keyColor]);
  return isReversed ? reverse(gradient) : gradient;
}

// Complementary gradient functions
function complementary(entropy: BitEnumerator, hueGenerator: ColorFunc): ColorFunc {
  const spectrum1 = entropy.nextFrac();
  const spectrum2 = modulo(spectrum1 + 0.5, 1);
  const lighterAdvance = entropy.nextFrac() * 0.3;
  const darkerAdvance = entropy.nextFrac() * 0.3;
  const isReversed = entropy.next();

  const color1 = hueGenerator(spectrum1);
  const color2 = hueGenerator(spectrum2);

  const luma1 = color1.luminance();
  const luma2 = color2.luminance();

  let darkerColor: Color;
  let lighterColor: Color;
  if (luma1 > luma2) {
    darkerColor = color2;
    lighterColor = color1;
  } else {
    darkerColor = color1;
    lighterColor = color2;
  }

  const adjustedLighterColor = lighterColor.lighten(lighterAdvance);
  const adjustedDarkerColor = darkerColor.darken(darkerAdvance);

  const gradient = blend(adjustedDarkerColor, adjustedLighterColor);
  return isReversed ? reverse(gradient) : gradient;
}

function complementaryFiducial(entropy: BitEnumerator): ColorFunc {
  const spectrum1 = entropy.nextFrac();
  const spectrum2 = modulo(spectrum1 + 0.5, 1);
  const isTint = entropy.next();
  const isReversed = entropy.next();
  const neutralColorBias = entropy.next();

  const neutralColor = isTint ? Color.white : Color.black;
  const color1 = spectrumCmykSafe(spectrum1);
  const color2 = spectrumCmykSafe(spectrum2);

  const biasedNeutralColor = neutralColor.lerpTo(neutralColorBias ? color1 : color2, 0.2).burn(0.1);

  const gradient = blend([
    adjustForLuminance(color1, biasedNeutralColor),
    biasedNeutralColor,
    adjustForLuminance(color2, biasedNeutralColor),
  ]);
  return isReversed ? reverse(gradient) : gradient;
}

// Triadic gradient functions
function triadic(entropy: BitEnumerator, hueGenerator: ColorFunc): ColorFunc {
  const spectrum1 = entropy.nextFrac();
  const spectrum2 = modulo(spectrum1 + 1.0 / 3, 1);
  const spectrum3 = modulo(spectrum1 + 2.0 / 3, 1);
  const lighterAdvance = entropy.nextFrac() * 0.3;
  const darkerAdvance = entropy.nextFrac() * 0.3;
  const isReversed = entropy.next();

  const color1 = hueGenerator(spectrum1);
  const color2 = hueGenerator(spectrum2);
  const color3 = hueGenerator(spectrum3);

  const colors = [color1, color2, color3].sort((a, b) => a.luminance() - b.luminance());

  const darkerColor = colors[0];
  const middleColor = colors[1];
  const lighterColor = colors[2];

  const adjustedLighterColor = lighterColor.lighten(lighterAdvance);
  const adjustedDarkerColor = darkerColor.darken(darkerAdvance);

  const gradient = blend([adjustedLighterColor, middleColor, adjustedDarkerColor]);
  return isReversed ? reverse(gradient) : gradient;
}

function triadicFiducial(entropy: BitEnumerator): ColorFunc {
  const spectrum1 = entropy.nextFrac();
  const spectrum2 = modulo(spectrum1 + 1.0 / 3, 1);
  const spectrum3 = modulo(spectrum1 + 2.0 / 3, 1);
  const isTint = entropy.next();
  const neutralInsertIndex = (entropy.nextUint8() % 2) + 1;
  const isReversed = entropy.next();

  const neutralColor = isTint ? Color.white : Color.black;

  const colors = [
    spectrumCmykSafe(spectrum1),
    spectrumCmykSafe(spectrum2),
    spectrumCmykSafe(spectrum3),
  ];

  switch (neutralInsertIndex) {
    case 1:
      colors[0] = adjustForLuminance(colors[0], neutralColor);
      colors[1] = adjustForLuminance(colors[1], neutralColor);
      colors[2] = adjustForLuminance(colors[2], colors[1]);
      break;
    case 2:
      colors[1] = adjustForLuminance(colors[1], neutralColor);
      colors[2] = adjustForLuminance(colors[2], neutralColor);
      colors[0] = adjustForLuminance(colors[0], colors[1]);
      break;
    default:
      throw new Error("Internal error.");
  }

  colors.splice(neutralInsertIndex, 0, neutralColor);

  const gradient = blend(colors);
  return isReversed ? reverse(gradient) : gradient;
}

// Analogous gradient functions
function analogous(entropy: BitEnumerator, hueGenerator: ColorFunc): ColorFunc {
  const spectrum1 = entropy.nextFrac();
  const spectrum2 = modulo(spectrum1 + 1.0 / 12, 1);
  const spectrum3 = modulo(spectrum1 + 2.0 / 12, 1);
  const spectrum4 = modulo(spectrum1 + 3.0 / 12, 1);
  const advance = entropy.nextFrac() * 0.5 + 0.2;
  const isReversed = entropy.next();

  const color1 = hueGenerator(spectrum1);
  const color2 = hueGenerator(spectrum2);
  const color3 = hueGenerator(spectrum3);
  const color4 = hueGenerator(spectrum4);

  let darkestColor: Color;
  let darkColor: Color;
  let lightColor: Color;
  let lightestColor: Color;

  if (color1.luminance() < color4.luminance()) {
    darkestColor = color1;
    darkColor = color2;
    lightColor = color3;
    lightestColor = color4;
  } else {
    darkestColor = color4;
    darkColor = color3;
    lightColor = color2;
    lightestColor = color1;
  }

  const adjustedDarkestColor = darkestColor.darken(advance);
  const adjustedDarkColor = darkColor.darken(advance / 2);
  const adjustedLightColor = lightColor.lighten(advance / 2);
  const adjustedLightestColor = lightestColor.lighten(advance);

  const gradient = blend([
    adjustedDarkestColor,
    adjustedDarkColor,
    adjustedLightColor,
    adjustedLightestColor,
  ]);
  return isReversed ? reverse(gradient) : gradient;
}

function analogousFiducial(entropy: BitEnumerator): ColorFunc {
  const spectrum1 = entropy.nextFrac();
  const spectrum2 = modulo(spectrum1 + 1.0 / 10, 1);
  const spectrum3 = modulo(spectrum1 + 2.0 / 10, 1);
  const isTint = entropy.next();
  const neutralInsertIndex = (entropy.nextUint8() % 2) + 1;
  const isReversed = entropy.next();

  const neutralColor = isTint ? Color.white : Color.black;

  const colors = [
    spectrumCmykSafe(spectrum1),
    spectrumCmykSafe(spectrum2),
    spectrumCmykSafe(spectrum3),
  ];

  switch (neutralInsertIndex) {
    case 1:
      colors[0] = adjustForLuminance(colors[0], neutralColor);
      colors[1] = adjustForLuminance(colors[1], neutralColor);
      colors[2] = adjustForLuminance(colors[2], colors[1]);
      break;
    case 2:
      colors[1] = adjustForLuminance(colors[1], neutralColor);
      colors[2] = adjustForLuminance(colors[2], neutralColor);
      colors[0] = adjustForLuminance(colors[0], colors[1]);
      break;
    default:
      throw new Error("Internal error");
  }

  colors.splice(neutralInsertIndex, 0, neutralColor);

  const gradient = blend(colors);
  return isReversed ? reverse(gradient) : gradient;
}

/**
 * A function that takes a deterministic source of bits and selects a gradient
 * used to color a particular LifeHash version.
 */
export function selectGradient(entropy: BitEnumerator, version: Version): ColorFunc {
  if (version === Version.grayscale_fiducial) {
    return selectGrayscale(entropy);
  }

  const value = entropy.nextUint2();

  switch (value) {
    case 0:
      switch (version) {
        case Version.version1:
          return monochromatic(entropy, makeHue);
        case Version.version2:
        case Version.detailed:
          return monochromatic(entropy, spectrumCmykSafe);
        case Version.fiducial:
          return monochromaticFiducial(entropy);
        default:
          return grayscale;
      }
    case 1:
      switch (version) {
        case Version.version1:
          return complementary(entropy, spectrum);
        case Version.version2:
        case Version.detailed:
          return complementary(entropy, spectrumCmykSafe);
        case Version.fiducial:
          return complementaryFiducial(entropy);
        default:
          return grayscale;
      }
    case 2:
      switch (version) {
        case Version.version1:
          return triadic(entropy, spectrum);
        case Version.version2:
        case Version.detailed:
          return triadic(entropy, spectrumCmykSafe);
        case Version.fiducial:
          return triadicFiducial(entropy);
        default:
          return grayscale;
      }
    case 3:
      switch (version) {
        case Version.version1:
          return analogous(entropy, spectrum);
        case Version.version2:
        case Version.detailed:
          return analogous(entropy, spectrumCmykSafe);
        case Version.fiducial:
          return analogousFiducial(entropy);
        default:
          return grayscale;
      }
    default:
      return grayscale;
  }
}
