import { Pressable, StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/icon-button';
import { Text } from '@/components/text';
import { useTheme } from '@/theme/theme-provider';
import { HIT_SLOP } from '@/theme/tokens';

interface MonthNavigatorProps {
  title: string;
  onPrevious: () => void;
  onNext: () => void;
  /** Shown when the user has navigated away from the current month. */
  onReturnToToday?: () => void;
}

export function MonthNavigator({ title, onPrevious, onNext, onReturnToToday }: MonthNavigatorProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <View style={styles.titleGroup}>
        <Text variant="title" accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.5}>
          {title}
        </Text>
        {onReturnToToday === undefined ? null : (
          <Pressable
            onPress={onReturnToToday}
            accessibilityRole="button"
            accessibilityLabel="Jump to the current month"
            hitSlop={HIT_SLOP}
            testID="back-to-today"
            style={{ marginTop: theme.spacing.xxs, alignSelf: 'flex-start', paddingVertical: 4 }}
          >
            <Text variant="footnote" color="accent">
              Back to today
            </Text>
          </Pressable>
        )}
      </View>
      <View style={styles.controls}>
        <IconButton name="chevron.left" accessibilityLabel="Previous month" onPress={onPrevious} />
        <IconButton
          name="chevron.right"
          accessibilityLabel="Next month"
          onPress={onNext}
          style={{ marginLeft: theme.spacing.xs }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleGroup: { flex: 1, marginRight: 12 },
  controls: { flexDirection: 'row', alignItems: 'center' },
});
