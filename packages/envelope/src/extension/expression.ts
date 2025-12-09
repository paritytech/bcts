import { Envelope } from "../base/envelope";
import { type EnvelopeEncodableValue } from "../base/envelope-encodable";
import { EnvelopeError } from "../base/error";

/// Extension for envelope expressions.
///
/// This module implements the Gordian Envelope expression syntax as specified
/// in BCR-2023-012. Expressions enable encoding of machine-evaluatable
/// expressions using envelopes, providing a foundation for distributed
/// function calls and computation.
///
/// ## Expression Structure
///
/// An expression consists of:
/// - A function identifier (the subject)
/// - Zero or more parameters (as assertions)
/// - Optional metadata (non-parameter assertions)
///
/// ## CBOR Tags
///
/// - Function: #6.40006
/// - Parameter: #6.40007
/// - Placeholder: #6.40008
/// - Replacement: #6.40009
///
/// @example
/// ```typescript
/// // Create a simple addition expression: add(lhs: 2, rhs: 3)
/// const expr = new Function('add')
///   .withParameter('lhs', 2)
///   .withParameter('rhs', 3);
///
/// const envelope = expr.envelope();
/// ```

/// CBOR tag for function identifiers
export const CBOR_TAG_FUNCTION = 40006;

/// CBOR tag for parameter identifiers
export const CBOR_TAG_PARAMETER = 40007;

/// CBOR tag for placeholder identifiers
export const CBOR_TAG_PLACEHOLDER = 40008;

/// CBOR tag for replacement identifiers
export const CBOR_TAG_REPLACEMENT = 40009;

/// Well-known function identifiers (numeric)
export const FUNCTION_IDS = {
  ADD: 1, // addition
  SUB: 2, // subtraction
  MUL: 3, // multiplication
  DIV: 4, // division
  NEG: 5, // unary negation
  LT: 6, // less than
  LE: 7, // less than or equal
  GT: 8, // greater than
  GE: 9, // greater than or equal
  EQ: 10, // equal to
  NE: 11, // not equal to
  AND: 12, // logical and
  OR: 13, // logical or
  XOR: 14, // logical xor
  NOT: 15, // logical not
} as const;

/// Well-known parameter identifiers (numeric)
export const PARAMETER_IDS = {
  BLANK: 1, // blank/implicit parameter (_)
  LHS: 2, // left-hand side
  RHS: 3, // right-hand side
} as const;

/// Type for function identifier (number or string)
export type FunctionID = number | string;

/// Type for parameter identifier (number or string)
export type ParameterID = number | string;

/// Represents a function identifier in an expression
export class Function {
  readonly #id: FunctionID;

  constructor(id: FunctionID) {
    this.#id = id;
  }

  /// Returns the function identifier
  id(): FunctionID {
    return this.#id;
  }

  /// Returns true if this is a numeric function ID
  isNumeric(): boolean {
    return typeof this.#id === "number";
  }

  /// Returns true if this is a string function ID
  isString(): boolean {
    return typeof this.#id === "string";
  }

  /// Creates an expression envelope with this function as the subject
  envelope(): Envelope {
    // For now, create a simple envelope with the function ID
    // In a full implementation, this would use CBOR tag 40006
    const functionStr = typeof this.#id === "number" ? `«${this.#id}»` : `«"${this.#id}"»`;
    return Envelope.new(functionStr);
  }

  /// Creates an expression with a parameter
  withParameter(param: ParameterID, value: EnvelopeEncodableValue): Expression {
    const expr = new Expression(this);
    return expr.withParameter(param, value);
  }

  /// Creates a function from a known numeric ID
  static fromNumeric(id: number): Function {
    return new Function(id);
  }

  /// Creates a function from a string name
  static fromString(name: string): Function {
    return new Function(name);
  }

  /// Returns a string representation for display
  toString(): string {
    return typeof this.#id === "number" ? `«${this.#id}»` : `«"${this.#id}"»`;
  }
}

/// Represents a parameter in an expression
export class Parameter {
  readonly #id: ParameterID;
  readonly #value: Envelope;

  constructor(id: ParameterID, value: Envelope) {
    this.#id = id;
    this.#value = value;
  }

  /// Returns the parameter identifier
  id(): ParameterID {
    return this.#id;
  }

  /// Returns the parameter value as an envelope
  value(): Envelope {
    return this.#value;
  }

  /// Returns true if this is a numeric parameter ID
  isNumeric(): boolean {
    return typeof this.#id === "number";
  }

  /// Returns true if this is a string parameter ID
  isString(): boolean {
    return typeof this.#id === "string";
  }

  /// Creates a parameter envelope
  /// In a full implementation, this would use CBOR tag 40007
  envelope(): Envelope {
    const paramStr = typeof this.#id === "number" ? `❰${this.#id}❱` : `❰"${this.#id}"❱`;
    return Envelope.newAssertion(paramStr, this.#value);
  }

  /// Creates a parameter from known IDs
  static blank(value: EnvelopeEncodableValue): Parameter {
    return new Parameter(PARAMETER_IDS.BLANK, Envelope.new(value));
  }

  static lhs(value: EnvelopeEncodableValue): Parameter {
    return new Parameter(PARAMETER_IDS.LHS, Envelope.new(value));
  }

  static rhs(value: EnvelopeEncodableValue): Parameter {
    return new Parameter(PARAMETER_IDS.RHS, Envelope.new(value));
  }

  /// Returns a string representation for display
  toString(): string {
    const idStr = typeof this.#id === "number" ? `❰${this.#id}❱` : `❰"${this.#id}"❱`;
    return `${idStr}: ${this.#value.asText()}`;
  }
}

/// Represents a complete expression with function and parameters
export class Expression {
  readonly #function: Function;
  readonly #parameters = new Map<string, Parameter>();
  #envelope: Envelope | null = null;

