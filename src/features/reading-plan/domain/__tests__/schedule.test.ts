import { PROTESTANT_CANON_INDEX } from '@/data/bible/canon-index';
import { addDaysToDateKey } from '@/utils/date-key';

import { UNREAD_HORIZON } from '../reading-position';
import {
  calculateReadingForDate,
  calculateReadingStatus,
  createScheduleContext,
  getDayReading,
  getPlanCompletionDate,
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

// Regressions for #16. Each case was reproduced against the code before the fix.
describe('canon finish is resolved per plan segment', () => {
  const read = (date: string, bookId: string, chapter: number, readingPlanId: string) =>
    makeCompletion(date, { id: `${bookId}-${chapter}`, bookId, chapter, readingPlanId });

  it('keeps an earlier segment finished after moving on to an unfinished one', () => {
    // Start at Revelation 20, finish on Aug 3, then move the position to Genesis 1.
    const revelation = makePlan({ id: 'rev', startDate: '2026-08-01', startBookId: 'REV', startChapter: 20,
      isActive: false, endDate: '2026-08-09' });
    const genesis = makePlan({ id: 'gen', startDate: '2026-08-10' });
    const plans = [revelation, genesis];
    const rows = [
      read('2026-08-01', 'REV', 20, 'rev'),
      read('2026-08-02', 'REV', 21, 'rev'),
      read('2026-08-03', 'REV', 22, 'rev'),
      read('2026-08-10', 'GEN', 1, 'gen'),
    ];
    const context = ctx(plans, rows);

    expect(getDayReading(plans, '2026-08-05', context).status).toBe('canon-complete');
    expect(isScheduledDay(plans, '2026-08-05', context)).toBe(false);
    // The Genesis segment is not finished, so its own unread days are still missed.
    expect(getDayReading(plans, '2026-08-12', context).status).toBe('missed');
  });

  it('does not lend a later segment its finish date to an earlier, unfinished one', () => {
    // Revelation 22 was read under the Genesis plan, so a segment starting there is
    // finished from its first day. The Genesis segment still owed its chapters.
    const genesis = makePlan({ id: 'gen', startDate: '2026-08-01', isActive: false, endDate: '2026-08-14' });
    const revelation = makePlan({ id: 'rev', startDate: '2026-08-15', startBookId: 'REV', startChapter: 22 });
    const plans = [genesis, revelation];
    const context = ctx(plans, [read('2026-08-02', 'REV', 22, 'gen')]);

    expect(context.canonFinishedOn).toBe('2026-08-02');
    expect(getDayReading(plans, '2026-08-05', context).status).toBe('missed');
    expect(isScheduledDay(plans, '2026-08-05', context)).toBe(true);
  });
});

describe('canon finish includes chapters owed from behind the plan start', () => {
  const plan = makePlan({ startDate: '2026-08-01', startBookId: 'REV', startChapter: 21 });

  it('is the day the last owed chapter closed, not the last chapter from the start', () => {
    const rows = [
      makeCompletion('2026-08-01', { id: 'a', bookId: 'GEN', chapter: 1, verses: { from: 1, to: 10 } }),
      makeCompletion('2026-08-02', { id: 'b', bookId: 'REV', chapter: 21 }),
      makeCompletion('2026-08-03', { id: 'c', bookId: 'REV', chapter: 22 }),
      makeCompletion('2026-08-10', { id: 'd', bookId: 'GEN', chapter: 1, verses: { from: 11, to: 31 } }),
    ];
    const context = ctx([plan], rows);

    expect(context.canonFinishedOn).toBe('2026-08-10');
    // Genesis 1 was still owed on Aug 4-9; finishing it later must not rewrite them.
    expect(getDayReading([plan], '2026-08-05', context).status).toBe('missed');
    expect(getDayReading([plan], '2026-08-11', context).status).toBe('canon-complete');
  });

  it('is still unset while that chapter is part-read', () => {
    const rows = [
      makeCompletion('2026-08-01', { id: 'a', bookId: 'GEN', chapter: 1, verses: { from: 1, to: 10 } }),
      makeCompletion('2026-08-02', { id: 'b', bookId: 'REV', chapter: 21 }),
      makeCompletion('2026-08-03', { id: 'c', bookId: 'REV', chapter: 22 }),
    ];
    expect(ctx([plan], rows).canonFinishedOn).toBeNull();
  });
});

describe('the unread queue past its cache', () => {
  it('does not continue into chapters before the plan start', () => {
    // Revelation 22 read, Genesis 1 part-read behind the start: Genesis 1 is the only
    // chapter owed, so nothing is left after it.
    const plan = makePlan({ startDate: '2026-08-01', startBookId: 'REV', startChapter: 22 });
    const rows = [
      makeCompletion('2026-08-01', { id: 'a', bookId: 'REV', chapter: 22 }),
      makeCompletion('2026-08-02', { id: 'b', bookId: 'GEN', chapter: 1, verses: { from: 1, to: 10 } }),
    ];
    const context = ctx([plan], rows);

    expect(chapters(calculateReadingForDate(plan, TODAY, context))).toEqual(['GEN 1']);
    expect(calculateReadingForDate(plan, addDaysToDateKey(TODAY, 1), context)).toEqual({ kind: 'canon-complete' });
  });
});

describe('a plan that starts in the future', () => {
  const plan = makePlan({ startDate: '2026-09-01' });

  it('previews its first day as its start chapter', () => {
    const context = ctx([plan], []);
    expect(getDayReading([plan], '2026-08-31', context).status).toBe('before-plan');
    expect(chapters(calculateReadingForDate(plan, '2026-09-01', context))).toEqual(['GEN 1']);
    expect(chapters(calculateReadingForDate(plan, '2026-09-02', context))).toEqual(['GEN 2']);
  });

  it('previews the same chapters before and on its start date', () => {
    const early = ctx([plan], []);
    const onTheDay = ctx([plan], [], '2026-09-01');
    for (const date of ['2026-09-01', '2026-09-15', '2026-12-31']) {
      expect(calculateReadingForDate(plan, date, early)).toEqual(calculateReadingForDate(plan, date, onTheDay));
    }
  });
});

describe('getPlanCompletionDate', () => {
  it('counts every chapter still owed, not just the cached queue', () => {
    const plan = makePlan({ startDate: TODAY });
    // 1,189 chapters at one a day: the last one is read 1,188 days from today.
    expect(getPlanCompletionDate(plan, ctx([plan], []))).toBe(addDaysToDateKey(TODAY, 1188));
  });

  it('divides by chapters per day', () => {
    const plan = makePlan({ startDate: TODAY, chaptersPerDay: 3 });
    // 1,189 / 3 rounds up to 397 days, so the last is 396 days out.
    expect(getPlanCompletionDate(plan, ctx([plan], []))).toBe(addDaysToDateKey(TODAY, 396));
  });

  it('starts tomorrow once today is already read', () => {
    const plan = makePlan({ startDate: '2026-08-01' });
    const context = ctx([plan], [makeCompletion(TODAY)]);
    // Genesis 1 is done, 1,188 remain, and the next one is tomorrow's.
    expect(getPlanCompletionDate(plan, context)).toBe(addDaysToDateKey(TODAY, 1188));
  });

  it('counts a plan that has not begun from its start date', () => {
    const plan = makePlan({ startDate: '2026-09-01', startBookId: 'REV', startChapter: 22 });
    expect(getPlanCompletionDate(plan, ctx([plan], []))).toBe('2026-09-01');
  });

  it('is null once nothing is owed', () => {
    const plan = makePlan({ startDate: '2026-08-01', startBookId: 'REV', startChapter: 22 });
    const context = ctx([plan], [makeCompletion('2026-08-02', { bookId: 'REV', chapter: 22 })]);
    expect(getPlanCompletionDate(plan, context)).toBeNull();
  });
});

// Codex review on PR #17. Each case failed before the fix.
describe('a chapter opened after the canon finish does not move it', () => {
  const plan = makePlan({ startDate: '2026-08-01', startBookId: 'REV', startChapter: 22 });
  const finish = makeCompletion('2026-08-01', { id: 'a', bookId: 'REV', chapter: 22 });
  const genesisOpened = makeCompletion('2026-08-10', { id: 'b', bookId: 'GEN', chapter: 1, verses: { from: 1, to: 10 } });
  const genesisClosed = makeCompletion('2026-08-15', { id: 'c', bookId: 'GEN', chapter: 1, verses: { from: 11, to: 31 } });

  it('keeps the days after the finish finished once that chapter closes', () => {
    const context = ctx([plan], [finish, genesisOpened, genesisClosed]);

    expect(context.canonFinishedOn).toBe('2026-08-01');
    // Before the reread began, and while it was open.
    expect(getDayReading([plan], '2026-08-05', context).status).toBe('canon-complete');
    expect(getDayReading([plan], '2026-08-12', context).status).toBe('canon-complete');
    expect(isScheduledDay([plan], '2026-08-05', context)).toBe(false);
  });

  it('keeps them finished while it is still open, and offers it again today', () => {
    const context = ctx([plan], [finish, genesisOpened]);

    expect(context.canonFinishedOn).toBe('2026-08-01');
    expect(getDayReading([plan], '2026-08-05', context).status).toBe('canon-complete');
    expect(getDayReading([plan], '2026-08-12', context).status).toBe('canon-complete');
    expect(chapters(calculateReadingForDate(plan, TODAY, context))).toEqual(['GEN 1']);
  });

  it('keeps an earlier segment finished when the next one reads a chapter in two sittings', () => {
    // #16's own repro, with Genesis 1 split across two days as verse tracking allows.
    const revelation = makePlan({ id: 'rev', startDate: '2026-08-01', startBookId: 'REV', startChapter: 20,
      isActive: false, endDate: '2026-08-09' });
    const genesis = makePlan({ id: 'gen', startDate: '2026-08-10' });
    const plans = [revelation, genesis];
    const read = (date: string, bookId: string, chapter: number, verses: ReadingCompletion['verses'] = null) =>
      makeCompletion(date, { id: `${date}-${bookId}-${chapter}`, bookId, chapter, verses,
        readingPlanId: bookId === 'REV' ? 'rev' : 'gen' });
    const revelationRows = [read('2026-08-01', 'REV', 20), read('2026-08-02', 'REV', 21), read('2026-08-03', 'REV', 22)];
    const firstSitting = read('2026-08-10', 'GEN', 1, { from: 1, to: 10 });
    const secondSitting = read('2026-08-11', 'GEN', 1, { from: 11, to: 31 });

    for (const rows of [[...revelationRows, firstSitting], [...revelationRows, firstSitting, secondSitting]]) {
      const context = ctx(plans, rows);
      expect(context.canonFinishedOnByPlan.get('rev')).toBe('2026-08-03');
      expect(getDayReading(plans, '2026-08-05', context).status).toBe('canon-complete');
      expect(isScheduledDay(plans, '2026-08-05', context)).toBe(false);
    }
  });

  it('still waits for each chapter owed when the last one closed, but not for later ones', () => {
    const rows = [
      // Genesis 1 is open when Revelation 22 closes on Aug 2.
      makeCompletion('2026-08-01', { id: 'a', bookId: 'GEN', chapter: 1, verses: { from: 1, to: 10 } }),
      makeCompletion('2026-08-02', { id: 'b', bookId: 'REV', chapter: 22 }),
      // Genesis 2 is opened before Genesis 1 closes, so it is owed on Aug 5 too.
      makeCompletion('2026-08-04', { id: 'c', bookId: 'GEN', chapter: 2, verses: { from: 1, to: 5 } }),
      makeCompletion('2026-08-05', { id: 'd', bookId: 'GEN', chapter: 1, verses: { from: 11, to: 31 } }),
      makeCompletion('2026-08-08', { id: 'e', bookId: 'GEN', chapter: 2, verses: { from: 6, to: 25 } }),
      // Genesis 3 is opened after that, and is never finished.
      makeCompletion('2026-08-10', { id: 'f', bookId: 'GEN', chapter: 3, verses: { from: 1, to: 5 } }),
    ];
    const context = ctx([plan], rows);

    expect(context.canonFinishedOn).toBe('2026-08-08');
    expect(getDayReading([plan], '2026-08-06', context).status).toBe('missed');
    expect(getDayReading([plan], '2026-08-09', context).status).toBe('canon-complete');
  });
});

describe('chapters part-read behind the plan start, beyond the cached queue', () => {
  const chapterAt = (absolute: number) => {
    const reference = INDEX.fromAbsoluteIndex(absolute);
    if (reference === null) throw new Error(`No chapter at ${absolute}`);
    return reference;
  };

  it('are all owed before the queue moves on to the plan start', () => {
    // One more part-read chapter than the queue caches, all behind a plan starting at
    // the canon's 601st chapter.
    const start = chapterAt(600);
    const plan = makePlan({ startDate: '2026-08-01', startBookId: start.bookId, startChapter: start.chapter });
    const rows = Array.from({ length: UNREAD_HORIZON + 1 }, (_, absolute) =>
      makeCompletion('2026-08-02', { id: `p${absolute}`, ...chapterAt(absolute), verses: { from: 1, to: 1 } }),
    );
    const context = ctx([plan], rows);
    const lastPartial = chapterAt(UNREAD_HORIZON);

    expect(chapters(calculateReadingForDate(plan, addDaysToDateKey(TODAY, UNREAD_HORIZON), context))).toEqual([
      `${lastPartial.bookId} ${lastPartial.chapter}`,
    ]);
    expect(chapters(calculateReadingForDate(plan, addDaysToDateKey(TODAY, UNREAD_HORIZON + 1), context))).toEqual([
      `${start.bookId} ${start.chapter}`,
    ]);
    // Every part-read chapter plus every chapter from the start, one a day from today.
    const owed = UNREAD_HORIZON + 1 + (INDEX.totalChapters - 600);
    expect(getPlanCompletionDate(plan, context)).toBe(addDaysToDateKey(TODAY, owed - 1));
  });
});
