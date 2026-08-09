import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { SelectionCard } from '@/features/reading-plan/components/selection-card';
import type { StartMode } from '@/features/reading-plan/domain/types';
import { useOnboarding } from '@/features/reading-plan/hooks/onboarding-context';
import { useTheme } from '@/theme/theme-provider';

const OPTIONS: readonly {
  mode: StartMode;
  title: string;
  description: string;
  icon: 'book.closed' | 'flame' | 'calendar';
}[] = [
  {
    mode: 'genesis',
    title: 'Start from Genesis',
    description: 'Begin at Genesis 1 today and read straight through.',
    icon: 'book.closed',
  },
  {
    mode: 'choose',
    title: 'Choose where to start',
    description: "Pick the chapter you're up to. It becomes today's reading.",
    icon: 'flame',
  },
];

export default function StartModeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { mode, setMode } = useOnboarding();

  const handleContinue = () => {
    router.push(mode === 'genesis' ? '/onboarding/confirm' : '/onboarding/position');
  };

  return (
    <Screen scroll edges={['bottom']} contentContainerStyle={{ paddingHorizontal: theme.spacing.xl }}>
      <Text variant="largeTitle" accessibilityRole="header" style={{ marginTop: theme.spacing.sm }}>
        Where would you like to begin?
      </Text>
      <Text variant="body" color="secondary" style={{ marginTop: theme.spacing.md }}>
        You can change this later without losing any progress.
      </Text>

      <View
        accessibilityRole="radiogroup"
        style={{ marginTop: theme.spacing.xxl, gap: theme.spacing.md }}
      >
        {OPTIONS.map((option) => (
          <SelectionCard
            key={option.mode}
            title={option.title}
            description={option.description}
            icon={option.icon}
            selected={mode === option.mode}
            onPress={() => setMode(option.mode)}
            testID={`start-mode-${option.mode}`}
          />
        ))}
      </View>

      <Button
        label="Continue"
        onPress={handleContinue}
        style={{ marginTop: theme.spacing.xxxl }}
        testID="start-continue"
      />
    </Screen>
  );
}
