import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';

import { Text } from './text';

interface SectionHeaderProps {
  title: string;
  /** Right-aligned control, e.g. a month navigator or an action link. */
  accessory?: ReactNode;
}

export function SectionHeader({ title, accessory }: SectionHeaderProps) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { marginBottom: theme.spacing.md }]}>
      <Text variant="overline" color="tertiary" accessibilityRole="header">
        {title.toUpperCase()}
      </Text>
      {accessory}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
