import type { BacklogEntry } from '@/features/reading-plan/domain/backlog';
import { fireEvent, renderWithTheme } from '@/test-utils/render';

import { BacklogCard } from '../backlog-card';

function unfinished(bookId: string, chapter: number, readTo: number, verseCount: number): BacklogEntry {
  return {
    kind: 'unfinished',
    reference: { bookId, chapter },
    progress: {
      reference: { bookId, chapter },
      verseCount,
      read: [{ from: 1, to: readTo }],
      remaining: [{ from: readTo + 1, to: verseCount }],
      isComplete: false,
      isPartial: true,
    },
  };
}

function skipped(bookId: string, chapter: number): BacklogEntry {
  return { kind: 'skipped', reference: { bookId, chapter } };
}

async function render(entries: BacklogEntry[]) {
  const onOpen = jest.fn();
  const queries = await renderWithTheme(<BacklogCard entries={entries} onOpen={onOpen} />);
  return { onOpen, ...queries };
}

describe('BacklogCard', () => {
  it('renders nothing when nothing is owed', async () => {
    // The wrapper providers are always present, so assert on the card's own content.
    const { queryByText } = await render([]);
    expect(queryByText(/STILL TO READ/)).toBeNull();
  });

  it('names a part-read chapter and what is left of it', async () => {
    const { getByLabelText } = await render([unfinished('EXO', 14, 10, 31)]);
    // FieldRow announces itself as "<label>, <value>".
    expect(getByLabelText('Exodus 14, 11–31 left')).toBeTruthy();
  });

  it('marks a skipped chapter as simply not read', async () => {
    // No verse detail: nothing was read, and "missed" would read as a reprimand.
    const { getByLabelText } = await render([skipped('LEV', 1)]);
    expect(getByLabelText('Leviticus 1, not read')).toBeTruthy();
  });

  it('uses a singular heading for one chapter', async () => {
    const { getByText } = await render([unfinished('EXO', 14, 10, 31)]);
    expect(getByText('STILL TO READ')).toBeTruthy();
  });

  it('counts both kinds together in the heading', async () => {
    const { getByText } = await render([skipped('EXO', 39), unfinished('EXO', 14, 10, 31)]);
    expect(getByText('STILL TO READ · 2')).toBeTruthy();
  });

  it('opens the entry that was tapped', async () => {
    const entries = [unfinished('GEN', 1, 5, 31), skipped('EXO', 39)];
    const { getByTestId, onOpen } = await render(entries);

    await fireEvent.press(getByTestId('backlog-EXO-39'));

    expect(onOpen).toHaveBeenCalledWith(entries[1]);
  });

  it('collapses a long list behind a summary', async () => {
    const many = [
      skipped('GEN', 1),
      skipped('GEN', 2),
      skipped('GEN', 3),
      skipped('GEN', 4),
      unfinished('GEN', 5, 5, 32),
    ];
    const { queryByTestId, getByText } = await render(many);

    expect(queryByTestId('backlog-GEN-3')).not.toBeNull();
    expect(queryByTestId('backlog-GEN-4')).toBeNull();
    expect(getByText('and 2 more')).toBeTruthy();
  });
});
