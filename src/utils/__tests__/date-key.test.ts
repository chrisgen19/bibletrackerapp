import {
  addDaysToDateKey,
  compareDateKeys,
  daysBetweenDateKeys,
  eachDateKeyInRange,
  fromDateKey,
  isDateKeyWithin,
  isValidDateKey,
  maxDateKey,
  minDateKey,
  toDateKey,
} from '../date-key';

describe('toDateKey', () => {
  it('uses the local calendar day, not UTC', () => {
    // 11:50 PM local on 24 August must belong to 24 August.
    const lateNight = new Date(2026, 7, 24, 23, 50, 0);
    expect(toDateKey(lateNight)).toBe('2026-08-24');
  });

  it('keeps the first minute of a day on that day', () => {
    expect(toDateKey(new Date(2026, 7, 24, 0, 0, 0))).toBe('2026-08-24');
  });

  it('pads single-digit months and days', () => {
    expect(toDateKey(new Date(2026, 0, 5, 9, 0, 0))).toBe('2026-01-05');
  });
});

describe('fromDateKey', () => {
  it('anchors at local noon so DST cannot shift the day', () => {
    const date = fromDateKey('2026-08-24');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(7);
    expect(date.getDate()).toBe(24);
    expect(date.getHours()).toBe(12);
  });

  it('round-trips through toDateKey', () => {
    expect(toDateKey(fromDateKey('2026-02-28'))).toBe('2026-02-28');
  });
});

describe('isValidDateKey', () => {
  it('accepts well-formed days', () => {
    expect(isValidDateKey('2026-08-24')).toBe(true);
    expect(isValidDateKey('2028-02-29')).toBe(true);
  });

  it('rejects malformed or impossible days', () => {
    expect(isValidDateKey('2026-8-24')).toBe(false);
    expect(isValidDateKey('24-08-2026')).toBe(false);
    expect(isValidDateKey('2026-13-01')).toBe(false);
    expect(isValidDateKey('2027-02-29')).toBe(false);
    expect(isValidDateKey('')).toBe(false);
    expect(isValidDateKey('not-a-date')).toBe(false);
  });
});

describe('day arithmetic', () => {
  it('adds and subtracts days across month boundaries', () => {
    expect(addDaysToDateKey('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDaysToDateKey('2026-09-01', -1)).toBe('2026-08-31');
  });

  it('adds days across year boundaries', () => {
    expect(addDaysToDateKey('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('handles leap days', () => {
    expect(addDaysToDateKey('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysToDateKey('2028-02-29', 1)).toBe('2028-03-01');
    expect(addDaysToDateKey('2027-02-28', 1)).toBe('2027-03-01');
  });

  it('measures whole calendar days between keys', () => {
    expect(daysBetweenDateKeys('2026-08-01', '2026-08-24')).toBe(23);
    expect(daysBetweenDateKeys('2026-08-24', '2026-08-01')).toBe(-23);
    expect(daysBetweenDateKeys('2026-08-24', '2026-08-24')).toBe(0);
    expect(daysBetweenDateKeys('2028-02-28', '2028-03-01')).toBe(2);
    expect(daysBetweenDateKeys('2027-02-28', '2027-03-01')).toBe(1);
  });

  it('counts a full non-leap year as 365 days', () => {
    expect(daysBetweenDateKeys('2026-01-01', '2027-01-01')).toBe(365);
  });

  it('counts a leap year as 366 days', () => {
    expect(daysBetweenDateKeys('2028-01-01', '2029-01-01')).toBe(366);
  });
});

describe('eachDateKeyInRange', () => {
  it('is inclusive of both ends', () => {
    expect(eachDateKeyInRange('2026-08-01', '2026-08-03')).toEqual([
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
    ]);
  });

  it('returns a single day when start equals end', () => {
    expect(eachDateKeyInRange('2026-08-01', '2026-08-01')).toEqual(['2026-08-01']);
  });

  it('returns nothing when the range is inverted', () => {
    expect(eachDateKeyInRange('2026-08-03', '2026-08-01')).toEqual([]);
  });

  it('spans a leap day', () => {
    expect(eachDateKeyInRange('2028-02-27', '2028-03-01')).toEqual([
      '2028-02-27',
      '2028-02-28',
      '2028-02-29',
      '2028-03-01',
    ]);
  });
});

describe('comparison helpers', () => {
  it('orders keys chronologically', () => {
    expect(compareDateKeys('2026-08-01', '2026-08-02')).toBeLessThan(0);
    expect(compareDateKeys('2026-09-01', '2026-08-31')).toBeGreaterThan(0);
    expect(compareDateKeys('2026-08-01', '2026-08-01')).toBe(0);
  });

  it('picks minimum and maximum', () => {
    expect(minDateKey('2026-08-01', '2026-08-24')).toBe('2026-08-01');
    expect(maxDateKey('2026-08-01', '2026-08-24')).toBe('2026-08-24');
  });

  it('tests inclusion in an open-ended range', () => {
    expect(isDateKeyWithin('2026-08-10', '2026-08-01', '2026-08-31')).toBe(true);
    expect(isDateKeyWithin('2026-08-01', '2026-08-01', '2026-08-31')).toBe(true);
    expect(isDateKeyWithin('2026-08-31', '2026-08-01', '2026-08-31')).toBe(true);
    expect(isDateKeyWithin('2026-09-01', '2026-08-01', '2026-08-31')).toBe(false);
    expect(isDateKeyWithin('2030-01-01', '2026-08-01', null)).toBe(true);
    expect(isDateKeyWithin('2026-07-31', '2026-08-01', null)).toBe(false);
  });
});
