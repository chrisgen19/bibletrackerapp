import { Alert } from 'react-native';

import { makePlan } from '@/features/reading-plan/domain/__tests__/fixtures';
import type { ChapterProgress } from '@/features/reading-plan/domain/chapter-progress';
import { createCompletionLookup } from '@/features/reading-plan/domain/schedule';
import type { DayReading } from '@/features/reading-plan/domain/types';
import { fireEvent, renderWithTheme } from '@/test-utils/render';

import { DayDetail } from '../day-detail';

const TODAY = '2026-08-09';

function makeDay(overrides: Partial<DayReading> = {}): DayReading {
  return {
    date: TODAY,
    status: 'today-pending',
    scheduled: { kind: 'scheduled', chapters: [{ bookId: 'GEN', chapter: 21 }] },
    completedChapters: [],
    plan: makePlan({ startDate: '2026-07-20' }),
    ...overrides,
  };
}

async function renderDetail(day: DayReading, handlers: Partial<Parameters<typeof DayDetail>[0]> = {}) {
  const onComplete = handlers.onComplete ?? jest.fn(() => true);
  const onUndo = handlers.onUndo ?? jest.fn();
  const onChangePlan = handlers.onChangePlan ?? jest.fn();
  const queries = await renderWithTheme(
    <DayDetail
      day={day}
      today={handlers.today ?? TODAY}
      onComplete={onComplete}
      onUndo={onUndo}
      onChangePlan={onChangePlan}
      completions={handlers.completions ?? createCompletionLookup([])}
      progress={handlers.progress ?? null}
    />,
  );
  return { onComplete, onUndo, onChangePlan, ...queries };
}

