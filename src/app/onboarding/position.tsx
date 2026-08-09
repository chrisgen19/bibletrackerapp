import { useRouter } from 'expo-router';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { ReadingPositionFields } from '@/features/reading-plan/components/reading-position-fields';
import { useOnboarding } from '@/features/reading-plan/hooks/onboarding-context';
import { useTheme } from '@/theme/theme-provider';

export default function PositionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { mode, canonId, bookId, chapter, startDate, setPosition } = useOnboarding();

  const isCustom = mode === 'custom';

  return (
    <Screen scroll edges={['bottom']} contentContainerStyle={{ paddingHorizontal: theme.spacing.xl }}>
      <Text variant="largeTitle" accessibilityRole="header" style={{ marginTop: theme.spacing.sm }}>
        {isCustom ? 'Set your starting point' : 'Where are you up to?'}
      </Text>
      <Text variant="body" color="secondary" style={{ marginTop: theme.spacing.md }}>
        {isCustom
          ? 'Choose the day your plan begins and the chapter it begins with.'
          : 'The chapter you choose becomes your reading for today.'}
      </Text>

      <ReadingPositionFields
        canonId={canonId}
        value={{ bookId, chapter, startDate }}
        onChange={setPosition}
        showStartDate={isCustom}
      />

      <Button
        label="Continue"
        onPress={() => router.push('/onboarding/confirm')}
        style={{ marginTop: theme.spacing.xxl }}
        testID="position-continue"
      />
    </Screen>
  );
}
