import { addMonths, endOfMonth, format, startOfMonth } from 'date-fns';

import { eachDateKeyInRange, fromDateKey, toDateKey, type DateKey } from '@/utils/date-key';

/** A month identified independently of any timezone, e.g. `{ year: 2026, month: 8 }`. */
export interface MonthKey {
  readonly year: number;
  /** 1-based, matching how humans say "August is month 8". */
  readonly month: number;
}

export interface CalendarCell {
  readonly date: DateKey;
  readonly dayOfMonth: number;
  readonly inCurrentMonth: boolean;
}

export interface CalendarMonth {
  readonly key: MonthKey;
  readonly title: string;
  readonly shortTitle: string;
  /** Every day belonging to the month itself, in order. */
  readonly monthDates: readonly DateKey[];
  /** Sunday-first rows padded with adjacent-month days. 4, 5 or 6 rows. */
  readonly weeks: readonly (readonly CalendarCell[])[];
}

export const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
export const WEEKDAY_ACCESSIBILITY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const DAYS_PER_WEEK = 7;

export function toMonthKey(date: Date): MonthKey {
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function monthKeyFromDateKey(key: DateKey): MonthKey {
  return toMonthKey(fromDateKey(key));
}

export function monthKeyToDate(key: MonthKey): Date {
  return new Date(key.year, key.month - 1, 1, 12, 0, 0, 0);
}

export function addMonthsToMonthKey(key: MonthKey, amount: number): MonthKey {
  return toMonthKey(addMonths(monthKeyToDate(key), amount));
}

export function monthKeysEqual(a: MonthKey, b: MonthKey): boolean {
  return a.year === b.year && a.month === b.month;
}

/** Stable identity for list keys and memo caches. */
export function monthKeyId(key: MonthKey): string {
  return `${key.year}-${String(key.month).padStart(2, '0')}`;
}

export function compareMonthKeys(a: MonthKey, b: MonthKey): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

/**
 * Builds a Sunday-first grid for the month.
 *
 * Leading and trailing cells come from the neighbouring months so every row holds
 * seven cells; February in a non-leap year starting on Sunday yields 4 rows, and a
 * 31-day month starting on Friday yields 6.
 */
export function buildCalendarMonth(key: MonthKey): CalendarMonth {
  const anchor = monthKeyToDate(key);
  const first = startOfMonth(anchor);
  const last = endOfMonth(anchor);

  const leading = first.getDay();
  const trailing = DAYS_PER_WEEK - 1 - last.getDay();

  const gridStart = new Date(first.getFullYear(), first.getMonth(), first.getDate() - leading, 12, 0, 0, 0);
  const gridEnd = new Date(last.getFullYear(), last.getMonth(), last.getDate() + trailing, 12, 0, 0, 0);

  const monthStartKey = toDateKey(first);
  const monthEndKey = toDateKey(last);
  const monthDates = eachDateKeyInRange(monthStartKey, monthEndKey);

  const cells: CalendarCell[] = eachDateKeyInRange(toDateKey(gridStart), toDateKey(gridEnd)).map((date) => ({
    date,
    dayOfMonth: fromDateKey(date).getDate(),
    inCurrentMonth: date >= monthStartKey && date <= monthEndKey,
  }));

  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += DAYS_PER_WEEK) {
    weeks.push(cells.slice(i, i + DAYS_PER_WEEK));
  }

  return {
    key,
    title: format(first, 'MMMM yyyy'),
    shortTitle: format(first, 'MMM yyyy'),
    monthDates,
    weeks,
  };
}
