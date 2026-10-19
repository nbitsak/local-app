export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type TourismPlace = {
  public_id: string;
  name: string;
  types: string[];
  formatted_address?: string | null;
  geometry?: {
    location?: {
      lat: number;
      lng: number;
    } | null;
  } | null;
};

type SearchOptions = {
  // Supply an actual private key, not a public woos- key.
  apiKey: string;
  location: Coordinates;

  // Optional to preserve existing InfoTab calls.
  // Defaults to ["tourism"].
  types?: readonly string[];

  signal?: AbortSignal;
  debug?: boolean;
};

type NearbySearchOptions = SearchOptions & {
  types: readonly string[];
};

type NearbyPage = {
  results: TourismPlace[];
  nextPage: number | null;
};

const ENDPOINT = "https://api.woosmap.com/localities/nearby/";
const RADIUS_METERS = 2000;
const PAGE_SIZE = 10;

function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function encodeQuery(params: Record<string, string>): string {
  return Object.entries(params)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&");
}

function validateLocation(location: Coordinates): void {
  const { latitude, longitude } = location;

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error("Invalid latitude or longitude.");
  }
}

function parsePlace(
  value: unknown,
  index: number,
): TourismPlace {
  if (!isObject(value)) {
    throw new Error(
      `Invalid Woosmap result at index ${index}.`,
    );
  }

  if (
    typeof value.public_id !== "string" ||
    typeof value.name !== "string" ||
    !Array.isArray(value.types) ||
    !value.types.every(
      (type: unknown) => typeof type === "string",
    )
  ) {
    throw new Error(
      `Invalid Woosmap result at index ${index}: ` +
        "expected public_id, name and types.",
    );
  }

  const place: TourismPlace = {
    public_id: value.public_id,
    name: value.name,
    types: value.types as string[],
  };

  if (
    typeof value.formatted_address === "string" ||
    value.formatted_address === null
  ) {
    place.formatted_address = value.formatted_address;
  }

  if (value.geometry === null) {
    place.geometry = null;
  } else if (isObject(value.geometry)) {
    const point = value.geometry.location;

    if (point === null) {
      place.geometry = {
        location: null,
      };
    } else if (
      isObject(point) &&
      typeof point.lat === "number" &&
      typeof point.lng === "number" &&
      Number.isFinite(point.lat) &&
      Number.isFinite(point.lng)
    ) {
      place.geometry = {
        location: {
          lat: point.lat,
          lng: point.lng,
        },
      };
    } else if (point !== undefined) {
      throw new Error(
        `Invalid coordinates in Woosmap result at index ${index}.`,
      );
    }
  }

  return place;
}

function parseNearbyPage(value: unknown): NearbyPage {
  if (!isObject(value)) {
    throw new Error(
      "Woosmap returned a non-object JSON response.",
    );
  }

  if (!Array.isArray(value.results)) {
    throw new Error(
      "Woosmap Nearby response is missing the results array. " +
        `Received fields: ${
          Object.keys(value).join(", ") || "(none)"
        }.`,
    );
  }

  if (!isObject(value.pagination)) {
    throw new Error(
      "Woosmap Nearby response is missing the pagination object. " +
        "Enable debug to inspect the response.",
    );
  }

  const rawNextPage = value.pagination.next_page;

  // Keep received results, but stop pagination if next_page is missing.
  if (rawNextPage === undefined) {
    console.warn(
      "Woosmap returned pagination without next_page. " +
        "Returning the pages received so far; results may be incomplete.",
      JSON.stringify(value.pagination, null, 2),
    );
  }

  const nextPage = rawNextPage ?? null;

  if (
    nextPage !== null &&
    !(
      typeof nextPage === "number" &&
      Number.isInteger(nextPage) &&
      nextPage > 0
    )
  ) {
    throw new Error(
      "Invalid Woosmap pagination.next_page: " +
        `${String(nextPage)}. Expected a positive integer or null.`,
    );
  }

  return {
    results: value.results.map((item, index) =>
      parsePlace(item, index),
    ),
    nextPage: nextPage as number | null,
  };
}

function getApiErrorMessage(
  status: number,
  body: unknown,
): string {
  if (isObject(body) && body.detail !== undefined) {
    const detail =
      typeof body.detail === "string"
        ? body.detail
        : JSON.stringify(body.detail);

    return `Woosmap HTTP ${status}: ${detail}`;
  }

  return `Woosmap request failed (HTTP ${status}).`;
}

// Keep this export and its default behavior for InfoTab.
// Despite its legacy name, the configured radius remains 2000 meters.
export async function getTourismPlacesWithin5Km({
  apiKey,
  location,
  types = ["tourism"],
  signal,
  debug = false,
}: SearchOptions): Promise<TourismPlace[]> {
  validateLocation(location);

  const privateKey = apiKey.trim();

  if (!privateKey) {
    throw new Error(
      "A Woosmap private API key is required.",
    );
  }

  const selectedTypes = [
    ...new Set(
      types
        .map((type) => type.trim())
        .filter((type) => type.length > 0),
    ),
  ];

  if (selectedTypes.length === 0) {
    throw new Error("Select at least one place type.");
  }

  const places = new Map<string, TourismPlace>();
  const visitedPages = new Set<number>();

  let page: number | null = 1;

  while (page !== null) {
    if (signal?.aborted) {
      const error = new Error("Request cancelled.");
      error.name = "AbortError";
      throw error;
    }

    if (visitedPages.has(page)) {
      throw new Error(
        `Woosmap returned repeated pagination for page ${page}.`,
      );
    }

    visitedPages.add(page);

    const query = encodeQuery({
      private_key: privateKey,
      location: `${location.latitude},${location.longitude}`,
      radius: String(RADIUS_METERS),
      types: selectedTypes.join("|"),
      page: String(page),
      limit: String(PAGE_SIZE),
    });

    const response = await fetch(
      `${ENDPOINT}?${query}`,
      {
        method: "GET",
        signal,
        headers: {
          Accept: "application/json",
        },
      },
    );

    const responseText = await response.text();
    let body: unknown;

    try {
      body = JSON.parse(responseText);
    } catch {
      throw new Error(
        "Woosmap returned non-JSON content " +
          `(HTTP ${response.status}).`,
      );
    }

    if (debug) {
      // Never log the URL: it contains the private key.
      console.log(
        `Woosmap Nearby page ${page} (HTTP ${response.status}):`,
        JSON.stringify(body, null, 2),
      );
    }

    if (!response.ok) {
      throw new Error(
        getApiErrorMessage(response.status, body),
      );
    }

    const result = parseNearbyPage(body);

    for (const place of result.results) {
      places.set(place.public_id, place);
    }

    page = result.nextPage;
  }

  return Array.from(places.values());
}

// General-purpose entry point used by NearbyTab.
export function getNearbyPlaces(
  options: NearbySearchOptions,
): Promise<TourismPlace[]> {
  return getTourismPlacesWithin5Km(options);
}