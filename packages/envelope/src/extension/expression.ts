/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

import { Envelope } from "../base/envelope";
import { type EnvelopeEncodable, type EnvelopeEncodableValue } from "../base/envelope-encodable";
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

//------------------------------------------------------------------------------
// Function class - matches Rust's Function enum
//------------------------------------------------------------------------------

/// Type tag for function variant
type FunctionVariant = "known" | "named";

/// Represents a function identifier in an expression.
///
/// In Gordian Envelope, a function appears as the subject of an expression
/// envelope, with its parameters as assertions on that envelope.
///
/// Functions can be identified in two ways:
/// 1. By a numeric ID (for well-known functions) - Known variant
/// 2. By a string name (for application-specific functions) - Named variant
///
/// When encoded in CBOR, functions are tagged with #6.40006.
export class Function implements EnvelopeEncodable {
  private readonly _variant: FunctionVariant;
  private readonly _value: number; // Only used for 'known' variant
  private readonly _name: string | undefined;

  private constructor(variant: FunctionVariant, value: number, name?: string) {
    this._variant = variant;
    this._value = value;
    this._name = name;
  }

  /// Creates a new known function with a numeric ID and optional name.
  static newKnown(value: number, name?: string): Function {
    return new Function("known", value, name);
  }

  /// Creates a new named function identified by a string.
  static newNamed(name: string): Function {
    return new Function("named", 0, name);
  }

  /// Creates a function from a numeric ID (convenience method).
  static fromNumeric(id: number): Function {
    return Function.newKnown(id);
  }

  /// Creates a function from a string name (convenience method).
  static fromString(name: string): Function {
    return Function.newNamed(name);
  }

  /// Returns true if this is a known (numeric) function.
  isKnown(): boolean {
    return this._variant === "known";
  }

  /// Returns true if this is a named (string) function.
  isNamed(): boolean {
    return this._variant === "named";
  }

  /// Returns the numeric value for known functions.
  value(): number | undefined {
    return this._variant === "known" ? this._value : undefined;
  }

  /// Returns the function identifier (number for known, string for named).
  id(): FunctionID {
    if (this._variant === "known") {
      return this._value;
    }
    // For named variant, name is always set during construction
    if (this._name === undefined) {
      throw new Error("Invalid named function: missing name");
    }
    return this._name;
  }

  /// Returns the display name of the function.
  ///
  /// For known functions with a name, returns the name.
  /// For known functions without a name, returns the numeric ID as a string.
  /// For named functions, returns the name enclosed in quotes.
  name(): string {
    if (this._variant === "known") {
      return this._name ?? this._value.toString();
    } else {
      return `"${this._name}"`;
    }
  }

  /// Returns the raw name for named functions, or undefined for known functions.
  namedName(): string | undefined {
    return this._variant === "named" ? this._name : undefined;
  }

  /// Returns the assigned name if present (for known functions only).
  assignedName(): string | undefined {
    return this._variant === "known" ? this._name : undefined;
  }

  /// Returns true if this is a numeric function ID (legacy compatibility).
  isNumeric(): boolean {
    return this._variant === "known";
  }

  /// Returns true if this is a string function ID (legacy compatibility).
  isString(): boolean {
    return this._variant === "named";
  }

  /// Creates an expression envelope with this function as the subject.
  envelope(): Envelope {
    const functionStr = this._variant === "known" ? `«${this._value}»` : `«"${this._name}"»`;
    return Envelope.new(functionStr);
  }

  /// Converts this function into an envelope (EnvelopeEncodable implementation).
  intoEnvelope(): Envelope {
    return this.envelope();
  }

  /// Creates an expression with a parameter.
  withParameter(param: ParameterID, value: EnvelopeEncodableValue): Expression {
    const expr = new Expression(this);
    return expr.withParameter(param, value);
  }

  /// Checks equality based on value (for known) or name (for named).
  equals(other: Function): boolean {
    if (this._variant !== other._variant) return false;
    if (this._variant === "known") {
      return this._value === other._value;
    } else {
      return this._name === other._name;
    }
  }

  /// Returns a hash code for this function.
  hashCode(): number {
    if (this._variant === "known") {
      return this._value;
    } else {
      // Simple string hash
      let hash = 0;
      for (let i = 0; i < (this._name?.length ?? 0); i++) {
        hash = (hash * 31 + (this._name?.charCodeAt(i) ?? 0)) | 0;
      }
      return hash;
    }
  }

  /// Returns a string representation for display.
  toString(): string {
    return this._variant === "known" ? `«${this._value}»` : `«"${this._name}"»`;
  }
}

