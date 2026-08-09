import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

/**
 * Minimal stand-in for `react-native-reanimated` under Jest.
 *
 * The library's own mock still imports the real worklets runtime, which needs a
 * JSI proxy that does not exist in a Node test environment. Mocking only the
 * surface this app uses keeps component tests fast and avoids coupling them to
 * Reanimated internals: animated values resolve to their target immediately, so
 * assertions see the settled UI.
 */

type AnyFunction = (...args: never[]) => unknown;

const identity = <T,>(value: T): T => value;

export function useSharedValue<T>(initial: T): { value: T } {
  // useState rather than useRef so the box is created once and read safely during render.
  const [box] = useState(() => ({ value: initial }));
  return box;
}

export function useDerivedValue<T>(factory: () => T): { value: T } {
  return { value: factory() };
}

interface EnteringAnimation {
  duration: (value: number) => EnteringAnimation;
  delay: (value: number) => EnteringAnimation;
  springify: () => EnteringAnimation;
}

function createEnteringAnimation(): EnteringAnimation {
  const animation: EnteringAnimation = {
    duration: () => animation,
    delay: () => animation,
    springify: () => animation,
  };
  return animation;
}

export const useAnimatedStyle = <T,>(factory: () => T): T => factory();
export const useAnimatedProps = <T,>(factory: () => T): T => factory();
export const useAnimatedRef = () => ({ current: null });
export const useReducedMotion = () => false;

export const withTiming = identity;
export const withSpring = identity;
export const withRepeat = identity;
export const withDelay = <T,>(_delay: number, value: T): T => value;
export const withSequence = <T,>(...values: T[]): T | undefined => values[values.length - 1];
export const cancelAnimation = (): void => undefined;

export const runOnJS =
  <T extends AnyFunction>(fn: T) =>
  (...args: Parameters<T>) =>
    fn(...args);
export const runOnUI = runOnJS;

export const FadeIn = createEnteringAnimation();
export const FadeInDown = createEnteringAnimation();
export const FadeOut = createEnteringAnimation();

export const Easing = { inOut: () => identity, out: () => identity, ease: identity };

const Animated = {
  View,
  Text,
  ScrollView,
  createAnimatedComponent: <T,>(component: T): T => component,
};

export default Animated;
