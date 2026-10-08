// Extra readings in the day sheet (#19), ported from bibletrackerweb's
// extra-readings.dom.test.tsx. The alerts are native, so they are read from Alert.alert.
import { Alert } from 'react-native';

import { makePlan } from '@/features/reading-plan/domain/__tests__/fixtures';
import { createCompletionLookup } from '@/features/reading-plan/domain/schedule';
import type { DayReading, ReadingCompletion } from '@/features/reading-plan/domain/types';
import { fireEvent, renderWithTheme } from '@/test-utils/render';

import { DayDetail, type DayDetailProps } from '../day-detail';

const TODAY = '2026-10-07';
const LEVITICUS_24 = { bookId: 'LEV', chapter: 24 };
const REVELATION_5 = { bookId: 'REV', chapter: 5 };

function makeDay(overrides: Partial<DayReading> = {}): DayReading {
  return {
    date: TODAY,
    status: 'today-pending',
    scheduled: { kind: 'scheduled', chapters: [LEVITICUS_24] },
    completedChapters: [],
    plan: makePlan({ startDate: '2026-10-01', startBookId: 'LEV' }),
    ...overrides,
  };
}

function row(id: string, reference: { bookId: string; chapter: number }, isExtra = false): ReadingCompletion {
  return { id, readingPlanId: 'plan-1', localDate: TODAY, ...reference, verses: null, completedAt: 0, isExtra };
}

async function renderDetail(day: DayReading, overrides: Partial<DayDetailProps> = {}) {
  const props: DayDetailProps = {
    day,
    today: TODAY,
    onComplete: jest.fn(() => true),
    onLogExtra: jest.fn(() => 'extra-row'),
    onUndo: jest.fn(),
    onUndoEntry: jest.fn(),
    onChangePlan: jest.fn(),
    completions: createCompletionLookup([]),
    rows: [],
    extraRows: [],
    onSetExtra: jest.fn(),
    onCountTowardPlan: jest.fn(),
    classifyReading: () => 'plan',
    progress: null,
    getProgressFor: () => null,
    getCompletedOnFor: () => null,
    currentPosition: LEVITICUS_24,
    focusChapter: null,
    ...overrides,
  };
  const queries = await renderWithTheme(<DayDetail {...props} />);
  return { props, ...queries };
}

