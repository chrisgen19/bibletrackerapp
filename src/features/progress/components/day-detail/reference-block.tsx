import { View } from 'react-native';

import { Text } from '@/components/text';
import type { BibleReference } from '@/data/bible/canon';
import type { CanonIndex } from '@/data/bible/canon-index';
import { formatReferenceSpan } from '@/features/reading-plan/domain/reference';
import { useTheme } from '@/theme/theme-provider';

export function ReferenceBlock({
  label,
  chapters,
  index,
}: {
  label: string;
  chapters: readonly BibleReference[];
  index: CanonIndex;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        marginTop: theme.spacing.xl,
        backgroundColor: theme.colors.surfaceSubtle,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.lg,
      }}
    >
      <Text variant="overline" color="tertiary">
        {label}
      </Text>
      <Text variant="title" style={{ marginTop: theme.spacing.xs }}>
        {formatReferenceSpan(chapters, index)}
      </Text>
    </View>
  );
}
