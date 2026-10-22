// src/services/offlineWikipedia.ts

import { Platform } from "react-native";

import type {
  OfflineWikipediaArticle,
} from "./infoDatabase";

//declare mail address
const USER_AGENT =
  "LocalApp/1.0 (mailto:nbitsakidis@gmail.com)";

//define supported languages
const SUPPORTED_LANGUAGES = [
  "el",
  "en",
  "fr",
  "it",
];

//function to display error
function throwIfAborted(
  signal?: AbortSignal,
): void {
  if (signal?.aborted) {
    const error = new Error("Request cancelled.");
    error.name = "AbortError";
    throw error;
  }
}

//function to code html special charaqcters
function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) => {
      const entities: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };

      return entities[character];
    },
  );
}

//function to decide if value is an object
function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

//function to parse wikipedia from url
export function parseWikipediaUrl(
  value: string,
): {
  language: string;
  title: string;
  sourceUrl: string;
} {
  const url = new URL(value);

  if (url.protocol !== "https:") {
    throw new Error(
      "Only HTTPS Wikipedia URLs are supported.",
    );
  }

  const host = url.hostname.toLowerCase();

  const match = host.match(
    /^([a-z]+)(?:\.m)?\.wikipedia\.org$/,
  );

  const language = match?.[1];

  if (
    !language ||
    !SUPPORTED_LANGUAGES.includes(language) ||
    !url.pathname.startsWith("/wiki/")
  ) {
    throw new Error(
      "Unsupported Wikipedia article URL.",
    );
  }

  const title = decodeURIComponent(
    url.pathname.slice("/wiki/".length),
  )
    .replace(/_/g, " ")
    .trim();

  if (!title || title.includes("|")) {
    throw new Error(
      "Invalid Wikipedia article title.",
    );
  }

  return {
    language,
    title,
    sourceUrl:
      `https://${language}.wikipedia.org/wiki/` +
      encodeURIComponent(
        title.replace(/ /g, "_"),
      ),
  };
}

//fuction to build the offline html db record
function buildOfflineHtml({
  title,
  content,
  sourceUrl,
  revisionId,
  language,
}: {
  title: string;
  content: string;
  sourceUrl: string;
  revisionId: number;
  language: string;
}): string {
  const revisionUrl =
    `https://${language}.wikipedia.org/w/index.php` +
    `?oldid=${revisionId}`;

  return `
<!DOCTYPE html>
<html lang="${escapeHtml(language)}">
<head>
  <meta charset="utf-8" />

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  />

  <meta
    http-equiv="Content-Security-Policy"
    content="
      default-src 'none';
      style-src 'unsafe-inline';
      img-src 'none';
      media-src 'none';
      font-src 'none';
      script-src 'none';
      connect-src 'none';
      frame-src 'none';
      object-src 'none';
      form-action 'none';
      base-uri 'none';
    "
  />

  <title>${escapeHtml(title)}</title>

  <style>
    body {
      margin: 0;
      padding: 20px;
      color: #0f172a;
      background: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont,
        "Segoe UI", sans-serif;
      font-size: 17px;
      line-height: 1.65;
      overflow-wrap: anywhere;
    }

    h1, h2, h3, h4 {
      line-height: 1.3;
    }

    h1 {
      font-size: 28px;
    }

    h2 {
      margin-top: 28px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
    }

    table {
      display: block;
      max-width: 100%;
      overflow-x: auto;
      border-collapse: collapse;
    }

    td, th {
      padding: 6px;
      border: 1px solid #e2e8f0;
    }

    img, picture, video, audio, iframe,
    script, form, object, embed,
    .mw-editsection, .navbox,
    .metadata, .noprint {
      display: none !important;
    }

    a {
      color: #2563eb;
      text-decoration: none;
    }

    .offline-note {
      padding: 12px;
      background: #eff6ff;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 20px;
    }

    .attribution {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #cbd5e1;
      font-size: 12px;
      color: #475569;
    }
  </style>
</head>

<body>
  <div class="offline-note">
    Offline reading copy. Images and external resources
    are not included. Links to other pages are disabled
    in this view.
  </div>

  <h1>${escapeHtml(title)}</h1>

  <main>
    ${content}
  </main>

  <footer class="attribution">
    <p>
      Source: Wikipedia contributors,
      ${escapeHtml(title)}.
    </p>

    <p>${escapeHtml(sourceUrl)}</p>

    <p>
      Saved revision: ${revisionId}<br />
      ${escapeHtml(revisionUrl)}
    </p>

    <p>
      Text is available under the Creative Commons
      Attribution-ShareAlike 4.0 license, except where
      otherwise noted in the source.
    </p>

    <p>
      https://creativecommons.org/licenses/by-sa/4.0/
    </p>

    <p>
      This reading copy uses simplified presentation
      and omits images and external resources.
    </p>
  </footer>
</body>
</html>
`;
}

//function to download wikipedia article
export async function downloadWikipediaArticle(
  url: string,
  signal?: AbortSignal,
): Promise<OfflineWikipediaArticle> {
  throwIfAborted(signal);

  const target = parseWikipediaUrl(url);

  const parameters: Record<string, string> = {
    action: "parse",
    page: target.title,
    prop: "text|revid",
    redirects: "1",
    format: "json",
    formatversion: "2",
    origin: "*",
  };

  const query = Object.entries(parameters)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&");

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (Platform.OS === "web") {
    headers["Api-User-Agent"] = USER_AGENT;
  } else {
    headers["User-Agent"] = USER_AGENT;
  }

  const response = await fetch(
    `https://${target.language}.wikipedia.org/w/api.php?${query}`,
    {
      signal,
      headers,
    },
  );

  const text = await response.text();

  throwIfAborted(signal);

  if (!response.ok) {
    throw new Error(
      `Wikipedia HTTP ${response.status}: ` +
        text.slice(0, 200),
    );
  }

  let data: unknown;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      "Wikipedia returned invalid JSON.",
    );
  }

  if (!isObject(data)) {
    throw new Error(
      "Wikipedia returned an invalid response.",
    );
  }

  if (isObject(data.error)) {
    throw new Error(
      typeof data.error.info === "string"
        ? data.error.info
        : "Wikipedia API request failed.",
    );
  }

  const parsed = data.parse;

  if (
    !isObject(parsed) ||
    typeof parsed.title !== "string" ||
    typeof parsed.pageid !== "number" ||
    typeof parsed.revid !== "number" ||
    typeof parsed.text !== "string"
  ) {
    throw new Error(
      "Wikipedia article content is unavailable.",
    );
  }

  return {
    sourceUrl: target.sourceUrl,
    title: parsed.title,
    language: target.language,
    pageId: parsed.pageid,
    revisionId: parsed.revid,
    html: buildOfflineHtml({
      title: parsed.title,
      content: parsed.text,
      sourceUrl: target.sourceUrl,
      revisionId: parsed.revid,
      language: target.language,
    }),
    savedAt: new Date().toISOString(),
  };
}