//------------------------------------------------------------------------------
// FunctionsStore class - matches Rust's FunctionsStore
//------------------------------------------------------------------------------

/// A store that maps functions to their assigned names.
///
/// FunctionsStore maintains a registry of functions and their human-readable
/// names, which is useful for displaying and debugging expression functions.
export class FunctionsStore {
  private readonly _dict = new Map<number | string, Function>();

  /// Creates a new FunctionsStore with the given functions.
  constructor(functions: Iterable<Function> = []) {
    for (const func of functions) {
      this.insert(func);
    }
  }

  /// Inserts a function into the store.
  insert(func: Function): void {
    if (func.isKnown()) {
      const value = func.value();
      if (value !== undefined) {
        this._dict.set(value, func);
      }
    } else {
      const name = func.namedName();
      if (name !== undefined) {
        this._dict.set(name, func);
      }
    }
  }

  /// Returns the assigned name for a function, if it exists in the store.
  assignedName(func: Function): string | undefined {
    let key: number | string | undefined;
    if (func.isKnown()) {
      key = func.value();
    } else {
      key = func.namedName();
    }
    if (key === undefined) return undefined;
    const stored = this._dict.get(key);
    return stored?.assignedName();
  }

  /// Returns the name for a function, either from this store or from the function itself.
  name(func: Function): string {
    const assigned = this.assignedName(func);
    return assigned ?? func.name();
  }

  /// Static method that returns the name of a function, using an optional store.
  static nameForFunction(func: Function, store?: FunctionsStore): string {
    if (store !== undefined) {
      const assigned = store.assignedName(func);
      if (assigned !== undefined && assigned !== "") return assigned;
    }
    return func.name();
  }
}

//------------------------------------------------------------------------------
// Parameter class - matches Rust's Parameter enum
//------------------------------------------------------------------------------

/// Type tag for parameter variant
type ParameterVariant = "known" | "named";

/// Represents a parameter identifier in an expression.
///
/// In Gordian Envelope, a parameter appears as a predicate in an assertion on
/// an expression envelope. The parameter identifies the name of the argument,
/// and the object of the assertion is the argument value.
///
/// Parameters can be identified in two ways:
/// 1. By a numeric ID (for well-known parameters) - Known variant
/// 2. By a string name (for application-specific parameters) - Named variant
///
/// When encoded in CBOR, parameters are tagged with #6.40007.
export class Parameter implements EnvelopeEncodable {
  private readonly _variant: ParameterVariant;
  private readonly _value: number; // Only used for 'known' variant, or 0 for 'named'
  private readonly _name: string | undefined;
  private readonly _paramValue: Envelope | undefined; // The parameter's value envelope

  private constructor(
    variant: ParameterVariant,
    value: number,
    name?: string,
    paramValue?: Envelope,
  ) {
    this._variant = variant;
    this._value = value;
    this._name = name;
    this._paramValue = paramValue;
  }

  /// Creates a new known parameter with a numeric ID and optional name.
  static newKnown(value: number, name?: string): Parameter {
    return new Parameter("known", value, name);
  }

  /// Creates a new named parameter identified by a string.
  static newNamed(name: string): Parameter {
    return new Parameter("named", 0, name);
  }

  /// Creates a parameter with a value envelope (internal use).
  static withValue(id: ParameterID, value: Envelope): Parameter {
    if (typeof id === "number") {
      return new Parameter("known", id, undefined, value);
    } else {
      return new Parameter("named", 0, id, value);
    }
  }

  /// Returns true if this is a known (numeric) parameter.
  isKnown(): boolean {
    return this._variant === "known";
  }

  /// Returns true if this is a named (string) parameter.
  isNamed(): boolean {
    return this._variant === "named";
  }

  /// Returns the numeric value for known parameters.
  value(): number | undefined {
    return this._variant === "known" ? this._value : undefined;
  }

  /// Returns the parameter identifier (number for known, string for named).
  id(): ParameterID {
    if (this._variant === "known") {
      return this._value;
    }
    // For named variant, name is always set during construction
    if (this._name === undefined) {
      throw new Error("Invalid named parameter: missing name");
    }
    return this._name;
  }

  /// Returns the display name of the parameter.
  ///
  /// For known parameters with a name, returns the name.
  /// For known parameters without a name, returns the numeric ID as a string.
  /// For named parameters, returns the name enclosed in quotes.
  name(): string {
    if (this._variant === "known") {
      return this._name ?? this._value.toString();
    } else {
      return `"${this._name}"`;
    }
  }

  /// Returns the raw name for named parameters, or undefined for known parameters.
  namedName(): string | undefined {
    return this._variant === "named" ? this._name : undefined;
  }

