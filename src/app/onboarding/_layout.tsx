import { Stack } from 'expo-router';

import { OnboardingProvider } from '@/features/reading-plan/hooks/onboarding-context';
import { useTheme } from '@/theme/theme-provider';

export default function OnboardingLayout() {
  const theme = useTheme();

  return (
    <OnboardingProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.accent,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="start" options={{ headerShown: true, title: '' }} />
        <Stack.Screen name="position" options={{ headerShown: true, title: '' }} />
        <Stack.Screen name="confirm" options={{ headerShown: true, title: '' }} />
      </Stack>
    </OnboardingProvider>
  );
}
