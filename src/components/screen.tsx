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

  const padding: ViewStyle = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
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
