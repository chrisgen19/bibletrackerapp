import type { ChapterProgress } from '@/features/reading-plan/domain/chapter-progress';
import { fireEvent, renderWithTheme } from '@/test-utils/render';

import { UnfinishedCard } from '../unfinished-card';

function progress(bookId: string, chapter: number, readTo: number, verseCount: number): ChapterProgress {
  return {
    reference: { bookId, chapter },
    verseCount,
    read: [{ from: 1, to: readTo }],
    remaining: [{ from: readTo + 1, to: verseCount }],
    isComplete: false,
    isPartial: true,
  };
}

async function render(chapters: ChapterProgress[]) {
  const onOpen = jest.fn();
  const queries = await renderWithTheme(<UnfinishedCard chapters={chapters} onOpen={onOpen} />);
  return { onOpen, ...queries };
}

describe('UnfinishedCard', () => {
  it('renders nothing when everything is finished', async () => {
    // The wrapper providers are always present, so assert on the card's own content.
    const { queryByText } = await render([]);
    expect(queryByText(/STILL TO FINISH/)).toBeNull();
  });

  it('names the chapter and what is left of it', async () => {
    const { getByLabelText } = await render([progress('EXO', 14, 10, 31)]);
    // FieldRow announces itself as "<label>, <value>".
    expect(getByLabelText('Exodus 14, 11–31 left')).toBeTruthy();
  });

  it('uses a singular heading for one chapter', async () => {
    const { getByText } = await render([progress('EXO', 14, 10, 31)]);
    expect(getByText('STILL TO FINISH')).toBeTruthy();
  });

  it('counts the chapters in the heading when there are several', async () => {
    const { getByText } = await render([
      progress('GEN', 1, 5, 31),
      progress('EXO', 14, 10, 31),
    ]);
    expect(getByText('STILL TO FINISH · 2')).toBeTruthy();
  });

  it('opens the chapter that was tapped', async () => {
    const chapters = [progress('GEN', 1, 5, 31), progress('EXO', 14, 10, 31)];
    const { getByTestId, onOpen } = await render(chapters);

    await fireEvent.press(getByTestId('unfinished-EXO-14'));

    expect(onOpen).toHaveBeenCalledWith(chapters[1]);
  });

  it('collapses a long list behind a summary', async () => {
    const many = [
      progress('GEN', 1, 5, 31),
      progress('GEN', 2, 5, 25),
      progress('GEN', 3, 5, 24),
      progress('GEN', 4, 5, 26),
      progress('GEN', 5, 5, 32),
    ];
    const { queryByTestId, getByText } = await render(many);

    expect(queryByTestId('unfinished-GEN-3')).not.toBeNull();
    expect(queryByTestId('unfinished-GEN-4')).toBeNull();
    expect(getByText('and 2 more')).toBeTruthy();
  });
});
