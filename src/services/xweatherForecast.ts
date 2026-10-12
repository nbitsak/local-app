export type ForecastPeriod = {
  timestamp: number;
  dateTimeISO: string;
  weather: string | null;
  tempC: number | null;
  maxTempC: number | null;
  minTempC: number | null;
  pop: number | null;
  precipMM: number | null;
  windSpeedKPH: number | null;
};

type ForecastLocation = {
  periods: ForecastPeriod[];
  profile: {
    tz: string;
  };
};

type ForecastApiResponse = {
  success: boolean;
  error?: {
    code?: string;
    description?: string;
  } | null;
  response?: ForecastLocation[] | null;
};

export type ForecastResult = {
  timezone: string;
  today: ForecastPeriod | null;
  todayHourly: ForecastPeriod[];
  week: ForecastPeriod[];
};

export type ForecastOptions = {
  latitude: number;
  longitude: number;
  clientId: string;
  clientSecret: string;
  signal?: AbortSignal;
};

type ForecastFilter = "day" | "1hr";

export class XweatherForecastError extends Error {
  readonly status: number | null;
  readonly filter: ForecastFilter;
  readonly details: string;

  constructor({
    message,
    status = null,
    filter,
    details = "",
  }: {
    message: string;
    status?: number | null;
    filter: ForecastFilter;
    details?: string;
  }) {
    super(message);
    this.name = "XweatherForecastError";
    this.status = status;
    this.filter = filter;
    this.details = details;
  }
}

function redactCredentials(
  text: string,
  options: ForecastOptions,
): string {
  let result = text;

  for (const value of [options.clientId, options.clientSecret]) {
    if (!value) continue;

    result = result
      .split(value)
      .join("[REDACTED]")
      .split(encodeURIComponent(value))
      .join("[REDACTED]");
  }

  return result;
}

function localDateKey(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const getPart = (type: string): string => {
    const value = parts.find((part) => part.type === type)?.value;

    if (!value) {
      throw new Error(`Unable to determine date component: ${type}`);
    }

    return value;
  };

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}

function validateOptions(options: ForecastOptions): void {
  const { latitude, longitude, clientId, clientSecret } = options;

  if (!clientId?.trim() || !clientSecret?.trim()) {
    throw new Error("Missing Xweather client ID or client secret.");
  }

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    throw new Error("Invalid latitude or longitude.");
  }
}

async function requestForecast(
  options: ForecastOptions,
  filter: ForecastFilter,
  limit: number,
): Promise<ForecastLocation> {
  const location = `${options.latitude},${options.longitude}`;

  const params: Record<string, string> = {
    client_id: options.clientId,
    client_secret: options.clientSecret,
    filter,
    limit: String(limit),
  };

  const query = Object.entries(params)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&");

  const url =
    "https://data.api.xweather.com/forecasts/" +
    `${encodeURIComponent(location)}?${query}`;

  let response: Response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: options.signal,
    });
  } catch (error: unknown) {
    // Preserve cancellation instead of reporting it as an API failure.
    if (options.signal?.aborted) {
      throw error;
    }

    const details = redactCredentials(
      error instanceof Error ? error.message : String(error),
      options,
    );

    throw new XweatherForecastError({
      message:
        `Xweather network error [filter=${filter}, limit=${limit}]: ` +
        details,
      filter,
      details,
    });
  }

  const rawBody = await response.text();
  const safeBody = redactCredentials(rawBody, options).slice(0, 1500);

  if (!response.ok) {
    throw new XweatherForecastError({
      message:
        `Xweather HTTP ${response.status} ` +
        `[filter=${filter}, limit=${limit}]: ` +
        (safeBody || "Empty response body"),
      status: response.status,
      filter,
      details: safeBody,
    });
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new XweatherForecastError({
      message: `Xweather returned invalid JSON [filter=${filter}].`,
      status: response.status,
      filter,
      details: safeBody,
    });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new XweatherForecastError({
      message: `Xweather returned an invalid response [filter=${filter}].`,
      status: response.status,
      filter,
      details: safeBody,
    });
  }

  // Basic envelope validation; not full field-by-field schema validation.
  const data = parsed as ForecastApiResponse;

  if (data.success !== true) {
    const description =
      typeof data.error?.description === "string"
        ? data.error.description
        : "Forecast request failed.";

    const details = redactCredentials(description, options);

    throw new XweatherForecastError({
      message: `Xweather API error [filter=${filter}]: ${details}`,
      status: response.status,
      filter,
      details,
    });
  }

  const forecast = Array.isArray(data.response)
    ? data.response[0]
    : undefined;

  if (!forecast || !Array.isArray(forecast.periods)) {
    throw new XweatherForecastError({
      message: `Xweather returned no forecast data [filter=${filter}].`,
      status: response.status,
      filter,
      details: safeBody,
    });
  }

  if (
    typeof forecast.profile?.tz !== "string" ||
    !forecast.profile.tz
  ) {
    throw new XweatherForecastError({
      message: `Xweather returned no location timezone [filter=${filter}].`,
      status: response.status,
      filter,
      details: safeBody,
    });
  }

  return forecast;
}

export async function getForecasts(
  options: ForecastOptions,
): Promise<ForecastResult> {
  validateOptions(options);

  // Sequential requests make failures easier to isolate.
  // If either request fails, the function rejects with its details.
  const daily = await requestForecast(options, "day", 7);
  const hourly = await requestForecast(options, "1hr", 24);

  const now = new Date();
  const timezone = daily.profile.tz;
  const todayKey = localDateKey(now, timezone);

  const week = daily.periods.slice(0, 7);

  const today =
    week.find((period) => {
      const date = new Date(period.dateTimeISO);

      return (
        Number.isFinite(date.getTime()) &&
        localDateKey(date, timezone) === todayKey
      );
    }) ?? null;

  const todayHourly = hourly.periods.filter((period) => {
    const date = new Date(period.dateTimeISO);

    return (
      Number.isFinite(date.getTime()) &&
      date.getTime() >= now.getTime() &&
      localDateKey(date, timezone) === todayKey
    );
  });

  return {
    timezone,
    today,
    todayHourly,
    week,
  };
}

