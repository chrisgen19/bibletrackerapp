import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/theme-provider';

interface CardProps {
  children: ReactNode;
  /** `plain` sits flat on the background; `raised` carries the card shadow. */
  variant?: 'plain' | 'raised';
  padded?: boolean;
  style?: ViewStyle;
}

export function Card({ children, variant = 'plain', padded = true, style }: CardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.xl,
          borderColor: theme.colors.separator,
          padding: padded ? theme.spacing.xl : 0,
        },
        variant === 'raised' ? theme.shadows.card : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: StyleSheet.hairlineWidth },
});
