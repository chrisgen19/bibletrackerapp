import { memo, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/text';
import type { DayReading } from '@/features/reading-plan/domain/types';
import { useTheme } from '@/theme/theme-provider';

import { describeDay, getDayAppearance } from './day-appearance';

export const CALENDAR_ROW_HEIGHT = 48;
const CIRCLE_SIZE = 36;

interface CalendarDayProps {
  day: DayReading;
  dayOfMonth: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  onPress: (date: string) => void;
}

function CalendarDayComponent({ day, dayOfMonth, inCurrentMonth, isToday, onPress }: CalendarDayProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const appearance = getDayAppearance(day.status, theme, { isToday, inCurrentMonth });

  const isCompleted = day.status === 'completed';
  // Drives the fill's entrance so a freshly marked day blooms rather than snapping.
  const fillProgress = useSharedValue(isCompleted ? 1 : 0);

  useEffect(() => {
    const target = isCompleted ? 1 : 0;
    fillProgress.value = reducedMotion
      ? target
      : isCompleted
        ? withSpring(1, theme.springs.gentle)
        : withTiming(0, { duration: theme.duration.fast });
  }, [isCompleted, fillProgress, reducedMotion, theme.springs.gentle, theme.duration.fast]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.72 + fillProgress.value * 0.28 }],
    opacity: fillProgress.value,
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={describeDay(day, isToday)}
      accessibilityHint="Opens the reading for this day"
      onPress={() => onPress(day.date)}
      style={styles.cell}
    >
      <View style={[styles.circle, { borderRadius: CIRCLE_SIZE / 2, opacity: appearance.opacity }]}>
        {isCompleted ? (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: theme.colors.accent, borderRadius: CIRCLE_SIZE / 2 },
              fillStyle,
            ]}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: appearance.fill, borderRadius: CIRCLE_SIZE / 2 },
            ]}
          />
        )}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: CIRCLE_SIZE / 2,
              borderWidth: appearance.ringWidth,
              borderColor: appearance.ring,
            },
          ]}
        />
        <Text
          variant="calendarDay"
          style={{ color: appearance.textColor, fontWeight: appearance.fontWeight }}
          // The 7-column grid cannot reflow, so day numerals cap their growth.
          maxFontSizeMultiplier={1.4}
        >
          {dayOfMonth}
        </Text>
      </View>
    </Pressable>
  );
}

export const CalendarDay = memo(CalendarDayComponent);
CalendarDay.displayName = 'CalendarDay';

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    height: CALENDAR_ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
