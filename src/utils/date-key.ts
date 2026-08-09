import { addDays, differenceInCalendarDays, format, isValid, parse } from 'date-fns';

/**
 * A calendar day in the user's *local* timezone, formatted `YYYY-MM-DD`.
 *
 * Every persisted day boundary in the app is expressed as a `DateKey`. Using a
 * local calendar string (rather than a UTC timestamp) is what makes a reading
 * marked at 11:50 PM belong to the day the user experienced, not to the next
 * UTC day.
 */
export type DateKey = string;

export const DATE_KEY_FORMAT = 'yyyy-MM-dd';

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Converts a `Date` to its local calendar day key. */
export function toDateKey(date: Date): DateKey {
  return format(date, DATE_KEY_FORMAT);
}

/**
 * Expands a day key back into a `Date` anchored at local noon.
 *
 * Noon (rather than midnight) keeps day arithmetic stable across daylight
 * saving transitions, where a local midnight can be skipped or repeated.
 */
export function fromDateKey(key: DateKey): Date {
  const parsed = parse(key, DATE_KEY_FORMAT, new Date());
  parsed.setHours(12, 0, 0, 0);
  return parsed;
}

export function isValidDateKey(value: string): boolean {
  if (!DATE_KEY_PATTERN.test(value)) return false;
  const parsed = parse(value, DATE_KEY_FORMAT, new Date());
  return isValid(parsed) && format(parsed, DATE_KEY_FORMAT) === value;
}

export function getTodayDateKey(now: Date = new Date()): DateKey {
  return toDateKey(now);
}

export function addDaysToDateKey(key: DateKey, days: number): DateKey {
  return toDateKey(addDays(fromDateKey(key), days));
}

/** Whole calendar days from `from` to `to`. Negative when `to` precedes `from`. */
export function daysBetweenDateKeys(from: DateKey, to: DateKey): number {
  return differenceInCalendarDays(fromDateKey(to), fromDateKey(from));
}

export function compareDateKeys(a: DateKey, b: DateKey): number {
  // `YYYY-MM-DD` sorts correctly as a plain string.
  return a < b ? -1 : a > b ? 1 : 0;
}

export function minDateKey(a: DateKey, b: DateKey): DateKey {
  return a <= b ? a : b;
}

export function maxDateKey(a: DateKey, b: DateKey): DateKey {
  return a >= b ? a : b;
}

/**
 * Every day from `start` to `end`, inclusive. Empty when `end` precedes `start`.
 *
 * Walks a single mutable cursor rather than re-parsing each key, which keeps
 * multi-year timeline scans (streaks, longest-streak) cheap.
 */
export function eachDateKeyInRange(start: DateKey, end: DateKey): DateKey[] {
  const total = daysBetweenDateKeys(start, end) + 1;
  if (total <= 0) return [];

  const keys: DateKey[] = new Array<DateKey>(total);
  const cursor = fromDateKey(start);
  for (let i = 0; i < total; i += 1) {
    keys[i] = toDateKey(cursor);
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

/** Inclusive on both ends. */
export function isDateKeyWithin(key: DateKey, start: DateKey, end: DateKey | null): boolean {
  if (key < start) return false;
  if (end !== null && key > end) return false;
  return true;
}
