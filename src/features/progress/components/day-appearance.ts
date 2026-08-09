import { format } from 'date-fns';

import { formatReferenceSpan } from '@/features/reading-plan/domain/reference';
import type { DayReading, ReadingStatus } from '@/features/reading-plan/domain/types';
import type { Theme } from '@/theme/tokens';
import { fromDateKey } from '@/utils/date-key';


export interface DayAppearance {
  /** Circle fill behind the numeral. `transparent` leaves the cell flat. */
  fill: string;
  /** Ring colour, used to mark today. */
  ring: string;
  ringWidth: number;
  textColor: string;
  fontWeight: '400' | '500' | '600';
  opacity: number;
}

/**
 * Maps a reading status to its calendar treatment.
 *
 * Missed days get a soft neutral fill rather than a warning colour: the product
 * should encourage consistency, not scold. Completed days rely on a solid accent
 * circle alone — at this density an extra check badge reads as clutter, and the
 * filled state is already unambiguous.
 */
export function getDayAppearance(
  status: ReadingStatus,
  theme: Theme,
  options: { isToday: boolean; inCurrentMonth: boolean },
): DayAppearance {
  const base: DayAppearance = {
    fill: 'transparent',
    ring: 'transparent',
    ringWidth: 0,
    textColor: theme.colors.textSecondary,
    fontWeight: '500',
    opacity: options.inCurrentMonth ? 1 : 0.28,
  };

  const todayRing = options.isToday
    ? { ring: theme.colors.accent, ringWidth: 2 }
    : { ring: 'transparent', ringWidth: 0 };

  switch (status) {
    case 'completed':
      return {
        ...base,
        ...todayRing,
        fill: theme.colors.accent,
        textColor: theme.colors.onAccent,
        fontWeight: '600',
      };
    case 'today-pending':
      return {
        ...base,
        ring: theme.colors.accent,
        ringWidth: 2,
        textColor: theme.colors.accent,
        fontWeight: '600',
      };
    case 'missed':
      return { ...base, fill: theme.colors.surfaceSubtle, textColor: theme.colors.textTertiary };
    case 'upcoming':
      return { ...base, ...todayRing, textColor: theme.colors.textTertiary };
    case 'before-plan':
    case 'canon-complete':
    case 'no-plan':
      return {
        ...base,
        ...todayRing,
        textColor: theme.colors.textTertiary,
        opacity: options.inCurrentMonth ? 0.5 : 0.24,
      };
  }
}

const STATUS_DESCRIPTION: Record<ReadingStatus, string> = {
  completed: 'completed',
  'today-pending': 'not read yet',
  missed: 'not read',
  upcoming: 'scheduled',
  'before-plan': 'before your plan began',
  'canon-complete': 'plan finished',
  'no-plan': 'no reading scheduled',
};

/** "Monday 24 August, Genesis 24, completed" */
export function describeDay(day: DayReading, isToday: boolean): string {
  const datePart = format(fromDateKey(day.date), 'EEEE d MMMM');
  const prefix = isToday ? `Today, ${datePart}` : datePart;

  const reference =
    day.scheduled.kind === 'scheduled' ? formatReferenceSpan(day.scheduled.chapters) : null;

  return [prefix, reference, STATUS_DESCRIPTION[day.status]].filter((part) => part !== null).join(', ');
}