  constructor(func: Function) {
    this.#function = func;
  }

  /// Returns the function
  function(): Function {
    return this.#function;
  }

  /// Returns all parameters
  parameters(): Parameter[] {
    return Array.from(this.#parameters.values());
  }

  /// Adds a parameter to the expression
  withParameter(param: ParameterID, value: EnvelopeEncodableValue): Expression {
    const key = typeof param === "number" ? param.toString() : param;
    this.#parameters.set(key, new Parameter(param, Envelope.new(value)));
    this.#envelope = null; // Invalidate cached envelope
    return this;
  }

  /// Adds multiple parameters at once
  withParameters(params: Record<string, EnvelopeEncodableValue>): Expression {
    for (const [key, value] of Object.entries(params)) {
      this.withParameter(key, value);
    }
    return this;
  }

  /// Gets a parameter value by ID
  getParameter(param: ParameterID): Envelope | undefined {
    const key = typeof param === "number" ? param.toString() : param;
    return this.#parameters.get(key)?.value();
  }

  /// Checks if a parameter exists
  hasParameter(param: ParameterID): boolean {
    const key = typeof param === "number" ? param.toString() : param;
    return this.#parameters.has(key);
  }

  /// Converts the expression to an envelope
  envelope(): Envelope {
    if (this.#envelope !== null) {
      return this.#envelope;
    }

    // Start with function envelope
    let env = this.#function.envelope();

    // Add all parameters as assertions
    for (const param of this.#parameters.values()) {
      const paramEnv = param.envelope();
      // Extract the assertion from the parameter envelope
      const assertion = paramEnv.assertions()[0];
      if (assertion !== undefined) {
        const predicate = assertion.subject().asPredicate();
        const object = assertion.subject().asObject();
        if (predicate !== undefined && object !== undefined) {
          env = env.addAssertion(predicate.asText(), object);
        }
      }
    }

    this.#envelope = env;
    return env;
  }

  /// Creates an expression from an envelope
  /// Note: This is a simplified implementation
  static fromEnvelope(envelope: Envelope): Expression {
    // Extract function from subject
    const subject = envelope.subject();
    const subjectText = subject.asText();
    if (subjectText === undefined) {
      throw EnvelopeError.general("Not a valid function envelope");
    }

    // Parse function identifier
    let funcId: FunctionID;
    if (subjectText.startsWith("«") && subjectText.endsWith("»")) {
      const inner = subjectText.slice(1, -1);
      if (inner.startsWith('"') && inner.endsWith('"')) {
        funcId = inner.slice(1, -1); // String function
      } else {
        funcId = parseInt(inner, 10); // Numeric function
      }
    } else {
      throw EnvelopeError.general("Not a valid function envelope");
    }

    const func = new Function(funcId);
    const expr = new Expression(func);

    // Extract parameters from assertions
    for (const assertion of envelope.assertions()) {
      try {
        const pred = assertion.subject().asPredicate();
        const obj = assertion.subject().asObject();

        if (pred !== undefined && obj !== undefined) {
          const predText = pred.asText();
          if (predText !== undefined && predText.startsWith("❰") && predText.endsWith("❱")) {
            const inner = predText.slice(1, -1);
            let paramId: ParameterID;
            if (inner.startsWith('"') && inner.endsWith('"')) {
              paramId = inner.slice(1, -1);
            } else {
              paramId = parseInt(inner, 10);
            }
            expr.withParameter(paramId, obj);
          }
        }
      } catch {
        // Skip non-parameter assertions
        continue;
      }
    }

    return expr;
  }

  /// Returns a string representation for display
  toString(): string {
    const params = Array.from(this.#parameters.values())
      .map((p) => p.toString())
      .join(", ");
    return `${this.#function.toString()} [${params}]`;
  }
}

/// Helper functions for creating common expressions

/// Creates an addition expression: lhs + rhs
export function add(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression {
  return Function.fromNumeric(FUNCTION_IDS.ADD)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/// Creates a subtraction expression: lhs - rhs
export function sub(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression {
  return Function.fromNumeric(FUNCTION_IDS.SUB)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/// Creates a multiplication expression: lhs * rhs
export function mul(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression {
  return Function.fromNumeric(FUNCTION_IDS.MUL)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/// Creates a division expression: lhs / rhs
export function div(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression {
  return Function.fromNumeric(FUNCTION_IDS.DIV)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/// Creates a negation expression: -value
export function neg(value: EnvelopeEncodableValue): Expression {
  return Function.fromNumeric(FUNCTION_IDS.NEG).withParameter(PARAMETER_IDS.BLANK, value);
}

/// Creates a less-than expression: lhs < rhs
export function lt(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression {
  return Function.fromNumeric(FUNCTION_IDS.LT)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/// Creates a greater-than expression: lhs > rhs
export function gt(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression {
  return Function.fromNumeric(FUNCTION_IDS.GT)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/// Creates an equality expression: lhs == rhs
export function eq(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression {
  return Function.fromNumeric(FUNCTION_IDS.EQ)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/// Creates a logical AND expression: lhs && rhs
export function and(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression {
  return Function.fromNumeric(FUNCTION_IDS.AND)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/// Creates a logical OR expression: lhs || rhs
export function or(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression {
  return Function.fromNumeric(FUNCTION_IDS.OR)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/// Creates a logical NOT expression: !value
export function not(value: EnvelopeEncodableValue): Expression {
  return Function.fromNumeric(FUNCTION_IDS.NOT).withParameter(PARAMETER_IDS.BLANK, value);
}

// Export types and classes
export {};