/** Invokes the nth button of the most recent Alert.alert call. */
function pressAlertButton(index: number) {
  const spy = Alert.alert as jest.Mock;
  const buttons = spy.mock.calls.at(-1)?.[2] as { text: string; onPress?: () => void }[] | undefined;
  buttons?.[index]?.onPress?.();
  return buttons;
}

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('DayDetail — plan tab', () => {
  it('shows the scheduled reading and marks it complete', async () => {
    const { getByText, getByTestId, onComplete } = await renderDetail(makeDay());

    expect(getByText('Genesis 21')).toBeTruthy();
    await fireEvent.press(getByTestId('mark-day-read'));
    // No span: verse tracking is off when the sheet has no chapter progress.
    expect(onComplete).toHaveBeenCalledWith([{ bookId: 'GEN', chapter: 21 }], undefined);
  });

  it('offers undo once completed, showing what was actually recorded', async () => {
    const { getByText, getByTestId, onUndo } = await renderDetail(
      makeDay({ status: 'completed', completedChapters: [{ bookId: 'JHN', chapter: 3 }] }),
    );

    expect(getByText('John 3 completed')).toBeTruthy();
    await fireEvent.press(getByTestId('undo-completion'));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('keeps future days view-only with no tabs', async () => {
    const { queryByTestId, getByText } = await renderDetail(
      makeDay({ date: '2026-09-01', status: 'upcoming' }),
    );

    expect(getByText('You can mark this reading once the day arrives.')).toBeTruthy();
    expect(queryByTestId('mark-day-read')).toBeNull();
    expect(queryByTestId('day-tab-custom')).toBeNull();
  });
});

/** Genesis 21 has 34 verses. */
function progressFor(read: { from: number; to: number }[]): ChapterProgress {
  const verseCount = 34;
  const remaining: { from: number; to: number }[] = [];
  let cursor = 1;
  for (const r of read) {
    if (r.from > cursor) remaining.push({ from: cursor, to: r.from - 1 });
    cursor = Math.max(cursor, r.to + 1);
  }
  if (cursor <= verseCount) remaining.push({ from: cursor, to: verseCount });
  return {
    reference: { bookId: 'GEN', chapter: 21 },
    verseCount,
    read,
    remaining,
    isComplete: remaining.length === 0,
    isPartial: read.length > 0 && remaining.length > 0,
  };
}

describe('DayDetail — partial chapters', () => {
  it('offers a verse limit when a single chapter is scheduled', async () => {
    const { getByTestId } = await renderDetail(makeDay(), { progress: progressFor([]) });
    expect(getByTestId('field-to-verse')).toBeTruthy();
  });

  it('defaults to the whole chapter, so one tap still records everything', async () => {
    const onComplete = jest.fn(() => true);
    const { getByTestId } = await renderDetail(makeDay(), { progress: progressFor([]), onComplete });

    await fireEvent.press(getByTestId('mark-day-read'));

    expect(onComplete).toHaveBeenCalledWith([{ bookId: 'GEN', chapter: 21 }], { from: 1, to: 34 });
  });

  it('records only as far as the chosen verse', async () => {
    const onComplete = jest.fn(() => true);
    const { getByTestId, getByLabelText } = await renderDetail(makeDay(), {
      progress: progressFor([]),
      onComplete,
    });

    await fireEvent.press(getByTestId('field-to-verse'));
    await fireEvent.press(getByLabelText('To verse 10'));
    await fireEvent.press(getByTestId('mark-day-read'));

    expect(onComplete).toHaveBeenCalledWith([{ bookId: 'GEN', chapter: 21 }], { from: 1, to: 10 });
  });

  it('shows what is read and what is left when a chapter is unfinished', async () => {
    const { getByText } = await renderDetail(
      makeDay({ status: 'completed', completedChapters: [{ bookId: 'GEN', chapter: 21 }] }),
      { progress: progressFor([{ from: 1, to: 10 }]) },
    );
    expect(getByText('Read 1–10 · 11–34 to go')).toBeTruthy();
  });

  it('still offers to continue when the day is marked but the chapter is not finished', async () => {
    // The crux: reading 1-10 completes the *day* but not the *chapter*.
    const onComplete = jest.fn(() => true);
    const { getByTestId } = await renderDetail(
      makeDay({ status: 'completed', completedChapters: [{ bookId: 'GEN', chapter: 21 }] }),
      { progress: progressFor([{ from: 1, to: 10 }]), onComplete },
    );

    await fireEvent.press(getByTestId('mark-day-read'));

    // Resumes at 11 rather than starting over.
    expect(onComplete).toHaveBeenCalledWith([{ bookId: 'GEN', chapter: 21 }], { from: 11, to: 34 });
  });

  it('shows the completed state once every verse is read', async () => {
    const { getByTestId, queryByTestId } = await renderDetail(
      makeDay({ status: 'completed', completedChapters: [{ bookId: 'GEN', chapter: 21 }] }),
      { progress: progressFor([{ from: 1, to: 34 }]) },
    );
    expect(getByTestId('undo-completion')).toBeTruthy();
    expect(queryByTestId('mark-day-read')).toBeNull();
  });

  it('records the span against the scheduled chapter, not everything logged that day', async () => {
    // Regression: a day holding both a partial scheduled read and a custom log of a
    // different chapter passed two chapters, so the repository dropped the span and
    // wrote whole-chapter sentinels — falsely completing the scheduled chapter.
    const onComplete = jest.fn(() => true);
    const { getByTestId } = await renderDetail(
      makeDay({
        status: 'completed',
        completedChapters: [
          { bookId: 'GEN', chapter: 21 },
          { bookId: 'EXO', chapter: 1 },
        ],
      }),
      { progress: progressFor([{ from: 1, to: 10 }]), onComplete },
    );

    await fireEvent.press(getByTestId('mark-day-read'));

    expect(onComplete).toHaveBeenCalledWith([{ bookId: 'GEN', chapter: 21 }], { from: 11, to: 34 });
  });

  it('does not claim the day is complete just because the chapter was read elsewhere', async () => {
    // Chapter progress spans every date. A chapter read on another day, then
    // scheduled again after a plan change, must not mark this day complete.
    const { queryByTestId, getByTestId } = await renderDetail(
      makeDay({ status: 'today-pending', completedChapters: [] }),
      { progress: progressFor([{ from: 1, to: 34 }]) },
    );

    expect(queryByTestId('undo-completion')).toBeNull();
    expect(getByTestId('mark-day-read')).toBeTruthy();
  });

  it('does not offer verse tracking on a future day', async () => {
    const { queryByTestId } = await renderDetail(
      makeDay({ date: '2026-09-01', status: 'upcoming' }),
      { progress: progressFor([]) },
    );
    expect(queryByTestId('field-to-verse')).toBeNull();
  });

  it('resumes from the first unread verse in the picker', async () => {
    const { getByTestId, queryByLabelText } = await renderDetail(
      makeDay({ status: 'completed', completedChapters: [{ bookId: 'GEN', chapter: 21 }] }),
      { progress: progressFor([{ from: 1, to: 10 }]) },
    );

    await fireEvent.press(getByTestId('field-to-verse'));
    // Already-read verses are not offered again.
    expect(queryByLabelText('To verse 5')).toBeNull();
    expect(queryByLabelText('To verse 11')).not.toBeNull();
  });
});

describe('DayDetail — custom tab', () => {
  it('logs an arbitrary chapter for the day', async () => {
    const { getByTestId, onComplete } = await renderDetail(makeDay());

    await fireEvent.press(getByTestId('day-tab-custom'));
    await fireEvent.press(getByTestId('log-custom-reading'));

    // Defaults to the scheduled chapter until the user picks something else.
    // No span: verse tracking is off when the sheet has no chapter progress.
    expect(onComplete).toHaveBeenCalledWith([{ bookId: 'GEN', chapter: 21 }]);
  });

  it('asks whether to move the plan, and does nothing to it when declined', async () => {
    const { getByTestId, onChangePlan } = await renderDetail(makeDay());

    await fireEvent.press(getByTestId('day-tab-custom'));
    await fireEvent.press(getByTestId('log-custom-reading'));

    const buttons = pressAlertButton(0); // "Keep my plan"
    expect(buttons?.[0]?.text).toBe('Keep my plan');
    expect(onChangePlan).not.toHaveBeenCalled();
  });

  it('moves the position to the next chapter when accepted', async () => {
    const { getByTestId, onChangePlan } = await renderDetail(makeDay());

    await fireEvent.press(getByTestId('day-tab-custom'));
    await fireEvent.press(getByTestId('log-custom-reading'));
    pressAlertButton(1); // "Continue from here"

    expect(onChangePlan).toHaveBeenCalledWith({
      canonId: 'protestant',
      // Logged today, so the plan resumes tomorrow — today keeps its own history.
      startDate: '2026-08-10',
      startBookId: 'GEN',
      startChapter: 22,
      chaptersPerDay: 1,
    });
  });

  it('does not offer to continue past the end of the canon', async () => {
    // CustomPanel seeds its state from the day's recorded chapter, so setting
    // completedChapters to Revelation 22 is what puts the picker at the canon end.
    const { getByTestId, onComplete } = await renderDetail(
      makeDay({
        completedChapters: [{ bookId: 'REV', chapter: 22 }],
        status: 'completed',
      }),
    );

    await fireEvent.press(getByTestId('day-tab-custom'));
    await fireEvent.press(getByTestId('log-custom-reading'));

    expect(onComplete).toHaveBeenCalledWith([{ bookId: 'REV', chapter: 22 }]);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('does not claim success when the write is rejected', async () => {
    // Regression: with no plan to attach to, completeReading writes nothing. The
    // sheet used to show "<chapter> is logged" and offer a continuation anyway.
    const onComplete = jest.fn(() => false);
    const { getByTestId, onChangePlan } = await renderDetail(makeDay(), { onComplete });

    await fireEvent.press(getByTestId('day-tab-custom'));
    await fireEvent.press(getByTestId('log-custom-reading'));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(onChangePlan).not.toHaveBeenCalled();
  });

  it('lets a day the plan never covered still be logged', async () => {
    const { getByTestId, getByText, onComplete } = await renderDetail(
      makeDay({
        date: '2026-07-01',
        status: 'before-plan',
        scheduled: { kind: 'before-plan' },
        plan: null,
      }),
    );

    expect(getByText('You can still record what you read using the Custom tab.')).toBeTruthy();

    await fireEvent.press(getByTestId('day-tab-custom'));
    await fireEvent.press(getByTestId('log-custom-reading'));
    // Exercises the plan: null path through buildContinuationDraft.
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
