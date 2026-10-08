// useDayDetail over the real provider and an in-memory database, so classification and
// read-through handling are checked against stored readings, as on device.
import type { ReadingDatabase } from '@/db/client';
import type { ReadingPlanDraft } from '@/features/reading-plan/domain/types';
import { ReadingDataProvider, useReadingData } from '@/features/reading-plan/hooks/reading-data-provider';
import { act, renderHook } from '@/test-utils/render';
import { createTestDatabase } from '@/test-utils/test-database';
import { addDaysToDateKey, getTodayDateKey } from '@/utils/date-key';

import { useDayDetail } from '../use-day-detail';

let mockDb: ReadingDatabase;

jest.mock('@/db/database-provider', () => ({
  useDatabase: () => mockDb,
}));

const TODAY = getTodayDateKey();
const daysAgo = (days: number) => addDaysToDateKey(TODAY, -days);
const EARLIER_DAY = daysAgo(5);

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

/** The reading data, plus the day detail for today and for an earlier day. */
async function renderDays() {
  const rendered = await renderHook(
    () => ({ data: useReadingData(), today: useDayDetail(TODAY), earlier: useDayDetail(EARLIER_DAY) }),
    { wrapper: ReadingDataProvider },
  );
  async function perform<T>(action: (data: ReturnType<typeof useReadingData>) => T): Promise<T> {
    let returned: T | undefined;
    await act(() => {
      returned = action(rendered.result.current.data);
    });
    return returned as T;
  }
  return { result: rendered.result, perform };
}

beforeEach(() => {
  mockDb = createTestDatabase();
});

describe('useDayDetail', () => {
  it('is null for a date that is not a real day', async () => {
    const { result } = await renderHook(() => useDayDetail('2026-02-30'), { wrapper: ReadingDataProvider });
    expect(result.current).toBeNull();
  });

  it('classifies a far-ahead Custom reading as extra and a nearby one as plan', async () => {
    const { result, perform } = await renderDays();
    await perform((data) => data.startPlan(draft()));

    expect(result.current.today?.classifyReading({ bookId: 'REV', chapter: 5 })).toBe('extra');
    expect(result.current.today?.classifyReading({ bookId: 'GEN', chapter: 3 })).toBe('plan');
  });

  it('records an extra apart from the plan, which still offers its chapter', async () => {
    const { result, perform } = await renderDays();
    await perform((data) => data.startPlan(draft()));

    let id: string | null = null;
    await act(() => {
      id = result.current.today?.onLogExtra({ bookId: 'REV', chapter: 5 }) ?? null;
    });

    expect(id).not.toBeNull();
    expect(result.current.today?.extraRows.map((row) => row.id)).toEqual([id]);
    expect(result.current.today?.rows).toEqual([]);
    expect(result.current.today?.day.scheduled).toEqual({
      kind: 'scheduled',
      chapters: [{ bookId: 'GEN', chapter: 1 }],
    });
  });

  it('treats a day from an earlier read-through on its own terms', async () => {
    const { result, perform } = await renderDays();
    await perform((data) => data.startPlan(draft({ startBookId: 'REV', startChapter: 22 })));
    await perform((data) => data.completeReading(daysAgo(9), [{ bookId: 'REV', chapter: 22 }]));
    await perform((data) => data.startNextReadThrough());

    // Read-through 1 was finished when 2 began: a new chapter there is an extra, and it
    // offers no catching up and no moving the current plan.
    const earlier = result.current.earlier;
    expect(earlier?.canMovePlan).toBe(false);
    expect(earlier?.currentPosition).toBeNull();
    expect(earlier?.classifyReading({ bookId: 'GEN', chapter: 2 })).toBe('extra');

    const today = result.current.today;
    expect(today?.canMovePlan).toBe(true);
    expect(today?.currentPosition).toEqual({ bookId: 'GEN', chapter: 1 });
    expect(today?.classifyReading({ bookId: 'GEN', chapter: 1 })).toBe('plan');
  });

  it('measures the chapter that finished the last read-through in it, on the day the next begins', async () => {
    const { result, perform } = await renderDays();
    await perform((data) => data.startPlan(draft({ startDate: daysAgo(3), startBookId: 'REV', startChapter: 22 })));
    await perform((data) => data.completeReading(TODAY, [{ bookId: 'REV', chapter: 22 }]));
    await perform((data) => data.startNextReadThrough());

    // Today now belongs to read-through 2, where Revelation 22 is unread; the reading
    // on today was recorded in read-through 1, where it finished the Bible.
    expect(result.current.data.currentReadThrough).toBe(2);
    expect(result.current.today?.getProgressFor({ bookId: 'REV', chapter: 22 })?.isComplete).toBe(true);
  });
});
