import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { Text } from '@/components/text';
import type { CanonIndex } from '@/data/bible/canon-index';
import type { ReadingCompletion } from '@/features/reading-plan/domain/types';
import { useTheme } from '@/theme/theme-provider';
import { MIN_TOUCH_TARGET } from '@/theme/tokens';

import { describeRow } from './describe-row';

interface ExtraReadingsBlockProps {
  rows: readonly ReadingCompletion[];
  index: CanonIndex;
  onSetExtra: (id: string, isExtra: boolean) => void;
  onUndoEntry: (id: string) => void;
}

/**
 * The extra readings recorded on a day: logged, but outside the plan. Each can be
 * brought into the plan or removed on its own.
 */
export function ExtraReadingsBlock({ rows, index, onSetExtra, onUndoEntry }: ExtraReadingsBlockProps) {
  const theme = useTheme();
  if (rows.length === 0) return null;

  return (
    <View style={{ marginTop: theme.spacing.xxl }}>
      <Text variant="overline" color="tertiary" accessibilityRole="header">
        EXTRA READINGS
      </Text>
      <Text variant="footnote" color="secondary" style={{ marginTop: theme.spacing.xs }}>
        Logged on this day, outside your plan.
      </Text>
      <View style={{ marginTop: theme.spacing.sm }}>
        {rows.map((row) => (
          <View key={row.id} style={styles.row}>
            <Text variant="body" style={{ flex: 1 }}>
              {describeRow(row, index)}
            </Text>
            <Button
              label="Count toward plan"
              variant="ghost"
              size="medium"
              onPress={() => onSetExtra(row.id, false)}
              accessibilityHint={`Counts ${describeRow(row, index)} toward your reading plan`}
              testID={`count-entry-${row.id}`}
            />
            <IconButton
              name="xmark"
              variant="plain"
              size={14}
              accessibilityLabel={`Remove ${describeRow(row, index)}`}
              onPress={() => onUndoEntry(row.id)}
              testID={`remove-extra-${row.id}`}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TOUCH_TARGET },
});
