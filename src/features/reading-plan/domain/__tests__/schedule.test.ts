import { PROTESTANT_CANON_INDEX } from '@/data/bible/canon-index';
import { addDaysToDateKey } from '@/utils/date-key';

import {
  calculateReadingForDate,
  calculateReadingStatus,
  createScheduleContext,
  getDayReading,
  isScheduledDay,
  resolvePlanForDate,
} from '../schedule';
import type { ReadingCompletion, ReadingPlan } from '../types';
import { makeCompletion, makeCompletions, makePlan } from './fixtures';

const TODAY = '2026-08-24';
const INDEX = PROTESTANT_CANON_INDEX;

function ctx(plans: readonly ReadingPlan[], rows: readonly ReadingCompletion[], today: string = TODAY) {
  return createScheduleContext(plans, rows, today, INDEX);
}
const chapters = (reading: ReturnType<typeof calculateReadingForDate>) =>
  reading.kind === 'scheduled' ? reading.chapters.map((c) => `${c.bookId} ${c.chapter}`) : reading.kind;

describe('the reading position follows the reader', () => {
  const plan = makePlan({ startDate: '2026-08-01', startBookId: 'GEN', startChapter: 1 });

  it('starts at the plan start when nothing has been read', () => {
    expect(chapters(calculateReadingForDate(plan, TODAY, ctx([plan], [])))).toEqual(['GEN 1']);
  });

  it('does not advance because days passed', () => {
    // 23 days elapsed since the plan began. The old model would say Genesis 24.
    const context = ctx([plan], []);
    expect(chapters(calculateReadingForDate(plan, TODAY, context))).toEqual(['GEN 1']);
  });

  it('advances one chapter per chapter read, not per day', () => {
    const rows = [
      makeCompletion('2026-08-01', { chapter: 1 }),
      makeCompletion('2026-08-05', { chapter: 2 }),
    ];
    expect(chapters(calculateReadingForDate(plan, TODAY, ctx([plan], rows)))).toEqual(['GEN 3']);
  });

  it('keeps a part-read chapter at the head of the queue', () => {
    const rows = [makeCompletion('2026-08-20', { chapter: 1, verses: { from: 1, to: 10 } })];
    // Today already has no reading, so the unfinished chapter is still what is owed.
    expect(chapters(calculateReadingForDate(plan, TODAY, ctx([plan], rows)))).toEqual(['GEN 1']);
  });

  it('steps over a chapter read out of order', () => {
    const rows = [
      makeCompletion('2026-08-01', { chapter: 1 }),
      makeCompletion('2026-08-02', { chapter: 3 }),
    ];
    // Genesis 2 is still owed; Genesis 3 is not offered twice.
    const context = ctx([plan], rows);
    expect(chapters(calculateReadingForDate(plan, TODAY, context))).toEqual(['GEN 2']);
    expect(chapters(calculateReadingForDate(plan, '2026-08-25', context))).toEqual(['GEN 4']);
  });

  it('crosses book boundaries by position, not by date', () => {
    const rows = Array.from({ length: 50 }, (_, i) =>
      makeCompletion(`2026-08-01`, { chapter: i + 1, bookId: 'GEN' }),
    );
    expect(chapters(calculateReadingForDate(plan, TODAY, ctx([plan], rows)))).toEqual(['EXO 1']);
  });

  it('reports a day before the plan started', () => {
    expect(calculateReadingForDate(plan, '2026-07-31', ctx([plan], []))).toEqual({ kind: 'before-plan' });
  });

  it('supports multi-chapter plans', () => {
    const three = makePlan({ startDate: '2026-08-01', chaptersPerDay: 3 });
    const context = ctx([three], []);
    expect(chapters(calculateReadingForDate(three, TODAY, context))).toEqual(['GEN 1', 'GEN 2', 'GEN 3']);
    expect(chapters(calculateReadingForDate(three, '2026-08-25', context))).toEqual(['GEN 4', 'GEN 5', 'GEN 6']);
  });
});

describe('a day that passed unread names no chapter', () => {
  const plan = makePlan({ startDate: '2026-08-01' });

  it('is not-scheduled rather than naming a chapter the reader never reached', () => {
    // The whole point: nothing was lost on this day, so nothing can be named.
    expect(calculateReadingForDate(plan, '2026-08-10', ctx([plan], []))).toEqual({ kind: 'not-scheduled' });
  });

  it('still reads as missed, neutrally', () => {
    expect(calculateReadingStatus(plan, '2026-08-10', ctx([plan], []))).toBe('missed');
  });

  it('shows exactly what was recorded when the day has a reading', () => {
    const rows = [makeCompletion('2026-08-10', { bookId: 'EXO', chapter: 7 })];
    expect(chapters(calculateReadingForDate(plan, '2026-08-10', ctx([plan], rows)))).toEqual(['EXO 7']);
  });

  it('does not change what a past day shows when more is read later', () => {
    const rows = [makeCompletion('2026-08-10', { bookId: 'EXO', chapter: 7 })];
    const later = [...rows, makeCompletion('2026-08-23', { bookId: 'EXO', chapter: 8 })];
    expect(chapters(calculateReadingForDate(plan, '2026-08-10', ctx([plan], rows)))).toEqual(['EXO 7']);
    expect(chapters(calculateReadingForDate(plan, '2026-08-10', ctx([plan], later)))).toEqual(['EXO 7']);
  });
});

