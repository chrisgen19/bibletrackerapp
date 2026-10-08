import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon, type IconName } from '@/components/icon';
import { Text } from '@/components/text';
import { useTheme } from '@/theme/theme-provider';

interface Stat {
  icon: IconName;
  value: string;
  label: string;
}

/**
 * Supporting statistics beneath the calendar, two to a row. Four tiles side by side
 * leave a phone's labels too narrow to read ("chapters this read-through").
 */
export function StatRow({ stats }: { stats: readonly Stat[] }) {
  const theme = useTheme();

  return (
    <View style={[styles.grid, { gap: theme.spacing.md }]}>
      {stats.map((stat) => (
        <Card
          key={stat.label}
          padded={false}
          style={{
            ...styles.tile,
            paddingVertical: theme.spacing.lg,
            paddingHorizontal: theme.spacing.md,
          }}
        >
          <View accessible accessibilityLabel={`${stat.value} ${stat.label}`}>
            <Icon name={stat.icon} size={16} color={theme.colors.accentMuted} />
            <Text variant="headline" style={{ marginTop: theme.spacing.sm }} maxFontSizeMultiplier={1.5}>
              {stat.value}
            </Text>
            <Text variant="footnote" color="tertiary" numberOfLines={2}>
              {stat.label}
            </Text>
          </View>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  // Grows to fill half the row: two per row with the gap between them.
  tile: { flexBasis: '40%', flexGrow: 1 },
});
