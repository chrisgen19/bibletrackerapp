import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as SQLite from 'expo-sqlite';

import * as schema from './schema';

export const DATABASE_NAME = 'chapter.db';

/**
 * The single typed handle passed to repositories.
 *
 * The Expo driver is synchronous, so repository functions are plain function
 * calls rather than promises — no loading state is needed for a local read.
 */
export type Database = ExpoSQLiteDatabase<typeof schema>;

/**
 * Any *synchronous* SQLite handle over this schema.
 *
 * Repositories take this rather than the Expo-specific type so the same code can
 * be driven by a Node SQLite driver under test. The two differ only in their run-result
 * type, which repositories never inspect.
 */
export type ReadingDatabase = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

export function createDatabase(sqlite: SQLite.SQLiteDatabase): Database {
  return drizzle(sqlite, { schema });
}

/**
 * Foreign keys are off by default in SQLite, which would let completions outlive
 * a deleted plan. Enabling them makes `ON DELETE CASCADE` in the schema real.
 */
export function configureConnection(sqlite: SQLite.SQLiteDatabase): void {
  sqlite.execSync('PRAGMA journal_mode = WAL;');
  sqlite.execSync('PRAGMA foreign_keys = ON;');
}
