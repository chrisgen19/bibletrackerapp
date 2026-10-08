// Read-throughs (spec: bibletrackerweb#18).
import { getChapterProgress } from '../chapter-progress';
import {
  buildNextReadThroughDraft,
  getCurrentReadThrough,
  getReadThrough,
  getReadThroughFinishDates,
  getRecordedReadThrough,
  getSegmentFinishDates,
  isCurrentReadThroughFinished,
  selectProgressCompletions,
} from '../read-through';
import { makeCompletion, makePlan } from './fixtures';
import {
  FIRST_FINISHED,
  FIRST as first,
  FIRST_RUN as firstRun,
  SECOND as second,
} from './read-through-fixtures';

describe('getReadThrough / getCurrentReadThrough', () => {
  it('treats a plan without one (written before read-throughs) as the first', () => {
    expect(getReadThrough(makePlan())).toBe(1);
  });

  it('follows the active plan', () => {
    expect(getCurrentReadThrough([first, second], second)).toBe(2);
  });

  it('falls back to the latest read-through without an active plan', () => {
    expect(getCurrentReadThrough([first, { ...second, isActive: false }], null)).toBe(2);
    expect(getCurrentReadThrough([], null)).toBe(1);
  });
});

describe('selectProgressCompletions', () => {
  it("keeps the read-through's own plan readings only", () => {
    const rows = [
      makeCompletion('2027-04-03', { id: 'old', readingPlanId: 'first' }),
      makeCompletion('2027-06-01', { id: 'new', readingPlanId: 'second' }),
      makeCompletion('2027-06-01', {
        id: 'extra',
        readingPlanId: 'second',
        bookId: 'REV',
        isExtra: true,
      }),
    ];
    const ids = (readThrough: number) =>
      selectProgressCompletions([first, second], rows, readThrough).map((row) => row.id);
    expect(ids(1)).toEqual(['old']);
    expect(ids(2)).toEqual(['new']);
  });
});

describe('getReadThroughFinishDates', () => {
  it('dates a finished read-through by the chapter that closed it', () => {
    const finished = getReadThroughFinishDates([first, second], firstRun);
    expect(finished.get(1)).toBe(FIRST_FINISHED);
    expect(finished.has(2)).toBe(false);
  });

  it('does not count a read-through with a chapter left', () => {
    const missingOne = firstRun.slice(0, -1);
    expect(getReadThroughFinishDates([first], missingOne).size).toBe(0);
  });

  it('finishes a first read-through that began mid-canon at its own start', () => {
    // Onboarded at Revelation 22: reading it finishes the plan, as the app says today.
    const late = makePlan({ startBookId: 'REV', startChapter: 22 });
    const rows = [makeCompletion('2026-08-01', { bookId: 'REV', chapter: 22 })];
    expect(getReadThroughFinishDates([late], rows).get(1)).toBe('2026-08-01');
  });

  it('ignores extra readings', () => {
    const late = makePlan({ startBookId: 'REV', startChapter: 22 });
    const rows = [
      makeCompletion('2026-08-01', {
        bookId: 'REV',
        chapter: 22,
        isExtra: true,
      }),
    ];
    expect(getReadThroughFinishDates([late], rows).size).toBe(0);
  });
});

// bibletrackerweb#4: the per-segment finish ported from bibletrackerapp#17, measured in
// each segment's own read-through.
describe('getSegmentFinishDates', () => {
  it('measures each segment against its own read-through', () => {
    // Against every row, read-through 2 would be finished on its first day: every
    // chapter was read in read-through 1.
    const finished = getSegmentFinishDates([first, second], firstRun, '2027-06-01');
    expect(finished.get('first')).toBe(FIRST_FINISHED);
    expect(finished.get('second')).toBeNull();
  });

  it('keeps a finished segment finished after a position change in the same read-through', () => {
    // Revelation 20 finished on Aug 3, then the position moved to Genesis 1. Measured
    // per read-through, the open Genesis segment left read-through 1 unfinished.
    const revelation = makePlan({
      id: 'rev',
      startDate: '2026-08-01',
      startBookId: 'REV',
      startChapter: 20,
      isActive: false,
      endDate: '2026-08-09',
    });
    const genesis = makePlan({ id: 'gen', startDate: '2026-08-10' });
    const rows = [20, 21, 22].map((chapter, offset) =>
      makeCompletion(`2026-08-0${offset + 1}`, {
        id: `rev-${chapter}`,
        readingPlanId: 'rev',
        bookId: 'REV',
        chapter,
      }),
    );

    const finished = getSegmentFinishDates([revelation, genesis], rows, '2026-08-24');
    expect(finished.get('rev')).toBe('2026-08-03');
    expect(finished.get('gen')).toBeNull();
  });
});

