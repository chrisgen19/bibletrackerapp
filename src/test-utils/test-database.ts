import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';


import type { ReadingDatabase } from '@/db/client';
import * as schema from '@/db/schema';

/**
 * An in-memory database for repository tests.
 *
 * Repositories accept any synchronous SQLite handle, so the code under test is
 * exactly the code that ships — only the engine underneath differs (better-sqlite3
 * here, Expo's SQLite on device). `better-sqlite3` is a devDependency and never
 * reaches the app bundle.
 *
 * The schema is applied from the *generated migration* rather than a hand-written
 * copy, so a migration that would fail on device fails here too.
 */
export function createTestDatabase(): ReadingDatabase {
  const sqlite = new BetterSqlite3(':memory:');

  // Match the pragma the app sets at open, so ON DELETE CASCADE behaves the same.
  sqlite.pragma('foreign_keys = ON');

  const migration = readFileSync(join(__dirname, '../../drizzle/0000_init.sql'), 'utf8');
  for (const statement of migration.split('--> statement-breakpoint')) {
    const trimmed = statement.trim();
    if (trimmed.length > 0) sqlite.exec(trimmed);
  }

  return drizzle(sqlite, { schema });
}
