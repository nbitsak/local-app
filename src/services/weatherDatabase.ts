// src/services/weatherDatabase.ts

import * as SQLite from "expo-sqlite";

import type {
  ForecastResult,
} from "./xweatherForecast";

export type WeatherLocation = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
};

export type SavedForecastSummary = {
  id: number;
  location_id: number;
  location_name: string;
  latitude: number;
  longitude: number;
  fetched_at: string;
  saved_at: string;
};

export type SavedForecast = SavedForecastSummary & {
  forecast: ForecastResult;
};

type SavedForecastRow = SavedForecastSummary & {
  schema_version: number;
  forecast_json: string;
};

const DATABASE_NAME = "weather.db";
const SNAPSHOT_VERSION = 1;

let databasePromise:
  | Promise<SQLite.SQLiteDatabase>
  | null = null;

async function initializeDatabase():
  Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(
    DATABASE_NAME,
  );

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS saved_weather_forecasts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      location_id INTEGER NOT NULL,
      location_name TEXT NOT NULL,

      latitude REAL NOT NULL
        CHECK (latitude BETWEEN -90 AND 90),

      longitude REAL NOT NULL
        CHECK (longitude BETWEEN -180 AND 180),

      fetched_at TEXT NOT NULL,
      saved_at TEXT NOT NULL,

      schema_version INTEGER NOT NULL,
      forecast_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS
      idx_saved_weather_location_date
    ON saved_weather_forecasts (
      location_id,
      saved_at DESC,
      id DESC
    );
  `);

  return db;
}

async function getDatabase():
  Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = initializeDatabase().catch(
      (error) => {
        databasePromise = null;
        throw error;
      },
    );
  }

  return databasePromise;
}

function validateLocation(
  location: WeatherLocation,
): void {
  if (
    !Number.isInteger(location.id) ||
    !location.name.trim() ||
    !Number.isFinite(location.latitude) ||
    !Number.isFinite(location.longitude) ||
    location.latitude < -90 ||
    location.latitude > 90 ||
    location.longitude < -180 ||
    location.longitude > 180
  ) {
    throw new Error(
      "A valid location is required to save the forecast.",
    );
  }
}

function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function parseStoredForecast(
  json: string,
): ForecastResult {
  let value: unknown;

  try {
    value = JSON.parse(json);
  } catch {
    throw new Error(
      "The saved forecast contains invalid JSON.",
    );
  }

  // Basic snapshot validation for the fields used by WeatherTab.
  if (
    !isObject(value) ||
    typeof value.timezone !== "string" ||
    !Array.isArray(value.todayHourly) ||
    !Array.isArray(value.week) ||
    !(
      value.today === null ||
      isObject(value.today)
    )
  ) {
    throw new Error(
      "The saved forecast has an unsupported format.",
    );
  }

  return value as unknown as ForecastResult;
}

export async function saveWeatherForecast({
  location,
  forecast,
  fetchedAt,
}: {
  location: WeatherLocation;
  forecast: ForecastResult;
  fetchedAt: string;
}): Promise<SavedForecastSummary> {
  validateLocation(location);

  const fetchedTimestamp = Date.parse(fetchedAt);

  if (!Number.isFinite(fetchedTimestamp)) {
    throw new Error(
      "The forecast retrieval date is invalid.",
    );
  }

  const forecastJson = JSON.stringify(forecast);

  // Verify that the snapshot can be read before inserting it.
  parseStoredForecast(forecastJson);

  const normalizedFetchedAt =
    new Date(fetchedTimestamp).toISOString();

  const savedAt = new Date().toISOString();

  const db = await getDatabase();

  const result = await db.runAsync(
    `
      INSERT INTO saved_weather_forecasts (
        location_id,
        location_name,
        latitude,
        longitude,
        fetched_at,
        saved_at,
        schema_version,
        forecast_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    location.id,
    location.name,
    location.latitude,
    location.longitude,
    normalizedFetchedAt,
    savedAt,
    SNAPSHOT_VERSION,
    forecastJson,
  );

  return {
    id: result.lastInsertRowId,
    location_id: location.id,
    location_name: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
    fetched_at: normalizedFetchedAt,
    saved_at: savedAt,
  };
}

export async function listSavedWeatherForecasts(
  locationId: number,
): Promise<SavedForecastSummary[]> {
  const db = await getDatabase();

  return db.getAllAsync<SavedForecastSummary>(
    `
      SELECT
        id,
        location_id,
        location_name,
        latitude,
        longitude,
        fetched_at,
        saved_at
      FROM saved_weather_forecasts
      WHERE location_id = ?
      ORDER BY saved_at DESC, id DESC
    `,
    locationId,
  );
}

export async function getSavedWeatherForecast(
  id: number,
  locationId: number,
): Promise<SavedForecast | null> {
  const db = await getDatabase();

  const row =
    await db.getFirstAsync<SavedForecastRow>(
      `
        SELECT
          id,
          location_id,
          location_name,
          latitude,
          longitude,
          fetched_at,
          saved_at,
          schema_version,
          forecast_json
        FROM saved_weather_forecasts
        WHERE id = ?
          AND location_id = ?
      `,
      id,
      locationId,
    );

  if (!row) {
    return null;
  }

  if (row.schema_version !== SNAPSHOT_VERSION) {
    throw new Error(
      "This saved forecast uses an unsupported version.",
    );
  }

  return {
    id: row.id,
    location_id: row.location_id,
    location_name: row.location_name,
    latitude: row.latitude,
    longitude: row.longitude,
    fetched_at: row.fetched_at,
    saved_at: row.saved_at,
    forecast: parseStoredForecast(row.forecast_json),
  };
}