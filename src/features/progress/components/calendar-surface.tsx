import { View } from 'react-native';

import { Card } from '@/components/card';
import { useTheme } from '@/theme/theme-provider';
import type { DateKey } from '@/utils/date-key';

import { WeekdayHeader } from './calendar-grid';
import { MonthNavigator } from './month-navigator';
import { MonthPager } from './month-pager';
import { MonthSummary } from './month-summary';
import type { MonthWindow } from '../hooks/use-month-window';

interface CalendarSurfaceProps {
  window: MonthWindow;
  today: DateKey;
  onSelectDay: (date: DateKey) => void;
  onStepMonth: (step: number) => void;
  /** Provided only while the user is looking at a month other than the current one. */
  onReturnToToday?: () => void;
}

/** The hero: month navigator, monthly summary and the swipeable day grid in one card. */
export function CalendarSurface({
  window: monthWindow,
  today,
  onSelectDay,
  onStepMonth,
  onReturnToToday,
}: CalendarSurfaceProps) {
  const theme = useTheme();
  const { calendar, statistics } = monthWindow.current;

  return (
    <Card variant="raised">
      <MonthNavigator
        title={calendar.title}
        onPrevious={() => onStepMonth(-1)}
        onNext={() => onStepMonth(1)}
        onReturnToToday={onReturnToToday}
      />

      <View style={{ marginTop: theme.spacing.lg }}>
        <MonthSummary statistics={statistics} monthTitle={calendar.title} />
      </View>

      <View
        style={{
          marginTop: theme.spacing.lg,
          paddingTop: theme.spacing.md,
          borderTopWidth: 1,
          borderTopColor: theme.colors.separator,
        }}
      >
        <WeekdayHeader />
        <MonthPager
          window={monthWindow}
          today={today}
          onSelectDay={onSelectDay}
          onStepMonth={onStepMonth}
        />
      </View>
    </Card>
  );
}
