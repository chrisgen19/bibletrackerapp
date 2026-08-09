import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/icon-button';
import { Text } from '@/components/text';
import type { BibleBook } from '@/data/bible/canon';
import { getCanonIndex } from '@/data/bible/canon-index';
import { useTheme } from '@/theme/theme-provider';
import { MIN_TOUCH_TARGET } from '@/theme/tokens';

interface BookPickerProps {
  visible: boolean;
  canonId: string;
  selectedBookId: string;
  onSelect: (book: BibleBook) => void;
  onClose: () => void;
}

function matches(book: BibleBook, query: string): boolean {
  if (query === '') return true;
  const needle = query.trim().toLowerCase();
  return (
    book.name.toLowerCase().includes(needle) || book.abbreviation.toLowerCase().includes(needle)
  );
}

const TESTAMENT_LABEL = { old: 'Old Testament', new: 'New Testament' } as const;

/** Searchable, full-height book list. Grouped by testament when no query is active. */
export function BookPicker({ visible, canonId, selectedBookId, onSelect, onClose }: BookPickerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const books = getCanonIndex(canonId).books;
  const results = useMemo(() => books.filter((book) => matches(book, query)), [books, query]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: theme.colors.background, paddingTop: theme.spacing.lg }]}>
        <View style={[styles.header, { paddingHorizontal: theme.spacing.xl }]}>
          <Text variant="title" accessibilityRole="header">
            Choose a book
          </Text>
          <IconButton name="xmark" accessibilityLabel="Close book picker" onPress={onClose} />
        </View>

        <View style={{ paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.md }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search books"
            placeholderTextColor={theme.colors.textTertiary}
            autoCorrect={false}
            clearButtonMode="while-editing"
            accessibilityLabel="Search books"
            style={[
              theme.typography.body,
              {
                color: theme.colors.textPrimary,
                backgroundColor: theme.colors.surfaceSubtle,
                borderRadius: theme.radius.md,
                paddingHorizontal: theme.spacing.lg,
                height: MIN_TOUCH_TARGET,
              },
            ]}
          />
        </View>

        <FlatList
          data={results}
          keyExtractor={(book) => book.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.xl,
            paddingBottom: insets.bottom + theme.spacing.xxl,
          }}
          ListEmptyComponent={
            <Text variant="callout" color="secondary" align="center" style={{ paddingVertical: 32 }}>
              No books match “{query}”.
            </Text>
          }
          renderItem={({ item, index }) => {
            const previous = results[index - 1];
            const showSection = query === '' && (previous === undefined || previous.testament !== item.testament);
            return (
              <View>
                {showSection ? (
                  <Text
                    variant="overline"
                    color="tertiary"
                    style={{ marginTop: index === 0 ? 0 : theme.spacing.xl, marginBottom: theme.spacing.sm }}
                  >
                    {TESTAMENT_LABEL[item.testament].toUpperCase()}
                  </Text>
                ) : null}
                <BookRow
                  book={item}
                  selected={item.id === selectedBookId}
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                />
              </View>
            );
          }}
        />
      </View>
    </Modal>
  );
}

function BookRow({
  book,
  selected,
  onPress,
}: {
  book: BibleBook;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${book.name}, ${book.chapterCount} chapters`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? theme.colors.surfacePressed : 'transparent',
          borderRadius: theme.radius.sm,
          paddingHorizontal: theme.spacing.md,
        },
      ]}
    >
      <Text variant="body" color={selected ? 'accent' : 'primary'} style={{ flex: 1 }}>
        {book.name}
      </Text>
      <Text variant="footnote" color="tertiary">
        {book.chapterCount}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TOUCH_TARGET },
});
