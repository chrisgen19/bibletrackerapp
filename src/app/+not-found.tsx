import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <EmptyState
          icon="calendar"
          title="This page doesn't exist"
          description="The link you followed doesn't lead anywhere in Chapter."
          action={{ label: 'Go to your reading', onPress: () => router.replace('/') }}
        />
      </View>
    </Screen>
  );
}
