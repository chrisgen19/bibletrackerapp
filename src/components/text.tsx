import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import type { TypographyToken } from '@/theme/tokens';

type ColorToken = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'onAccent' | 'danger';

export interface TextProps extends RNTextProps {
  variant?: TypographyToken;
  color?: ColorToken;
  align?: TextStyle['textAlign'];
}

/**
 * The single text primitive.
 *
 * Routing all copy through it keeps the type ramp and colour roles consistent, and
 * leaves Dynamic Type scaling enabled by default (individual call sites cap the
 * multiplier only where a fixed grid would otherwise break).
 */
export function Text({ variant = 'body', color = 'primary', align, style, ...rest }: TextProps) {
  const theme = useTheme();

  const colorValue = {
    primary: theme.colors.textPrimary,
    secondary: theme.colors.textSecondary,
    tertiary: theme.colors.textTertiary,
    accent: theme.colors.accent,
    onAccent: theme.colors.onAccent,
    danger: theme.colors.danger,
  }[color];

  return <RNText style={[theme.typography[variant], { color: colorValue, textAlign: align }, style]} {...rest} />;
}
