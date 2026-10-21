// src/services/infoDatabase.ts

import * as SQLite from "expo-sqlite";

import type {
  TourismPlace,
} from "./woosmapTourism";

import type {
  WikipediaArticle,
} from "./wikipedia";

export type PlaceWithWikipedia = TourismPlace & {
  wikipedia: WikipediaArticle | null;
  wikiStatus:
    | "loading"
    | "found"
    | "not-found"
    | "error";
};

export type CityInfo = {
  name: string;
  country: string | null;
  wikipedia: WikipediaArticle | null;
};

export type CityStatus =
  | "loading"
  | "found"
  | "not-found"
  | "wiki-error"
  | "permission-denied"
  | "unsupported"
  | "error";

export type InfoSnapshot = {
  locationId: number;
  locationName: string;
  latitude: number;
  longitude: number;

  cityInfo: CityInfo | null;
  cityStatus: CityStatus;

  places: PlaceWithWikipedia[];

  placesUpdatedAt: string | null;
  cityUpdatedAt: string | null;
};

export type OfflineWikipediaArticle = {
  sourceUrl: string;
  title: string;
  language: string;
  pageId: number;
  revisionId: number;
  html: string;
  savedAt: string;
};

type SnapshotRow = {
  snapshot_json: string;
  schema_version: number;
};

type ArticleRow = {
  source_url: string;
  title: string;
  language: string;
  page_id: number;
  revision_id: number;
  html_content: string;
  saved_at: string;
};

let databasePromise:
  | Promise<SQLite.SQLiteDatabase>
  | null = null;

async function initializeDatabase():
  Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(
    "info.db",
  );

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS info_snapshots (
      location_id INTEGER PRIMARY KEY,
      snapshot_json TEXT NOT NULL,
      schema_version INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS offline_wikipedia_articles (
      source_url TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      language TEXT NOT NULL,
      page_id INTEGER NOT NULL,
      revision_id INTEGER NOT NULL,
      html_content TEXT NOT NULL,
      saved_at TEXT NOT NULL
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

export async function loadInfoSnapshot(
  locationId: number,
): Promise<InfoSnapshot | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<SnapshotRow>(
    `
      SELECT snapshot_json, schema_version
      FROM info_snapshots
      WHERE location_id = ?
    `,
    locationId,
  );

  if (!row) return null;

  if (row.schema_version !== 1) {
    throw new Error(
      "Unsupported saved information version.",
    );
  }

  const snapshot =
    JSON.parse(row.snapshot_json) as InfoSnapshot;

  if (
    !snapshot ||
    snapshot.locationId !== locationId ||
    !Array.isArray(snapshot.places)
  ) {
    throw new Error(
      "The saved information is invalid.",
    );
  }

  return snapshot;
}

export async function saveInfoSnapshot(
  snapshot: InfoSnapshot,
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `
      INSERT INTO info_snapshots (
        location_id,
        snapshot_json,
        schema_version
      )
      VALUES (?, ?, 1)
      ON CONFLICT(location_id) DO UPDATE SET
        snapshot_json = excluded.snapshot_json,
        schema_version = excluded.schema_version
    `,
    snapshot.locationId,
    JSON.stringify(snapshot),
  );
}

export async function loadOfflineWikipediaArticle(
  sourceUrl: string,
): Promise<OfflineWikipediaArticle | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<ArticleRow>(
    `
      SELECT
        source_url,
        title,
        language,
        page_id,
        revision_id,
        html_content,
        saved_at
      FROM offline_wikipedia_articles
      WHERE source_url = ?
    `,
    sourceUrl,
  );

  if (!row) return null;

  return {
    sourceUrl: row.source_url,
    title: row.title,
    language: row.language,
    pageId: row.page_id,
    revisionId: row.revision_id,
    html: row.html_content,
    savedAt: row.saved_at,
  };
}

export async function saveOfflineWikipediaArticle(
  article: OfflineWikipediaArticle,
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `
      INSERT INTO offline_wikipedia_articles (
        source_url,
        title,
        language,
        page_id,
        revision_id,
        html_content,
        saved_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_url) DO UPDATE SET
        title = excluded.title,
        language = excluded.language,
        page_id = excluded.page_id,
        revision_id = excluded.revision_id,
        html_content = excluded.html_content,
        saved_at = excluded.saved_at
    `,
    article.sourceUrl,
    article.title,
    article.language,
    article.pageId,
    article.revisionId,
    article.html,
    article.savedAt,
  );
}