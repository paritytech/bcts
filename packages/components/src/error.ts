/**
 * Error types re-exported from @blockchain-commons/crypto
 * with additional factory methods for components
 */

import { CryptoError as BaseCryptoError } from "@blockchain-commons/crypto";

export class CryptoError extends BaseCryptoError {
  static invalidSize(expected: number, actual: number): CryptoError {
    return new CryptoError(`Invalid size: expected ${expected}, got ${actual}`);
  }

  static invalidFormat(message: string): CryptoError {
    return new CryptoError(`Invalid format: ${message}`);
  }

  static cryptoOperation(message: string): CryptoError {
    return new CryptoError(`Crypto operation failed: ${message}`);
  }

  static invalidInput(message: string): CryptoError {
    return new CryptoError(`Invalid input: ${message}`);
  }
}

export type Result<T> = T | Error;

export function isError(result: unknown): result is Error {
  return result instanceof Error;
}
