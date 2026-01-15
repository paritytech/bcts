/**
 * Mainline DHT-specific errors.
 *
 * Port of mainline/error.rs from hubert-rust.
 *
 * @module
 */

import { HubertError } from "../error.js";

/**
 * Base class for Mainline DHT-specific errors.
 *
 * @category Mainline
 */
export class MainlineError extends HubertError {
  constructor(message: string) {
    super(message);
    this.name = "MainlineError";
  }
}

/**
 * Value size exceeds DHT limit.
 *
 * Port of `Error::ValueTooLarge { size }` from mainline/error.rs line 4-5.
 *
 * @category Mainline
 */
export class ValueTooLargeError extends MainlineError {
  readonly size: number;

  constructor(size: number) {
    super(`Value size ${size} exceeds DHT limit of 1000 bytes`);
    this.name = "ValueTooLargeError";
    this.size = size;
  }
}

/**
 * DHT operation error.
 *
 * Port of `Error::DhtError` from mainline/error.rs line 7-8.
 *
 * @category Mainline
 */
export class DhtError extends MainlineError {
  constructor(message: string) {
    super(`DHT operation error: ${message}`);
    this.name = "DhtError";
  }
}

/**
 * Put query error.
 *
 * Port of `Error::PutQueryError` from mainline/error.rs line 10-11.
 *
 * @category Mainline
 */
export class PutQueryError extends MainlineError {
  constructor(message: string) {
    super(`Put query error: ${message}`);
    this.name = "PutQueryError";
  }
}

/**
 * Decode ID error.
 *
 * Port of `Error::DecodeIdError` from mainline/error.rs line 13-14.
 *
 * @category Mainline
 */
export class DecodeIdError extends MainlineError {
  constructor(message: string) {
    super(`Decode ID error: ${message}`);
    this.name = "DecodeIdError";
  }
}

/**
 * Put mutable error.
 *
 * Port of `Error::PutMutableError` from mainline/error.rs line 16-17.
 *
 * @category Mainline
 */
export class PutMutableError extends MainlineError {
  constructor(message: string) {
    super(`Put mutable error: ${message}`);
    this.name = "PutMutableError";
  }
}

/**
 * I/O error.
 *
 * Port of `Error::Io` from mainline/error.rs line 19-20.
 *
 * @category Mainline
 */
export class MainlineIoError extends MainlineError {
  constructor(message: string) {
    super(`IO error: ${message}`);
    this.name = "MainlineIoError";
  }
}
