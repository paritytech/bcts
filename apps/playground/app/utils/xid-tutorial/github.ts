export interface GithubKey {
  key: string;
  created_at: string;
  id?: number;
}

/** Canned fallback data used when live GitHub API is unavailable or the user declines to fetch. */
const CANNED_RESPONSES: Record<string, GithubKey[]> = {
  BRadvoc8: [
    {
      key: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOiOtuf9hwDBjNXyjvjHMKeLQKyzT8GcH3tLvHNKrXJe",
      created_at: "2025-05-10T02:15:26.791Z",
    },
  ],
};

export async function fetchGithubSigningKeys(
  username: string,
  opts: { live?: boolean; cannedKeyOverride?: string } = {},
): Promise<{ keys: GithubKey[]; source: "live" | "canned"; error?: string }> {
  // Canned mode simulates "the user uploaded their freshly-generated SSH key
  // to GitHub" — echo back whatever the XID's edge actually claims so the
  // mismatch isn't a teaching artifact. Mirrors the upstream tutorial's local
  // mode (`scripts/03_2_SCRIPT.sh`) where GitHub == the locally-built XID.
  if (!opts.live) {
    if (opts.cannedKeyOverride) {
      return {
        keys: [{ key: opts.cannedKeyOverride, created_at: new Date().toISOString() }],
        source: "canned",
      };
    }
    const canned = CANNED_RESPONSES[username];
    if (canned) return { keys: canned, source: "canned" };
    return { keys: [], source: "canned", error: `No canned data for "${username}"` };
  }
  try {
    const res = await fetch(
      `https://api.github.com/users/${encodeURIComponent(username)}/ssh_signing_keys`,
    );
    if (!res.ok) {
      return {
        keys: CANNED_RESPONSES[username] ?? [],
        source: "canned",
        error: `GitHub API returned ${res.status} — falling back to canned data.`,
      };
    }
    const data = (await res.json()) as GithubKey[];
    return { keys: data, source: "live" };
  } catch (e) {
    return {
      keys: CANNED_RESPONSES[username] ?? [],
      source: "canned",
      error: e instanceof Error ? e.message : "Network error — falling back to canned data.",
    };
  }
}

/** Compare two ssh-* key strings by their first two whitespace-separated tokens. */
export function sshKeysMatch(a: string, b: string): boolean {
  const an = a.trim().split(/\s+/);
  const bn = b.trim().split(/\s+/);
  return an[0] === bn[0] && an[1] === bn[1];
}
