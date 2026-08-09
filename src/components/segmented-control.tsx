import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/theme-provider';

import { Text } from './text';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Announced as the group's purpose, e.g. "Appearance". */
  accessibilityLabel?: string;
  testIDPrefix?: string;
  style?: ViewStyle;
}

/** iOS-style segmented picker. Used for appearance and for the day sheet's tabs. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  testIDPrefix,
  style,
}: SegmentedControlProps<T>) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.root,
        { backgroundColor: theme.colors.surfaceSubtle, borderRadius: theme.radius.md, padding: 3 },
        style,
      ]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            testID={testIDPrefix === undefined ? undefined : `${testIDPrefix}-${option.value}`}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              {
                backgroundColor: selected ? theme.colors.surface : 'transparent',
                borderRadius: theme.radius.sm,
              },
              selected ? theme.shadows.card : null,
            ]}
          >
            <Text
              variant="callout"
              color={selected ? 'primary' : 'secondary'}
              align="center"
              numberOfLines={1}
              style={{ fontWeight: selected ? '600' : '400' }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row' },
  segment: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center' },
});
