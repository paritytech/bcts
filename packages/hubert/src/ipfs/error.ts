/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * IPFS-specific errors.
 *
 * Port of ipfs/error.rs from hubert-rust.
 *
 * @module
 */

import { HubertError } from "../error.js";

/**
 * Base class for IPFS-specific errors.
 *
 * @category IPFS
 */
export class IpfsError extends HubertError {
  constructor(message: string) {
    super(message);
    this.name = "IpfsError";
  }
}

/**
 * Envelope size exceeds practical limit.
 *
 * Port of `Error::EnvelopeTooLarge { size }` from ipfs/error.rs line 5.
 *
 * @category IPFS
 */
export class EnvelopeTooLargeError extends IpfsError {
  readonly size: number;

  constructor(size: number) {
    super(`Envelope size ${size} exceeds practical limit`);
    this.name = "EnvelopeTooLargeError";
    this.size = size;
  }
}

/**
 * IPFS daemon error.
 *
 * Port of `Error::DaemonError` from ipfs/error.rs line 8.
 *
 * @category IPFS
 */
export class IpfsDaemonError extends IpfsError {
  constructor(message: string) {
    super(`IPFS daemon error: ${message}`);
    this.name = "IpfsDaemonError";
  }
}

/**
 * Operation timed out.
 *
 * Port of `Error::Timeout` from ipfs/error.rs line 11.
 *
 * @category IPFS
 */
export class IpfsTimeoutError extends IpfsError {
  constructor() {
    super("Operation timed out");
    this.name = "IpfsTimeoutError";
  }
}

/**
 * Unexpected IPNS path format.
 *
 * Port of `Error::UnexpectedIpnsPathFormat` from ipfs/error.rs line 14.
 *
 * @category IPFS
 */
export class UnexpectedIpnsPathFormatError extends IpfsError {
  readonly path: string;

  constructor(path: string) {
    super(`Unexpected IPNS path format: ${path}`);
    this.name = "UnexpectedIpnsPathFormatError";
    this.path = path;
  }
}
