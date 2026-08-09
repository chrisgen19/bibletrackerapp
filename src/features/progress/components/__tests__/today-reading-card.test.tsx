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

function renderCard(day: DayReading, handlers: { onMarkRead?: () => void; onOpenDetail?: () => void } = {}) {
  return renderWithTheme(
    <TodayReadingCard
      day={day}
      onMarkRead={handlers.onMarkRead ?? jest.fn()}
      onOpenDetail={handlers.onOpenDetail ?? jest.fn()}
    />,
  );
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
