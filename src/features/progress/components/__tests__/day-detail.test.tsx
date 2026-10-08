import { Alert } from 'react-native';

import { makePlan } from '@/features/reading-plan/domain/__tests__/fixtures';
import type { ChapterProgress } from '@/features/reading-plan/domain/chapter-progress';
import { createCompletionLookup } from '@/features/reading-plan/domain/schedule';
import type { DayReading, ReadingCompletion } from '@/features/reading-plan/domain/types';
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

/** One row per recorded chapter, which is what the sheet actually renders from. */
function rowsFor(day: DayReading): ReadingCompletion[] {
  return day.completedChapters.map((reference, position) => ({
    id: `row-${position}`,
    readingPlanId: 'plan-1',
    localDate: day.date,
    bookId: reference.bookId,
    chapter: reference.chapter,
    verses: null,
    completedAt: 0,
  }));
}

async function renderDetail(day: DayReading, handlers: Partial<Parameters<typeof DayDetail>[0]> = {}) {
  const onComplete = handlers.onComplete ?? jest.fn(() => true);
  const onUndo = handlers.onUndo ?? jest.fn();
  const onUndoEntry = handlers.onUndoEntry ?? jest.fn();
  const onChangePlan = handlers.onChangePlan ?? jest.fn();
  const queries = await renderWithTheme(
    <DayDetail
      day={day}
      today={handlers.today ?? TODAY}
      onComplete={onComplete}
      onUndo={onUndo}
      onUndoEntry={onUndoEntry}
      onChangePlan={onChangePlan}
      // No extras, and every log is a plan reading: what these tests were written for.
      onLogExtra={handlers.onLogExtra ?? (() => null)}
      extraRows={handlers.extraRows ?? []}
      onSetExtra={handlers.onSetExtra ?? jest.fn()}
      onCountTowardPlan={handlers.onCountTowardPlan ?? jest.fn()}
      classifyReading={handlers.classifyReading ?? (() => 'plan')}
      completions={handlers.completions ?? createCompletionLookup([])}
      rows={handlers.rows ?? rowsFor(day)}
      progress={handlers.progress ?? null}
      getProgressFor={handlers.getProgressFor ?? (() => null)}
      getCompletedOnFor={handlers.getCompletedOnFor ?? (() => null)}
      currentPosition={handlers.currentPosition ?? null}
      focusChapter={handlers.focusChapter ?? null}
    />,
  );
  return { onComplete, onUndo, onUndoEntry, onChangePlan, ...queries };
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
    expect(getByText('You’ve read verses 1–10. Verses 11–34 still to go.')).toBeTruthy();
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

  it('names the finished chapter once, not as a span of itself', async () => {
    // Reading 1-10 then 11-end on the same date leaves two rows for one chapter.
    // The confirmation used to read "Genesis 21-21 completed".
    const { getByText, queryByText } = await renderDetail(
      makeDay({
        status: 'completed',
        completedChapters: [
          { bookId: 'GEN', chapter: 21 },
          { bookId: 'GEN', chapter: 21 },
        ],
      }),
      { progress: progressFor([{ from: 1, to: 34 }]) },
    );

    expect(getByText('Genesis 21 completed')).toBeTruthy();
    expect(queryByText('Genesis 21–21 completed')).toBeNull();
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
    expect(onComplete).toHaveBeenCalledWith([{ bookId: 'GEN', chapter: 21 }], undefined);
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

  it('clears the verse selection after logging, as the plan tab does', async () => {
    const { getByTestId, getByLabelText, queryByText } = await renderDetail(makeDay(), {
      getProgressFor: () => progressFor([]),
    });

    await fireEvent.press(getByTestId('day-tab-custom'));
    await fireEvent.press(getByTestId('custom-field-to-verse'));
    await fireEvent.press(getByLabelText('To verse 10'));
    expect(queryByText('Log Genesis 21:1–10 as Read')).not.toBeNull();

    await fireEvent.press(getByTestId('log-custom-reading'));

    // A stale selection is how the reversed span below becomes reachable.
    expect(queryByText('Log Genesis 21:1–10 as Read')).toBeNull();
    expect(queryByText('Log Genesis 21 as Read')).not.toBeNull();
  });

  it('never writes a reversed span after progress advances past the stale selection', async () => {
    // The sheet stays open after logging, so progress refreshes underneath it:
    // fromVerse moves to 11 while a stale toVerse of 10 remains, giving 11-10.
    // normaliseRanges swaps that to 10-11 and marks verse 11 read unread.
    let read: { from: number; to: number }[] = [];
    const onComplete = jest.fn((_c: unknown, verses?: { from: number; to: number }) => {
      if (verses !== undefined) read = [...read, verses];
      return true;
    });
    const { getByTestId, getByLabelText, queryByText } = await renderDetail(makeDay(), {
      onComplete,
      getProgressFor: () => progressFor(read),
    });

    await fireEvent.press(getByTestId('day-tab-custom'));
    await fireEvent.press(getByTestId('custom-field-to-verse'));
    await fireEvent.press(getByLabelText('To verse 10'));
    await fireEvent.press(getByTestId('log-custom-reading'));

    // Re-opening the picker re-renders against the refreshed progress.
    await fireEvent.press(getByTestId('custom-field-to-verse'));
    expect(queryByText('Log Genesis 21:11–10 as Read')).toBeNull();

    await fireEvent.press(getByTestId('log-custom-reading'));
    for (const span of onComplete.mock.calls.map((call) => call[1])) {
      if (span !== undefined) expect(span.to).toBeGreaterThanOrEqual(span.from);
    }
  });

  it('does not offer to move the plan past verses that are still unread', async () => {
    // Regression: the continuation draft starts at the chapter *after* the one
    // logged. Offering it after a partial read would advance the plan to Genesis 22
    // while 11-34 of Genesis 21 had never been read - re-creating the very loss
    // this feature exists to prevent.
    const { getByTestId, getByLabelText, onComplete, onChangePlan } = await renderDetail(
      makeDay(),
      { getProgressFor: () => progressFor([]) },
    );

    await fireEvent.press(getByTestId('day-tab-custom'));
    await fireEvent.press(getByTestId('custom-field-to-verse'));
    await fireEvent.press(getByLabelText('To verse 10'));
    await fireEvent.press(getByTestId('log-custom-reading'));

    expect(onComplete).toHaveBeenCalledWith([{ bookId: 'GEN', chapter: 21 }], { from: 1, to: 10 });
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(onChangePlan).not.toHaveBeenCalled();
  });

  it('offers to move the plan once a resumed chapter is actually finished', async () => {
    // The mirror of the case above: 1-10 were read earlier, the user now reads
    // 11-34, so the chapter is genuinely done and continuing is correct.
    const { getByTestId, getByLabelText, onComplete, onChangePlan } = await renderDetail(
      makeDay(),
      { getProgressFor: () => progressFor([{ from: 1, to: 10 }]) },
    );

    await fireEvent.press(getByTestId('day-tab-custom'));
    await fireEvent.press(getByTestId('custom-field-to-verse'));
    await fireEvent.press(getByLabelText('To verse 34, finishes the chapter'));
    await fireEvent.press(getByTestId('log-custom-reading'));

    expect(onComplete).toHaveBeenCalledWith([{ bookId: 'GEN', chapter: 21 }], { from: 11, to: 34 });
    pressAlertButton(1);
    expect(onChangePlan).toHaveBeenCalledWith(
      expect.objectContaining({ startBookId: 'GEN', startChapter: 22 }),
    );
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

    expect(onComplete).toHaveBeenCalledWith([{ bookId: 'REV', chapter: 22 }], undefined);
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

describe('DayDetail — a day that passed unread', () => {
  it('says the position is unchanged rather than claiming the plan had not started', () => {
    // Regression: the new `not-scheduled` kind fell through to the before-plan copy,
    // telling the reader their plan had not begun on a day well inside it.
    const day = makeDay({
      date: '2026-08-05',
      status: 'missed',
      scheduled: { kind: 'not-scheduled' },
      completedChapters: [],
    });
    return renderDetail(day, { today: TODAY }).then(({ getByText, queryByText }) => {
      expect(getByText(/your place in the plan moves as you read/)).toBeTruthy();
      expect(queryByText(/hadn’t started yet/)).toBeNull();
    });
  });
});

describe('DayDetail — catching up on a missed day', () => {
  const LEVITICUS_6 = { bookId: 'LEV', chapter: 6 };

  /** Leviticus 6 has 30 verses. */
  function leviticusProgress(read: { from: number; to: number }[]): ChapterProgress {
    const verseCount = 30;
    const remaining: { from: number; to: number }[] = [];
    let cursor = 1;
    for (const r of read) {
      if (r.from > cursor) remaining.push({ from: cursor, to: r.from - 1 });
      cursor = Math.max(cursor, r.to + 1);
    }
    if (cursor <= verseCount) remaining.push({ from: cursor, to: verseCount });
    return {
      reference: LEVITICUS_6,
      verseCount,
      read,
      remaining,
      isComplete: remaining.length === 0,
      isPartial: read.length > 0 && remaining.length > 0,
    };
  }

  function missedDay() {
    return makeDay({
      date: '2026-08-05',
      status: 'missed',
      scheduled: { kind: 'not-scheduled' },
      completedChapters: [],
    });
  }

  it('seeds the custom tab from the reading position, not Genesis 1', async () => {
    // The regression. A missed day schedules nothing, so both fallbacks used to
    // land on `index.firstReference`. Setting only the verse then recorded
    // Genesis 1 against a day the reader had spent in Leviticus.
    const { getByTestId, getByText, onComplete } = await renderDetail(missedDay(), {
      currentPosition: LEVITICUS_6,
    });

    await fireEvent.press(getByTestId('day-tab-custom'));

    expect(getByText('Leviticus')).toBeTruthy();
    expect(getByText('6')).toBeTruthy();

    await fireEvent.press(getByTestId('log-custom-reading'));
    expect(onComplete).toHaveBeenCalledWith([LEVITICUS_6], undefined);
  });

  it('falls back to Genesis 1 only when there is no position at all', async () => {
    const { getByTestId, onComplete } = await renderDetail(missedDay(), {
      currentPosition: null,
    });

    await fireEvent.press(getByTestId('day-tab-custom'));
    await fireEvent.press(getByTestId('log-custom-reading'));

    expect(onComplete).toHaveBeenCalledWith([{ bookId: 'GEN', chapter: 1 }], undefined);
  });

  it('offers the catch-up without leaving the plan tab', async () => {
    const { getByTestId, getByText, getByLabelText, onComplete } = await renderDetail(missedDay(), {
      currentPosition: LEVITICUS_6,
      getProgressFor: () => leviticusProgress([]),
    });

    expect(getByText(/your place in the plan moves as you read/)).toBeTruthy();
    expect(getByText('Mark Leviticus 6 as Read')).toBeTruthy();

    await fireEvent.press(getByTestId('catch-up-field-to-verse'));
    await fireEvent.press(getByLabelText('To verse 7'));
    await fireEvent.press(getByTestId('catch-up-submit'));

    expect(onComplete).toHaveBeenCalledWith([LEVITICUS_6], { from: 1, to: 7 });
  });

  it('does not offer a catch-up on a day before the plan began', async () => {
    const { queryByTestId, getByText } = await renderDetail(
      makeDay({ date: '2026-07-01', status: 'before-plan', scheduled: { kind: 'before-plan' }, plan: null }),
      { currentPosition: LEVITICUS_6, getProgressFor: () => leviticusProgress([]) },
    );

    expect(queryByTestId('catch-up-submit')).toBeNull();
    expect(getByText('You can still record what you read using the Custom tab.')).toBeTruthy();
  });

  it('does not ask to move the plan when logging the chapter already at the head', async () => {
    // The queue steps over finished chapters by itself, so there is nothing to move.
    // Accepting the prompt would rewrite the plan start and drop every chapter still
    // unread before it.
    const { getByTestId, onChangePlan } = await renderDetail(
      makeDay({ scheduled: { kind: 'scheduled', chapters: [{ bookId: 'GEN', chapter: 21 }] } }),
      { currentPosition: { bookId: 'GEN', chapter: 21 } },
    );

    await fireEvent.press(getByTestId('day-tab-custom'));
    await fireEvent.press(getByTestId('log-custom-reading'));

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(onChangePlan).not.toHaveBeenCalled();
  });
});

describe('DayDetail — a chapter that is already finished', () => {
  const complete = progressFor([{ from: 1, to: 34 }]);

  it('says so instead of offering it as a fresh reading', async () => {
    // A finished chapter leaves `remaining` empty, so fromVerse fell back to 1 and
    // the control read exactly like an untouched chapter: "Log Genesis 21 as Read".
    const { getByText, queryByText, getByTestId } = await renderDetail(makeDay(), {
      getProgressFor: () => complete,
      getCompletedOnFor: () => '2026-08-07',
    });

    await fireEvent.press(getByTestId('day-tab-custom'));

    expect(getByText('Genesis 21 is already fully read — completed on 7 August.')).toBeTruthy();
    expect(getByText('Log Genesis 21 Again')).toBeTruthy();
    expect(queryByText('Log Genesis 21 as Read')).toBeNull();
  });

  it('distinguishes a chapter recorded on the day being viewed', async () => {
    const { getByText, getByTestId } = await renderDetail(makeDay(), {
      getProgressFor: () => complete,
      getCompletedOnFor: () => TODAY,
    });

    await fireEvent.press(getByTestId('day-tab-custom'));

    expect(getByText('Genesis 21 is already recorded on this day.')).toBeTruthy();
  });

  it('drops the "finishes the chapter" wording for something already finished', async () => {
    const { getByText, queryByText, getByTestId } = await renderDetail(makeDay(), {
      getProgressFor: () => complete,
      getCompletedOnFor: () => '2026-08-07',
    });

    await fireEvent.press(getByTestId('day-tab-custom'));

    expect(getByText('34 (whole chapter)')).toBeTruthy();
    expect(queryByText('34 (finishes the chapter)')).toBeNull();
    expect(queryByText(/Stopping early/)).toBeNull();
  });

  it('still records when the reader really means to log it again', async () => {
    const { getByTestId, onComplete } = await renderDetail(makeDay(), {
      getProgressFor: () => complete,
      getCompletedOnFor: () => '2026-08-07',
    });

    await fireEvent.press(getByTestId('day-tab-custom'));
    await fireEvent.press(getByTestId('log-custom-reading'));

    expect(onComplete).toHaveBeenCalledWith([{ bookId: 'GEN', chapter: 21 }], { from: 1, to: 34 });
  });
});

describe('DayDetail — removing a mistaken reading', () => {
  it('offers removal even while the chapter is unfinished', async () => {
    // The reader who logged the wrong chapter for half a chapter had no way back:
    // the calendar showed the day complete while the sheet only offered to read on.
    const { getByTestId, onUndo } = await renderDetail(
      makeDay({ status: 'completed', completedChapters: [{ bookId: 'GEN', chapter: 21 }] }),
      { progress: progressFor([{ from: 1, to: 10 }]) },
    );

    expect(getByTestId('mark-day-read')).toBeTruthy();
    await fireEvent.press(getByTestId('undo-completion'));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('does not claim a part-read chapter is completed', async () => {
    // The label used to come from the *scheduled* chapter's progress, so a day
    // holding a half-read chapter showed a checkmark and "completed".
    const day = makeDay({ status: 'completed', completedChapters: [{ bookId: 'GEN', chapter: 21 }] });
    const partial = progressFor([{ from: 1, to: 10 }]);
    const { getByText, queryByText } = await renderDetail(day, {
      rows: [
        {
          id: 'row-0',
          readingPlanId: 'plan-1',
          localDate: day.date,
          bookId: 'GEN',
          chapter: 21,
          verses: { from: 1, to: 10 },
          completedAt: 0,
        },
      ],
      progress: partial,
      getProgressFor: () => partial,
    });

    expect(getByText('Genesis 21:1–10 recorded')).toBeTruthy();
    expect(queryByText('Genesis 21 completed')).toBeNull();
  });

  it('reads completion from the rows when a day holds two chapters', async () => {
    // A two-chapter day has no single `progress`, which used to resolve to
    // "complete" and label an unfinished pair as done.
    const day = makeDay({
      status: 'completed',
      completedChapters: [
        { bookId: 'GEN', chapter: 21 },
        { bookId: 'LEV', chapter: 6 },
      ],
    });
    const partial = progressFor([{ from: 1, to: 10 }]);
    const { queryByText } = await renderDetail(day, {
      progress: null,
      getProgressFor: (reference) => (reference.bookId === 'GEN' ? partial : null),
    });

    expect(queryByText(/completed/)).toBeNull();
  });

  it('labels a part-read chapter honestly on a day before the plan began', async () => {
    // UnscheduledPanel passed `isComplete` as a constant. A before-plan day is the
    // one place that panel still renders with rows.
    const partial = progressFor([{ from: 1, to: 10 }]);
    const { queryByText } = await renderDetail(
      makeDay({
        date: '2026-07-01',
        status: 'completed',
        scheduled: { kind: 'before-plan' },
        plan: null,
        completedChapters: [{ bookId: 'GEN', chapter: 21 }],
      }),
      { getProgressFor: () => partial },
    );

    expect(queryByText('Genesis 21 completed')).toBeNull();
  });

  it('removes a single entry from a day holding several', async () => {
    const day = makeDay({
      status: 'completed',
      completedChapters: [
        { bookId: 'GEN', chapter: 1 },
        { bookId: 'LEV', chapter: 6 },
      ],
    });
    const { getByTestId, onUndoEntry } = await renderDetail(day);

    await fireEvent.press(getByTestId('remove-entry-row-0'));

    expect(onUndoEntry).toHaveBeenCalledWith('row-0');
  });
});
