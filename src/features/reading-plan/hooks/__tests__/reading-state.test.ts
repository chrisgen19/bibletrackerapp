import { makeCompletion, makePlan } from '@/features/reading-plan/domain/__tests__/fixtures';
import {
  FIRST,
  FIRST_RUN,
  SECOND,
} from '@/features/reading-plan/domain/__tests__/read-through-fixtures';
import {
  calculateReadingForDate,
  getDayReading,
  isScheduledDay,
} from '@/features/reading-plan/domain/schedule';

import { deriveReadingState } from '../reading-state';

describe('deriveReadingState with an extra reading', () => {
  const plan = makePlan({ startDate: '2026-10-01' });
  const planReading = makeCompletion('2026-10-01', { id: 'gen1', chapter: 1 });
  const extra = makeCompletion('2026-10-02', { id: 'rev5', bookId: 'REV', chapter: 5, isExtra: true });
  const state = deriveReadingState(
    { plans: [plan], activePlan: plan, completions: [planReading, extra] },
    '2026-10-02',
  );

  it('shows the extra on its day in the full context only', () => {
    expect(state.scheduleContext.byDate.has('2026-10-02')).toBe(true);
    expect(state.planScheduleContext.byDate.has('2026-10-02')).toBe(false);
    expect(state.completionLookup.has('2026-10-02')).toBe(true);
    expect(state.planCompletionLookup.has('2026-10-02')).toBe(false);
  });

  it('never moves the plan for it', () => {
    expect(state.planReadings.map((row) => row.id)).toEqual(['gen1']);
    expect(state.progressReadings.map((row) => row.id)).toEqual(['gen1']);
    expect(state.scheduleContext.unread[0]).toEqual({ bookId: 'GEN', chapter: 2 });
    expect(state.planScheduleContext.unread[0]).toEqual({ bookId: 'GEN', chapter: 2 });
  });

  it('still offers the plan reading on a day holding only an extra', () => {
    expect(calculateReadingForDate(plan, '2026-10-02', state.planScheduleContext)).toEqual({
      kind: 'scheduled',
      chapters: [{ bookId: 'GEN', chapter: 2 }],
    });
  });
});

describe('deriveReadingState across read-throughs', () => {
  it('counts the current read-through only, and keeps the last one finished', () => {
    const plans = [FIRST, SECOND];
    const state = deriveReadingState({ plans, activePlan: SECOND, completions: FIRST_RUN }, '2027-06-01');

    expect(state.currentReadThrough).toBe(2);
    expect(state.progressReadings).toHaveLength(0);
    expect(state.planScheduleContext.unread[0]).toEqual({ bookId: 'GEN', chapter: 1 });
    expect(state.finishedReadThroughs).toBe(1);
    expect(state.canStartNextReadThrough).toBe(false);
    // The days between finishing read-through 1 and starting 2 stay finished.
    expect(getDayReading(plans, '2027-05-15', state.scheduleContext).status).toBe('canon-complete');
    expect(isScheduledDay(plans, '2027-05-15', state.scheduleContext)).toBe(false);
  });

  it('offers the next read-through once the current one is finished', () => {
    const active = { ...FIRST, isActive: true, endDate: null };
    const state = deriveReadingState(
      { plans: [active], activePlan: active, completions: FIRST_RUN },
      '2027-05-15',
    );

    expect(state.currentReadThrough).toBe(1);
    expect(state.finishedReadThroughs).toBe(1);
    expect(state.canStartNextReadThrough).toBe(true);
  });

  it('offers nothing without a plan', () => {
    const state = deriveReadingState({ plans: [], activePlan: null, completions: [] }, '2026-10-02');

    expect(state.currentReadThrough).toBe(1);
    expect(state.finishedReadThroughs).toBe(0);
    expect(state.canStartNextReadThrough).toBe(false);
  });
});
