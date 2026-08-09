import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { HIT_SLOP, MIN_TOUCH_TARGET } from '@/theme/tokens';

import { Icon, type IconName } from './icon';

interface IconButtonProps {
  name: IconName;
  onPress: () => void;
  /** Required: an icon-only control has no visible label to fall back on. */
  accessibilityLabel: string;
  accessibilityHint?: string;
  disabled?: boolean;
  size?: number;
  variant?: 'plain' | 'filled';
  style?: ViewStyle;
  testID?: string;
}

export function IconButton({
  name,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
  size = 18,
  variant = 'filled',
  style,
  testID,
}: IconButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      hitSlop={HIT_SLOP}
      style={({ pressed }) => [
        styles.base,
        {
          borderRadius: theme.radius.full,
          backgroundColor:
            variant === 'filled'
              ? pressed
                ? theme.colors.surfacePressed
                : theme.colors.surfaceSubtle
              : pressed
                ? theme.colors.surfaceSubtle
                : 'transparent',
          opacity: disabled ? 0.35 : 1,
        },
        style,
      ]}
    >
      <Icon name={name} size={size} color={theme.colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
