/**
 * Server API endpoint to proxy IANA CBOR tags registry
 *
 * Fetches the IANA CBOR tags XML from the official registry,
 * parses it, and returns the data as JSON to avoid CORS issues.
 * Results are cached for 1 hour using Nitro's built-in caching.
 */

const IANA_CBOR_TAGS_URL = "https://www.iana.org/assignments/cbor-tags/cbor-tags.xml";

export interface IanaTagItem {
  value: string;
  description: string;
  semantics: string;
  references: string[];
  date?: string;
  updated?: string;
}

interface IanaTagsResponse {
  tags: IanaTagItem[];
  lastUpdated: string | null;
}

/**
 * Parse the IANA CBOR tags XML and extract tag records
 */
function parseIanaXml(xmlText: string): IanaTagsResponse {
  // Extract last updated
  const updatedMatch = xmlText.match(/<registry[^>]*>[\s\S]*?<updated>([^<]+)<\/updated>/);
  const lastUpdated = updatedMatch ? updatedMatch[1] : null;

  // Find the tags registry section
  const tagsRegistryMatch = xmlText.match(/<registry id="tags"[^>]*>([\s\S]*?)<\/registry>/);
  if (!tagsRegistryMatch) {
    throw new Error("Could not find tags registry in IANA XML");
  }

  const tagsRegistryContent = tagsRegistryMatch[1];

  // Extract all record elements
  const recordRegex =
    /<record(?:\s+date="([^"]*)")?(?:\s+updated="([^"]*)")?[^>]*>([\s\S]*?)<\/record>/g;
  const tags: IanaTagItem[] = [];

  let match;
  while ((match = recordRegex.exec(tagsRegistryContent)) !== null) {
    const recordDate = match[1];
    const recordUpdated = match[2];
    const recordContent = match[3];

    // Extract fields from record
    const valueMatch = recordContent.match(/<value>([^<]*)<\/value>/);
    const descriptionMatch = recordContent.match(/<description>([^<]*)<\/description>/);
    const semanticsMatch = recordContent.match(/<semantics>([^<]*)<\/semantics>/);

    const value = valueMatch ? valueMatch[1] : "";
    const description = descriptionMatch ? descriptionMatch[1] : "";
    const semantics = semanticsMatch ? semanticsMatch[1] : "";

    // Extract references
    const references: string[] = [];
    const xrefRegex = /<xref\s+type="([^"]*)"\s+data="([^"]*)"\s*\/>/g;
    let xrefMatch;
    while ((xrefMatch = xrefRegex.exec(recordContent)) !== null) {
      const type = xrefMatch[1];
      const data = xrefMatch[2];

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

    // Skip empty or unassigned entries
    if (value && (description || semantics)) {
      tags.push({
        value,
        description,
        semantics,
        references,
        date: recordDate,
        updated: recordUpdated,
      });
    }
  }

  return { tags, lastUpdated };
}

export default defineCachedEventHandler(
  async () => {
    const response = await fetch(IANA_CBOR_TAGS_URL);
    if (!response.ok) {
      throw createError({
        statusCode: response.status,
        statusMessage: `Failed to fetch IANA registry: ${response.status}`,
      });
    }

    const xmlText = await response.text();
    return parseIanaXml(xmlText);
  },
  {
    maxAge: 60 * 60 * 24, // Cache for 1 day
    swr: true, // Stale-while-revalidate: serve stale content while fetching fresh
    name: "iana-cbor-tags",
  },
);
