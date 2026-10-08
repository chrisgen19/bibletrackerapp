import { Alert, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { useTheme } from '@/theme/theme-provider';

interface NextReadThroughCardProps {
  /** The read-through that would start, e.g. 2. */
  nextReadThrough: number;
  onStart: () => void;
}

/**
 * Asks before starting the next read-through. Nothing is deleted, but the plan's
 * position does start again, so it is worth a second tap. Keeping things as they are
 * comes first, as in every confirmation in the app.
 */
export function confirmNextReadThrough(nextReadThrough: number, onStart: () => void): void {
  Alert.alert(
    `Start read-through #${nextReadThrough}?`,
    'Your plan starts again at Genesis 1, at the same pace. Everything you have read stays on your calendar and in your streaks.',
    [
      { text: 'Not yet', style: 'cancel' },
      { text: 'Start', onPress: onStart },
    ],
  );
}

/**
 * Offered once the Bible is finished: read it again from Genesis 1 without losing
 * anything. Shown beside today's card rather than inside it, so the finishing day can
 * show "Completed today" and this offer together.
 */
export function NextReadThroughCard({ nextReadThrough, onStart }: NextReadThroughCardProps) {
  const theme = useTheme();
  const label = `read-through #${nextReadThrough}`;

  return (
    <Card variant="raised">
      <Text variant="overline" color="tertiary">
        READ IT AGAIN
      </Text>
      <Text variant="headline" style={{ marginTop: theme.spacing.sm }}>
        You have finished the Bible
      </Text>
      <Text variant="callout" color="secondary" style={{ marginTop: theme.spacing.xs }}>
        {`Start ${label} from Genesis 1. Everything you have read stays on your calendar.`}
      </Text>
      <View style={{ marginTop: theme.spacing.xl }}>
        <Button
          label={`Start Read-Through #${nextReadThrough}`}
          leading={<Icon name="arrow.counterclockwise" size={16} color={theme.colors.onAccent} />}
          onPress={() => confirmNextReadThrough(nextReadThrough, onStart)}
          accessibilityHint="Asks before starting your plan again from Genesis 1"
          testID="start-next-read-through"
        />
      </View>
    </Card>
  );
}