  /// Returns the assigned name if present (for known parameters only).
  assignedName(): string | undefined {
    return this._variant === "known" ? this._name : undefined;
  }

  /// Returns the parameter value as an envelope, if set.
  paramValue(): Envelope | undefined {
    return this._paramValue;
  }

  /// Returns true if this is a numeric parameter ID (legacy compatibility).
  isNumeric(): boolean {
    return this._variant === "known";
  }

  /// Returns true if this is a string parameter ID (legacy compatibility).
  isString(): boolean {
    return this._variant === "named";
  }

  /// Creates a parameter envelope.
  envelope(): Envelope {
    const paramStr = this._variant === "known" ? `❰${this._value}❱` : `❰"${this._name}"❱`;
    if (this._paramValue !== undefined) {
      return Envelope.newAssertion(paramStr, this._paramValue);
    }
    return Envelope.new(paramStr);
  }

  /// Converts this parameter into an envelope (EnvelopeEncodable implementation).
  intoEnvelope(): Envelope {
    return this.envelope();
  }

  /// Checks equality based on value (for known) or name (for named).
  equals(other: Parameter): boolean {
    if (this._variant !== other._variant) return false;
    if (this._variant === "known") {
      return this._value === other._value;
    } else {
      return this._name === other._name;
    }
  }

  /// Returns a hash code for this parameter.
  hashCode(): number {
    if (this._variant === "known") {
      return this._value;
    } else {
      let hash = 0;
      for (let i = 0; i < (this._name?.length ?? 0); i++) {
        hash = (hash * 31 + (this._name?.charCodeAt(i) ?? 0)) | 0;
      }
      return hash;
    }
  }

  /// Returns a string representation for display.
  toString(): string {
    const idStr = this._variant === "known" ? `❰${this._value}❱` : `❰"${this._name}"❱`;
    if (this._paramValue !== undefined) {
      return `${idStr}: ${this._paramValue.asText()}`;
    }
    return idStr;
  }

  // Convenience static methods for standard parameters
  static blank(value: EnvelopeEncodableValue): Parameter {
    return Parameter.withValue(PARAMETER_IDS.BLANK, Envelope.new(value));
  }

  static lhs(value: EnvelopeEncodableValue): Parameter {
    return Parameter.withValue(PARAMETER_IDS.LHS, Envelope.new(value));
  }

  static rhs(value: EnvelopeEncodableValue): Parameter {
    return Parameter.withValue(PARAMETER_IDS.RHS, Envelope.new(value));
  }
}

//------------------------------------------------------------------------------
// ParametersStore class - matches Rust's ParametersStore
//------------------------------------------------------------------------------

/// A store that maps parameters to their assigned names.
///
/// ParametersStore maintains a registry of parameters and their human-readable
/// names, which is useful for displaying and debugging expression parameters.
export class ParametersStore {
  private readonly _dict = new Map<number | string, Parameter>();

  /// Creates a new ParametersStore with the given parameters.
  constructor(parameters: Iterable<Parameter> = []) {
    for (const param of parameters) {
      this.insert(param);
    }
  }

  /// Inserts a parameter into the store.
  insert(param: Parameter): void {
    if (param.isKnown()) {
      const value = param.value();
      if (value !== undefined) {
        this._dict.set(value, param);
      }
    } else {
      const name = param.namedName();
      if (name !== undefined) {
        this._dict.set(name, param);
      }
    }
  }

  /// Returns the assigned name for a parameter, if it exists in the store.
  assignedName(param: Parameter): string | undefined {
    let key: number | string | undefined;
    if (param.isKnown()) {
      key = param.value();
    } else {
      key = param.namedName();
    }
    if (key === undefined) return undefined;
    const stored = this._dict.get(key);
    return stored?.assignedName();
  }

  /// Returns the name for a parameter, either from this store or from the parameter itself.
  name(param: Parameter): string {
    const assigned = this.assignedName(param);
    return assigned ?? param.name();
  }

  /// Static method that returns the name of a parameter, using an optional store.
  static nameForParameter(param: Parameter, store?: ParametersStore): string {
    if (store !== undefined) {
      const assigned = store.assignedName(param);
      if (assigned !== undefined && assigned !== "") return assigned;
    }
    return param.name();
  }
}

//------------------------------------------------------------------------------
// Well-known function constants (matching Rust's function_constant! macro)
//------------------------------------------------------------------------------

