import { format, isToday } from 'date-fns';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { validateReadingPlanDraft } from '@/features/reading-plan/domain/plan-draft';
import { formatReference } from '@/features/reading-plan/domain/reference';
import { useOnboarding } from '@/features/reading-plan/hooks/onboarding-context';
import { useReadingData } from '@/features/reading-plan/hooks/reading-data-provider';
import { useTheme } from '@/theme/theme-provider';
import { fromDateKey } from '@/utils/date-key';

export default function ConfirmScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { draft } = useOnboarding();
  const { startPlan } = useReadingData();
  const [error, setError] = useState<string | null>(null);

  const startDay = fromDateKey(draft.startDate);
  const reference = formatReference({ bookId: draft.startBookId, chapter: draft.startChapter });

  const handleStart = useCallback(() => {
    const validation = validateReadingPlanDraft(draft);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    startPlan(draft);
    router.replace('/');
  }, [draft, startPlan, router]);

  return (
    <Screen scroll edges={['bottom']} contentContainerStyle={{ paddingHorizontal: theme.spacing.xl }}>
      <Text variant="largeTitle" accessibilityRole="header" style={{ marginTop: theme.spacing.sm }}>
        Your first reading
      </Text>

      <Card variant="raised" style={{ marginTop: theme.spacing.xxl, alignItems: 'center' }}>
        <View style={styles.centered}>
          <Text variant="overline" color="tertiary">
            {isToday(startDay) ? 'TODAY' : format(startDay, 'd MMMM yyyy').toUpperCase()}
          </Text>
          <Text
            variant="display"
            align="center"
            style={{ marginTop: theme.spacing.md }}
            maxFontSizeMultiplier={1.6}
          >
            {reference}
          </Text>
          <Text variant="callout" color="secondary" style={{ marginTop: theme.spacing.xs }}>
            One chapter a day
          </Text>
        </View>
      </Card>

      <Text variant="footnote" color="tertiary" align="center" style={{ marginTop: theme.spacing.lg }}>
        {isToday(startDay)
          ? 'Each following day moves to the next chapter automatically.'
          : `Your plan begins on ${format(startDay, 'EEEE d MMMM')} and moves forward one chapter a day.`}
      </Text>

      {error === null ? null : (
        <Text variant="footnote" color="danger" align="center" style={{ marginTop: theme.spacing.md }}>
          {error}
        </Text>
      )}

      <Button
        label="Start Reading"
        onPress={handleStart}
        style={{ marginTop: theme.spacing.xxxl }}
        testID="start-reading"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', paddingVertical: 8 },
});
