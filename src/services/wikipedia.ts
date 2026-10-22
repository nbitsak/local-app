// services/wikipedia.ts

import { Platform } from "react-native";

//define wikipedia user agent (e-mail) 
const WIKIPEDIA_USER_AGENT =
  "LocalApp/1.0 (mailto:nbitsakidis@gmail.com)";

//define wikipedia languages
const WIKIPEDIA_LANGUAGES = [
  "el",
  "en",
  "fr",
  "it",
] as const;

//define wikipedia language type
export type WikipediaLanguage =
  (typeof WIKIPEDIA_LANGUAGES)[number];

//define wikipedia article type
export type WikipediaArticle = {
  title: string;
  url: string;
  language: WikipediaLanguage;
};

//define wikipedia page type
type WikipediaPage = {
  pageid?: number;
  ns?: number;
  title?: string;
  missing?: boolean;
  invalid?: boolean;
  redirect?: boolean;
};

//define wikipedia response type
type WikipediaResponse = {
  error?: {
    code?: string;
    info?: string;
  };
  query?: {
    pages?: WikipediaPage[];
  };
};

//function to clean title
function cleanTitle(value: string): string {
  return value
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ");
}

//function to normalize title
function normalizeTitle(value: string): string {
  return cleanTitle(value).toLowerCase();
}

//function for aborted wikipedia request 
function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const error = new Error(
      "Wikipedia request cancelled.",
    );

    error.name = "AbortError";
    throw error;
  }
}

//function for encoding wikipedia search term
function encodeQuery(
  params: Record<string, string>,
): string {
  return Object.entries(params)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&");
}

//function for setting request header
function getRequestHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (Platform.OS === "web") {
    // Browsers control their own User-Agent header.
    headers["Api-User-Agent"] = WIKIPEDIA_USER_AGENT;
  } else {
    headers["User-Agent"] = WIKIPEDIA_USER_AGENT;
  }

  return headers;
}

//function for getting wikipedia article
async function getExactArticle(
  name: string,
  language: WikipediaLanguage,
  signal?: AbortSignal,
): Promise<WikipediaArticle | null> {
  throwIfAborted(signal);

  const query = encodeQuery({
    action: "query",
    titles: name,
    prop: "info",
    format: "json",
    formatversion: "2",
    origin: "*",

    // Do not follow redirects to another article.
  });

  //api url 
  const response = await fetch(
    `https://${language}.wikipedia.org/w/api.php?${query}`,
    {
      method: "GET",
      signal,
      headers: getRequestHeaders(),
    },
  );

  const text = await response.text();

  throwIfAborted(signal);

  if (!response.ok) {
    throw new Error(
      `Wikipedia (${language}) HTTP ${response.status}: ` +
        text.slice(0, 300),
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      `Wikipedia (${language}) returned non-JSON content: ` +
        text.slice(0, 200),
    );
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    throw new Error(
      `Wikipedia (${language}) returned an invalid JSON object.`,
    );
  }

  const data = parsed as WikipediaResponse;

  if (data.error) {
    throw new Error(
      `Wikipedia (${language}): ` +
        (
          data.error.info ??
          data.error.code ??
          "Unknown API error"
        ),
    );
  }

  if (!Array.isArray(data.query?.pages)) {
    throw new Error(
      `Wikipedia (${language}): missing query.pages array.`,
    );
  }

  const page = data.query.pages[0];

  if (
    !page ||
    page.missing ||
    page.invalid ||
    page.redirect ||
    page.ns !== 0 ||
    typeof page.pageid !== "number" ||
    typeof page.title !== "string"
  ) {
    return null;
  }

  // Ignore only capitalization and whitespace differences.
  // Accents, punctuation and additional words must match.
  if (
    normalizeTitle(page.title) !== normalizeTitle(name)
  ) {
    return null;
  }

  return {
    title: page.title,
    language,
    url:
      `https://${language}.wikipedia.org/wiki/` +
      encodeURIComponent(
        page.title.replace(/ /g, "_"),
      ),
  };
}

//function for finding if wikipedia article exists
export async function findWikipediaArticle(
  name: string,
  signal?: AbortSignal,
): Promise<WikipediaArticle | null> {
  throwIfAborted(signal);

  const title = cleanTitle(name);

  if (!title || title.includes("|")) {
    return null;
  }

  const failures: string[] = [];
  let completedChecks = 0;

  for (const language of WIKIPEDIA_LANGUAGES) {
    throwIfAborted(signal);

    try {
      const article = await getExactArticle(
        title,
        language,
        signal,
      );

      throwIfAborted(signal);

      completedChecks++;

      if (article) {
        return article;
      }
    } catch (err: unknown) {
      throwIfAborted(signal);

      const message =
        err instanceof Error
          ? err.message
          : String(err);

      console.warn("Wikipedia request failed:", {
        title,
        language,
        message,
      });

      failures.push(message);
    }
  }

  // A failed check is not the same as an absent article.
  if (failures.length > 0) {
    throw new Error(
      "Wikipedia lookup incomplete " +
        `(${completedChecks}/${WIKIPEDIA_LANGUAGES.length} ` +
        "checks completed): " +
        failures.join(" | "),
    );
  }

  return null;
}