// useReadingProgress over the real provider and an in-memory database: what the
// progress screen shows beside the calendar, per read-through and without extras (#19).
import type { ReadingDatabase } from '@/db/client';
import type { ReadingPlanDraft } from '@/features/reading-plan/domain/types';
import { ReadingDataProvider, useReadingData } from '@/features/reading-plan/hooks/reading-data-provider';
import { act, renderHook } from '@/test-utils/render';
import { createTestDatabase } from '@/test-utils/test-database';
import { addDaysToDateKey, getTodayDateKey } from '@/utils/date-key';

import { useReadingProgress } from '../use-reading-progress';

let mockDb: ReadingDatabase;

jest.mock('@/db/database-provider', () => ({
  useDatabase: () => mockDb,
}));

const TODAY = getTodayDateKey();
const daysAgo = (days: number) => addDaysToDateKey(TODAY, -days);

function draft(overrides: Partial<ReadingPlanDraft> = {}): ReadingPlanDraft {
  return {
    canonId: 'protestant',
    startDate: daysAgo(10),
    startBookId: 'GEN',
    startChapter: 1,
    chaptersPerDay: 1,
    ...overrides,
  };
}

async function renderProgress() {
  const rendered = await renderHook(() => ({ data: useReadingData(), progress: useReadingProgress() }), {
    wrapper: ReadingDataProvider,
  });
  async function perform(action: (data: ReturnType<typeof useReadingData>) => unknown) {
    await act(() => {
      action(rendered.result.current.data);
    });
  }
  return { result: rendered.result, perform };
}

beforeEach(() => {
  mockDb = createTestDatabase();
});

describe('useReadingProgress', () => {
  it("offers the plan's chapter today when only an extra was logged", async () => {
    const { result, perform } = await renderProgress();
    await perform((data) => data.startPlan(draft()));
    await perform((data) => data.completeReading(TODAY, [{ bookId: 'REV', chapter: 5 }], undefined, true));

    expect(result.current.progress.todayReading.scheduled).toEqual({
      kind: 'scheduled',
      chapters: [{ bookId: 'GEN', chapter: 1 }],
    });
    expect(result.current.progress.todayReading.status).toBe('today-pending');
  });

  it('never lists a part-read extra as still to finish', async () => {
    const { result, perform } = await renderProgress();
    await perform((data) => data.startPlan(draft()));
    await perform((data) =>
      data.completeReading(daysAgo(2), [{ bookId: 'NUM', chapter: 6 }], { from: 24, to: 26 }, true),
    );
    await perform((data) => data.completeReading(daysAgo(1), [{ bookId: 'GEN', chapter: 2 }], { from: 1, to: 5 }));

    expect(result.current.progress.unfinished.map((chapter) => chapter.reference)).toEqual([
      { bookId: 'GEN', chapter: 2 },
    ]);
  });

  it('counts chapters in the current read-through only', async () => {
    const { result, perform } = await renderProgress();
    await perform((data) => data.startPlan(draft({ startBookId: 'REV', startChapter: 22 })));
    await perform((data) => data.completeReading(daysAgo(9), [{ bookId: 'REV', chapter: 22 }]));
    expect(result.current.progress.chaptersRead).toBe(1);

    await perform((data) => data.startNextReadThrough());

    expect(result.current.progress.chaptersRead).toBe(0);
    expect(result.current.data.finishedReadThroughs).toBe(1);
  });
});
