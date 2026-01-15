/**
 * Server-specific error types.
 *
 * Port of server/error.rs from hubert-rust.
 *
 * @module
 */

import { HubertError } from "../error.js";

/**
 * Base error class for server errors.
 *
 * @category Server Errors
 */
export class ServerError extends HubertError {
  constructor(message: string) {
    super(message);
    this.name = "ServerError";
  }
}

/**
 * General server error.
 *
 * Port of `Error::General(String)` from server/error.rs line 4.
 *
 * @category Server Errors
 */
export class ServerGeneralError extends ServerError {
  constructor(message: string) {
    super(`Server error: ${message}`);
    this.name = "ServerGeneralError";
  }
}

/**
 * Network error during server communication.
 *
 * Port of `Error::NetworkError(String)` from server/error.rs line 7.
 *
 * @category Server Errors
 */
export class ServerNetworkError extends ServerError {
  constructor(message: string) {
    super(`Network error: ${message}`);
    this.name = "ServerNetworkError";
  }
}

/**
 * Parse error during data handling.
 *
 * Port of `Error::ParseError(String)` from server/error.rs line 10.
 *
 * @category Server Errors
 */
export class ServerParseError extends ServerError {
  constructor(message: string) {
    super(`Parse error: ${message}`);
    this.name = "ServerParseError";
  }
}

/**
 * SQLite database error.
 *
 * Port of `Error::Sqlite(e)` from server/error.rs line 19.
 *
 * @category Server Errors
 */
export class SqliteError extends ServerError {
  /** The underlying error */
  override readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(`SQLite error: ${message}`);
    this.name = "SqliteError";
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}
