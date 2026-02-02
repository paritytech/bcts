/**
 * XID edge find command - 1:1 port of cmd/xid/edge/find.rs
 *
 * Find edges by is-a, source, target, or subject criteria.
 */

import { IS_A, SOURCE, TARGET } from "@bcts/known-values";
import type { Exec } from "../../../exec.js";
import { readEnvelope } from "../../../utils.js";
import { readXidDocument } from "../xid-utils.js";

/**
 * Command arguments for the edge find command.
 */
export interface CommandArgs {
  isA?: string;
  source?: string;
  target?: string;
  subject?: string;
  envelope?: string;
}

/**
 * Edge find command implementation.
 */
export class EdgeFindCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const xidDocument = readXidDocument(this.args.envelope);
    let edges = [...xidDocument.edges().iter()].map(([, e]) => e);

    if (this.args.isA !== undefined) {
      const isAEnvelope = readEnvelope(this.args.isA);
      edges = edges.filter((edge) => {
        const isAAssertions = edge.assertionsWithPredicate(IS_A);
        return isAAssertions.some((a) => a.object().digest().equals(isAEnvelope.digest()));
      });
    }

    if (this.args.source !== undefined) {
      const sourceEnvelope = readEnvelope(this.args.source);
      edges = edges.filter((edge) => {
        const sourceAssertions = edge.assertionsWithPredicate(SOURCE);
        return sourceAssertions.some((a) => a.object().digest().equals(sourceEnvelope.digest()));
      });
    }

    if (this.args.target !== undefined) {
      const targetEnvelope = readEnvelope(this.args.target);
      edges = edges.filter((edge) => {
        const targetAssertions = edge.assertionsWithPredicate(TARGET);
        return targetAssertions.some((a) => a.object().digest().equals(targetEnvelope.digest()));
      });
    }

    if (this.args.subject !== undefined) {
      const subjectEnvelope = readEnvelope(this.args.subject);
      edges = edges.filter((edge) => edge.subject().digest().equals(subjectEnvelope.digest()));
    }

    return edges.map((e) => e.urString()).join("\n");
  }
}

/**
 * Execute the edge find command.
 */
export function exec(args: CommandArgs): string {
  return new EdgeFindCommand(args).exec();
}
