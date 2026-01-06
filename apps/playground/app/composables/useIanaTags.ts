/**
 * Composable for fetching IANA CBOR tags registry
 *
 * Fetches and parses the official IANA CBOR tags via our server API
 * to avoid CORS issues.
 */

export interface IanaTagItem {
  value: string;
  description: string;
  semantics: string;
  references: string[];
  date?: string;
  updated?: string;
}

export interface IanaTagsResult {
  tags: IanaTagItem[];
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

interface IanaTagsResponse {
  tags: IanaTagItem[];
  lastUpdated: string | null;
}

// Cache for the fetched data
let cachedResult: IanaTagsResult | null = null;
let fetchPromise: Promise<IanaTagsResult> | null = null;

/**
 * Fetch IANA CBOR tags from our server API
 */
async function fetchIanaTags(): Promise<IanaTagsResult> {
  try {
    const response = await fetch("/api/iana");
    if (!response.ok) {
      throw new Error(`Failed to fetch IANA registry: ${response.status}`);
    }

    const data: IanaTagsResponse = await response.json();

    return {
      tags: data.tags,
      loading: false,
      error: null,
      lastUpdated: data.lastUpdated,
    };
  } catch (err) {
    return {
      tags: [],
      loading: false,
      error: err instanceof Error ? err.message : "Unknown error",
      lastUpdated: null,
    };
  }
}

export function useIanaTags() {
  const result = ref<IanaTagsResult>({
    tags: [],
    loading: true,
    error: null,
    lastUpdated: null,
  });

  // Return cached result if available
  if (cachedResult) {
    result.value = cachedResult;
    return result;
  }

  // If already fetching, wait for that promise
  if (fetchPromise) {
    fetchPromise.then((data) => {
      result.value = data;
    });
    return result;
  }

  // Start fetching
  fetchPromise = fetchIanaTags();
  fetchPromise.then((data) => {
    cachedResult = data;
    result.value = data;
    fetchPromise = null;
  });

  return result;
}

/**
 * Force refresh the IANA tags cache
 */
export async function refreshIanaTags(): Promise<IanaTagsResult> {
  cachedResult = null;
  fetchPromise = null;
  const data = await fetchIanaTags();
  cachedResult = data;
  return data;
}
