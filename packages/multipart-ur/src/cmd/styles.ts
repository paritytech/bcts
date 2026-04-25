/** Port of `bc-mur::main::styles`. ANSI styles for help output. */

const RESET = "\x1b[0m";

export const styles = {
  bold: (s: string) => `\x1b[1m${s}${RESET}`,
  underline: (s: string) => `\x1b[4m${s}${RESET}`,
  yellow: (s: string) => `\x1b[33m${s}${RESET}`,
  green: (s: string) => `\x1b[32m${s}${RESET}`,
  red: (s: string) => `\x1b[31m${s}${RESET}`,
  brightCyan: (s: string) => `\x1b[96m${s}${RESET}`,
  header: (s: string) => `\x1b[1;4;33m${s}${RESET}`,
  usage: (s: string) => `\x1b[1;4;33m${s}${RESET}`,
};
