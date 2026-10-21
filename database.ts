import * as SQLite from "expo-sqlite";

//Description of location type
export type Location = {
  id: number;
  real_location: string;
  city: string;
  country_code: string;
  latitude: number;
  longitude: number;
  source_url: string;
};

// Description of new location type 
export type NewLocation = Omit<Location, "id">;

// Description of result of saving location
export type SaveLocationResult =
  | {
      saved: true;
      location: Location;
    }
  | {
      saved: false;
      existingLocation: Location;
      distanceMeters: number;
    };

// Minimum distance to register a new location
const MIN_DISTANCE_METERS = 100;

// Initialization of Database
async function initializeDatabase() {
  const db = await SQLite.openDatabaseAsync("locations.db");

// Creation of table if it not exists already
// type of database record is
// id,real_location_city, country_code, latitude, longitude, source_url
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY,
      real_location TEXT NOT NULL,
      city TEXT NOT NULL,
      country_code TEXT NOT NULL DEFAULT 'GR',
      latitude REAL NOT NULL
        CHECK (latitude BETWEEN -90 AND 90),
      longitude REAL NOT NULL
        CHECK (longitude BETWEEN -180 AND 180),
      source_url TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_locations_coordinates
      ON locations (latitude, longitude);
  `);

  return db;
}

let databasePromise:
  | ReturnType<typeof initializeDatabase>
  | undefined;

//function to get database data
function getDatabase() {
  if (!databasePromise) {
    databasePromise = initializeDatabase().catch((error) => {
      databasePromise = undefined;
      throw error;
    });
  }

  return databasePromise;
}

//function to convert degrees to radians
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

//function to calculate distance in meters between locations
function distanceInMeters(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number
): number {
  const earthRadiusMeters = 6_371_000;

  const deltaLatitude = toRadians(latitude2 - latitude1);
  const deltaLongitude = toRadians(longitude2 - longitude1);

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(latitude1)) *
      Math.cos(toRadians(latitude2)) *
      Math.sin(deltaLongitude / 2) ** 2;

  // protection from minor mistakes
  const clampedA = Math.max(0, Math.min(1, a));

  const angularDistance =
    2 *
    Math.atan2(
      Math.sqrt(clampedA),
      Math.sqrt(1 - clampedA)
    );

  return earthRadiusMeters * angularDistance;
}

// serializes this function calls
// as two parallel tries not to read
// same old data before saving
let saveQueue: Promise<void> = Promise.resolve();

//function to save location if it is far enough from already saved
export function saveLocationIfFarEnough(
  location: NewLocation
): Promise<SaveLocationResult> {
  const operation = saveQueue.then(() =>
    checkAndSaveLocation(location)
  );

  saveQueue = operation.then(
    () => undefined,
    () => undefined
  );

  return operation;
}

//function to check if location is eligible, and save it to db
async function checkAndSaveLocation(
  location: NewLocation
): Promise<SaveLocationResult> {
  if (
    !Number.isFinite(location.latitude) ||
    !Number.isFinite(location.longitude) ||
    location.latitude < -90 ||
    location.latitude > 90 ||
    location.longitude < -180 ||
    location.longitude > 180
  ) {
    throw new Error("Οι συντεταγμένες δεν είναι έγκυρες.");
  }

  const db = await getDatabase();

  let outcome: SaveLocationResult | undefined;

  await db.withExclusiveTransactionAsync(async (txn) => {
    const existingLocations =
      await txn.getAllAsync<Location>(
        "SELECT * FROM locations"
      );

    let nearestLocation: Location | undefined;
    let nearestDistance = Infinity;

    for (const existing of existingLocations) {
      const distance = distanceInMeters(
        location.latitude,
        location.longitude,
        existing.latitude,
        existing.longitude
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestLocation = existing;
      }
    }

    if (
      nearestLocation &&
      nearestDistance <= MIN_DISTANCE_METERS
    ) {
      outcome = {
        saved: false,
        existingLocation: nearestLocation,
        distanceMeters: nearestDistance,
      };

      return;
    }

    const result = await txn.runAsync(
      `
        INSERT INTO locations (
          real_location,
          city,
          country_code,
          latitude,
          longitude,
          source_url
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      location.real_location,
      location.city,
      location.country_code,
      location.latitude,
      location.longitude,
      location.source_url
    );

    outcome = {
      saved: true,
      location: {
        id: result.lastInsertRowId,
        ...location,
      },
    };
  });

  if (!outcome) {
    throw new Error(
      "Δεν ολοκληρώθηκε ο έλεγχος αποθήκευσης."
    );
  }

  return outcome;
}