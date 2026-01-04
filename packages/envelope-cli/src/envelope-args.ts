/**
 * Envelope arguments module - 1:1 port of envelope_args.rs
 *
 * Handles envelope input from command line or stdin.
 */

import { Envelope } from "@bcts/envelope";
import { readEnvelope } from "./utils.js";

/**
 * Interface for arguments that include an envelope.
 */
export interface EnvelopeArgsLike {
  /** The envelope UR string, or undefined to read from stdin */
  envelope?: string;
}

/**
 * Read an envelope from the args or stdin.
 */
export function readEnvelopeFromArgs(args: EnvelopeArgsLike): Envelope {
  return readEnvelope(args.envelope);
}

/**
 * Envelope arguments structure.
 * The envelope can be provided on the command line or read from stdin.
 */
export interface EnvelopeArgs extends EnvelopeArgsLike {
  /**
   * The envelope to process.
   * If not supplied on the command line, it is read from stdin.
   */
  envelope?: string;
}
