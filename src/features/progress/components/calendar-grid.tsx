import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import type { DayReading } from '@/features/reading-plan/domain/types';
import { useTheme } from '@/theme/theme-provider';
import type { DateKey } from '@/utils/date-key';

import { CALENDAR_ROW_HEIGHT, CalendarDay } from './calendar-day';
import {
  WEEKDAY_ACCESSIBILITY_LABELS,
  WEEKDAY_LABELS,
  type CalendarMonth,
} from '../domain/calendar-month';

interface CalendarGridProps {
  month: CalendarMonth;
  readings: ReadonlyMap<DateKey, DayReading>;
  today: DateKey;
  onSelectDay: (date: DateKey) => void;
}

export function WeekdayHeader() {
  const theme = useTheme();

  return (
    <View style={[styles.row, { marginBottom: theme.spacing.xs }]} accessibilityRole="header">
      {WEEKDAY_LABELS.map((label, index) => (
        <View key={WEEKDAY_ACCESSIBILITY_LABELS[index]} style={styles.headerCell}>
          <Text
            variant="weekday"
            color="tertiary"
            accessibilityLabel={WEEKDAY_ACCESSIBILITY_LABELS[index]}
            maxFontSizeMultiplier={1.3}
          >
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** A single month's day grid. The pager renders several of these side by side. */
export function CalendarGrid({ month, readings, today, onSelectDay }: CalendarGridProps) {
  return (
    <View>
      {month.weeks.map((week) => {
        const weekKey = week[0]?.date ?? String(month.key.month);
        return (
          <View key={weekKey} style={styles.row}>
            {week.map((cell) => {
              const day = readings.get(cell.date);
              if (day === undefined) return <View key={cell.date} style={styles.headerCell} />;
              return (
                <CalendarDay
                  key={cell.date}
                  day={day}
                  dayOfMonth={cell.dayOfMonth}
                  inCurrentMonth={cell.inCurrentMonth}
                  isToday={cell.date === today}
                  onPress={onSelectDay}
                />
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

export function getGridHeight(rowCount: number): number {
  return rowCount * CALENDAR_ROW_HEIGHT;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  headerCell: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 20 },
});
