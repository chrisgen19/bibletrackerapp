import type { DayReading } from '@/features/reading-plan/domain/types';
import { fireEvent, renderWithTheme } from '@/test-utils/render';

import { TodayReadingCard } from '../today-reading-card';

function makeDay(overrides: Partial<DayReading> = {}): DayReading {
  return {
    date: '2026-08-24',
    status: 'today-pending',
    scheduled: { kind: 'scheduled', chapters: [{ bookId: 'GEN', chapter: 24 }] },
    completedChapters: [],
    plan: null,
    ...overrides,
  };
}

function renderCard(
  day: DayReading,
  handlers: {
    onMarkRead?: () => void;
    onOpenDetail?: () => void;
    progress?: Parameters<typeof TodayReadingCard>[0]['progress'];
  } = {},
) {
  return renderWithTheme(
    <TodayReadingCard
      day={day}
      onMarkRead={handlers.onMarkRead ?? jest.fn()}
      onOpenDetail={handlers.onOpenDetail ?? jest.fn()}
      progress={handlers.progress ?? null}
    />,
  );
}

/** Genesis 24 has 67 verses. */
function partialProgress(readTo: number) {
  return {
    reference: { bookId: 'GEN', chapter: 24 },
    verseCount: 67,
    read: [{ from: 1, to: readTo }],
    remaining: [{ from: readTo + 1, to: 67 }],
    isComplete: false,
    isPartial: true,
  };
}

describe('TodayReadingCard', () => {
  it('answers "what should I read today?"', async () => {
    const { getByText } = await renderCard(makeDay());

    expect(getByText('Genesis 24')).toBeTruthy();
    expect(getByText('One chapter')).toBeTruthy();
  });

  it('marks the reading complete when the primary action is pressed', async () => {
    const onMarkRead = jest.fn();
    const { getByTestId } = await renderCard(makeDay(), { onMarkRead });

    await fireEvent.press(getByTestId('mark-today-read'));
    expect(onMarkRead).toHaveBeenCalledTimes(1);
  });

  it('replaces the action with a confirmation once completed', async () => {
    const { getByText, queryByTestId } = await renderCard(
      makeDay({ status: 'completed', completedChapters: [{ bookId: 'GEN', chapter: 24 }] }),
    );

    expect(getByText('Completed today')).toBeTruthy();
    // Undo is intentionally not offered as the primary action here.
    expect(queryByTestId('mark-today-read')).toBeNull();
  });

  it('shows what was actually read, not the schedule, once logged', async () => {
    // Regression: logging Genesis 50 on a day scheduled for Genesis 24 used to leave
    // the card announcing "Genesis 24 — Completed today", contradicting the day sheet.
    const { getByText, queryByText } = await renderCard(
      makeDay({ status: 'completed', completedChapters: [{ bookId: 'GEN', chapter: 50 }] }),
    );

    expect(getByText('Genesis 50')).toBeTruthy();
    expect(queryByText('Genesis 24')).toBeNull();
  });

  it('still shows the schedule while the day is unread', async () => {
    const { getByText } = await renderCard(makeDay());
    expect(getByText('Genesis 24')).toBeTruthy();
  });

  it('routes to the day detail for undo', async () => {
    const onOpenDetail = jest.fn();
    const { getByTestId } = await renderCard(makeDay({ status: 'completed' }), { onOpenDetail });

    await fireEvent.press(getByTestId('open-today-detail'));
    expect(onOpenDetail).toHaveBeenCalledTimes(1);
  });

  it('celebrates finishing the canon instead of offering an empty reading', async () => {
    const { getByText, queryByTestId } = await renderCard(
      makeDay({ status: 'canon-complete', scheduled: { kind: 'canon-complete' } }),
    );

    expect(getByText('You have finished the Bible')).toBeTruthy();
    expect(queryByTestId('mark-today-read')).toBeNull();
  });

  it('explains a plan that has not started yet', async () => {
    const { getByText } = await renderCard(
      makeDay({ status: 'before-plan', scheduled: { kind: 'before-plan' } }),
    );

    expect(getByText('Your plan starts soon')).toBeTruthy();
  });

  it('shows what is left when the chapter is part-read', async () => {
    const { getByText } = await renderCard(
      makeDay({ status: 'completed', completedChapters: [{ bookId: 'GEN', chapter: 24 }] }),
      { progress: partialProgress(10) },
    );
    expect(getByText('11–67 still to read')).toBeTruthy();
  });

  it('offers to continue rather than claiming the day is done', async () => {
    // The day has a reading recorded, but the chapter is unfinished — saying
    // "Completed today" here would be a small lie.
    const onOpenDetail = jest.fn();
    const { getByTestId, queryByText } = await renderCard(
      makeDay({ status: 'completed', completedChapters: [{ bookId: 'GEN', chapter: 24 }] }),
      { progress: partialProgress(10), onOpenDetail },
    );

    expect(queryByText('Completed today')).toBeNull();
    await fireEvent.press(getByTestId('continue-reading'));
    expect(onOpenDetail).toHaveBeenCalledTimes(1);
  });

  it('says completed once the whole chapter is read', async () => {
    const { getByText } = await renderCard(
      makeDay({ status: 'completed', completedChapters: [{ bookId: 'GEN', chapter: 24 }] }),
      {
        progress: {
          reference: { bookId: 'GEN', chapter: 24 },
          verseCount: 67,
          read: [{ from: 1, to: 67 }],
          remaining: [],
          isComplete: true,
          isPartial: false,
        },
      },
    );
    expect(getByText('Completed today')).toBeTruthy();
  });

  it('pluralises multi-chapter days', async () => {
    const { getByText } = await renderCard(
      makeDay({
        scheduled: {
          kind: 'scheduled',
          chapters: [
            { bookId: 'GEN', chapter: 1 },
            { bookId: 'GEN', chapter: 2 },
          ],
        },
      }),
    );

    expect(getByText('Genesis 1–2')).toBeTruthy();
    expect(getByText('2 chapters')).toBeTruthy();
  });
});
