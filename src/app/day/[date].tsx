import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import type { BibleReference } from '@/data/bible/canon';
import { DayDetail } from '@/features/progress/components/day-detail';
import { getDayReading } from '@/features/reading-plan/domain/schedule';
import type { DayReading, ReadingPlanDraft } from '@/features/reading-plan/domain/types';
import { useReadingData } from '@/features/reading-plan/hooks/reading-data-provider';
import { useTheme } from '@/theme/theme-provider';
import { isValidDateKey } from '@/utils/date-key';
import { completionHaptic, settingChangedHaptic, undoHaptic } from '@/utils/haptics';

export default function DayDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { date } = useLocalSearchParams<{ date: string }>();
  const { plans, completionLookup, today, completeReading, undoReading, changePlan } = useReadingData();

  const isValid = typeof date === 'string' && isValidDateKey(date);

  const day = useMemo<DayReading | null>(
    () => (isValid ? getDayReading(plans, date, completionLookup, today) : null),
    [isValid, date, plans, completionLookup, today],
  );

  const handleComplete = useCallback(
    (chapters: readonly BibleReference[]): boolean => {
      if (day === null) return false;
      const logged = completeReading(day.date, chapters);
      if (logged) completionHaptic();
      return logged;
    },
    [day, completeReading],
  );

  const handleUndo = useCallback(() => {
    if (day === null) return;
    undoReading(day.date);
    undoHaptic();
  }, [day, undoReading]);

  const handleChangePlan = useCallback(
    (draft: ReadingPlanDraft) => {
      changePlan(draft);
      settingChangedHaptic();
    },
    [changePlan],
  );

  const padding = {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xxl,
    paddingBottom: Math.max(insets.bottom, theme.spacing.xl) + theme.spacing.sm,
  };

  // Without any plan there is nothing to attach a completion to. Mirror the main
  // screen and send the user to onboarding rather than showing a sheet whose
  // actions cannot persist — reachable via a reminder that outlived a reset.
  if (plans.length === 0) {
    return <Redirect href="/onboarding" />;
  }

  if (day === null) {
    return (
      <View style={[{ backgroundColor: theme.colors.surface }, padding]}>
        <EmptyState
          icon="calendar"
          title="That day isn't available"
          description="We couldn't find a reading for that date."
          action={{ label: 'Close', onPress: () => router.back() }}
          compact
        />
      </View>
    );
  }

  return (
    <View style={[{ backgroundColor: theme.colors.surface }, padding]}>
      <DayDetail
        day={day}
        today={today}
        onComplete={handleComplete}
        onUndo={handleUndo}
        onChangePlan={handleChangePlan}
        completions={completionLookup}
      />
    </View>
  );
}
