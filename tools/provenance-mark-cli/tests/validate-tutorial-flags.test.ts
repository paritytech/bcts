/**
 * Regression tests locking in the `validate` flag matrix exercised by the
 * `tutorials/xid-quickstart/scripts/*.sh` end-to-end tests.
 *
 * The tutorial scripts depend on these specific behaviors:
 *   1. `validate <mark>` returns the mark via stdout and exits 0 when valid
 *      (single genesis mark counts as valid), exits 1 otherwise.
 *   2. `validate <m0> <m1>` accepts multiple positional args (chain validation).
 *   3. `validate --warn` / `-w` suppresses the failure and returns the report
 *      via stdout instead of throwing.
 *   4. `validate --format json-compact` / `json-pretty` produces JSON with the
 *      `.chains[0].sequences[0].end_seq` path that scripts grep with `jq`.
 */
import { describe, it, expect } from "vitest";
import {
  ProvenanceMarkGenerator,
  ProvenanceMarkResolution,
  type ProvenanceMark,
} from "@bcts/provenance-mark";

import { ValidateCommand, ValidateFormat } from "../src/cmd/validate.js";

function buildChain(): ProvenanceMark[] {
  // Use a deterministic seed so test output is reproducible.
  const generator = ProvenanceMarkGenerator.newWithPassphrase(
    ProvenanceMarkResolution.Low,
    "tutorial-flags-fixture",
  );
  const m0 = generator.next(new Date(Date.UTC(2024, 0, 1, 0, 0, 0, 0)));
  const m1 = generator.next(new Date(Date.UTC(2024, 0, 2, 0, 0, 0, 0)));
  const m2 = generator.next(new Date(Date.UTC(2024, 0, 3, 0, 0, 0, 0)));
  return [m0, m1, m2];
}

function run(args: { marks: string[]; warn?: boolean; format?: ValidateFormat }) {
  const cmd = new ValidateCommand({
    marks: args.marks,
    warn: args.warn ?? false,
    format: args.format ?? ValidateFormat.Text,
  });
  try {
    return { ok: true as const, output: cmd.exec() };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

describe("validate — tutorial-script flag matrix", () => {
  it("single genesis mark exits successfully", () => {
    const [m0] = buildChain();
    const result = run({ marks: [m0.urString()] });
    expect(result.ok).toBe(true);
  });

  it("multi-mark genesis-anchored chain exits successfully", () => {
    const [m0, m1, m2] = buildChain();
    const result = run({ marks: [m0.urString(), m1.urString(), m2.urString()] });
    expect(result.ok).toBe(true);
  });

  it("non-genesis-only chain fails without --warn (scripts rely on exit 1)", () => {
    const [, m1, m2] = buildChain();
    const result = run({ marks: [m1.urString(), m2.urString()] });
    expect(result.ok).toBe(false);
  });

  it("--warn suppresses failure and returns the report on stdout", () => {
    const [, m1, m2] = buildChain();
    const result = run({ marks: [m1.urString(), m2.urString()], warn: true });
    expect(result.ok).toBe(true);
    expect(result.ok && result.output).toMatch(/Chain 1:/);
  });

  it("--format json-compact emits .chains[0].sequences[0].end_seq", () => {
    const [m0, m1, m2] = buildChain();
    const result = run({
      marks: [m0.urString(), m1.urString(), m2.urString()],
      format: ValidateFormat.JsonCompact,
    });
    expect(result.ok).toBe(true);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const json = JSON.parse(result.output) as {
      chains: { sequences: { start_seq: number; end_seq: number }[] }[];
    };
    expect(json.chains[0].sequences[0].end_seq).toBe(2);
    expect(json.chains[0].sequences[0].start_seq).toBe(0);

    // Compact JSON has no whitespace — matches Rust's serde_json::to_string()
    expect(result.output).not.toMatch(/\n/);
  });

  it("--format json-pretty produces indented JSON with the same shape", () => {
    const [m0, m1] = buildChain();
    const result = run({
      marks: [m0.urString(), m1.urString()],
      format: ValidateFormat.JsonPretty,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.output).toMatch(/\n {2}/); // indented
    const json = JSON.parse(result.output) as {
      chains: { sequences: { end_seq: number }[] }[];
    };
    expect(json.chains[0].sequences[0].end_seq).toBe(1);
  });

  it("rejects an out-of-order chain (broken predecessor relationship)", () => {
    const [, m1, m2] = buildChain();
    const result = run({ marks: [m2.urString(), m1.urString()] });
    expect(result.ok).toBe(false);
  });
});