/// Standard arithmetic and logical functions
export const ADD = Function.newKnown(FUNCTION_IDS.ADD, "add");
export const SUB = Function.newKnown(FUNCTION_IDS.SUB, "sub");
export const MUL = Function.newKnown(FUNCTION_IDS.MUL, "mul");
export const DIV = Function.newKnown(FUNCTION_IDS.DIV, "div");
export const NEG = Function.newKnown(FUNCTION_IDS.NEG, "neg");
export const LT = Function.newKnown(FUNCTION_IDS.LT, "lt");
export const LE = Function.newKnown(FUNCTION_IDS.LE, "le");
export const GT = Function.newKnown(FUNCTION_IDS.GT, "gt");
export const GE = Function.newKnown(FUNCTION_IDS.GE, "ge");
export const EQ = Function.newKnown(FUNCTION_IDS.EQ, "eq");
export const NE = Function.newKnown(FUNCTION_IDS.NE, "ne");
export const AND = Function.newKnown(FUNCTION_IDS.AND, "and");
export const OR = Function.newKnown(FUNCTION_IDS.OR, "or");
export const XOR = Function.newKnown(FUNCTION_IDS.XOR, "xor");
export const NOT = Function.newKnown(FUNCTION_IDS.NOT, "not");

/// Raw value constants (matching Rust's _VALUE suffix constants)
export const ADD_VALUE = FUNCTION_IDS.ADD;
export const SUB_VALUE = FUNCTION_IDS.SUB;
export const MUL_VALUE = FUNCTION_IDS.MUL;
export const DIV_VALUE = FUNCTION_IDS.DIV;
export const NEG_VALUE = FUNCTION_IDS.NEG;
export const LT_VALUE = FUNCTION_IDS.LT;
export const LE_VALUE = FUNCTION_IDS.LE;
export const GT_VALUE = FUNCTION_IDS.GT;
export const GE_VALUE = FUNCTION_IDS.GE;
export const EQ_VALUE = FUNCTION_IDS.EQ;
export const NE_VALUE = FUNCTION_IDS.NE;
export const AND_VALUE = FUNCTION_IDS.AND;
export const OR_VALUE = FUNCTION_IDS.OR;
export const XOR_VALUE = FUNCTION_IDS.XOR;
export const NOT_VALUE = FUNCTION_IDS.NOT;

//------------------------------------------------------------------------------
// Well-known parameter constants (matching Rust's parameter_constant! macro)
//------------------------------------------------------------------------------

/// Standard parameters
export const BLANK = Parameter.newKnown(PARAMETER_IDS.BLANK, "_");
export const LHS = Parameter.newKnown(PARAMETER_IDS.LHS, "lhs");
export const RHS = Parameter.newKnown(PARAMETER_IDS.RHS, "rhs");

/// Raw value constants
export const BLANK_VALUE = PARAMETER_IDS.BLANK;
export const LHS_VALUE = PARAMETER_IDS.LHS;
export const RHS_VALUE = PARAMETER_IDS.RHS;

//------------------------------------------------------------------------------
// Global stores (matching Rust's GLOBAL_FUNCTIONS and GLOBAL_PARAMETERS)
//------------------------------------------------------------------------------

/// Lazy initialization helper for global stores
export class LazyStore<T> {
  private _store: T | undefined;
  private readonly _initializer: () => T;

  constructor(initializer: () => T) {
    this._initializer = initializer;
  }

  get(): T {
    this._store ??= this._initializer();
    return this._store;
  }
}

/// The global shared store of known functions.
export const GLOBAL_FUNCTIONS = new LazyStore(
  () => new FunctionsStore([ADD, SUB, MUL, DIV, NEG, LT, LE, GT, GE, EQ, NE, AND, OR, XOR, NOT]),
);

/// The global shared store of known parameters.
export const GLOBAL_PARAMETERS = new LazyStore(() => new ParametersStore([BLANK, LHS, RHS]));

//------------------------------------------------------------------------------
// Expression class
//------------------------------------------------------------------------------

/// Represents a complete expression with function and parameters.
export class Expression implements EnvelopeEncodable {
  private readonly _function: Function;
  private readonly _parameters = new Map<string, Parameter>();
  private _envelope: Envelope | null = null;

  constructor(func: Function) {
    this._function = func;
  }

  /// Returns the function.
  function(): Function {
    return this._function;
  }

  /// Returns all parameters.
  parameters(): Parameter[] {
    return Array.from(this._parameters.values());
  }

  /// Adds a parameter to the expression.
  withParameter(param: ParameterID, value: EnvelopeEncodableValue): Expression {
    const key = typeof param === "number" ? param.toString() : param;
    this._parameters.set(key, Parameter.withValue(param, Envelope.new(value)));
    this._envelope = null; // Invalidate cached envelope
    return this;
  }

