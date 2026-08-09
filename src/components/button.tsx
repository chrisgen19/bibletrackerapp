import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useTheme } from '@/theme/theme-provider';
import { MIN_TOUCH_TARGET } from '@/theme/tokens';

import { Text } from './text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'medium' | 'large';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  /** Rendered before the label — typically an icon. */
  leading?: React.ReactNode;
  accessibilityHint?: string;
  style?: ViewStyle;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'large',
  disabled = false,
  leading,
  accessibilityHint,
  style,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.02 }],
    opacity: 1 - pressed.value * 0.12,
  }));

  const palette: Record<ButtonVariant, { background: string; border: string; color: Parameters<typeof Text>[0]['color'] }> =
    {
      primary: { background: theme.colors.accent, border: 'transparent', color: 'onAccent' },
      secondary: { background: theme.colors.surfaceSubtle, border: theme.colors.separator, color: 'primary' },
      ghost: { background: 'transparent', border: 'transparent', color: 'accent' },
      destructive: { background: theme.colors.dangerSoft, border: 'transparent', color: 'danger' },
    };

  const { background, border, color } = palette[variant];
  const height = size === 'large' ? 54 : MIN_TOUCH_TARGET;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withSpring(1, theme.springs.press);
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, theme.springs.press);
      }}
      style={[
        styles.base,
        {
          height,
          backgroundColor: background,
          borderColor: border,
          borderRadius: theme.radius.lg,
          paddingHorizontal: theme.spacing.xl,
          opacity: disabled ? 0.4 : 1,
        },
        animatedStyle,
        style,
      ]}
    >
      {leading === undefined ? null : <View style={styles.leading}>{leading}</View>}
      <Text variant="headline" color={color} numberOfLines={1}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  leading: { marginRight: 8 },
});
