// The provider over a real in-memory database: every action writes, then the snapshot
// is re-read, exactly as on device.
import type { ReadingDatabase } from '@/db/client';
import { getDayReading } from '@/features/reading-plan/domain/schedule';
import type { ReadingPlanDraft } from '@/features/reading-plan/domain/types';
import { act, renderHook } from '@/test-utils/render';
import { createTestDatabase } from '@/test-utils/test-database';
import { addDaysToDateKey, getTodayDateKey } from '@/utils/date-key';

import { ReadingDataProvider, useReadingData } from '../reading-data-provider';

let mockDb: ReadingDatabase;

jest.mock('@/db/database-provider', () => ({
  useDatabase: () => mockDb,
}));

const TODAY = getTodayDateKey();
const daysAgo = (days: number) => addDaysToDateKey(TODAY, -days);
const REVELATION_5 = [{ bookId: 'REV', chapter: 5 }];

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

async function renderReadingData() {
  const rendered = await renderHook(() => useReadingData(), { wrapper: ReadingDataProvider });
  /** Runs an action and hands back what it returned. */
  async function perform<T>(action: (data: ReturnType<typeof useReadingData>) => T): Promise<T> {
    let returned: T | undefined;
    await act(() => {
      returned = action(rendered.result.current);
    });
    return returned as T;
  }
  return { result: rendered.result, perform };
}

beforeEach(() => {
  mockDb = createTestDatabase();
});

describe('ReadingDataProvider: extra readings', () => {
  it('logs an extra on its day without moving the plan', async () => {
    const { result, perform } = await renderReadingData();
    await perform((data) => data.startPlan(draft()));

    const ids = await perform((data) => data.completeReading(TODAY, REVELATION_5, undefined, true));

    expect(ids).toHaveLength(1);
    expect(result.current.scheduleContext.byDate.has(TODAY)).toBe(true);
    expect(result.current.planScheduleContext.byDate.has(TODAY)).toBe(false);
    expect(result.current.planReadings).toHaveLength(0);
    expect(result.current.planScheduleContext.unread[0]).toEqual({ bookId: 'GEN', chapter: 1 });
  });

  it('writes nothing, and says so, without a plan', async () => {
    const { result, perform } = await renderReadingData();

    const ids = await perform((data) => data.completeReading(TODAY, REVELATION_5, undefined, true));

    expect(ids).toEqual([]);
    expect(result.current.completions).toHaveLength(0);
  });

  it('marks a reading as extra and back', async () => {
    const { result, perform } = await renderReadingData();
    await perform((data) => data.startPlan(draft()));
    const [id] = await perform((data) => data.completeReading(TODAY, [{ bookId: 'GEN', chapter: 1 }]));

    await perform((data) => data.setReadingExtra(id ?? '', true));
    expect(result.current.planReadings).toHaveLength(0);
    expect(result.current.planScheduleContext.unread[0]).toEqual({ bookId: 'GEN', chapter: 1 });

    await perform((data) => data.setReadingExtra(id ?? '', false));
    expect(result.current.planReadings.map((row) => row.id)).toEqual([id]);
    expect(result.current.planScheduleContext.unread[0]).toEqual({ bookId: 'GEN', chapter: 2 });
  });

  it('moves the plan and counts the reading toward it in one write', async () => {
    const { result, perform } = await renderReadingData();
    await perform((data) => data.startPlan(draft()));
    const [id] = await perform((data) => data.completeReading(TODAY, REVELATION_5, undefined, true));

    await perform((data) =>
      data.countTowardPlan(id ?? '', draft({ startDate: TODAY, startBookId: 'REV', startChapter: 6 })),
    );

    const active = result.current.activePlan;
    expect(active).toMatchObject({ startDate: TODAY, startBookId: 'REV', startChapter: 6 });
    expect(result.current.completions.find((row) => row.id === id)).toMatchObject({
      isExtra: false,
      readingPlanId: active?.id,
    });
  });
});

describe('ReadingDataProvider: read-throughs', () => {
  it('starts the next read-through only once the current one is finished', async () => {
    const { result, perform } = await renderReadingData();
    await perform((data) => data.startPlan(draft({ startBookId: 'REV', startChapter: 22 })));

    expect(await perform((data) => data.startNextReadThrough())).toBe(false);
    expect(result.current.plans).toHaveLength(1);

    await perform((data) => data.completeReading(daysAgo(9), [{ bookId: 'REV', chapter: 22 }]));
    expect(result.current.canStartNextReadThrough).toBe(true);
    expect(result.current.finishedReadThroughs).toBe(1);

    expect(await perform((data) => data.startNextReadThrough())).toBe(true);
    expect(result.current.currentReadThrough).toBe(2);
    expect(result.current.activePlan).toMatchObject({
      startDate: TODAY,
      startBookId: 'GEN',
      startChapter: 1,
      readThrough: 2,
    });
    expect(result.current.canStartNextReadThrough).toBe(false);
    expect(result.current.finishedReadThroughs).toBe(1);
    expect(result.current.planScheduleContext.unread[0]).toEqual({ bookId: 'GEN', chapter: 1 });
    // The days between finishing and starting again stay finished, not missed.
    expect(getDayReading(result.current.plans, daysAgo(5), result.current.scheduleContext).status).toBe(
      'canon-complete',
    );

    // A second start finds read-through 2 just begun, and starts nothing.
    expect(await perform((data) => data.startNextReadThrough())).toBe(false);
    expect(result.current.plans).toHaveLength(2);
  });
});
