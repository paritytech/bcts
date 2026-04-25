import {
  validate,
  hasIssues,
  formatValidationIssue,
  type ProvenanceMark,
} from "@bcts/provenance-mark";

export interface MarkComparison {
  sameChain: boolean;
  sequences: number[];
  latestIndex: number;
  latestSeq: number;
  issues: string[];
}

/** Compare multiple provenance marks: same chain? which is newest? any issues? */
export function compareProvenanceMarks(marks: ProvenanceMark[]): MarkComparison {
  if (marks.length === 0) {
    return { sameChain: true, sequences: [], latestIndex: -1, latestSeq: -1, issues: [] };
  }

  const report = validate(marks);
  const issues: string[] = [];
  for (const chain of report.chains) {
    for (const seq of chain.sequences) {
      for (const markReport of seq.marks) {
        for (const issue of markReport.issues) {
          issues.push(formatValidationIssue(issue));
        }
      }
    }
  }

  const sameChain = report.chains.length === 1;
  const sequences = marks.map((m) => m.seq());

  let latestIndex = 0;
  let latestSeq = sequences[0] ?? 0;
  for (let i = 1; i < sequences.length; i++) {
    const s = sequences[i];
    if (s !== undefined && s > latestSeq) {
      latestSeq = s;
      latestIndex = i;
    }
  }

  return { sameChain, sequences, latestIndex, latestSeq, issues };
}

/** Find the newest edition in an array. */
export function findNewest<T extends { mark: ProvenanceMark }>(entries: T[]): T | null {
  if (entries.length === 0) return null;
  const first = entries[0];
  if (!first) return null;
  let best: T = first;
  for (let i = 1; i < entries.length; i++) {
    const e = entries[i];
    if (e && e.mark.seq() > best.mark.seq()) best = e;
  }
  return best;
}

export { hasIssues };
