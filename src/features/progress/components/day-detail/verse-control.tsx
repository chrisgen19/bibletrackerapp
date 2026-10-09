import { format } from 'date-fns';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { FieldRow } from '@/components/field-row';
import { Text } from '@/components/text';
import type { BibleReference, VerseRange } from '@/data/bible/canon';
import type { CanonIndex } from '@/data/bible/canon-index';
import { VersePicker } from '@/features/reading-plan/components/verse-picker';
import type { ChapterProgress } from '@/features/reading-plan/domain/chapter-progress';
import { formatReference } from '@/features/reading-plan/domain/reference';
import { formatVerseRange } from '@/features/reading-plan/domain/verse-range';
import { useTheme } from '@/theme/theme-provider';
import { fromDateKey, type DateKey } from '@/utils/date-key';

interface VerseControlProps {
  reference: BibleReference;
  progress: ChapterProgress;
  index: CanonIndex;
  /** "Mark" on the reading-plan side, "Log" when recording something by hand. */
  verb: 'Mark' | 'Log';
  /** Returns false when the write failed, so a stale selection is not cleared. */
  onSubmit: (span: VerseRange) => boolean;
  getCompletedOnFor: (reference: BibleReference) => DateKey | null;
  /** The day being viewed, to tell "recorded here" from "read on another day". */
  viewedDate: DateKey;
  fieldTestID: string;
  submitTestID: string;
}

/**
 * "I read up to verse N", and the button that records it.
 *
 * Shared by the plan tab, the catch-up block and the Custom tab so the three cannot
 * drift apart in wording or in what they write. Remount it with a `key` when the
 * chapter changes and the pending selection resets itself.
 */
export function VerseControl({
  reference,
  progress,
  index,
  verb,
  onSubmit,
  getCompletedOnFor,
  viewedDate,
  fieldTestID,
  submitTestID,
}: VerseControlProps) {
  const theme = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [toVerse, setToVerse] = useState<number | null>(null);

  const fromVerse = progress.remaining[0]?.from ?? 1;
  const lastVerse = progress.verseCount;
  // A selection below `fromVerse` is stale: progress advanced past it while the sheet
  // stayed open. Treat it as unset rather than building a reversed span — normalise
  // would swap 11–10 into 10–11 and mark a verse read that never was.
  const endVerse = toVerse !== null && toVerse >= fromVerse ? toVerse : lastVerse;
  const span: VerseRange = { from: fromVerse, to: endVerse };
  const finishesChapter = endVerse >= lastVerse;
  const chapterLabel = formatReference(reference, index);

  // A finished chapter leaves `remaining` empty, so `fromVerse` falls back to 1 and
  // the control would otherwise present it as untouched — same field, same label,
  // no hint that logging again adds a second row and inflates the streak.
  const completedOn = progress.isComplete ? getCompletedOnFor(reference) : null;
  const alreadyHere = completedOn !== null && completedOn === viewedDate;

  return (
    <View>
      <View style={{ marginBottom: theme.spacing.md }}>
        <Card padded={false}>
          <FieldRow
            label="Read up to verse"
            value={
              progress.isComplete
                ? `${lastVerse} (whole chapter)`
                : finishesChapter
                  ? `${lastVerse} (finishes the chapter)`
                  : String(endVerse)
            }
            onPress={() => setPickerOpen(true)}
            last
            testID={fieldTestID}
          />
        </Card>
        {progress.isComplete ? null : (
          <Text variant="footnote" color="tertiary" style={{ marginTop: theme.spacing.sm }}>
            {finishesChapter
              ? 'Stopping early? Set how far you got and finish the rest another day.'
              : `Recording verses ${formatVerseRange(span)}. Verses ${formatVerseRange({
                  from: endVerse + 1,
                  to: lastVerse,
                })} stay waiting for you.`}
          </Text>
        )}
      </View>

      {progress.isComplete ? (
        <View
          style={{
            marginBottom: theme.spacing.md,
            padding: theme.spacing.lg,
            borderRadius: theme.radius.lg,
            backgroundColor: theme.colors.accentSoft,
          }}
        >
          <Text variant="footnote" color="accent" testID={`${submitTestID}-already-read`}>
            {alreadyHere
              ? `${chapterLabel} is already recorded on this day.`
              : completedOn === null
                ? `${chapterLabel} is already fully read.`
                : `${chapterLabel} is already fully read — completed on ${format(
                    fromDateKey(completedOn),
                    'd MMMM',
                  )}.`}
          </Text>
        </View>
      ) : null}

      <Button
        label={
          progress.isComplete
            ? `${verb} ${chapterLabel} Again`
            : finishesChapter && fromVerse === 1
              ? `${verb} ${chapterLabel} as Read`
              : `${verb} ${chapterLabel}:${formatVerseRange(span)} as Read`
        }
        variant={progress.isComplete ? 'secondary' : 'primary'}
        onPress={() => {
          if (onSubmit(span)) setToVerse(null);
        }}
        accessibilityHint={
          progress.isComplete
            ? `Records ${chapterLabel} again for this day, in addition to the reading already logged`
            : `Records ${chapterLabel} verses ${formatVerseRange(span)} as read`
        }
        testID={submitTestID}
      />

      <VersePicker
        visible={pickerOpen}
        chapterLabel={chapterLabel}
        fromVerse={fromVerse}
        verseCount={lastVerse}
        selectedTo={endVerse}
        onSelect={setToVerse}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}
