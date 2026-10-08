import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { DEFAULT_CANON_ID } from '@/data/bible/canon-index';
import { ReadingPositionFields } from '@/features/reading-plan/components/reading-position-fields';
import {
  DEFAULT_CHAPTERS_PER_DAY,
  validateReadingPlanDraft,
} from '@/features/reading-plan/domain/plan-draft';
import { formatReference } from '@/features/reading-plan/domain/reference';
import { calculateReadingForDate } from '@/features/reading-plan/domain/schedule';
import type { ReadingPlanDraft } from '@/features/reading-plan/domain/types';
import { useReadingData } from '@/features/reading-plan/hooks/reading-data-provider';
import { useTheme } from '@/theme/theme-provider';
import { settingChangedHaptic } from '@/utils/haptics';

/**
 * Moves the user's reading position.
 *
 * The new position always begins today as a fresh plan segment; earlier days keep
 * resolving against the segment that governed them, so no completed day changes.
 */
export default function ReadingPlanScreen() {
  const theme = useTheme();
  const router = useRouter();
  // The plan's view: an extra reading logged today is not today's reading.
  const { activePlan, today, changePlan, planScheduleContext } = useReadingData();

  const currentToday =
    activePlan === null ? null : calculateReadingForDate(activePlan, today, planScheduleContext);
  const currentReference =
    currentToday?.kind === 'scheduled' && currentToday.chapters[0] !== undefined
      ? formatReference(currentToday.chapters[0])
      : null;

  // Opens on where the reader is, the value Settings shows for "Current position", not on
  // the plan segment's first chapter.
  const [position, setPosition] = useState(() => {
    const here = planScheduleContext.unread[0];
    return {
      bookId: here?.bookId ?? activePlan?.startBookId ?? 'GEN',
      chapter: here?.chapter ?? activePlan?.startChapter ?? 1,
      startDate: today,
    };
  });
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(() => {
    const draft: ReadingPlanDraft = {
      canonId: activePlan?.canonId ?? DEFAULT_CANON_ID,
      startDate: today,
      startBookId: position.bookId,
      startChapter: position.chapter,
      chaptersPerDay: activePlan?.chaptersPerDay ?? DEFAULT_CHAPTERS_PER_DAY,
    };

    const validation = validateReadingPlanDraft(draft);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    changePlan(draft);
    settingChangedHaptic();
    router.back();
  }, [activePlan, today, position, changePlan, router]);

  return (
    <Screen scroll edges={['bottom']} contentContainerStyle={{ padding: theme.spacing.xl }}>
      {currentReference === null ? null : (
        <Card style={{ marginBottom: theme.spacing.xl }}>
          <Text variant="overline" color="tertiary">
            READING TODAY
          </Text>
          <Text variant="title" style={{ marginTop: theme.spacing.xs }}>
            {currentReference}
          </Text>
        </Card>
      )}

      <Text variant="headline">Move to a different chapter</Text>
      <Text variant="footnote" color="secondary" style={{ marginTop: theme.spacing.xs, marginBottom: theme.spacing.lg }}>
        The chapter you pick becomes today&apos;s reading, and the plan continues from there.
      </Text>

      <ReadingPositionFields
        canonId={activePlan?.canonId ?? DEFAULT_CANON_ID}
        value={position}
        onChange={setPosition}
      />

      <View
        style={{
          marginTop: theme.spacing.xl,
          padding: theme.spacing.lg,
          borderRadius: theme.radius.lg,
          backgroundColor: theme.colors.surfaceSubtle,
        }}
      >
        <Text variant="footnote" color="secondary">
          Your history is safe. Days you have already marked as read keep the chapter you read on them,
          and your streak carries over.
        </Text>
      </View>

      {error === null ? null : (
        <Text variant="footnote" color="danger" style={{ marginTop: theme.spacing.md }}>
          {error}
        </Text>
      )}

      <Button
        label="Save Position"
        onPress={handleSave}
        style={{ marginTop: theme.spacing.xl }}
        testID="save-reading-plan"
      />
    </Screen>
  );
}
