import type { Envelope } from "@bcts/envelope";

export interface CommitmentListEntry {
  filename: string;
  digestUr: string;
}

/** Compute the envelope digest as a ur:digest UR string. */
export function digestUr(env: Envelope): string {
  return env.digest().ur().toString();
}

/** Build a README-style markdown commitment list. */
export function buildCommitmentList(entries: CommitmentListEntry[]): string {
  const lines: string[] = [
    "# CLA Commitment List",
    "",
    "This is a list of commitments for CLAs guaranteeing rights to work done for SisterSpaces. ",
    "CLAs are published as envelope-cli digest hashes to preserve privacy. Original CLAs are ",
    "held by the Project Manager and can be privately produced if necessary. ",
    "This list is a living example of the power of herd privacy.",
    "",
  ];
  for (const e of entries) lines.push(e.digestUr);
  return lines.join("\n");
}

/** Verify a CLA was listed in a commitment list (exact digest string match). */
export function verifyAgainstList(cla: Envelope, list: string): boolean {
  return list.includes(digestUr(cla));
}
