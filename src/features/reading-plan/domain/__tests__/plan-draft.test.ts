import {
  buildReadingPlanDraft,
  clampChapter,
  getChapterCount,
  validateReadingPlanDraft,
} from '../plan-draft';

const TODAY = '2026-08-24';

describe('buildReadingPlanDraft', () => {
  it('starts the Genesis plan at Genesis 1 today', () => {
    expect(buildReadingPlanDraft({ mode: 'genesis', today: TODAY })).toEqual({
      canonId: 'protestant',
      startDate: TODAY,
      startBookId: 'GEN',
      startChapter: 1,
      chaptersPerDay: 1,
    });
  });

  it('ignores a supplied book when starting from Genesis', () => {
    const draft = buildReadingPlanDraft({ mode: 'genesis', bookId: 'REV', chapter: 22, today: TODAY });
    expect(draft.startBookId).toBe('GEN');
    expect(draft.startChapter).toBe(1);
  });

  it('makes the chosen chapter today’s reading by default', () => {
    const draft = buildReadingPlanDraft({
      mode: 'choose',
      bookId: 'PSA',
      chapter: 119,
      today: TODAY,
    });
    // The start-date disclosure stays closed, so the plan begins today.
    expect(draft.startDate).toBe(TODAY);
    expect(draft.startBookId).toBe('PSA');
    expect(draft.startChapter).toBe(119);
  });

  it('honours a back-dated start when the user opens the disclosure', () => {
    const draft = buildReadingPlanDraft({
      mode: 'choose',
      bookId: 'MAT',
      chapter: 5,
      startDate: '2026-08-01',
      today: TODAY,
    });
    expect(draft.startDate).toBe('2026-08-01');
    expect(draft.startBookId).toBe('MAT');
    expect(draft.startChapter).toBe(5);
  });

  it('honours a future start date', () => {
    const draft = buildReadingPlanDraft({
      mode: 'choose',
      bookId: 'MAT',
      chapter: 5,
      startDate: '2026-09-01',
      today: TODAY,
    });
    expect(draft.startDate).toBe('2026-09-01');
  });

  it('ignores a supplied start date when starting from Genesis', () => {
    const draft = buildReadingPlanDraft({
      mode: 'genesis',
      startDate: '2020-01-01',
      today: TODAY,
    });
    expect(draft.startDate).toBe(TODAY);
  });

  it('clamps a chapter beyond the end of the chosen book', () => {
    const draft = buildReadingPlanDraft({ mode: 'choose', bookId: 'JUD', chapter: 40, today: TODAY });
    expect(draft.startChapter).toBe(1);
  });

  it('keeps one chapter per day in V1', () => {
    expect(buildReadingPlanDraft({ mode: 'choose', today: TODAY }).chaptersPerDay).toBe(1);
  });
});

describe('validateReadingPlanDraft', () => {
  const base = {
    canonId: 'protestant',
    startDate: TODAY,
    startBookId: 'GEN',
    startChapter: 1,
    chaptersPerDay: 1,
  };

  it('accepts a valid draft', () => {
    expect(validateReadingPlanDraft(base)).toEqual({ ok: true, message: null });
  });

  it('rejects a chapter that does not exist in the book', () => {
    const result = validateReadingPlanDraft({ ...base, startBookId: 'GEN', startChapter: 51 });
    expect(result.ok).toBe(false);
    expect(result.message).toBe('That chapter does not exist in the selected book.');
  });

  it('rejects an unknown book', () => {
    expect(validateReadingPlanDraft({ ...base, startBookId: 'NOPE' }).ok).toBe(false);
  });

  it('rejects a malformed start date', () => {
    const result = validateReadingPlanDraft({ ...base, startDate: '24-08-2026' });
    expect(result.ok).toBe(false);
    expect(result.message).toBe('Start date must be a valid YYYY-MM-DD day.');
  });

  it('rejects a chapter below 1', () => {
    expect(validateReadingPlanDraft({ ...base, startChapter: 0 }).ok).toBe(false);
  });

  it('surfaces user-facing copy, never a raw validation dump', () => {
    const result = validateReadingPlanDraft({ ...base, startChapter: 999 });
    expect(result.message).not.toMatch(/zod|invalid_|ZodError/i);
  });
});

describe('chapter helpers', () => {
  it('reports the chapter count for a book', () => {
    expect(getChapterCount('PSA')).toBe(150);
    expect(getChapterCount('OBA')).toBe(1);
    expect(getChapterCount('UNKNOWN')).toBe(1);
  });

  it('clamps chapters into the valid range', () => {
    expect(clampChapter('GEN', 60)).toBe(50);
    expect(clampChapter('GEN', 0)).toBe(1);
    expect(clampChapter('GEN', 25)).toBe(25);
    expect(clampChapter('GEN', Number.NaN)).toBe(1);
  });
});
