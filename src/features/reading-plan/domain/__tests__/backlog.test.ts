import { PROTESTANT_CANON_INDEX } from '@/data/bible/canon-index';

import { getBacklog, getSkippedChapters } from '../backlog';
import type { ReadingCompletion } from '../types';
import { makeCompletion, makePlan } from './fixtures';

const INDEX = PROTESTANT_CANON_INDEX;
const label = (r: { bookId: string; chapter: number }) => `${r.bookId} ${r.chapter}`;

/** The two segments actually on the device, after "Continue from here" was accepted. */
const CONTINUED = [
  makePlan({ id: 'seg1', startDate: '2026-08-09', endDate: '2026-08-22', isActive: false,
    startBookId: 'EXO', startChapter: 29 }),
  makePlan({ id: 'seg2', startDate: '2026-08-23', endDate: null, isActive: true,
    startBookId: 'EXO', startChapter: 39 }),
];
/** The same history had the prompt been declined: one segment, still marching on. */
const DECLINED = [
  makePlan({ id: 'seg1', startDate: '2026-08-09', endDate: null, isActive: true,
    startBookId: 'EXO', startChapter: 29 }),
];

function readThrough(): ReadingCompletion[] {
  const rows: ReadingCompletion[] = [];
  for (let c = 29; c <= 35; c += 1) {
    rows.push(makeCompletion(`2026-08-${String(c - 20).padStart(2, '0')}`, { bookId: 'EXO', chapter: c }));
  }
  rows.push(makeCompletion('2026-08-16', { bookId: 'EXO', chapter: 36 }));
  rows.push(makeCompletion('2026-08-17', { bookId: 'EXO', chapter: 37 }));
  rows.push(makeCompletion('2026-08-19', { bookId: 'EXO', chapter: 38 }));
  return rows;
}

describe('getSkippedChapters', () => {
  it('reports nothing when the plan was moved back to where the reader is', () => {
    // Exodus 39/40 and Leviticus 1/2 were scheduled on missed days, but the new
    // segment schedules them again from the 23rd. Nothing is lost.
    expect(getSkippedChapters(CONTINUED, readThrough(), '2026-08-23', INDEX)).toEqual([]);
  });

  it('reports the chapters the plan walked past when it was not moved', () => {
    const skipped = getSkippedChapters(DECLINED, readThrough(), '2026-08-23', INDEX);
    expect(skipped.map(label)).toEqual(['EXO 39', 'EXO 40', 'LEV 1', 'LEV 2']);
  });

  it('never reports today or a future day', () => {
    // Today is Leviticus 3 under the untouched plan; tomorrow is Leviticus 4.
    const skipped = getSkippedChapters(DECLINED, readThrough(), '2026-08-23', INDEX);
    expect(skipped.map(label)).not.toContain('LEV 3');
    expect(skipped.map(label)).not.toContain('LEV 4');
  });

  it('leaves a part-read chapter to the unfinished list', () => {
    const rows = [
      ...readThrough(),
      makeCompletion('2026-08-20', { bookId: 'EXO', chapter: 39, verses: { from: 1, to: 10 } }),
    ];
    const skipped = getSkippedChapters(DECLINED, rows, '2026-08-23', INDEX);
    expect(skipped.map(label)).toEqual(['EXO 40', 'LEV 1', 'LEV 2']);
  });

  it('reports nothing before the plan has started', () => {
    expect(getSkippedChapters(DECLINED, [], '2026-08-09', INDEX)).toEqual([]);
    expect(getSkippedChapters(DECLINED, [], '2026-08-01', INDEX)).toEqual([]);
  });

  it('reports nothing when there is no plan at all', () => {
    expect(getSkippedChapters([], [], '2026-08-23', INDEX)).toEqual([]);
  });

  it('counts only days a segment actually covered, not the gap between them', () => {
    // Genesis 1-10 scheduled, then the position jumps to Matthew. The hundreds of
    // chapters in between were never scheduled and must not be reported.
    const plans = [
      makePlan({ id: 'a', startDate: '2026-01-01', endDate: '2026-01-10', isActive: false,
        startBookId: 'GEN', startChapter: 1 }),
      makePlan({ id: 'b', startDate: '2026-01-11', endDate: null, isActive: true,
        startBookId: 'MAT', startChapter: 1 }),
    ];
    const skipped = getSkippedChapters(plans, [], '2026-01-15', INDEX);
    expect(skipped.map(label)).toEqual([
      'GEN 1', 'GEN 2', 'GEN 3', 'GEN 4', 'GEN 5', 'GEN 6', 'GEN 7', 'GEN 8', 'GEN 9', 'GEN 10',
      'MAT 1', 'MAT 2', 'MAT 3', 'MAT 4',
    ]);
  });

  it("adds today's chapter to the backlog once the day has passed", () => {
    // The mechanism is self-correcting: today is excluded because the plan is still
    // on it, and it joins the backlog tomorrow if it went unread.
    const today = getSkippedChapters(DECLINED, readThrough(), '2026-08-23', INDEX);
    expect(today.map(label)).not.toContain('LEV 3');

    const tomorrow = getSkippedChapters(DECLINED, readThrough(), '2026-08-24', INDEX);
    expect(tomorrow.map(label)).toContain('LEV 3');
  });

  it('handles a multi-chapter plan', () => {
    const plans = [makePlan({ startDate: '2026-08-01', chaptersPerDay: 3, startBookId: 'GEN', startChapter: 1 })];
    // Day 1 is Genesis 1-3, day 2 is 4-6; today (day 3) is 7-9 and is excluded.
    expect(getSkippedChapters(plans, [], '2026-08-03', INDEX).map(label)).toEqual([
      'GEN 1', 'GEN 2', 'GEN 3', 'GEN 4', 'GEN 5', 'GEN 6',
    ]);
  });
});

describe('getBacklog', () => {
  it('merges part-read and skipped chapters into one canon-ordered list', () => {
    const rows = [
      ...readThrough(),
      makeCompletion('2026-08-20', { bookId: 'LEV', chapter: 1, verses: { from: 1, to: 5 } }),
    ];
    const backlog = getBacklog(DECLINED, rows, '2026-08-23', INDEX);
    expect(backlog.map((e) => `${e.kind}:${label(e.reference)}`)).toEqual([
      'skipped:EXO 39',
      'skipped:EXO 40',
      'unfinished:LEV 1',
      'skipped:LEV 2',
    ]);
  });

  it('is empty when everything scheduled has been read', () => {
    expect(getBacklog(CONTINUED, readThrough(), '2026-08-23', INDEX)).toEqual([]);
  });
});
