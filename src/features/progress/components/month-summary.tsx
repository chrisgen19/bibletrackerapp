import { StyleSheet, View } from 'react-native';

import { ProgressRing } from '@/components/progress-ring';
import { Text } from '@/components/text';
import { useTheme } from '@/theme/theme-provider';

import { describeMonthProgress, type MonthStatistics } from '../domain/month-statistics';

interface MonthSummaryProps {
  statistics: MonthStatistics;
  monthTitle: string;
}

/**
 * The headline number for the selected month.
 *
 * Months that predate the plan, and months still to come, get descriptive copy
 * instead of a percentage — reporting "0%" for time the user could not have read
 * would be both wrong and discouraging.
 */
export function MonthSummary({ statistics, monthTitle }: MonthSummaryProps) {
  const theme = useTheme();
  const showRing = statistics.kind === 'past' || statistics.kind === 'current';
  const headline = describeMonthProgress(statistics);

  const supporting =
    statistics.kind === 'past' || statistics.kind === 'current'
      ? `${statistics.percent}% complete`
      : statistics.kind === 'future'
        ? 'Planned readings'
        : statistics.kind === 'before-plan'
          ? 'Nothing was scheduled yet'
          : 'Start a plan to begin tracking';

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${monthTitle}. ${headline}. ${supporting}.`}
    >
      <View style={styles.text}>
        <Text variant="headline" maxFontSizeMultiplier={1.6}>
          {headline}
        </Text>
        <Text variant="callout" color="secondary" style={{ marginTop: theme.spacing.xxs }}>
          {supporting}
        </Text>
      </View>
      {showRing ? (
        <ProgressRing percent={statistics.percent} accessibilityLabel={`${statistics.percent} percent`} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  text: { flex: 1, paddingRight: 16 },
});
