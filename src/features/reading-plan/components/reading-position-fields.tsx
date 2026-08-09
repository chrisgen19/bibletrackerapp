import DateTimePicker from '@react-native-community/datetimepicker';
import { format, isToday as isTodayDate } from 'date-fns';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { Card } from '@/components/card';
import { FieldRow } from '@/components/field-row';
import { Text } from '@/components/text';
import { getCanonIndex } from '@/data/bible/canon-index';
import { useTheme } from '@/theme/theme-provider';
import { fromDateKey, toDateKey, type DateKey } from '@/utils/date-key';

import { BookPicker } from './book-picker';
import { ChapterPicker } from './chapter-picker';

export interface ReadingPosition {
  bookId: string;
  chapter: number;
  startDate: DateKey;
}

interface ReadingPositionFieldsProps {
  canonId: string;
  value: ReadingPosition;
  onChange: (next: ReadingPosition) => void;
  /**
   * Offers the start date as a collapsed disclosure. Off for the settings editor,
   * where moving your position always takes effect from today.
   */
  allowStartDate?: boolean;
}

/**
 * Book / chapter / start-date editor shared by onboarding and the settings screen.
 *
 * Choosing a book clamps the chapter into range, so an invalid reference can never
 * reach the domain layer. The start date stays collapsed and reading "Today" unless
 * the user opens it, keeping the common path a two-field decision.
 */
export function ReadingPositionFields({
  canonId,
  value,
  onChange,
  allowStartDate = false,
}: ReadingPositionFieldsProps) {
  const theme = useTheme();
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const [chapterPickerOpen, setChapterPickerOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const index = getCanonIndex(canonId);
  const book = index.getBook(value.bookId);
  const startDay = fromDateKey(value.startDate);
  const startsToday = isTodayDate(startDay);

  return (
    <View>
      <Card padded={false}>
        <FieldRow
          label="Book"
          value={book?.name ?? value.bookId}
          onPress={() => setBookPickerOpen(true)}
          testID="field-book"
        />
        <FieldRow
          label="Chapter"
          value={String(value.chapter)}
          onPress={() => setChapterPickerOpen(true)}
          last={!allowStartDate}
          testID="field-chapter"
        />

        {allowStartDate ? (
          <>
            <FieldRow
              label="Start date"
              value={startsToday ? 'Today' : format(startDay, 'd MMM yyyy')}
              onPress={() => setDatePickerOpen((open) => !open)}
              last
              testID="field-start-date"
            />
            {datePickerOpen ? (
              <View style={{ paddingHorizontal: theme.spacing.sm, paddingBottom: theme.spacing.md }}>
                <DateTimePicker
                  value={startDay}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  accentColor={theme.colors.accent}
                  themeVariant={theme.scheme}
                  accessibilityLabel="Plan start date"
                  onChange={(_event, selected) => {
                    if (Platform.OS !== 'ios') setDatePickerOpen(false);
                    if (selected === undefined) return;
                    onChange({ ...value, startDate: toDateKey(selected) });
                  }}
                />
              </View>
            ) : null}
          </>
        ) : null}
      </Card>

      {allowStartDate ? (
        <Text variant="footnote" color="tertiary" style={{ marginTop: theme.spacing.sm }}>
          {startsToday
            ? 'Started earlier? Set the date your plan began and the calendar will fill in from there.'
            : `Your plan begins on ${format(startDay, 'EEEE d MMMM')}, so earlier days will appear on your calendar.`}
        </Text>
      ) : null}

      <BookPicker
        visible={bookPickerOpen}
        canonId={canonId}
        selectedBookId={value.bookId}
        onClose={() => setBookPickerOpen(false)}
        onSelect={(selected) => {
          onChange({
            ...value,
            bookId: selected.id,
            chapter: Math.min(value.chapter, selected.chapterCount),
          });
        }}
      />
      <ChapterPicker
        visible={chapterPickerOpen}
        canonId={canonId}
        bookId={value.bookId}
        selectedChapter={value.chapter}
        onClose={() => setChapterPickerOpen(false)}
        onSelect={(chapter) => onChange({ ...value, chapter })}
      />
    </View>
  );
}
