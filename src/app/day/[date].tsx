import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { formatReferenceSpan } from '@/features/reading-plan/domain/reference';
import { getDayReading } from '@/features/reading-plan/domain/schedule';
import type { DayReading } from '@/features/reading-plan/domain/types';
import { useReadingData } from '@/features/reading-plan/hooks/reading-data-provider';
import { useTheme } from '@/theme/theme-provider';
import { compareDateKeys, fromDateKey, isValidDateKey } from '@/utils/date-key';
import { completionHaptic, undoHaptic } from '@/utils/haptics';

export default function DayDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { date } = useLocalSearchParams<{ date: string }>();
  const { plans, completionLookup, today, completeReading, undoReading } = useReadingData();

  const isValid = typeof date === 'string' && isValidDateKey(date);

  const day = useMemo<DayReading | null>(
    () => (isValid ? getDayReading(plans, date, completionLookup, today) : null),
    [isValid, date, plans, completionLookup, today],
  );

  const handleComplete = useCallback(() => {
    if (day === null || day.scheduled.kind !== 'scheduled') return;
    completeReading(day.date, day.scheduled.chapters);
    completionHaptic();
  }, [day, completeReading]);

  const handleUndo = useCallback(() => {
    if (day === null) return;
    undoReading(day.date);
    undoHaptic();
  }, [day, undoReading]);

  const padding = {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xxl,
    paddingBottom: Math.max(insets.bottom, theme.spacing.xl) + theme.spacing.sm,
  };

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
      <DayHeader day={day} isToday={day.date === today} />
      <DayBody day={day} today={today} onComplete={handleComplete} onUndo={handleUndo} />
    </View>
  );
}

function DayHeader({ day, isToday }: { day: DayReading; isToday: boolean }) {
  const theme = useTheme();
  const parsed = fromDateKey(day.date);

  return (
    <View>
      <Text variant="overline" color="tertiary">
        {isToday ? 'TODAY' : format(parsed, 'EEEE').toUpperCase()}
      </Text>
      <Text variant="title" style={{ marginTop: theme.spacing.xs }} accessibilityRole="header">
        {format(parsed, 'd MMMM yyyy')}
      </Text>
    </View>
  );
}

interface DayBodyProps {
  day: DayReading;
  today: string;
  onComplete: () => void;
  onUndo: () => void;
}

function DayBody({ day, today, onComplete, onUndo }: DayBodyProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();

  if (day.scheduled.kind === 'before-plan') {
    return (
      <View style={{ marginTop: theme.spacing.xl }}>
        <Text variant="body" color="secondary">
          Your reading plan hadn&apos;t started yet on this day.
        </Text>
      </View>
    );
  }

  if (day.scheduled.kind === 'canon-complete') {
    return (
      <View style={{ marginTop: theme.spacing.xl }}>
        <Text variant="body" color="secondary">
          You had already finished the entire Bible by this day. Nothing was scheduled.
        </Text>
      </View>
    );
  }

  const isCompleted = day.status === 'completed';
  const isFuture = compareDateKeys(day.date, today) > 0;
  // A completed day shows exactly what was recorded, which can differ from the
  // current schedule if the plan changed afterwards.
  const chapters = isCompleted && day.completedChapters.length > 0
    ? day.completedChapters
    : day.scheduled.chapters;

  return (
    <View>
      <View
        style={{
          marginTop: theme.spacing.xl,
          backgroundColor: theme.colors.surfaceSubtle,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.lg,
        }}
      >
        <Text variant="overline" color="tertiary">
          {isFuture ? 'SCHEDULED' : 'READING'}
        </Text>
        <Text variant="title" style={{ marginTop: theme.spacing.xs }}>
          {formatReferenceSpan(chapters)}
        </Text>
      </View>

      <View style={{ marginTop: theme.spacing.xl }}>
        {isCompleted ? (
          <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(theme.duration.base)}>
            <View style={styles.completedRow}>
              <Icon name="checkmark" size={15} color={theme.colors.accent} />
              <Text variant="headline" color="accent" style={{ marginLeft: theme.spacing.sm }}>
                Completed
              </Text>
            </View>
            <Button
              label="Undo Completion"
              variant="secondary"
              onPress={onUndo}
              accessibilityHint="Removes this day's reading from your progress"
              style={{ marginTop: theme.spacing.lg }}
              testID="undo-completion"
            />
          </Animated.View>
        ) : isFuture ? (
          <View
            style={[
              styles.noticeRow,
              { backgroundColor: theme.colors.surfaceSubtle, borderRadius: theme.radius.md },
            ]}
          >
            <Text variant="callout" color="secondary" align="center">
              You can mark this reading once the day arrives.
            </Text>
          </View>
        ) : (
          <Button
            label="Mark as Read"
            onPress={onComplete}
            accessibilityHint={`Marks ${formatReferenceSpan(chapters)} as read`}
            testID="mark-day-read"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  completedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  noticeRow: { paddingVertical: 16, paddingHorizontal: 16 },
});
