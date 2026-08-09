import type { BibleBook } from '@/data/bible/canon';
import { fireEvent, renderWithTheme } from '@/test-utils/render';

import { BookPicker } from '../book-picker';
import { ChapterPicker } from '../chapter-picker';

async function renderBookPicker(selectedBookId = 'GEN') {
  const onSelect = jest.fn<void, [BibleBook]>();
  const onClose = jest.fn();
  const queries = await renderWithTheme(
    <BookPicker
      visible
      canonId="protestant"
      selectedBookId={selectedBookId}
      onSelect={onSelect}
      onClose={onClose}
    />,
  );
  return { onSelect, onClose, ...queries };
}

async function renderChapterPicker(bookId: string, selectedChapter = 1) {
  const onSelect = jest.fn<void, [number]>();
  const onClose = jest.fn();
  const queries = await renderWithTheme(
    <ChapterPicker
      visible
      canonId="protestant"
      bookId={bookId}
      selectedChapter={selectedChapter}
      onSelect={onSelect}
      onClose={onClose}
    />,
  );
  return { onSelect, onClose, ...queries };
}

describe('BookPicker', () => {
  it('lists books grouped by testament', async () => {
    const { getByText } = await renderBookPicker();
    expect(getByText('OLD TESTAMENT')).toBeTruthy();
    expect(getByText('Genesis')).toBeTruthy();
  });

  it('filters by name as you search', async () => {
    const { getByLabelText, queryByText, getByText } = await renderBookPicker();

    await fireEvent.changeText(getByLabelText('Search books'), 'rev');

    expect(getByText('Revelation')).toBeTruthy();
    expect(queryByText('Genesis')).toBeNull();
    // Section headers are suppressed while filtering.
    expect(queryByText('OLD TESTAMENT')).toBeNull();
  });

  it('matches on abbreviation too', async () => {
    const { getByLabelText, getByText } = await renderBookPicker();
    await fireEvent.changeText(getByLabelText('Search books'), '1 cor');
    expect(getByText('1 Corinthians')).toBeTruthy();
  });

  it('is case-insensitive and ignores surrounding spaces', async () => {
    const { getByLabelText, getByText } = await renderBookPicker();
    await fireEvent.changeText(getByLabelText('Search books'), '  PSALMS  ');
    expect(getByText('Psalms')).toBeTruthy();
  });

  it('explains when nothing matches', async () => {
    const { getByLabelText, getByText } = await renderBookPicker();
    await fireEvent.changeText(getByLabelText('Search books'), 'zzzz');
    expect(getByText(/No books match/)).toBeTruthy();
  });

  it('reports the chosen book and closes', async () => {
    const { getByLabelText, onSelect, onClose } = await renderBookPicker();

    // Search first, as a user would: Revelation is the 66th row and the list is
    // virtualised, so it is not mounted until filtering brings it into view.
    await fireEvent.changeText(getByLabelText('Search books'), 'revelation');
    await fireEvent.press(getByLabelText('Revelation, 22 chapters'));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'REV', chapterCount: 22 }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

/**
 * The grid virtualises at 50 cells. An "is chapter N+1 absent?" assertion is only
 * meaningful for books shorter than that window — beyond it the cell is unmounted
 * whatever the underlying count, so the assertion cannot fail. These cases
 * therefore assert the *exact* number of cells rendered, which pins the grid to
 * the canon rather than merely to the viewport.
 *
 * Chapter counts themselves (Psalms 150, Genesis 50, ...) are covered by the canon
 * unit tests; what matters here is that the picker uses them.
 */
const SHORT_BOOKS = [
  { bookId: 'JUD', name: 'Jude', chapters: 1 },
  { bookId: '2JN', name: '2 John', chapters: 1 },
  { bookId: 'JON', name: 'Jonah', chapters: 4 },
  { bookId: '1CO', name: '1 Corinthians', chapters: 16 },
  { bookId: 'REV', name: 'Revelation', chapters: 22 },
] as const;

describe('ChapterPicker', () => {
  it.each(SHORT_BOOKS)('renders exactly $chapters chapters for $name', async ({ bookId, chapters }) => {
    const { getAllByLabelText, getByLabelText, queryByLabelText } = await renderChapterPicker(bookId);

    expect(getAllByLabelText(/^Chapter \d+$/)).toHaveLength(chapters);
    expect(getByLabelText(`Chapter ${chapters}`)).toBeTruthy();
    expect(queryByLabelText(`Chapter ${chapters + 1}`)).toBeNull();
  });

  it('grows the grid for a longer book', async () => {
    // Psalms exceeds the virtualisation window, so the count cannot be pinned here.
    // What is checkable is that it renders strictly more than a short book does.
    const psalms = await renderChapterPicker('PSA');
    const revelation = await renderChapterPicker('REV');

    expect(psalms.getAllByLabelText(/^Chapter \d+$/).length).toBeGreaterThan(
      revelation.getAllByLabelText(/^Chapter \d+$/).length,
    );
  });

  it('reports the chosen chapter and closes', async () => {
    const { getByLabelText, onSelect, onClose } = await renderChapterPicker('REV');

    await fireEvent.press(getByLabelText('Chapter 22'));

    expect(onSelect).toHaveBeenCalledWith(22);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('names the book it is picking for', async () => {
    const { getByText } = await renderChapterPicker('REV');
    expect(getByText('Revelation')).toBeTruthy();
  });
});
