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

/** Supporting statistics beneath the calendar: streak, best streak, total read. */
export function StatRow({ stats }: { stats: readonly Stat[] }) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {stats.map((stat, index) => (
        <Card
          key={stat.label}
          padded={false}
          style={{
            flex: 1,
            paddingVertical: theme.spacing.lg,
            paddingHorizontal: theme.spacing.md,
            marginLeft: index === 0 ? 0 : theme.spacing.md,
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
  row: { flexDirection: 'row' },
});