  /// Adds multiple parameters at once.
  withParameters(params: Record<string, EnvelopeEncodableValue>): Expression {
    for (const [key, value] of Object.entries(params)) {
      this.withParameter(key, value);
    }
    return this;
  }

  /// Gets a parameter value by ID.
  getParameter(param: ParameterID): Envelope | undefined {
    const key = typeof param === "number" ? param.toString() : param;
    return this._parameters.get(key)?.paramValue();
  }

  /// Checks if a parameter exists.
  hasParameter(param: ParameterID): boolean {
    const key = typeof param === "number" ? param.toString() : param;
    return this._parameters.has(key);
  }

  /// Converts the expression to an envelope.
  envelope(): Envelope {
    if (this._envelope !== null) {
      return this._envelope;
    }

    // Start with function envelope
    let env = this._function.envelope();

    // Add all parameters as assertions
    for (const param of this._parameters.values()) {
      const paramEnv = param.envelope();
      // The paramEnv is itself an assertion envelope - extract predicate and object directly
      const paramCase = paramEnv.case();
      if (paramCase.type === "assertion") {
        const predicate = paramCase.assertion.predicate();
        const object = paramCase.assertion.object();
        const predText = predicate.asText();
        if (predText !== undefined) {
          env = env.addAssertion(predText, object);
        }
      }
    }

    this._envelope = env;
    return env;
  }

  /// Converts this expression into an envelope (EnvelopeEncodable implementation).
  intoEnvelope(): Envelope {
    return this.envelope();
  }

  /// Creates an expression from an envelope.
  static fromEnvelope(envelope: Envelope): Expression {
    // Extract function from subject
    const subject = envelope.subject();
    const subjectText = subject.asText();
    if (subjectText === undefined) {
      throw EnvelopeError.general("Not a valid function envelope");
    }

    // Parse function identifier
    let func: Function;
    if (subjectText.startsWith("«") && subjectText.endsWith("»")) {
      const inner = subjectText.slice(1, -1);
      if (inner.startsWith('"') && inner.endsWith('"')) {
        func = Function.newNamed(inner.slice(1, -1));
      } else {
        func = Function.newKnown(parseInt(inner, 10));
      }
    } else {
      throw EnvelopeError.general("Not a valid function envelope");
    }

    const expr = new Expression(func);

    // Extract parameters from assertions
    for (const assertion of envelope.assertions()) {
      try {
        const pred = assertion.subject().asPredicate();
        const obj = assertion.asObject();

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

  /// Returns a string representation for display.
  toString(): string {
    const params = Array.from(this._parameters.values())
      .map((p) => p.toString())
      .join(", ");
    return `${this._function.toString()} [${params}]`;
  }
}

//------------------------------------------------------------------------------
// Helper functions for creating common expressions
//------------------------------------------------------------------------------

/// Creates an addition expression: lhs + rhs
export function add(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression {
  return new Expression(ADD)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/// Creates a subtraction expression: lhs - rhs
export function sub(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression {
  return new Expression(SUB)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/// Creates a multiplication expression: lhs * rhs
export function mul(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression {
  return new Expression(MUL)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/// Creates a division expression: lhs / rhs
export function div(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression {
  return new Expression(DIV)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/// Creates a negation expression: -value
export function neg(value: EnvelopeEncodableValue): Expression {
  return new Expression(NEG).withParameter(PARAMETER_IDS.BLANK, value);
}

/// Creates a less-than expression: lhs < rhs
export function lt(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression {
  return new Expression(LT)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/// Creates a less-than-or-equal expression: lhs <= rhs
export function le(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression {
  return new Expression(LE)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/// Creates a greater-than expression: lhs > rhs
export function gt(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression {
  return new Expression(GT)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/// Creates a greater-than-or-equal expression: lhs >= rhs
export function ge(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression {
  return new Expression(GE)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/// Creates an equality expression: lhs == rhs
export function eq(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression {
  return new Expression(EQ)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/// Creates a not-equal expression: lhs != rhs
export function ne(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression {
  return new Expression(NE)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/// Creates a logical AND expression: lhs && rhs
export function and(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression {
  return new Expression(AND)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/// Creates a logical OR expression: lhs || rhs
export function or(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression {
  return new Expression(OR)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/// Creates a logical XOR expression: lhs ^ rhs
export function xor(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression {
  return new Expression(XOR)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/// Creates a logical NOT expression: !value
export function not(value: EnvelopeEncodableValue): Expression {
  return new Expression(NOT).withParameter(PARAMETER_IDS.BLANK, value);
}
