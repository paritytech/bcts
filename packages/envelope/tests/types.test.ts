import { Envelope, IS_A } from "../src";

describe("Type System", () => {
  describe("Single type", () => {
    it("should add a single type to an envelope", () => {
      const person = Envelope.new("Alice").addType("Person");

      expect(person.hasType("Person")).toBe(true);
      expect(person.types().length).toBe(1);
      expect(person.getType().extractString()).toBe("Person");
    });
  });

  describe("Multiple types", () => {
    it("should support multiple types on an envelope", () => {
      const multiTyped = Envelope.new("Bob")
        .addType("Person")
        .addType("Employee")
        .addType("Manager");

      expect(multiTyped.types().length).toBe(3);
      expect(multiTyped.hasType("Person")).toBe(true);
      expect(multiTyped.hasType("Employee")).toBe(true);
      expect(multiTyped.hasType("Manager")).toBe(true);
      expect(multiTyped.hasType("Customer")).toBe(false);
    });
  });

  describe("Type validation", () => {
    it("should validate matching types", () => {
      const document = Envelope.new("Contract").addType("LegalDocument");

      expect(() => document.checkType("LegalDocument")).not.toThrow();
    });

    it("should reject non-matching types", () => {
      const document = Envelope.new("Contract").addType("LegalDocument");

      expect(() => document.checkType("Spreadsheet")).toThrow();
    });
  });

  describe("Types combined with other assertions", () => {
    it("should work with other assertions", () => {
      const employee = Envelope.new("Charlie")
        .addType("Person")
        .addType("Employee")
        .addAssertion("department", "Engineering")
        .addAssertion("salary", 75000);

      expect(employee.subject().extractString()).toBe("Charlie");
      expect(employee.hasType("Person")).toBe(true);
      expect(employee.hasType("Employee")).toBe(true);
      expect(employee.objectForPredicate("department").extractString()).toBe("Engineering");
      expect(employee.objectForPredicate("salary").extractNumber()).toBe(75000);
    });
  });

  describe("IS_A predicate", () => {
    it("should work with IS_A predicate directly", () => {
      const typed = Envelope.new("Data").addAssertion(IS_A, "DataSet");

      expect(typed.hasType("DataSet")).toBe(true);
    });
  });
});
