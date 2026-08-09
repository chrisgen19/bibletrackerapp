import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { MIN_TOUCH_TARGET } from '@/theme/tokens';

import { Icon } from './icon';
import { Text } from './text';

interface FieldRowProps {
  label: string;
  value: string;
  onPress: () => void;
  /** Hides the separator on the last row of a group. */
  last?: boolean;
  testID?: string;
}

/** iOS-style disclosure row used by the plan editors and settings. */
export function FieldRow({ label, value, onPress, last = false, testID }: FieldRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}`}
      accessibilityHint={`Changes the ${label.toLowerCase()}`}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          paddingHorizontal: theme.spacing.lg,
          backgroundColor: pressed ? theme.colors.surfacePressed : 'transparent',
        },
      ]}
    >
      <Text variant="body" style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant="body" color="secondary" numberOfLines={1} style={{ marginRight: theme.spacing.sm }}>
        {value}
      </Text>
      <Icon name="chevron.right" size={13} color={theme.colors.textTertiary} />
      {last ? null : (
        <View
          style={[
            styles.separator,
            { backgroundColor: theme.colors.separator, left: theme.spacing.lg },
          ]}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TOUCH_TARGET + 6 },
  separator: { position: 'absolute', bottom: 0, right: 0, height: StyleSheet.hairlineWidth },
});
