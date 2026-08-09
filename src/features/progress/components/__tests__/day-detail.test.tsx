import { Alert } from 'react-native';

import { makePlan } from '@/features/reading-plan/domain/__tests__/fixtures';
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
  const onComplete = handlers.onComplete ?? jest.fn();
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
    expect(onComplete).toHaveBeenCalledWith([{ bookId: 'GEN', chapter: 21 }]);
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

describe('DayDetail — custom tab', () => {
  it('logs an arbitrary chapter for the day', async () => {
    const { getByTestId, onComplete } = await renderDetail(makeDay());

    await fireEvent.press(getByTestId('day-tab-custom'));
    await fireEvent.press(getByTestId('log-custom-reading'));

    // Defaults to the scheduled chapter until the user picks something else.
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
