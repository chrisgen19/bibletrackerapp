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

describe('ChapterPicker', () => {
  it('sizes the grid to the selected book', async () => {
    const { getByLabelText, queryByLabelText } = await renderChapterPicker('REV');
    // Revelation has 22 chapters — not Genesis's 50.
    expect(getByLabelText('Chapter 22')).toBeTruthy();
    expect(queryByLabelText('Chapter 23')).toBeNull();
  });

  it('bounds a long book at its real chapter count', async () => {
    const { getByLabelText, queryByLabelText } = await renderChapterPicker('PSA');
    expect(getByLabelText('Chapter 1')).toBeTruthy();
    // Psalms stops at 150. Deeper rows are virtualised away, so the meaningful
    // assertion is the upper bound rather than a specific mounted cell.
    expect(queryByLabelText('Chapter 151')).toBeNull();
  });

  it('handles single-chapter books', async () => {
    const { getByLabelText, queryByLabelText } = await renderChapterPicker('JUD');
    expect(getByLabelText('Chapter 1')).toBeTruthy();
    expect(queryByLabelText('Chapter 2')).toBeNull();
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
