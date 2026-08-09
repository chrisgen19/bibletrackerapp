import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useTheme } from '@/theme/theme-provider';

export default function WelcomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  const entering = (delay: number) =>
    reducedMotion ? undefined : FadeInDown.duration(theme.duration.slow).delay(delay);

  return (
    <Screen style={{ paddingHorizontal: theme.spacing.xl }}>
      <View style={styles.body}>
        <Animated.View entering={entering(0)}>
          <View
            style={[
              styles.mark,
              { backgroundColor: theme.colors.accentSoft, borderRadius: theme.radius.xl },
            ]}
          >
            <Icon name="book.closed" size={26} color={theme.colors.accent} />
          </View>
        </Animated.View>

        <Animated.View entering={entering(80)}>
          <Text
            variant="largeTitle"
            style={{ marginTop: theme.spacing.xxl }}
            accessibilityRole="header"
          >
            Build a daily rhythm of Scripture.
          </Text>
        </Animated.View>

        <Animated.View entering={entering(160)}>
          <Text variant="body" color="secondary" style={{ marginTop: theme.spacing.lg }}>
            One chapter a day, tracked on a calendar you actually want to look at. Everything stays on
            your device — no account, no sign-in, works offline.
          </Text>
        </Animated.View>
      </View>

      <Animated.View entering={entering(240)} style={{ paddingBottom: theme.spacing.lg }}>
        <Button label="Get Started" onPress={() => router.push('/onboarding/start')} testID="get-started" />
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center' },
  mark: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
});
