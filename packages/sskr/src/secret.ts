// Ported from bc-sskr-rust/src/secret.rs

import { MIN_SECRET_LEN, MAX_SECRET_LEN } from "./index.js";
import { SSKRError, SSKRErrorType } from "./error.js";

/**
 * A secret to be split into shares.
 */
export class Secret {
  private readonly data: Uint8Array;

  private constructor(data: Uint8Array) {
    this.data = data;
  }

  /**
   * Creates a new Secret instance with the given data.
   *
   * @param data - The secret data to be split into shares.
   * @returns A new Secret instance.
   * @throws SSKRError if the length of the secret is less than
   *   MIN_SECRET_LEN, greater than MAX_SECRET_LEN, or not even.
   */
  static new(data: Uint8Array | string): Secret {
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    const len = bytes.length;

    if (len < MIN_SECRET_LEN) {
      throw new SSKRError(SSKRErrorType.SecretTooShort);
    }
    if (len > MAX_SECRET_LEN) {
      throw new SSKRError(SSKRErrorType.SecretTooLong);
    }
    if ((len & 1) !== 0) {
      throw new SSKRError(SSKRErrorType.SecretLengthNotEven);
    }

    return new Secret(new Uint8Array(bytes));
  }

  /**
   * Returns the length of the secret.
   */
  len(): number {
    return this.data.length;
  }

  /**
   * Returns true if the secret is empty.
   */
  isEmpty(): boolean {
    return this.len() === 0;
  }

  /**
   * Returns a reference to the secret data.
   */
  getData(): Uint8Array {
    return this.data;
  }

  /**
   * Returns the secret data as a Uint8Array.
   */
  asRef(): Uint8Array {
    return this.data;
  }

  /**
   * Check equality with another Secret.
   */
  equals(other: Secret): boolean {
    if (this.data.length !== other.data.length) {
      return false;
    }
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i] !== other.data[i]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Clone the secret.
   */
  clone(): Secret {
    return new Secret(new Uint8Array(this.data));
  }
}
