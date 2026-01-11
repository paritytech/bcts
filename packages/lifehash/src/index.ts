// Main API
export {
  Version,
  makeFromUtf8,
  makeFromData,
  makeFromDigest,
  type Image,
} from "./lifehash";

// Utilities
export { dataToHex, hexToData } from "./hex";
export { sha256 } from "./sha256";

// Types
export type { Data } from "./data";
export { Pattern } from "./patterns";

// For advanced usage
export { Color } from "./color";
export { HSBColor } from "./hsb-color";
export { Point } from "./point";
export { Size } from "./size";
