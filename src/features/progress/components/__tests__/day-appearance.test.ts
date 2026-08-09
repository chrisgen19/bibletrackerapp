import type { DayReading } from '@/features/reading-plan/domain/types';
import { lightTheme } from '@/theme/tokens';

import { describeDay, getDayAppearance } from '../day-appearance';

const OPTIONS = { isToday: false, inCurrentMonth: true };

describe('getDayAppearance', () => {
  it('fills completed days with the accent colour', () => {
    const appearance = getDayAppearance('completed', lightTheme, OPTIONS);
    expect(appearance.fill).toBe(lightTheme.colors.accent);
    expect(appearance.textColor).toBe(lightTheme.colors.onAccent);
  });

  it('outlines today when it is still pending', () => {
    const appearance = getDayAppearance('today-pending', lightTheme, { ...OPTIONS, isToday: true });
    expect(appearance.ringWidth).toBeGreaterThan(0);
    expect(appearance.ring).toBe(lightTheme.colors.accent);
    expect(appearance.fill).toBe('transparent');
  });

  it('still marks today when it has been completed', () => {
    const appearance = getDayAppearance('completed', lightTheme, { ...OPTIONS, isToday: true });
    expect(appearance.fill).toBe(lightTheme.colors.accent);
    expect(appearance.ringWidth).toBeGreaterThan(0);
  });

  it('treats missed days neutrally, never with the danger colour', () => {
    const appearance = getDayAppearance('missed', lightTheme, OPTIONS);
    expect(appearance.fill).toBe(lightTheme.colors.surfaceSubtle);
    expect(appearance.fill).not.toBe(lightTheme.colors.danger);
    expect(appearance.textColor).not.toBe(lightTheme.colors.danger);
    expect(appearance.ringWidth).toBe(0);
  });

  it('never uses the danger colour for any calendar state', () => {
    const statuses = [
      'completed',
      'today-pending',
      'missed',
      'upcoming',
      'before-plan',
      'canon-complete',
      'no-plan',
    ] as const;

    for (const status of statuses) {
      const appearance = getDayAppearance(status, lightTheme, OPTIONS);
      expect(appearance.fill).not.toBe(lightTheme.colors.danger);
      expect(appearance.textColor).not.toBe(lightTheme.colors.danger);
      expect(appearance.ring).not.toBe(lightTheme.colors.danger);
    }
  });

  it('lowers contrast for future and out-of-month days', () => {
    const upcoming = getDayAppearance('upcoming', lightTheme, OPTIONS);
    expect(upcoming.textColor).toBe(lightTheme.colors.textTertiary);

    const outside = getDayAppearance('upcoming', lightTheme, { ...OPTIONS, inCurrentMonth: false });
    expect(outside.opacity).toBeLessThan(upcoming.opacity);
  });
});

describe('describeDay', () => {
  const day: DayReading = {
    date: '2026-08-24',
    status: 'completed',
    scheduled: { kind: 'scheduled', chapters: [{ bookId: 'GEN', chapter: 24 }] },
    completedChapters: [{ bookId: 'GEN', chapter: 24 }],
    plan: null,
  };

  it('reads a full sentence for screen readers', () => {
    expect(describeDay(day, false)).toBe('Monday 24 August, Genesis 24, completed');
  });

  it('announces today explicitly', () => {
    expect(describeDay(day, true)).toBe('Today, Monday 24 August, Genesis 24, completed');
  });

  it('omits a reference when nothing is scheduled', () => {
    expect(describeDay({ ...day, status: 'before-plan', scheduled: { kind: 'before-plan' } }, false)).toBe(
      'Monday 24 August, before your plan began',
    );
  });
});
