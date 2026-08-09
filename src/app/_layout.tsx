import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DatabaseProvider } from '@/db/database-provider';
import { ReadingDataProvider } from '@/features/reading-plan/hooks/reading-data-provider';
import { useNotificationResponseRouting } from '@/features/reminders/hooks/use-notification-routing';
import { ThemeProvider, useTheme } from '@/theme/theme-provider';
import { useAppearanceSetting } from '@/theme/use-appearance-setting';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <SafeAreaProvider>
          <DatabaseProvider>
            <ReadingDataProvider>
              <AppNavigator />
            </ReadingDataProvider>
          </DatabaseProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Lives inside the providers so it can hydrate the stored appearance preference
 * and theme the native navigation chrome.
 */
function AppNavigator() {
  const theme = useTheme();
  useAppearanceSetting();
  useNotificationResponseRouting();

  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: { color: theme.colors.textPrimary },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="settings" options={{ headerShown: true, title: 'Settings' }} />
        <Stack.Screen
          name="reading-plan"
          options={{ headerShown: true, title: 'Reading Plan', presentation: 'card' }}
        />
        <Stack.Screen
          name="day/[date]"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: 'fitToContents',
            sheetGrabberVisible: true,
            sheetCornerRadius: 28,
            headerShown: false,
          }}
        />
      </Stack>
    </>
  );
}