describe('today and the days after it', () => {
  const plan = makePlan({ startDate: '2026-08-01' });

  it('gives tomorrow the next chapter after today when today is unread', () => {
    const context = ctx([plan], []);
    expect(chapters(calculateReadingForDate(plan, TODAY, context))).toEqual(['GEN 1']);
    expect(chapters(calculateReadingForDate(plan, '2026-08-25', context))).toEqual(['GEN 2']);
  });

  it('gives tomorrow the head of the queue when today is already read', () => {
    // Today consumed Genesis 1, so it no longer occupies a slot.
    const rows = [makeCompletion(TODAY, { chapter: 1 })];
    const context = ctx([plan], rows);
    expect(chapters(calculateReadingForDate(plan, TODAY, context))).toEqual(['GEN 1']);
    expect(chapters(calculateReadingForDate(plan, '2026-08-25', context))).toEqual(['GEN 2']);
  });

  it('marks today pending until it is read, then completed', () => {
    expect(calculateReadingStatus(plan, TODAY, ctx([plan], []))).toBe('today-pending');
    expect(calculateReadingStatus(plan, TODAY, ctx([plan], [makeCompletion(TODAY)]))).toBe('completed');
  });

  it('marks future days upcoming', () => {
    expect(calculateReadingStatus(plan, '2026-08-25', ctx([plan], []))).toBe('upcoming');
  });
});

describe('canon completion', () => {
  it('reports canon-complete once everything from the start is read', () => {
    const plan = makePlan({ startDate: '2026-08-01', startBookId: 'REV', startChapter: 22 });
    const rows = [makeCompletion('2026-08-02', { bookId: 'REV', chapter: 22 })];
    const context = ctx([plan], rows);
    expect(calculateReadingForDate(plan, '2026-08-25', context)).toEqual({ kind: 'canon-complete' });
    expect(isScheduledDay([plan], '2026-08-25', context)).toBe(false);
  });

  it('still counts the day the last chapter was read', () => {
    const plan = makePlan({ startDate: '2026-08-01', startBookId: 'REV', startChapter: 22 });
    const rows = [makeCompletion('2026-08-02', { bookId: 'REV', chapter: 22 })];
    expect(isScheduledDay([plan], '2026-08-02', ctx([plan], rows))).toBe(true);
  });
});

describe('plan segments', () => {
  const first = makePlan({ id: 'plan-1', startDate: '2026-01-01', endDate: '2026-06-30',
    isActive: false, startBookId: 'GEN', startChapter: 1 });
  const second = makePlan({ id: 'plan-2', startDate: '2026-07-01', endDate: null,
    isActive: true, startBookId: 'MAT', startChapter: 1 });
  const plans = [first, second];

  it('resolves the segment that governs each date', () => {
    expect(resolvePlanForDate(plans, '2026-03-01')?.id).toBe('plan-1');
    expect(resolvePlanForDate(plans, '2026-06-30')?.id).toBe('plan-1');
    expect(resolvePlanForDate(plans, '2026-07-01')?.id).toBe('plan-2');
  });

  it('returns null before any plan existed', () => {
    expect(resolvePlanForDate(plans, '2025-12-31')).toBeNull();
  });

  it('preserves the chapters actually recorded after a plan change', () => {
    const rows = [makeCompletion('2026-03-01', { bookId: 'EXO', chapter: 10 })];
    const day = getDayReading(plans, '2026-03-01', ctx(plans, rows));
    expect(day.status).toBe('completed');
    expect(day.completedChapters).toEqual([{ bookId: 'EXO', chapter: 10 }]);
    expect(day.plan?.id).toBe('plan-1');
  });

  it('takes the position from the segment governing today', () => {
    const day = getDayReading(plans, TODAY, ctx(plans, []));
    expect(chapters(day.scheduled)).toEqual(['MAT 1']);
  });
});

