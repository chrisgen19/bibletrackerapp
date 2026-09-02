import { Redirect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/icon-button';
import { Text } from '@/components/text';
import { getCanonIndex } from '@/data/bible/canon-index';
import { CalendarSurface } from '@/features/progress/components/calendar-surface';
import { StatRow } from '@/features/progress/components/stat-row';
import { TodayReadingCard } from '@/features/progress/components/today-reading-card';
import { UnfinishedList } from '@/features/progress/components/unfinished-list';
import {
  addMonthsToMonthKey,
  monthKeyFromDateKey,
  monthKeysEqual,
  type MonthKey,
} from '@/features/progress/domain/calendar-month';
import { useMonthWindow } from '@/features/progress/hooks/use-month-window';
import { useStreaks } from '@/features/progress/hooks/use-streaks';
import {
  countChaptersRead,
  getChapterProgress,
  getUnfinishedChapters,
} from '@/features/reading-plan/domain/chapter-progress';
import { useReadingData } from '@/features/reading-plan/hooks/reading-data-provider';
import { useTodayReading } from '@/features/reading-plan/hooks/use-today-reading';
import { useTheme } from '@/theme/theme-provider';
import type { DateKey } from '@/utils/date-key';
import { completionHaptic } from '@/utils/haptics';

export default function ProgressScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hasCompletedOnboarding, today, completions, completeReading, activePlan } = useReadingData();

  const [monthKey, setMonthKey] = useState<MonthKey>(() => monthKeyFromDateKey(today));
  const monthWindow = useMonthWindow(monthKey);
  const todayReading = useTodayReading();
  const streaks = useStreaks();

  const currentMonthKey = useMemo(() => monthKeyFromDateKey(today), [today]);
  const canonIndex = useMemo(
    () => getCanonIndex(activePlan?.canonId ?? 'protestant'),
    [activePlan],
  );

  /** Progress on today's chapter, so the card can show what is left to read. */
  const todayProgress = useMemo(() => {
    if (todayReading.scheduled.kind !== 'scheduled') return null;
    const chapter =
      todayReading.scheduled.chapters.length === 1 ? todayReading.scheduled.chapters[0] : undefined;
    if (chapter === undefined) return null;
    return getChapterProgress(completions, chapter, canonIndex);
  }, [todayReading.scheduled, completions, canonIndex]);

  /**
   * Chapters left half-read, minus whatever today's card is already showing.
   *
   * Today's partial chapter has its own "Continue Reading" button; listing it twice
   * would read as two outstanding readings rather than one.
   */
  const unfinished = useMemo(() => {
    const shownToday = new Set(
      todayReading.scheduled.kind === 'scheduled'
        ? todayReading.scheduled.chapters.map((c) => `${c.bookId}:${c.chapter}`)
        : [],
    );
    return getUnfinishedChapters(completions, canonIndex).filter(
      (progress) =>
        !shownToday.has(`${progress.reference.bookId}:${progress.reference.chapter}`),
    );
  }, [completions, canonIndex, todayReading.scheduled]);

  /** Chapters finished, not completion rows — a chapter read in two sittings is one. */
  const chaptersRead = useMemo(
    () => countChaptersRead(completions, canonIndex),
    [completions, canonIndex],
  );
  const isViewingCurrentMonth = monthKeysEqual(monthKey, currentMonthKey);

  const stepMonth = useCallback((step: number) => {
    setMonthKey((current) => addMonthsToMonthKey(current, step));
  }, []);

  const openDay = useCallback(
    (date: DateKey) => {
      router.push(`/day/${date}`);
    },
    [router],
  );

  const markTodayRead = useCallback(() => {
    if (todayReading.scheduled.kind !== 'scheduled') return;
    completeReading(today, todayReading.scheduled.chapters);
    completionHaptic();
  }, [completeReading, today, todayReading.scheduled]);

  if (!hasCompletedOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <View
        style={[
          styles.header,
          { paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing.md },
        ]}
      >
        <Text variant="largeTitle" accessibilityRole="header" maxFontSizeMultiplier={1.5}>
          Your Reading
        </Text>
        <IconButton
          name="gearshape"
          variant="plain"
          accessibilityLabel="Settings"
          onPress={() => router.push('/settings')}
        />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.xl,
          paddingBottom: insets.bottom + theme.spacing.xxxl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <CalendarSurface
          window={monthWindow}
          today={today}
          onSelectDay={openDay}
          onStepMonth={stepMonth}
          onReturnToToday={isViewingCurrentMonth ? undefined : () => setMonthKey(currentMonthKey)}
        />

        <View style={{ marginTop: theme.spacing.xxl }}>
          <TodayReadingCard
            day={todayReading}
            onMarkRead={markTodayRead}
            onOpenDetail={() => openDay(today)}
            progress={todayProgress}
          />
        </View>

        {unfinished.length > 0 ? (
          <View style={{ marginTop: theme.spacing.xxl }}>
            <UnfinishedList
              chapters={unfinished}
              index={canonIndex}
              onSelect={(reference) =>
                router.push(
                  `/day/${today}?book=${reference.bookId}&chapter=${reference.chapter}`,
                )
              }
            />
          </View>
        ) : null}

        <View style={{ marginTop: theme.spacing.md }}>
          <StatRow
            stats={[
              { icon: 'flame', value: String(streaks.current), label: 'day streak' },
              { icon: 'calendar', value: String(streaks.longest), label: 'longest streak' },
              { icon: 'book.closed', value: String(chaptersRead), label: 'chapters read' },
            ]}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
