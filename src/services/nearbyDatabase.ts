// src/services/nearbyDatabase.ts

import * as SQLite from "expo-sqlite";

import type { SelectedMapPlace } from "../navigation/types";

//define saved place row type
type SavedPlaceRow = {
  place_id: string;
  name: string;
  latitude: number;
  longitude: number;
  formatted_address: string | null;
  is_starting_location: number;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

// Initialization of Database
async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync("nearby.db");

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS nearby_selected_places (
      origin_id TEXT NOT NULL,
      place_id TEXT NOT NULL,
      name TEXT NOT NULL,

      latitude REAL NOT NULL
        CHECK (latitude BETWEEN -90 AND 90),

      longitude REAL NOT NULL
        CHECK (longitude BETWEEN -180 AND 180),

      formatted_address TEXT,

      is_starting_location INTEGER NOT NULL
        CHECK (is_starting_location IN (0, 1)),

      sort_order INTEGER NOT NULL,
      saved_at TEXT NOT NULL,

      PRIMARY KEY (origin_id, place_id)
    );
  `);

  return db;
}

//function to get database
async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = initializeDatabase().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }

  return databasePromise;
}

//function to validate a place is legible
function validatePlace(place: SelectedMapPlace): void {
  if (!place.id.trim() || !place.name.trim()) {
    throw new Error("A selected place must have an ID and a name.");
  }

  if (
    !Number.isFinite(place.latitude) ||
    !Number.isFinite(place.longitude) ||
    place.latitude < -90 ||
    place.latitude > 90 ||
    place.longitude < -180 ||
    place.longitude > 180
  ) {
    throw new Error(`Invalid coordinates for "${place.name}".`);
  }
}

//function to save nearby selection
export async function saveNearbySelection(
  startingPlace: SelectedMapPlace,
  destinations: readonly SelectedMapPlace[],
): Promise<void> {
  validatePlace(startingPlace);

  const originId = startingPlace.id;

  const uniqueDestinations = new Map<string, SelectedMapPlace>();

  for (const destination of destinations) {
    validatePlace(destination);

    // The starting location is inserted separately.
    if (destination.id === originId) {
      continue;
    }

    uniqueDestinations.set(destination.id, {
      ...destination,
      isStartingLocation: false,
    });
  }

  const placesToSave: SelectedMapPlace[] = [
    {
      ...startingPlace,
      isStartingLocation: true,
    },
    ...uniqueDestinations.values(),
  ];

  const db = await getDatabase();
  const savedAt = new Date().toISOString();

  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      `
        DELETE FROM nearby_selected_places
        WHERE origin_id = ?
      `,
      originId,
    );

    for (const [index, place] of placesToSave.entries()) {
      await transaction.runAsync(
        `
          INSERT INTO nearby_selected_places (
            origin_id,
            place_id,
            name,
            latitude,
            longitude,
            formatted_address,
            is_starting_location,
            sort_order,
            saved_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        originId,
        place.id,
        place.name,
        place.latitude,
        place.longitude,
        place.formatted_address ?? null,
        place.isStartingLocation ? 1 : 0,
        index,
        savedAt,
      );
    }
  });
}

//function to load nearby selection
export async function loadNearbySelection(
  originId: string,
): Promise<SelectedMapPlace[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<SavedPlaceRow>(
    `
      SELECT
        place_id,
        name,
        latitude,
        longitude,
        formatted_address,
        is_starting_location
      FROM nearby_selected_places
      WHERE origin_id = ?
        AND is_starting_location = 0
      ORDER BY sort_order ASC
    `,
    originId,
  );

  return rows.map((row) => ({
    id: row.place_id,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    formatted_address: row.formatted_address,
    isStartingLocation: false,
  }));
}
