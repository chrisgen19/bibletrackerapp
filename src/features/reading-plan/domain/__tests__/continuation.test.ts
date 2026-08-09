import { buildContinuationDraft } from '../continuation';
import { createCompletionLookup } from '../schedule';
import { makeCompletions, makePlan } from './fixtures';

const NONE = createCompletionLookup([]);

const plan = makePlan({ startDate: '2026-07-20' });

describe('buildContinuationDraft', () => {
  it('continues from the chapter after the one logged', () => {
    const draft = buildContinuationDraft({
      loggedChapter: { bookId: 'JHN', chapter: 3 },
      loggedDate: '2026-08-09',
      today: '2026-08-09',
      plan,
      completions: NONE,
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
      completions: NONE,
    });
    expect(draft?.startDate).toBe('2026-08-10');
  });

  it('starts today when the logged day is in the past', () => {
    const draft = buildContinuationDraft({
      loggedChapter: { bookId: 'GEN', chapter: 1 },
      loggedDate: '2026-08-01',
      today: '2026-08-09',
      plan,
      completions: NONE,
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
      completions: NONE,
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
      completions: NONE,
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
      completions: NONE,
    });
    expect(draft).toBeNull();
  });

  it('carries the existing plan’s canon and pace forward', () => {
    const draft = buildContinuationDraft({
      loggedChapter: { bookId: 'GEN', chapter: 1 },
      loggedDate: '2026-08-09',
      today: '2026-08-09',
      plan: makePlan({ chaptersPerDay: 3, canonId: 'some-other-canon' }),
      completions: NONE,
    });
    expect(draft?.chaptersPerDay).toBe(3);
    expect(draft?.canonId).toBe('some-other-canon');
  });

  it('works with no existing plan', () => {
    const draft = buildContinuationDraft({
      loggedChapter: { bookId: 'PSA', chapter: 22 },
      loggedDate: '2026-08-09',
      today: '2026-08-09',
      plan: null,
      completions: NONE,
    });
    expect(draft).toEqual({
      canonId: 'protestant',
      startDate: '2026-08-10',
      startBookId: 'PSA',
      startChapter: 23,
      chaptersPerDay: 1,
    });
  });

  it('does not park the next chapter on a day already completed', () => {
    // Regression: the user marked today's reading, then backfilled an earlier day.
    // Starting the segment today would schedule John 4 onto a finished day, and
    // tomorrow would advance to John 5 — silently skipping John 4 entirely.
    const draft = buildContinuationDraft({
      loggedChapter: { bookId: 'JHN', chapter: 3 },
      loggedDate: '2026-08-05',
      today: '2026-08-09',
      plan,
      completions: createCompletionLookup(makeCompletions(['2026-08-09'])),
    });

    expect(draft?.startDate).toBe('2026-08-10');
    expect(draft?.startBookId).toBe('JHN');
    expect(draft?.startChapter).toBe(4);
  });

  it('skips a run of consecutive completed days', () => {
    const draft = buildContinuationDraft({
      loggedChapter: { bookId: 'JHN', chapter: 3 },
      loggedDate: '2026-08-05',
      today: '2026-08-09',
      plan,
      completions: createCompletionLookup(
        makeCompletions(['2026-08-09', '2026-08-10', '2026-08-11']),
      ),
    });
    expect(draft?.startDate).toBe('2026-08-12');
  });

  it('still starts today when today has not been read', () => {
    const draft = buildContinuationDraft({
      loggedChapter: { bookId: 'JHN', chapter: 3 },
      loggedDate: '2026-08-05',
      today: '2026-08-09',
      plan,
      completions: createCompletionLookup(makeCompletions(['2026-08-05'])),
    });
    expect(draft?.startDate).toBe('2026-08-09');
  });

  it('crosses a month boundary when logging on the last day of a month', () => {
    const draft = buildContinuationDraft({
      loggedChapter: { bookId: 'GEN', chapter: 1 },
      loggedDate: '2026-08-31',
      today: '2026-08-31',
      plan,
      completions: NONE,
    });
    expect(draft?.startDate).toBe('2026-09-01');
  });
});