/** The most recent alert: its title, message and button labels. */
function lastAlert() {
  const [title, message, buttons] = (Alert.alert as jest.Mock).mock.calls.at(-1) ?? [];
  const list = (buttons ?? []) as { text: string; onPress?: () => void }[];
  return { title, message: message as string, labels: list.map((button) => button.text), buttons: list };
}

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('DayDetail: a Custom reading far from the plan', () => {
  async function logRevelation5(overrides: Partial<DayDetailProps> = {}) {
    const rendered = await renderDetail(makeDay(), {
      focusChapter: REVELATION_5,
      classifyReading: () => 'extra',
      ...overrides,
    });
    await fireEvent.press(rendered.getByTestId('log-custom-reading'));
    return rendered.props;
  }

  it('is recorded as an extra reading, not a plan reading', async () => {
    const { onLogExtra, onComplete } = await logRevelation5();
    expect(onLogExtra).toHaveBeenCalledWith(REVELATION_5, undefined);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('says so, keeps the plan where it is, and offers to move it instead', async () => {
    await logRevelation5();
    const { title, message, labels } = lastAlert();

    expect(title).toBe('Logged as an extra reading');
    expect(message).toContain('Revelation 5 is logged as an extra reading. Your plan stays at Leviticus 24.');
    expect(message).toContain('Move your plan to carry on from Revelation 6 instead?');
    expect(labels).toEqual(['Keep as extra', 'Move my plan']);
  });

  it('changes nothing when kept as extra', async () => {
    const { onChangePlan, onSetExtra, onCountTowardPlan } = await logRevelation5();
    lastAlert().buttons[0]?.onPress?.();

    expect(onChangePlan).not.toHaveBeenCalled();
    expect(onSetExtra).not.toHaveBeenCalled();
    expect(onCountTowardPlan).not.toHaveBeenCalled();
  });

  it('moves the plan on and brings the reading into it as one write', async () => {
    const { onChangePlan, onSetExtra, onCountTowardPlan } = await logRevelation5();
    lastAlert().buttons[1]?.onPress?.();

    expect(onCountTowardPlan).toHaveBeenCalledWith(
      'extra-row',
      expect.objectContaining({ startBookId: 'REV', startChapter: 6 }),
    );
    expect(onChangePlan).not.toHaveBeenCalled();
    expect(onSetExtra).not.toHaveBeenCalled();
  });

  it('does not offer to move the plan on a day from an earlier read-through', async () => {
    const { onCountTowardPlan } = await logRevelation5({ canMovePlan: false, currentPosition: null });
    const { message, labels, buttons } = lastAlert();

    expect(message).toContain('Your plan stays where it is.');
    expect(labels).toEqual(['Keep as extra', 'Count toward plan']);
    buttons[1]?.onPress?.();
    expect(onCountTowardPlan).toHaveBeenCalledWith('extra-row', null);
  });

  it('only offers to count it when there is nothing to carry on to', async () => {
    const { onCountTowardPlan } = await logRevelation5({ focusChapter: { bookId: 'REV', chapter: 22 } });
    const { labels, buttons } = lastAlert();

    expect(labels).toEqual(['Keep as extra', 'Count toward plan']);
    buttons[1]?.onPress?.();
    expect(onCountTowardPlan).toHaveBeenCalledWith('extra-row', null);
  });

  it('shows no notice when nothing was written', async () => {
    await logRevelation5({ onLogExtra: jest.fn(() => null) });
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('still asks the usual question for a plan reading', async () => {
    const { props, getByTestId } = await renderDetail(makeDay(), {
      focusChapter: { bookId: 'LEV', chapter: 26 },
      classifyReading: () => 'plan',
    });
    await fireEvent.press(getByTestId('log-custom-reading'));

    expect(props.onComplete).toHaveBeenCalledWith([{ bookId: 'LEV', chapter: 26 }], undefined);
    expect(props.onLogExtra).not.toHaveBeenCalled();
    expect(lastAlert().labels).toEqual(['Keep my plan', 'Continue from here']);
  });
});

describe('DayDetail: extra readings on a day', () => {
  it('lists them apart from the plan, each with its own actions', async () => {
    const { props, getByText, getByTestId } = await renderDetail(makeDay(), {
      extraRows: [row('extra-1', REVELATION_5, true)],
    });

    expect(getByText('EXTRA READINGS')).toBeTruthy();
    expect(getByText('Revelation 5')).toBeTruthy();

    await fireEvent.press(getByTestId('count-entry-extra-1'));
    expect(props.onSetExtra).toHaveBeenCalledWith('extra-1', false);
    await fireEvent.press(getByTestId('remove-extra-extra-1'));
    expect(props.onUndoEntry).toHaveBeenCalledWith('extra-1');
  });

  it('lists them under the Custom tab too', async () => {
    const { getByText } = await renderDetail(makeDay(), {
      focusChapter: REVELATION_5,
      extraRows: [row('extra-1', REVELATION_5, true)],
    });
    expect(getByText('EXTRA READINGS')).toBeTruthy();
  });

  it("still offers the plan's reading on a day holding only an extra", async () => {
    const { getByText } = await renderDetail(makeDay(), {
      extraRows: [row('extra-1', REVELATION_5, true)],
    });
    expect(getByText('Mark Leviticus 24 as Read')).toBeTruthy();
  });

  it('does not call a past day with an extra reading empty', async () => {
    const { getByText } = await renderDetail(
      makeDay({ date: '2026-10-05', status: 'missed', scheduled: { kind: 'not-scheduled' } }),
      { extraRows: [row('extra-1', REVELATION_5, true)] },
    );
    expect(getByText(/No plan reading was recorded on this day/)).toBeTruthy();
  });

  it('lets a recorded plan reading be marked as extra', async () => {
    const { props, getByTestId } = await renderDetail(
      makeDay({ status: 'completed', completedChapters: [LEVITICUS_24] }),
      { rows: [row('plan-row', LEVITICUS_24)] },
    );
    await fireEvent.press(getByTestId('mark-extra'));
    expect(props.onSetExtra).toHaveBeenCalledWith('plan-row', true);
  });

  it('lets one of several readings be marked as extra on its own', async () => {
    const LEVITICUS_25 = { bookId: 'LEV', chapter: 25 };
    const { props, getByTestId } = await renderDetail(
      makeDay({ status: 'completed', completedChapters: [LEVITICUS_24, LEVITICUS_25] }),
      { rows: [row('first', LEVITICUS_24), row('second', LEVITICUS_25)] },
    );
    await fireEvent.press(getByTestId('mark-extra-second'));
    expect(props.onSetExtra).toHaveBeenCalledWith('second', true);
  });
});
