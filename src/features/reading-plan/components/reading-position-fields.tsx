import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
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
  /** Only the custom-start flow lets the user move the plan's first day. */
  showStartDate?: boolean;
}

/**
 * Book / chapter / start-date editor shared by onboarding and the settings screen.
 *
 * Choosing a book clamps the chapter into range, so an invalid reference can never
 * reach the domain layer.
 */
export function ReadingPositionFields({
  canonId,
  value,
  onChange,
  showStartDate = false,
}: ReadingPositionFieldsProps) {
  const theme = useTheme();
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const [chapterPickerOpen, setChapterPickerOpen] = useState(false);

  const index = getCanonIndex(canonId);
  const book = index.getBook(value.bookId);

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
          last={!showStartDate}
          testID="field-chapter"
        />
        {showStartDate ? (
          <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
            <Text variant="body" style={{ marginBottom: theme.spacing.sm }}>
              Start date
            </Text>
            <DateTimePicker
              value={fromDateKey(value.startDate)}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              accentColor={theme.colors.accent}
              themeVariant={theme.scheme}
              accessibilityLabel="Plan start date"
              onChange={(_event, selected) => {
                if (selected === undefined) return;
                onChange({ ...value, startDate: toDateKey(selected) });
              }}
            />
          </View>
        ) : null}
      </Card>

      {showStartDate ? (
        <Text variant="footnote" color="tertiary" style={{ marginTop: theme.spacing.sm }}>
          Your first reading lands on {format(fromDateKey(value.startDate), 'd MMMM yyyy')}.
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

