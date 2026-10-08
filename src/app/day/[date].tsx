import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { DayDetail } from '@/features/progress/components/day-detail';
import { useDayDetail } from '@/features/progress/hooks/use-day-detail';
import { useReadingData } from '@/features/reading-plan/hooks/reading-data-provider';
import { useTheme } from '@/theme/theme-provider';

export default function DayDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { date, book, chapter } = useLocalSearchParams<{
    date: string;
    book?: string;
    chapter?: string;
  }>();
  const { plans } = useReadingData();
  const detail = useDayDetail(date, book, chapter);

  const padding = {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xxl,
    paddingBottom: Math.max(insets.bottom, theme.spacing.xl) + theme.spacing.sm,
  };

  // Without any plan there is nothing to attach a completion to. Mirror the main
  // screen and send the user to onboarding rather than showing a sheet whose
  // actions cannot persist — reachable via a reminder that outlived a reset.
  if (plans.length === 0) {
    return <Redirect href="/onboarding" />;
  }

  if (detail === null) {
    return (
      <View style={[{ backgroundColor: theme.colors.surface }, padding]}>
        <EmptyState
          icon="calendar"
          title="That day isn't available"
          description="We couldn't find a reading for that date."
          action={{ label: 'Close', onPress: () => router.back() }}
          compact
        />
      </View>
    );
  }

  return (
    <View style={[{ backgroundColor: theme.colors.surface }, padding]}>
      <DayDetail {...detail} />
    </View>
  );
}
