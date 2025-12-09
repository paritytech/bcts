import {
  Envelope,
  Function,
  Parameter,
  Expression,
  FUNCTION_IDS,
  PARAMETER_IDS,
  CBOR_TAG_FUNCTION,
  CBOR_TAG_PARAMETER,
  CBOR_TAG_PLACEHOLDER,
  CBOR_TAG_REPLACEMENT,
  add,
  sub,
  mul,
  div,
  neg,
  lt,
  gt,
  eq,
  and,
  or,
  not,
} from "../src";

describe("Expression (Gordian Envelope Expressions)", () => {
  describe("CBOR Tag Constants", () => {
    it("should have correct tag values", () => {
      expect(CBOR_TAG_FUNCTION).toBe(40006);
      expect(CBOR_TAG_PARAMETER).toBe(40007);
      expect(CBOR_TAG_PLACEHOLDER).toBe(40008);
      expect(CBOR_TAG_REPLACEMENT).toBe(40009);
    });
  });

  describe("Well-known Function IDs", () => {
    it("should have expected function IDs", () => {
      expect(FUNCTION_IDS.ADD).toBeDefined();
      expect(FUNCTION_IDS.SUB).toBeDefined();
      expect(FUNCTION_IDS.MUL).toBeDefined();
      expect(FUNCTION_IDS.EQ).toBeDefined();
      expect(FUNCTION_IDS.AND).toBeDefined();
      expect(FUNCTION_IDS.NOT).toBeDefined();
    });
  });

  describe("Well-known Parameter IDs", () => {
    it("should have expected parameter IDs", () => {
      expect(PARAMETER_IDS.BLANK).toBeDefined();
      expect(PARAMETER_IDS.LHS).toBeDefined();
      expect(PARAMETER_IDS.RHS).toBeDefined();
    });
  });

  describe("Function class - numeric ID", () => {
    it("should create function with numeric ID", () => {
      const addFunc = new Function(FUNCTION_IDS.ADD);

      expect(addFunc.id()).toBe(FUNCTION_IDS.ADD);
      expect(addFunc.isNumeric()).toBe(true);
      expect(addFunc.isString()).toBe(false);
    });
  });

  describe("Function class - string ID", () => {
    it("should create function with string ID", () => {
      const customFunc = Function.fromString("myCustomFunction");

      expect(customFunc.id()).toBe("myCustomFunction");
      expect(customFunc.isNumeric()).toBe(false);
      expect(customFunc.isString()).toBe(true);
    });
  });

  describe("Function envelope", () => {
    it("should create envelope from function", () => {
      const addFunc = new Function(FUNCTION_IDS.ADD);
      const funcEnvelope = addFunc.envelope();

      expect(funcEnvelope).toBeDefined();
    });
  });

  describe("Parameter class - numeric ID", () => {
    it("should create parameter with numeric ID", () => {
      const lhsParam = new Parameter(PARAMETER_IDS.LHS, Envelope.new(42));

      expect(lhsParam.id()).toBe(PARAMETER_IDS.LHS);
      expect(lhsParam.isNumeric()).toBe(true);
      expect(lhsParam.isString()).toBe(false);
    });
  });

  describe("Parameter class - string ID", () => {
    it("should create parameter with string ID", () => {
      const customParam = new Parameter("myParam", Envelope.new("value"));

      expect(customParam.id()).toBe("myParam");
      expect(customParam.isNumeric()).toBe(false);
      expect(customParam.isString()).toBe(true);
    });
  });

  describe("Parameter static helpers", () => {
    it("should create parameters with static helpers", () => {
      const blankParam = Parameter.blank(100);
      const lhsParam = Parameter.lhs(50);
      const rhsParam = Parameter.rhs(25);

      expect(blankParam.id()).toBe(PARAMETER_IDS.BLANK);
      expect(lhsParam.id()).toBe(PARAMETER_IDS.LHS);
      expect(rhsParam.id()).toBe(PARAMETER_IDS.RHS);
    });
  });

  describe("Basic Expression", () => {
    it("should create expression with function", () => {
      const addFunc = new Function(FUNCTION_IDS.ADD);
      const expr = new Expression(addFunc);

      expect(expr.function().id()).toBe(FUNCTION_IDS.ADD);
      expect(expr.parameters().length).toBe(0);
    });
  });

  describe("Expression with parameters", () => {
    it("should add parameters to expression", () => {
      const addFunc = new Function(FUNCTION_IDS.ADD);
      const expr = new Expression(addFunc)
        .withParameter(PARAMETER_IDS.LHS, 10)
        .withParameter(PARAMETER_IDS.RHS, 20);

      expect(expr.parameters().length).toBe(2);
      expect(expr.hasParameter(PARAMETER_IDS.LHS)).toBe(true);
      expect(expr.hasParameter(PARAMETER_IDS.RHS)).toBe(true);
    });
  });

  describe("Helper functions", () => {
    it("should create add expression", () => {
      const expr = add(5, 3);

      expect(expr.function().id()).toBe(FUNCTION_IDS.ADD);
      expect(expr.parameters().length).toBe(2);
    });

    it("should create sub expression", () => {
      const expr = sub(10, 4);

      expect(expr.function().id()).toBe(FUNCTION_IDS.SUB);
      expect(expr.parameters().length).toBe(2);
    });

    it("should create mul expression", () => {
      const expr = mul(6, 7);

      expect(expr.function().id()).toBe(FUNCTION_IDS.MUL);
      expect(expr.parameters().length).toBe(2);
    });

    it("should create div expression", () => {
      const expr = div(20, 5);

      expect(expr.function().id()).toBe(FUNCTION_IDS.DIV);
      expect(expr.parameters().length).toBe(2);
    });

    it("should create neg expression (unary)", () => {
      const expr = neg(42);

      expect(expr.function().id()).toBe(FUNCTION_IDS.NEG);
      expect(expr.parameters().length).toBe(1);
      expect(expr.hasParameter(PARAMETER_IDS.BLANK)).toBe(true);
    });

    it("should create comparison expressions", () => {
      expect(lt(5, 10).function().id()).toBe(FUNCTION_IDS.LT);
      expect(gt(15, 10).function().id()).toBe(FUNCTION_IDS.GT);
      expect(eq(42, 42).function().id()).toBe(FUNCTION_IDS.EQ);
    });

    it("should create logical expressions", () => {
      expect(and(true, false).function().id()).toBe(FUNCTION_IDS.AND);
      expect(or(true, false).function().id()).toBe(FUNCTION_IDS.OR);
      expect(not(true).function().id()).toBe(FUNCTION_IDS.NOT);
    });
  });

  describe("Function.withParameter shortcut", () => {
    it("should create expression from function with parameters", () => {
      const expr = Function.fromNumeric(FUNCTION_IDS.MUL)
        .withParameter(PARAMETER_IDS.LHS, 8)
        .withParameter(PARAMETER_IDS.RHS, 9);

      expect(expr).toBeInstanceOf(Expression);
      expect(expr.function().id()).toBe(FUNCTION_IDS.MUL);
      expect(expr.parameters().length).toBe(2);
    });
  });

  describe("Expression.withParameters bulk add", () => {
    it("should add multiple parameters at once", () => {
      const expr = new Expression(Function.fromString("calculate")).withParameters({
        x: 10,
        y: 20,
        z: 30,
      });

      expect(expr.parameters().length).toBe(3);
      expect(expr.hasParameter("x")).toBe(true);
      expect(expr.hasParameter("y")).toBe(true);
      expect(expr.hasParameter("z")).toBe(true);
    });
  });

  describe("Nested expression", () => {
    it("should support nested expressions", () => {
      const innerAdd = add(10, 20);
      const nestedExpr = Function.fromNumeric(FUNCTION_IDS.MUL)
        .withParameter(PARAMETER_IDS.LHS, innerAdd.envelope())
        .withParameter(PARAMETER_IDS.RHS, 3);

      expect(nestedExpr).toBeDefined();
      expect(nestedExpr.function().id()).toBe(FUNCTION_IDS.MUL);
    });
  });

  describe("Expression envelope caching", () => {
    it("should cache envelope", () => {
      const expr = add(1, 2);
      const env1 = expr.envelope();
      const env2 = expr.envelope();

      expect(env1).toBe(env2);
    });
  });

  describe("All function IDs present", () => {
    it("should have all expected functions", () => {
      const expectedFunctions = [
        "ADD",
        "SUB",
        "MUL",
        "DIV",
        "NEG",
        "LT",
        "LE",
        "GT",
        "GE",
        "EQ",
        "NE",
        "AND",
        "OR",
        "XOR",
        "NOT",
      ];

      const allPresent = expectedFunctions.every(
        (name) => FUNCTION_IDS[name as keyof typeof FUNCTION_IDS] !== undefined,
      );

      expect(allPresent).toBe(true);
    });
  });

  describe("All parameter IDs present", () => {
    it("should have all expected parameters", () => {
      const expectedParams = ["BLANK", "LHS", "RHS"];

      const allPresent = expectedParams.every(
        (name) => PARAMETER_IDS[name as keyof typeof PARAMETER_IDS] !== undefined,
      );

      expect(allPresent).toBe(true);
    });
  });
});
