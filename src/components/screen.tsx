import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme-provider';

interface ScreenProps {
  children: ReactNode;
  /** Wraps content in a ScrollView. Off for screens that manage their own scrolling. */
  scroll?: boolean;
  edges?: readonly Edge[];
  contentContainerStyle?: ViewStyle;
  style?: ViewStyle;
}

/**
 * Page shell: themed background plus safe-area padding.
 *
 * Bottom inset is always applied so content clears the home indicator on modern
 * iPhones.
 */
export function Screen({
  children,
  scroll = false,
  edges = ['top', 'bottom'],
  contentContainerStyle,
  style,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Only emit the edges that were asked for. React Native resolves the longhand
  // `paddingLeft`/`paddingRight` ahead of a caller's `paddingHorizontal` regardless
  // of array order, so emitting explicit zeroes here would silently flatten the
  // horizontal padding of every screen that uses this component.
  const padding: ViewStyle = {
    ...(edges.includes('top') ? { paddingTop: insets.top } : null),
    ...(edges.includes('bottom') ? { paddingBottom: insets.bottom } : null),
    ...(edges.includes('left') ? { paddingLeft: insets.left } : null),
    ...(edges.includes('right') ? { paddingRight: insets.right } : null),
  };

  if (scroll) {
    return (
      <View style={[styles.root, { backgroundColor: theme.colors.background }, style]}>
        <ScrollView
          style={styles.fill}
          contentContainerStyle={[padding, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }, padding, style]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
});
