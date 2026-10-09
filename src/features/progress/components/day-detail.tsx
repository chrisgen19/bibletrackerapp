import { format } from 'date-fns';
import { useState } from 'react';
import { View } from 'react-native';

import { SegmentedControl, type SegmentOption } from '@/components/segmented-control';
import { Text } from '@/components/text';
import type { BibleReference, VerseRange } from '@/data/bible/canon';
import { DEFAULT_CANON_ID, getCanonIndex } from '@/data/bible/canon-index';
import type { ChapterProgress } from '@/features/reading-plan/domain/chapter-progress';
import type { ReadingKind } from '@/features/reading-plan/domain/reading-kind';
import type { CompletionLookup } from '@/features/reading-plan/domain/schedule';
import type {
  DayReading,
  ReadingCompletion,
  ReadingPlanDraft,
} from '@/features/reading-plan/domain/types';
import { useTheme } from '@/theme/theme-provider';
import { compareDateKeys, fromDateKey, type DateKey } from '@/utils/date-key';

import { CustomPanel } from './day-detail/custom-panel';
import { ExtraReadingsBlock } from './day-detail/extra-readings-block';
import { PlanPanel } from './day-detail/plan-panel';

type Tab = 'plan' | 'custom';

const TABS: readonly SegmentOption<Tab>[] = [
  { value: 'plan', label: 'Reading plan' },
  { value: 'custom', label: 'Custom' },
];

export interface DayDetailProps {
  day: DayReading;
  today: DateKey;
  /** Records plan readings. Returns false when nothing was written, so no success is shown. */
  onComplete: (chapters: readonly BibleReference[], verses?: VerseRange) => boolean;
  /** Records a Custom reading as an extra; the stored row, or null when nothing was written. */
  onLogExtra: (reference: BibleReference, verses?: VerseRange) => string | null;
  onUndo: () => void;
  /** Removes one recorded reading, so a day with several keeps the rest. */
  onUndoEntry: (id: string) => void;
  /** Moves the reading position so the next unread day follows on from a logged chapter. */
  onChangePlan: (draft: ReadingPlanDraft) => void;
  /** Lets a continuation skip days that are already recorded. */
  completions: CompletionLookup;
  /** The plan readings recorded on this day, so each can be described and removed on its own. */
  rows: readonly ReadingCompletion[];
  /** The extra readings recorded on this day, listed apart from the plan's. */
  extraRows: readonly ReadingCompletion[];
  /** Moves one recorded reading into or out of the plan. */
  onSetExtra: (id: string, isExtra: boolean) => void;
  /** Brings a just-logged extra into the plan, moving the plan on to `draft` first. */
  onCountTowardPlan: (id: string, draft: ReadingPlanDraft | null) => void;
  /** Whether a chapter logged from the Custom tab belongs to the plan (reading-kind.ts). */
  classifyReading: (reference: BibleReference) => ReadingKind;
  /**
   * Progress on the scheduled chapter across every day it was touched, or `null`
   * when the day schedules no single chapter.
   */
  progress: ChapterProgress | null;
  /** Progress for any chapter, so the Custom tab can resume an unfinished one. */
  getProgressFor: (reference: BibleReference) => ChapterProgress | null;
  /** When a chapter was finished, so an already-read one can say so rather than
   * presenting itself as untouched. */
  getCompletedOnFor: (reference: BibleReference) => DateKey | null;
  /**
   * The chapter the reader is actually on — the head of the unread queue.
   *
   * Seeds the Custom tab and the catch-up action on a missed day. Without it both
   * fall back to Genesis 1, which is a valid-looking selection that is almost never
   * what the reader meant, and which silently records the wrong chapter.
   */
  currentPosition: BibleReference | null;
  /**
   * False on a day from an earlier read-through: a reading there stays in that
   * read-through, so moving the current plan on from it would skip a chapter the current
   * one never counted. Defaults to true.
   */
  canMovePlan?: boolean;
  /** Opens straight onto the Custom tab with this chapter selected. */
  focusChapter?: BibleReference | null;
}

export function DayDetail({
  day,
  today,
  onComplete,
  onLogExtra,
  onUndo,
  onUndoEntry,
  onChangePlan,
  completions,
  rows,
  extraRows,
  onSetExtra,
  onCountTowardPlan,
  classifyReading,
  progress,
  getProgressFor,
  getCompletedOnFor,
  currentPosition,
  canMovePlan = true,
  focusChapter = null,
}: DayDetailProps) {
  const theme = useTheme();
  // Arriving from the unfinished list lands directly on Custom with that chapter.
  const [tab, setTab] = useState<Tab>(focusChapter === null ? 'plan' : 'custom');

  const isFuture = compareDateKeys(day.date, today) > 0;

  return (
    <View>
      <DayHeader day={day} isToday={day.date === today} />

      {/* Future readings are view-only: you cannot log something you have not read. */}
      {isFuture ? null : (
        <SegmentedControl
          options={TABS}
          value={tab}
          onChange={setTab}
          accessibilityLabel="What to log for this day"
          testIDPrefix="day-tab"
          style={{ marginTop: theme.spacing.xl }}
        />
      )}

      {tab === 'plan' || isFuture ? (
        <PlanPanel
          day={day}
          isFuture={isFuture}
          onComplete={onComplete}
          onUndo={onUndo}
          onUndoEntry={onUndoEntry}
          onSetExtra={onSetExtra}
          rows={rows}
          hasExtras={extraRows.length > 0}
          progress={progress}
          getProgressFor={getProgressFor}
          getCompletedOnFor={getCompletedOnFor}
          currentPosition={currentPosition}
        />
      ) : (
        <CustomPanel
          day={day}
          today={today}
          onComplete={onComplete}
          onLogExtra={onLogExtra}
          onChangePlan={onChangePlan}
          onCountTowardPlan={onCountTowardPlan}
          classifyReading={classifyReading}
          completions={completions}
          getProgressFor={getProgressFor}
          getCompletedOnFor={getCompletedOnFor}
          currentPosition={currentPosition}
          canMovePlan={canMovePlan}
          focusChapter={focusChapter}
        />
      )}

      <ExtraReadingsBlock
        rows={extraRows}
        index={getCanonIndex(day.plan?.canonId ?? DEFAULT_CANON_ID)}
        onSetExtra={onSetExtra}
        onUndoEntry={onUndoEntry}
      />
    </View>
  );
}

function DayHeader({ day, isToday }: { day: DayReading; isToday: boolean }) {
  const theme = useTheme();
  const parsed = fromDateKey(day.date);

  return (
    <View>
      <Text variant="overline" color="tertiary">
        {isToday ? 'TODAY' : format(parsed, 'EEEE').toUpperCase()}
      </Text>
      <Text variant="title" style={{ marginTop: theme.spacing.xs }} accessibilityRole="header">
        {format(parsed, 'd MMMM yyyy')}
      </Text>
    </View>
  );
}