describe('getDayReading', () => {
  const plan = makePlan({ startDate: '2026-08-01' });

  it('reports a chapter read in two sittings once', () => {
    const rows = [
      makeCompletion('2026-08-05', { chapter: 5, verses: { from: 1, to: 10 } }),
      makeCompletion('2026-08-05', { chapter: 5, verses: { from: 11, to: 32 } }),
    ];
    expect(getDayReading([plan], '2026-08-05', ctx([plan], rows)).completedChapters)
      .toEqual([{ bookId: 'GEN', chapter: 5 }]);
  });

  it('reports before-plan for days that precede the first segment', () => {
    const day = getDayReading([plan], '2026-07-26', ctx([plan], []));
    expect(day.status).toBe('before-plan');
  });

  it('reports no-plan only when no plan has ever existed', () => {
    expect(getDayReading([], '2026-07-26', ctx([], [])).status).toBe('no-plan');
  });

  it('keeps a completion visible on a day no segment governs', () => {
    const rows = makeCompletions(['2026-07-26']);
    expect(getDayReading([plan], '2026-07-26', ctx([plan], rows)).status).toBe('completed');
  });
});

describe('review fixes', () => {
  it('keeps a chapter part-read behind the plan start at the head of the queue', () => {
    // Regression: getUnreadSequence walks forward from the plan start, so a chapter
    // part-read through the Custom tab sat behind it and was stepped over forever.
    // Deleting the unfinished-chapter card removed the only other way to reach it.
    const plan = makePlan({ startDate: '2026-08-01', startBookId: 'EXO', startChapter: 1 });
    const rows = [makeCompletion('2026-08-02', { bookId: 'GEN', chapter: 1, verses: { from: 1, to: 10 } })];
    expect(chapters(calculateReadingForDate(plan, TODAY, ctx([plan], rows)))).toEqual(['GEN 1']);
  });

  it('does not offer a chapter that was part-read and then finished', () => {
    const plan = makePlan({ startDate: '2026-08-01', startBookId: 'EXO', startChapter: 1 });
    const rows = [
      makeCompletion('2026-08-02', { bookId: 'GEN', chapter: 1, verses: { from: 1, to: 10 } }),
      makeCompletion('2026-08-03', { bookId: 'GEN', chapter: 1, verses: { from: 11, to: 31 } }),
    ];
    expect(chapters(calculateReadingForDate(plan, TODAY, ctx([plan], rows)))).toEqual(['EXO 1']);
  });

  it('does not let a later reread drag the canon finish date forward', () => {
    // Regression: the finish date was the newest row in the database, so rereading
    // Genesis 1 after finishing turned every day in between into a missed one.
    const plan = makePlan({ startDate: '2026-08-01', startBookId: 'REV', startChapter: 22 });
    const finish = makeCompletion('2026-08-02', { bookId: 'REV', chapter: 22 });
    const reread = makeCompletion('2026-08-10', { bookId: 'GEN', chapter: 1 });

    const before = ctx([plan], [finish]);
    const after = ctx([plan], [finish, reread]);
    expect(before.canonFinishedOn).toBe('2026-08-02');
    expect(after.canonFinishedOn).toBe('2026-08-02');
    expect(isScheduledDay([plan], '2026-08-05', after)).toBe(false);
  });

  it('takes the canon from the plan governing today, not the oldest segment', () => {
    const old = makePlan({ id: 'old', startDate: '2026-01-01', endDate: '2026-06-30', isActive: false });
    const current = makePlan({ id: 'current', startDate: '2026-07-01', endDate: null, isActive: true });
    // No injected index: the context must pick the canon itself.
    const context = createScheduleContext([old, current], [], TODAY);
    expect(context.activePlan?.id).toBe('current');
    expect(context.index.canon.id).toBe(current.canonId);
  });

  it('still schedules readings far beyond the cached queue', () => {
    // The calendar pages forward without limit; the queue is only cached to 400.
    const plan = makePlan({ startDate: '2026-08-01', startBookId: 'GEN', startChapter: 1 });
    const context = ctx([plan], []);
    const farOff = addDaysToDateKey(TODAY, 500);
    const reading = calculateReadingForDate(plan, farOff, context);
    expect(reading.kind).toBe('scheduled');
    // 500 days after today, one chapter a day from Genesis 1: absolute index 500.
    expect(chapters(reading)).toEqual(['PSA 23']);
  });

  it('reports canon-complete past the end rather than an empty schedule', () => {
    const plan = makePlan({ startDate: '2026-08-01', startBookId: 'REV', startChapter: 21 });
    const context = ctx([plan], []);
    // Two chapters left: Revelation 21 today, 22 tomorrow, nothing after.
    expect(chapters(calculateReadingForDate(plan, addDaysToDateKey(TODAY, 1), context))).toEqual(['REV 22']);
    expect(calculateReadingForDate(plan, addDaysToDateKey(TODAY, 2), context)).toEqual({ kind: 'canon-complete' });
  });
});
