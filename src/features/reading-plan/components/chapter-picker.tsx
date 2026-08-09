import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/icon-button';
import { Text } from '@/components/text';
import { getCanonIndex } from '@/data/bible/canon-index';
import { useTheme } from '@/theme/theme-provider';

interface ChapterPickerProps {
  visible: boolean;
  canonId: string;
  bookId: string;
  selectedChapter: number;
  onSelect: (chapter: number) => void;
  onClose: () => void;
}

const COLUMNS = 5;

/** Numeric grid sized to the selected book, so an invalid chapter cannot be chosen. */
export function ChapterPicker({
  visible,
  canonId,
  bookId,
  selectedChapter,
  onSelect,
  onClose,
}: ChapterPickerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const book = getCanonIndex(canonId).getBook(bookId);
  const chapters = Array.from({ length: book?.chapterCount ?? 1 }, (_, index) => index + 1);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: theme.colors.background, paddingTop: theme.spacing.lg }]}>
        <View style={[styles.header, { paddingHorizontal: theme.spacing.xl }]}>
          <View style={{ flex: 1 }}>
            <Text variant="title" accessibilityRole="header">
              Choose a chapter
            </Text>
            <Text variant="footnote" color="secondary" style={{ marginTop: theme.spacing.xxs }}>
              {book?.name ?? bookId}
            </Text>
          </View>
          <IconButton name="xmark" accessibilityLabel="Close chapter picker" onPress={onClose} />
        </View>

        <FlatList
          data={chapters}
          numColumns={COLUMNS}
          keyExtractor={(chapter) => String(chapter)}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.xl,
            paddingTop: theme.spacing.lg,
            paddingBottom: insets.bottom + theme.spacing.xxl,
          }}
          columnWrapperStyle={{ gap: theme.spacing.sm }}
          renderItem={({ item }) => {
            const selected = item === selectedChapter;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Chapter ${item}`}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.chapter,
                  {
                    marginBottom: theme.spacing.sm,
                    borderRadius: theme.radius.md,
                    backgroundColor: selected
                      ? theme.colors.accent
                      : pressed
                        ? theme.colors.surfacePressed
                        : theme.colors.surfaceSubtle,
                  },
                ]}
              >
                <Text variant="body" color={selected ? 'onAccent' : 'primary'} maxFontSizeMultiplier={1.4}>
                  {item}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  chapter: { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center' },
});
