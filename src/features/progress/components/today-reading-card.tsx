import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import type { ChapterProgress } from '@/features/reading-plan/domain/chapter-progress';
import { distinctReferences, formatReferenceSpan } from '@/features/reading-plan/domain/reference';
import type { DayReading } from '@/features/reading-plan/domain/types';
import { formatVerseRanges } from '@/features/reading-plan/domain/verse-range';
import { useTheme } from '@/theme/theme-provider';

interface TodayReadingCardProps {
  day: DayReading;
  onMarkRead: () => void;
  /** Opens the day detail sheet, where undo and the verse control live. */
  onOpenDetail: () => void;
  /** Progress on today's chapter, when a single chapter is scheduled. */
  progress?: ChapterProgress | null;
}

/**
 * The answer to "what should I read today?".
 *
 * Completing swaps the primary action for a quiet confirmation rather than an undo
 * button — undo stays one tap away in the day detail sheet, so the finished state
 * reads as an accomplishment, not a prompt to reverse it.
 */
export function TodayReadingCard({
  day,
  onMarkRead,
  onOpenDetail,
  progress = null,
}: TodayReadingCardProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const isCompleted = day.status === 'completed';

  const completion = useSharedValue(isCompleted ? 1 : 0);

  useEffect(() => {
    const target = isCompleted ? 1 : 0;
    completion.value = reducedMotion
      ? target
      : isCompleted
        ? withSpring(1, theme.springs.gentle)
        : withTiming(0, { duration: theme.duration.fast });
  }, [isCompleted, completion, reducedMotion, theme.springs.gentle, theme.duration.fast]);

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.8 + completion.value * 0.2 }],
    opacity: completion.value,
  }));

  if (day.scheduled.kind !== 'scheduled') {
    return (
      <Card variant="raised">
        <Text variant="overline" color="tertiary">
          TODAY&apos;S READING
        </Text>
        <Text variant="headline" style={{ marginTop: theme.spacing.sm }}>
          {day.scheduled.kind === 'canon-complete'
            ? 'You have finished the Bible'
            : day.scheduled.kind === 'not-scheduled'
              ? 'Nothing scheduled'
              : 'Your plan starts soon'}
        </Text>
        <Text variant="callout" color="secondary" style={{ marginTop: theme.spacing.xs }}>
          {day.scheduled.kind === 'canon-complete'
            ? 'Every chapter from Genesis to Revelation is behind you. Start a new plan whenever you are ready.'
            : day.scheduled.kind === 'not-scheduled'
              ? 'Use the Custom tab to record whatever you read.'
              : 'Your first reading will appear on the day your plan begins.'}
        </Text>
      </Card>
    );
  }

  // A completed day shows what was actually recorded, which differs from the
  // schedule after a custom log. The day sheet applies the same rule, and the two
  // surfaces must not disagree about the same day.
  // Duplicates collapse: two spans of one chapter are one chapter, not "Genesis 24–24".
  const chapters = distinctReferences(
    isCompleted && day.completedChapters.length > 0 ? day.completedChapters : day.scheduled.chapters,
  );
  const reference = formatReferenceSpan(chapters);
  const chapterCount = chapters.length;

  // A part-read chapter is a third state: the day is done, the chapter is not.
  const isPartial = progress?.isPartial === true;
  const subtitle = isPartial
    ? `${formatVerseRanges(progress?.remaining ?? [])} still to read`
    : chapterCount === 1
      ? 'One chapter'
      : `${chapterCount} chapters`;

  return (
    <Card variant="raised">
      <View style={styles.headerRow}>
        <Text variant="overline" color="tertiary">
          TODAY&apos;S READING
        </Text>
        {isCompleted ? (
          <Animated.View
            style={[
              styles.badge,
              { backgroundColor: theme.colors.accentSoft, borderRadius: theme.radius.full },
              badgeStyle,
            ]}
          >
            <Icon name="checkmark" size={12} color={theme.colors.accent} />
          </Animated.View>
        ) : null}
      </View>

      <Text
        variant="display"
        style={{ marginTop: theme.spacing.sm }}
        maxFontSizeMultiplier={1.6}
        accessibilityRole="header"
      >
        {reference}
      </Text>
      <Text variant="callout" color="secondary" style={{ marginTop: theme.spacing.xxs }}>
        {subtitle}
      </Text>

      <View style={{ marginTop: theme.spacing.xl }}>
        {isPartial ? (
          <Button
            label="Continue Reading"
            onPress={onOpenDetail}
            accessibilityHint={`Opens ${reference} to record how much more you read`}
            testID="continue-reading"
          />
        ) : isCompleted ? (
          <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(theme.duration.base)}>
            <View
              style={[
                styles.completedRow,
                {
                  backgroundColor: theme.colors.accentSoft,
                  borderRadius: theme.radius.lg,
                  paddingVertical: theme.spacing.md,
                },
              ]}
            >
              <Icon name="checkmark" size={15} color={theme.colors.accent} />
              <Text variant="headline" color="accent" style={{ marginLeft: theme.spacing.sm }}>
                Completed today
              </Text>
            </View>
            <Pressable
              onPress={onOpenDetail}
              accessibilityRole="button"
              accessibilityLabel="View today's reading details"
              accessibilityHint="Opens the day detail, where you can undo this reading"
              testID="open-today-detail"
              style={{ marginTop: theme.spacing.sm, paddingVertical: theme.spacing.md }}
            >
              <Text variant="footnote" color="tertiary" align="center">
                View details
              </Text>
            </Pressable>
          </Animated.View>
        ) : (
          <Button
            label="Mark as Read"
            onPress={onMarkRead}
            accessibilityHint={`Marks ${reference} as read for today`}
            testID="mark-today-read"
          />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  completedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
