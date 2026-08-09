import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Text } from '@/components/text';
import { useTheme } from '@/theme/theme-provider';

interface SelectionCardProps {
  title: string;
  description: string;
  icon: IconName;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}

/** Large tap target used for the "where would you like to begin?" choices. */
export function SelectionCard({
  title,
  description,
  icon,
  selected,
  onPress,
  testID,
}: SelectionCardProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
      accessibilityHint={description}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: selected ? theme.colors.accentSoft : theme.colors.surface,
          borderColor: selected ? theme.colors.accent : theme.colors.separator,
          borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
          borderRadius: theme.radius.xl,
          padding: theme.spacing.xl,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.row}>
        <View
          style={[
            styles.iconWell,
            {
              backgroundColor: selected ? theme.colors.accent : theme.colors.surfaceSubtle,
              borderRadius: theme.radius.md,
            },
          ]}
        >
          <Icon
            name={icon}
            size={18}
            color={selected ? theme.colors.onAccent : theme.colors.textSecondary}
          />
        </View>
        <View style={styles.copy}>
          <Text variant="headline">{title}</Text>
          <Text variant="footnote" color="secondary" style={{ marginTop: theme.spacing.xxs }}>
            {description}
          </Text>
        </View>
        {selected ? <Icon name="checkmark" size={16} color={theme.colors.accent} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%' },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconWell: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, marginLeft: 14, marginRight: 8 },
});
