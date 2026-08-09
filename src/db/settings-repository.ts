import { eq } from 'drizzle-orm';
import { z } from 'zod';

import type { Database } from './client';
import { appSettings } from './schema';

/**
 * Typed access to the key/value settings table.
 *
 * Every read is validated, so a value written by an older build — or corrupted on
 * disk — degrades to the documented default instead of crashing a screen.
 */

export const SETTING_KEYS = {
  appearance: 'appearance',
  reminderEnabled: 'reminder_enabled',
  reminderTime: 'reminder_time',
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

export const appearanceSchema = z.enum(['system', 'light', 'dark']);
export type AppearancePreference = z.infer<typeof appearanceSchema>;

/** `HH:mm` in 24-hour local time. */
export const reminderTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const booleanSchema = z.enum(['true', 'false']).transform((value) => value === 'true');

/**
 * The subset of the Drizzle API shared by the database handle and a transaction
 * handle, so helpers can run inside or outside a transaction without casting.
 */
type SqliteExecutor = Pick<Database, 'select' | 'insert' | 'delete'>;

function readRaw(db: SqliteExecutor, key: SettingKey): string | null {
  return db.select().from(appSettings).where(eq(appSettings.key, key)).get()?.value ?? null;
}

function writeRaw(db: SqliteExecutor, key: SettingKey, value: string): void {
  db.insert(appSettings)
    .values({ key, value, updatedAt: Date.now() })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: Date.now() } })
    .run();
}

function readValidated<T>(db: SqliteExecutor, key: SettingKey, schema: z.ZodType<T>, fallback: T): T {
  const raw = readRaw(db, key);
  if (raw === null) return fallback;
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : fallback;
}

export function getAppearancePreference(db: Database): AppearancePreference {
  return readValidated(db, SETTING_KEYS.appearance, appearanceSchema, 'system');
}

export function setAppearancePreference(db: Database, value: AppearancePreference): void {
  writeRaw(db, SETTING_KEYS.appearance, value);
}

export interface ReminderSettings {
  readonly enabled: boolean;
  /** `HH:mm`, local. */
  readonly time: string;
}

export const DEFAULT_REMINDER_TIME = '07:00';

export function getReminderSettings(db: Database): ReminderSettings {
  return {
    enabled: readValidated(db, SETTING_KEYS.reminderEnabled, booleanSchema, false),
    time: readValidated(db, SETTING_KEYS.reminderTime, reminderTimeSchema, DEFAULT_REMINDER_TIME),
  };
}

export function setReminderSettings(db: Database, settings: ReminderSettings): void {
  db.transaction((tx) => {
    writeRaw(tx, SETTING_KEYS.reminderEnabled, settings.enabled ? 'true' : 'false');
    writeRaw(tx, SETTING_KEYS.reminderTime, settings.time);
  });
}

export function clearAllSettings(db: Database): void {
  db.delete(appSettings).run();
}
