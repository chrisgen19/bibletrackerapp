import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
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
