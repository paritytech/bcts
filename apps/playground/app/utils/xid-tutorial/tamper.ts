/** Return a tampered UR string by flipping the last bytewords character. */
export function tamperUr(ur: string): string {
  if (ur.length < 2) return ur;
  const last = ur[ur.length - 1];
  const replacement = last === "a" ? "b" : "a";
  return ur.slice(0, -1) + replacement;
}

/** Tamper with the middle of the UR to simulate content mutation (vs checksum). */
export function tamperMiddle(ur: string): string {
  if (ur.length < 40) return tamperUr(ur);
  const mid = Math.floor(ur.length / 2);
  const ch = ur[mid];
  const replacement = ch === "a" ? "b" : "a";
  return ur.slice(0, mid) + replacement + ur.slice(mid + 1);
}
