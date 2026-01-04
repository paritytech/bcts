/**
 * Composable for fetching IANA CBOR tags registry
 *
 * Fetches and parses the official IANA CBOR tags XML registry.
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

const IANA_CBOR_TAGS_URL = "https://www.iana.org/assignments/cbor-tags/cbor-tags.xml";

/**
 * Parse the IANA CBOR tags XML and extract tag records
 */
function parseIanaXml(xmlText: string): { tags: IanaTagItem[]; lastUpdated: string | null } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");

  // Check for parse errors
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("Failed to parse IANA XML");
  }

  // Get last updated from the registry
  const updatedElement = doc.querySelector("registry > updated");
  const lastUpdated = updatedElement?.textContent ?? null;

  // Find the tags registry (id="tags")
  const tagsRegistry = doc.querySelector('registry[id="tags"]');
  if (!tagsRegistry) {
    throw new Error("Could not find tags registry in IANA XML");
  }

  // Parse all record elements
  const records = tagsRegistry.querySelectorAll("record");
  const tags: IanaTagItem[] = [];

  records.forEach((record) => {
    const value = record.querySelector("value")?.textContent ?? "";
    const description = record.querySelector("description")?.textContent ?? "";
    const semantics = record.querySelector("semantics")?.textContent ?? "";
    const date =
      record.getAttribute("date") ?? record.querySelector("date")?.textContent ?? undefined;
    const updated =
      record.getAttribute("updated") ?? record.querySelector("updated")?.textContent ?? undefined;

    // Collect all references
    const references: string[] = [];
    const xrefs = record.querySelectorAll("xref");
    xrefs.forEach((xref) => {
      const type = xref.getAttribute("type");
      const data = xref.getAttribute("data");
      if (type && data) {
        if (type === "rfc") {
          references.push(`RFC ${data.replace("rfc", "").toUpperCase()}`);
        } else if (type === "uri") {
          references.push(data);
        } else if (type === "draft") {
          references.push(`Draft: ${data}`);
        } else if (type === "person") {
          references.push(`Contact: ${data.replace(/_/g, " ")}`);
        }
      }
    });

    // Skip empty or unassigned entries
    if (value && (description || semantics)) {
      tags.push({
        value,
        description,
        semantics,
        references,
        date,
        updated,
      });
    }
  });

  return { tags, lastUpdated };
}

// Cache for the fetched data
let cachedResult: IanaTagsResult | null = null;
let fetchPromise: Promise<IanaTagsResult> | null = null;

/**
 * Fetch IANA CBOR tags from the official registry
 */
async function fetchIanaTags(): Promise<IanaTagsResult> {
  try {
    const response = await fetch(IANA_CBOR_TAGS_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch IANA registry: ${response.status}`);
    }

    const xmlText = await response.text();
    const { tags, lastUpdated } = parseIanaXml(xmlText);

    return {
      tags,
      loading: false,
      error: null,
      lastUpdated,
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
