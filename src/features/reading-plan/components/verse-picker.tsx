import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/icon-button';
import { Text } from '@/components/text';
import { useTheme } from '@/theme/theme-provider';

interface VersePickerProps {
  visible: boolean;
  /** Label for the chapter being read, e.g. "Genesis 1". */
  chapterLabel: string;
  /** The first verse not yet read. Selection starts here. */
  fromVerse: number;
  verseCount: number;
  /** Currently chosen end verse, so it can be shown as selected. */
  selectedTo: number;
  onSelect: (toVerse: number) => void;
  onClose: () => void;
}

const COLUMNS = 5;

/**
 * "I read up to verse N."
 *
 * Deliberately not a from/to pair. The start is derived from what has already been
 * read, so finishing a chapter tomorrow is one tap on the last verse rather than two
 * selections. Arbitrary spans remain representable in storage; this is just the path
 * that matches how people actually read.
 */
export function VersePicker({
  visible,
  chapterLabel,
  fromVerse,
  verseCount,
  selectedTo,
  onSelect,
  onClose,
}: VersePickerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const verses = Array.from({ length: Math.max(0, verseCount - fromVerse + 1) }, (_, i) => fromVerse + i);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: theme.colors.background, paddingTop: theme.spacing.lg }]}>
        <View style={[styles.header, { paddingHorizontal: theme.spacing.xl }]}>
          <View style={{ flex: 1 }}>
            <Text variant="title" accessibilityRole="header">
              How far did you read?
            </Text>
            <Text variant="footnote" color="secondary" style={{ marginTop: theme.spacing.xxs }}>
              {fromVerse === 1
                ? `${chapterLabel} · ${verseCount} verses`
                : `${chapterLabel} · continuing from verse ${fromVerse}`}
            </Text>
          </View>
          <IconButton name="xmark" accessibilityLabel="Close verse picker" onPress={onClose} />
        </View>

        <FlatList
          data={verses}
          numColumns={COLUMNS}
          keyExtractor={(verse) => String(verse)}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.xl,
            paddingTop: theme.spacing.lg,
            paddingBottom: insets.bottom + theme.spacing.xxl,
          }}
          columnWrapperStyle={{ gap: theme.spacing.sm }}
          renderItem={({ item }) => {
            const selected = item === selectedTo;
            const isLast = item === verseCount;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={
                  isLast ? `To verse ${item}, finishes the chapter` : `To verse ${item}`
                }
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.verse,
                  {
                    marginBottom: theme.spacing.sm,
                    borderRadius: theme.radius.md,
                    backgroundColor: selected
                      ? theme.colors.accent
                      : pressed
                        ? theme.colors.surfacePressed
                        : theme.colors.surfaceSubtle,
                    // The last verse finishes the chapter, so it gets a hint of the accent.
                    borderWidth: !selected && isLast ? 1 : 0,
                    borderColor: theme.colors.accentMuted,
                  },
                ]}
              >
                <Text
                  variant="body"
                  color={selected ? 'onAccent' : 'primary'}
                  maxFontSizeMultiplier={1.4}
                >
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
  verse: { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center' },
});
