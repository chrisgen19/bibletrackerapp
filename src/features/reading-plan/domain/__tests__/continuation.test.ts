import { buildContinuationDraft } from '../continuation';
import { makePlan } from './fixtures';

const plan = makePlan({ startDate: '2026-07-20' });

describe('buildContinuationDraft', () => {
  it('continues from the chapter after the one logged', () => {
    const draft = buildContinuationDraft({
      loggedChapter: { bookId: 'JHN', chapter: 3 },
      loggedDate: '2026-08-09',
      today: '2026-08-09',
      plan,
    });

    expect(draft).toEqual({
      canonId: 'protestant',
      startDate: '2026-08-10',
      startBookId: 'JHN',
      startChapter: 4,
      chaptersPerDay: 1,
    });
  });

  it('starts tomorrow when the logged day is today, leaving today untouched', () => {
    const draft = buildContinuationDraft({
      loggedChapter: { bookId: 'GEN', chapter: 1 },
      loggedDate: '2026-08-09',
      today: '2026-08-09',
      plan,
    });
    expect(draft?.startDate).toBe('2026-08-10');
  });

  it('starts today when the logged day is in the past', () => {
    const draft = buildContinuationDraft({
      loggedChapter: { bookId: 'GEN', chapter: 1 },
      loggedDate: '2026-08-01',
      today: '2026-08-09',
      plan,
    });
    // Days between the logged date and today already happened; the plan resumes now.
    expect(draft?.startDate).toBe('2026-08-09');
  });

  it('crosses a book boundary', () => {
    const draft = buildContinuationDraft({
      loggedChapter: { bookId: 'GEN', chapter: 50 },
      loggedDate: '2026-08-09',
      today: '2026-08-09',
      plan,
    });
    expect(draft?.startBookId).toBe('EXO');
    expect(draft?.startChapter).toBe(1);
  });

  it('crosses the testament boundary', () => {
    const draft = buildContinuationDraft({
      loggedChapter: { bookId: 'MAL', chapter: 4 },
      loggedDate: '2026-08-09',
      today: '2026-08-09',
      plan,
    });
    expect(draft?.startBookId).toBe('MAT');
    expect(draft?.startChapter).toBe(1);
  });

  it('returns null when the final chapter of the canon was logged', () => {
    const draft = buildContinuationDraft({
      loggedChapter: { bookId: 'REV', chapter: 22 },
      loggedDate: '2026-08-09',
      today: '2026-08-09',
      plan,
    });
    expect(draft).toBeNull();
  });

  it('carries the existing plan’s canon and pace forward', () => {
    const draft = buildContinuationDraft({
      loggedChapter: { bookId: 'GEN', chapter: 1 },
      loggedDate: '2026-08-09',
      today: '2026-08-09',
      plan: makePlan({ chaptersPerDay: 3 }),
    });
    expect(draft?.chaptersPerDay).toBe(3);
    expect(draft?.canonId).toBe('protestant');
  });

  it('works with no existing plan', () => {
    const draft = buildContinuationDraft({
      loggedChapter: { bookId: 'PSA', chapter: 22 },
      loggedDate: '2026-08-09',
      today: '2026-08-09',
      plan: null,
    });
    expect(draft).toEqual({
      canonId: 'protestant',
      startDate: '2026-08-10',
      startBookId: 'PSA',
      startChapter: 23,
      chaptersPerDay: 1,
    });
  });

  it('crosses a month boundary when logging on the last day of a month', () => {
    const draft = buildContinuationDraft({
      loggedChapter: { bookId: 'GEN', chapter: 1 },
      loggedDate: '2026-08-31',
      today: '2026-08-31',
      plan,
    });
    expect(draft?.startDate).toBe('2026-09-01');
  });
});