describe('isCurrentReadThroughFinished', () => {
  it("is true once the active plan's read-through is finished", () => {
    const active = { ...first, isActive: true, endDate: null };
    expect(isCurrentReadThroughFinished([active], active, firstRun)).toBe(true);
  });

  it('is false for a new read-through that has only begun', () => {
    expect(isCurrentReadThroughFinished([first, second], second, firstRun)).toBe(false);
  });

  it('is false without an active plan', () => {
    expect(isCurrentReadThroughFinished([first], null, firstRun)).toBe(false);
  });
});

describe('buildNextReadThroughDraft', () => {
  it('starts again at Genesis 1 on the given day, at the same pace', () => {
    const plan = makePlan({
      startBookId: 'MAT',
      startChapter: 5,
      chaptersPerDay: 3,
    });
    expect(buildNextReadThroughDraft(plan, '2027-06-01')).toEqual({
      canonId: 'protestant',
      startDate: '2027-06-01',
      startBookId: 'GEN',
      startChapter: 1,
      chaptersPerDay: 3,
    });
  });
});

describe('getRecordedReadThrough', () => {
  // Read-through 2 started on the day read-through 1 finished, with Revelation 22.
  const restart = { ...second, startDate: FIRST_FINISHED };
  const plans = [first, restart];
  const REVELATION_22 = { bookId: 'REV', chapter: 22 };
  const finishingDay = firstRun.filter((row) => row.localDate === FIRST_FINISHED);

  it('is the read-through a chapter on the day was recorded in', () => {
    expect(getRecordedReadThrough(plans, finishingDay, REVELATION_22)).toBe(1);
  });

  it('keeps the chapter that finished read-through 1 finished on the day 2 starts', () => {
    const measuredIn = (readThrough: number) =>
      getChapterProgress(selectProgressCompletions(plans, firstRun, readThrough), REVELATION_22)
        ?.isComplete;

    const recorded = getRecordedReadThrough(plans, finishingDay, REVELATION_22);
    expect(measuredIn(recorded ?? getReadThrough(restart))).toBe(true);
    // Measured in the read-through governing the day, it read as unread.
    expect(measuredIn(getReadThrough(restart))).toBe(false);
  });

  it('is null for a chapter the day holds no reading of', () => {
    expect(
      getRecordedReadThrough(plans, finishingDay, {
        bookId: 'GEN',
        chapter: 1,
      }),
    ).toBeNull();
  });
});

// Review on #20 (Codex): "Move my plan" starts its segment tomorrow; moving the position in
// Settings the same day closes that segment before it begins. Its start date is still the
// latest, and the finish check measured the read-through from it.
describe('a segment replaced before it began', () => {
  const TODAY = '2026-08-10';
  const started = makePlan({
    id: 'started',
    startDate: '2026-08-01',
    isActive: false,
    endDate: TODAY,
  });
  /** The continuation from "Move my plan", closed the same day by Settings. */
  const continuation = (startChapter: number) =>
    makePlan({
      id: 'continuation',
      startDate: '2026-08-11',
      startBookId: 'REV',
      startChapter,
      isActive: false,
      endDate: '2026-08-09',
      createdAt: 1,
    });
  /** The position Settings moved to, today. */
  const moved = (startBookId: string, startChapter: number) =>
    makePlan({
      id: 'moved',
      startDate: TODAY,
      startBookId,
      startChapter,
      createdAt: 2,
    });
  const read = (bookId: string, chapter: number) =>
    makeCompletion(TODAY, { id: `${bookId}-${chapter}`, bookId, chapter });

  it('does not hold back a read-through finished from the active segment', () => {
    const active = moved('REV', 22);
    const plans = [started, continuation(21), active];

    expect(isCurrentReadThroughFinished(plans, active, [read('REV', 22)])).toBe(true);
  });

  it('does not finish a read-through the active segment has not', () => {
    const active = moved('GEN', 1);
    const plans = [started, continuation(22), active];
    const rows = [read('REV', 21), read('REV', 22)];

    expect(isCurrentReadThroughFinished(plans, active, rows)).toBe(false);
  });

  it('still measures a read-through made only of such segments', () => {
    expect(getReadThroughFinishDates([continuation(22)], [read('REV', 22)]).has(1)).toBe(true);
  });
});
