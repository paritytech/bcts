// Ported from bc-shamir-rust/src/shamir.rs

import { hmacSha256, memzero, memzeroVecVecU8 } from "@bcts/crypto";
import type { RandomNumberGenerator } from "@bcts/rand";

import { ShamirError, ShamirErrorType } from "./error.js";
import { MAX_SECRET_LEN, MAX_SHARE_COUNT, MIN_SECRET_LEN } from "./index.js";
import { interpolate } from "./interpolate.js";

const SECRET_INDEX = 255;
const DIGEST_INDEX = 254;

function createDigest(randomData: Uint8Array, sharedSecret: Uint8Array): Uint8Array {
  return hmacSha256(randomData, sharedSecret);
}

function validateParameters(threshold: number, shareCount: number, secretLength: number): void {
  if (shareCount > MAX_SHARE_COUNT) {
    throw new ShamirError(ShamirErrorType.TooManyShares);
  } else if (threshold < 1 || threshold > shareCount) {
    throw new ShamirError(ShamirErrorType.InvalidThreshold);
  } else if (secretLength > MAX_SECRET_LEN) {
    throw new ShamirError(ShamirErrorType.SecretTooLong);
  } else if (secretLength < MIN_SECRET_LEN) {
    throw new ShamirError(ShamirErrorType.SecretTooShort);
  } else if ((secretLength & 1) !== 0) {
    throw new ShamirError(ShamirErrorType.SecretNotEvenLen);
  }
}

/**
 * Splits a secret into shares using the Shamir secret sharing algorithm.
 *
 * @param threshold - The minimum number of shares required to reconstruct the
 *   secret. Must be greater than or equal to 1 and less than or equal to
 *   shareCount.
 * @param shareCount - The total number of shares to generate. Must be at least
 *   threshold and less than or equal to MAX_SHARE_COUNT.
 * @param secret - A Uint8Array containing the secret to be split. Must be at
 *   least MIN_SECRET_LEN bytes long and at most MAX_SECRET_LEN bytes long.
 *   The length must be an even number.
 * @param randomGenerator - An implementation of the RandomNumberGenerator
 *   interface, used to generate random data.
 * @returns An array of Uint8Array representing the shares of the secret.
 * @throws ShamirError if parameters are invalid
 *
 * @example
 * ```typescript
 * import { splitSecret } from "@bcts/shamir";
 * import { SecureRandomNumberGenerator } from "@bcts/rand";
 *
 * const threshold = 2;
 * const shareCount = 3;
 * const secret = new TextEncoder().encode("my secret belongs to me.");
 * const rng = new SecureRandomNumberGenerator();
 *
 * const shares = splitSecret(threshold, shareCount, secret, rng);
 * console.log(shares.length); // 3
 * ```
 */
export function splitSecret(
  threshold: number,
  shareCount: number,
  secret: Uint8Array,
  randomGenerator: RandomNumberGenerator,
): Uint8Array[] {
  validateParameters(threshold, shareCount, secret.length);

  if (threshold === 1) {
    // just return shareCount copies of the secret
    const result: Uint8Array[] = [];
    for (let i = 0; i < shareCount; i++) {
      result.push(new Uint8Array(secret));
    }
    return result;
  } else {
    const x = new Uint8Array(shareCount);
    const y: Uint8Array[] = [];
    for (let i = 0; i < shareCount; i++) {
      y.push(new Uint8Array(secret.length));
    }
    let n = 0;
    const result: Uint8Array[] = [];
    for (let i = 0; i < shareCount; i++) {
      result.push(new Uint8Array(secret.length));
    }

    for (let index = 0; index < threshold - 2; index++) {
      randomGenerator.fillRandomData(result[index]);
      x[n] = index;
      y[n].set(result[index]);
      n++;
    }

    // generate secret_length - 4 bytes worth of random data
    const digest = new Uint8Array(secret.length);
    randomGenerator.fillRandomData(digest.subarray(4));
    // put 4 bytes of digest at the top of the digest array
    const d = createDigest(digest.subarray(4), secret);
    digest.set(d.subarray(0, 4), 0);
    x[n] = DIGEST_INDEX;
    y[n].set(digest);
    n++;

    x[n] = SECRET_INDEX;
    y[n].set(secret);
    n++;

    for (let index = threshold - 2; index < shareCount; index++) {
      const v = interpolate(n, x, secret.length, y, index);
      result[index].set(v);
    }

    // clean up stack
    memzero(digest);
    memzero(x);
    memzeroVecVecU8(y);

    return result;
  }
}

/**
 * Recovers the secret from the given shares using the Shamir secret sharing
 * algorithm.
 *
 * @param indexes - An array of indexes of the shares to be used for recovering
 *   the secret. These are the indexes of the shares returned by splitSecret.
 * @param shares - An array of shares of the secret matching the indexes in
 *   indexes. These are the shares returned by splitSecret.
 * @returns A Uint8Array representing the recovered secret.
 * @throws ShamirError if parameters are invalid or checksum verification fails
 *
 * @example
 * ```typescript
 * import { recoverSecret } from "@bcts/shamir";
 *
 * const indexes = [0, 2];
 * const shares = [
 *   new Uint8Array([47, 165, 102, 232, ...]),
 *   new Uint8Array([221, 174, 116, 201, ...]),
 * ];
 *
 * const secret = recoverSecret(indexes, shares);
 * console.log(new TextDecoder().decode(secret)); // "my secret belongs to me."
 * ```
 */
export function recoverSecret(indexes: number[], shares: Uint8Array[]): Uint8Array {
  const threshold = shares.length;
  if (threshold === 0 || indexes.length !== threshold) {
    throw new ShamirError(ShamirErrorType.InvalidThreshold);
  }

  const shareLength = shares[0].length;
  validateParameters(threshold, threshold, shareLength);

  const allSameLength = shares.every((share) => share.length === shareLength);
  if (!allSameLength) {
    throw new ShamirError(ShamirErrorType.SharesUnequalLength);
  }

  if (threshold === 1) {
    return new Uint8Array(shares[0]);
  } else {
    const indexesU8 = new Uint8Array(indexes);

    const digest = interpolate(threshold, indexesU8, shareLength, shares, DIGEST_INDEX);
    const secret = interpolate(threshold, indexesU8, shareLength, shares, SECRET_INDEX);
    const verify = createDigest(digest.subarray(4), secret);

    let valid = true;
    for (let i = 0; i < 4; i++) {
      valid = valid && digest[i] === verify[i];
    }

    memzero(digest);
    memzero(verify);

    if (!valid) {
      throw new ShamirError(ShamirErrorType.ChecksumFailure);
    }

    return secret;
  }
}
