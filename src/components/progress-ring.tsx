import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/theme/theme-provider';

import { Text } from './text';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ProgressRingProps {
  /** 0–100. */
  percent: number;
  size?: number;
  strokeWidth?: number;
  /** Hidden when the month has nothing to report, e.g. before the plan began. */
  showLabel?: boolean;
  accessibilityLabel?: string;
}

/**
 * Circular completion meter for the monthly summary.
 *
 * The sweep animates on change so a freshly marked reading visibly moves the ring,
 * and collapses to a static render when the system asks for reduced motion.
 */
export function ProgressRing({
  percent,
  size = 56,
  strokeWidth = 5,
  showLabel = true,
  accessibilityLabel,
}: ProgressRingProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));

  const progress = useSharedValue(reducedMotion ? clamped : 0);

  useEffect(() => {
    progress.value = reducedMotion ? clamped : withTiming(clamped, { duration: theme.duration.slow });
  }, [clamped, progress, reducedMotion, theme.duration.slow]);

  const dashOffset = useDerivedValue(() => circumference * (1 - progress.value / 100));

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: dashOffset.value }));

  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? `${Math.round(clamped)} percent complete`}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.colors.surfaceSubtle}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.colors.accent}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          // Start the sweep at 12 o'clock rather than 3 o'clock.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {showLabel ? (
        <Text variant="footnote" color="secondary" maxFontSizeMultiplier={1.3}>
          {Math.round(clamped)}%
        </Text>
      ) : null}
    </View>
  );
}
