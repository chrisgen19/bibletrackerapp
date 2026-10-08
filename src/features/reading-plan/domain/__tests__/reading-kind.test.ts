// Extra readings (spec: bibletrackerweb#18).
import { PROTESTANT_CANON_INDEX } from '@/data/bible/canon-index';

import { classifyCustomReading, PLAN_WINDOW_DAYS, selectPlanReadings } from '../reading-kind';
import { createScheduleContext } from '../schedule';
import type { ReadingCompletion, ReadingPlan } from '../types';
import { makeCompletion, makePlan } from './fixtures';

const TODAY = '2026-10-07';
const index = PROTESTANT_CANON_INDEX;

/** A reader whose plan started at Leviticus 23 and who has read up to Leviticus 23. */
function setup(
  planOverrides: Partial<ReadingPlan> = {},
  readings: readonly ReadingCompletion[] = [
    makeCompletion('2026-10-06', { id: 'a', bookId: 'LEV', chapter: 22 }),
    makeCompletion('2026-10-07', { id: 'b', bookId: 'LEV', chapter: 23 }),
  ],
) {
  const plan = makePlan({
    startDate: '2026-10-06',
    startBookId: 'LEV',
    startChapter: 22,
    ...planOverrides,
  });
  const planReadings = selectPlanReadings(readings);
  const context = createScheduleContext([plan], planReadings, TODAY);
  return (bookId: string, chapter: number) =>
    classifyCustomReading({
      reference: { bookId, chapter },
      planReadings,
      unread: context.unread,
      plan,
      index,
    });
}

describe('selectPlanReadings', () => {
  it('keeps plan readings and rows without the flag, drops extras', () => {
    const rows = [
      makeCompletion('2026-10-01', { id: 'plain' }),
      makeCompletion('2026-10-02', { id: 'plan', isExtra: false }),
      makeCompletion('2026-10-03', { id: 'extra', isExtra: true }),
    ];
    expect(selectPlanReadings(rows).map((row) => row.id)).toEqual(['plain', 'plan']);
  });
});

describe('classifyCustomReading', () => {
  it('counts the chapter at the reading position', () => {
    expect(setup()('LEV', 24)).toBe('plan');
  });

  it(`counts reading ahead within ${PLAN_WINDOW_DAYS} days of the plan`, () => {
    const classify = setup();
    // Leviticus 24-27 then Numbers 1-3: the next seven chapters at one a day.
    expect(classify('LEV', 27)).toBe('plan');
    expect(classify('NUM', 3)).toBe('plan');
  });

  it('calls a jump further ahead than a week an extra', () => {
    const classify = setup();
    expect(classify('NUM', 4)).toBe('extra');
    expect(classify('REV', 5)).toBe('extra');
  });

  it("widens the window with the plan's pace", () => {
    // Two chapters a day: a week is fourteen chapters, through Numbers 10.
    const classify = setup({ chaptersPerDay: 2 });
    expect(classify('NUM', 10)).toBe('plan');
    expect(classify('NUM', 11)).toBe('extra');
  });

  it('calls a re-read of a finished chapter an extra', () => {
    expect(setup()('LEV', 22)).toBe('extra');
  });

  it('counts finishing a part-read chapter, wherever it is', () => {
    const classify = setup({}, [
      makeCompletion('2026-03-10', {
        id: 'p',
        bookId: 'NUM',
        chapter: 6,
        verses: { from: 24, to: 26 },
      }),
    ]);
    expect(classify('NUM', 6)).toBe('plan');
  });

  it('ignores extra readings when judging what is already read', () => {
    // Numbers 6:24-26 was an extra, so Numbers 6 is untouched as far as the plan knows.
    const classify = setup({}, [
      makeCompletion('2026-03-10', {
        id: 'p',
        bookId: 'NUM',
        chapter: 6,
        verses: { from: 24, to: 26 },
        isExtra: true,
      }),
    ]);
    expect(classify('NUM', 6)).toBe('extra');
  });

  it('counts filling a gap behind the reading position', () => {
    // Exodus 5 was never logged, and the plan began at Leviticus 22.
    expect(setup()('EXO', 5)).toBe('plan');
  });

  it('calls everything extra once the plan has nothing left to read', () => {
    const classify = setup({ startBookId: 'REV', startChapter: 22 }, [
      makeCompletion('2026-10-07', { id: 'end', bookId: 'REV', chapter: 22 }),
    ]);
    // Even a chapter behind the start: the plan is finished, so nothing moves it.
    expect(classify('GEN', 1)).toBe('extra');
    expect(classify('REV', 22)).toBe('extra');
  });

  it('counts everything as the plan when there is no plan', () => {
    expect(
      classifyCustomReading({
        reference: { bookId: 'REV', chapter: 5 },
        planReadings: [],
        unread: [],
        plan: null,
        index,
      }),
    ).toBe('plan');
  });
});
