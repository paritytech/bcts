/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Predicate/Object arguments module - 1:1 port of pred_obj_args.rs
 *
 * Handles predicate and object arguments for assertions.
 */

import { Envelope } from "@bcts/envelope";
import { type DataType, parseDataTypeToEnvelope } from "./data-types.js";

/**
 * Interface for arguments that include a predicate and object.
 */
export interface PredObjArgsLike {
  /** Predicate type */
  predType: DataType;
  /** Predicate value */
  predValue: string;
  /** Object type */
  objType: DataType;
  /** Object value */
  objValue: string;
  /** Optional integer tag for the predicate provided as an enclosed UR */
  predTag?: number | bigint;
  /** Optional integer tag for the object provided as an enclosed UR */
  objTag?: number | bigint;
}

/**
 * Create an assertion envelope from predicate/object arguments.
 */
export function assertionEnvelope(args: PredObjArgsLike): Envelope {
  const predicate = parseDataTypeToEnvelope(args.predType, args.predValue, args.predTag);
  const object = parseDataTypeToEnvelope(args.objType, args.objValue, args.objTag);
  return Envelope.newAssertion(predicate, object);
}

/**
 * Predicate/Object arguments structure.
 */
export interface PredObjArgs extends PredObjArgsLike {
  /** Predicate type */
  predType: DataType;
  /** Predicate value */
  predValue: string;
  /** Object type */
  objType: DataType;
  /** Object value */
  objValue: string;
  /** The integer tag for the predicate provided as an enclosed UR */
  predTag?: number | bigint;
  /** The integer tag for the object provided as an enclosed UR */
  objTag?: number | bigint;
}
