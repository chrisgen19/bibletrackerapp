import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { FieldRow } from '@/components/field-row';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { SegmentedControl, type SegmentOption } from '@/components/segmented-control';
import { Text } from '@/components/text';
import type { AppearancePreference } from '@/db/settings-repository';
import { formatReference } from '@/features/reading-plan/domain/reference';
import { useReadingData } from '@/features/reading-plan/hooks/reading-data-provider';
import { useReminderSettings } from '@/features/reminders/hooks/use-reminder-settings';
import { formatReminderTime, parseReminderTime } from '@/features/reminders/notifications';
import { useTheme } from '@/theme/theme-provider';
import { MIN_TOUCH_TARGET } from '@/theme/tokens';
import { useAppearanceSetting } from '@/theme/use-appearance-setting';

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { activePlan, resetProgress, completions } = useReadingData();
  const { preference, setAppearance } = useAppearanceSetting();
  const reminder = useReminderSettings();
  const [timePickerOpen, setTimePickerOpen] = useState(Platform.OS === 'ios');

  const handleReset = useCallback(() => {
    Alert.alert(
      'Reset progress?',
      'This permanently deletes your reading plan and every completed day on this device. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: () => {
            resetProgress();
            router.replace('/');
          },
        },
      ],
    );
  }, [resetProgress, router]);

  const startReference =
    activePlan === null
      ? 'No plan yet'
      : formatReference({ bookId: activePlan.startBookId, chapter: activePlan.startChapter });

  return (
    <Screen scroll edges={['bottom']} contentContainerStyle={{ padding: theme.spacing.xl }}>
      <SectionHeader title="Reading Plan" />
      <Card padded={false}>
        <FieldRow
          label="Current position"
          value={startReference}
          onPress={() => router.push('/reading-plan')}
          last
          testID="settings-reading-plan"
        />
      </Card>
      <Text variant="footnote" color="tertiary" style={{ marginTop: theme.spacing.sm }}>
        Changing where you are starts a new stretch of your plan from today. Every day you have already
        completed stays exactly as it is.
      </Text>

      <View style={{ marginTop: theme.spacing.xxl }}>
        <SectionHeader title="Daily Reminder" />
        <Card padded={false}>
          <View style={[styles.switchRow, { paddingHorizontal: theme.spacing.lg }]}>
            <Text variant="body" style={{ flex: 1 }}>
              Daily reminder
            </Text>
            <Switch
              value={reminder.settings.enabled}
              disabled={reminder.busy}
              onValueChange={(next) => {
                void reminder.setEnabled(next);
              }}
              trackColor={{ true: theme.colors.accent, false: theme.colors.separatorStrong }}
              accessibilityLabel="Daily reminder"
              accessibilityHint="Sends a local notification at your chosen time"
              testID="reminder-switch"
            />
          </View>

          {reminder.settings.enabled ? (
            Platform.OS === 'ios' ? (
              <View
                style={[
                  styles.timeRow,
                  { paddingHorizontal: theme.spacing.lg, borderTopColor: theme.colors.separator },
                ]}
              >
                <Text variant="body" style={{ flex: 1 }}>
                  Time
                </Text>
                <ReminderTimePicker
                  time={reminder.settings.time}
                  onChange={(next) => {
                    void reminder.setTime(next);
                  }}
                />
              </View>
            ) : (
              <>
                <FieldRow
                  label="Time"
                  value={formatReminderTime(reminder.settings.time)}
                  onPress={() => setTimePickerOpen(true)}
                  last
                />
                {timePickerOpen ? (
                  <ReminderTimePicker
                    time={reminder.settings.time}
                    onChange={(next) => {
                      setTimePickerOpen(false);
                      void reminder.setTime(next);
                    }}
                  />
                ) : null}
              </>
            )
          ) : null}
        </Card>

        {reminder.error === 'permission-denied' ? (
          <Text variant="footnote" color="secondary" style={{ marginTop: theme.spacing.sm }}>
            Notifications are turned off for Chapter. You can enable them in your device Settings, then
            switch the reminder back on here.
          </Text>
        ) : reminder.error === 'schedule-failed' ? (
          <Text variant="footnote" color="secondary" style={{ marginTop: theme.spacing.sm }}>
            We couldn&apos;t set that reminder. Try choosing the time again.
          </Text>
        ) : (
          <Text variant="footnote" color="tertiary" style={{ marginTop: theme.spacing.sm }}>
            Reminders are scheduled on this device only.
          </Text>
        )}
      </View>

      <View style={{ marginTop: theme.spacing.xxl }}>
        <SectionHeader title="Appearance" />
        <AppearanceSelector value={preference} onChange={setAppearance} />
      </View>

      <View style={{ marginTop: theme.spacing.xxl }}>
        <SectionHeader title="Reset Progress" />
        <Button
          label="Reset Progress"
          variant="destructive"
          onPress={handleReset}
          accessibilityHint="Deletes your plan and all completed readings"
          testID="reset-progress"
        />
        <Text variant="footnote" color="tertiary" style={{ marginTop: theme.spacing.sm }}>
          {completions.length === 0
            ? 'You have no completed readings yet.'
            : `This will remove ${completions.length} completed ${
                completions.length === 1 ? 'chapter' : 'chapters'
              }.`}
        </Text>
      </View>
    </Screen>
  );
}

function ReminderTimePicker({ time, onChange }: { time: string; onChange: (time: string) => void }) {
  const theme = useTheme();
  const parsed = parseReminderTime(time) ?? { hour: 7, minute: 0 };
  const value = new Date();
  value.setHours(parsed.hour, parsed.minute, 0, 0);

  return (
    <DateTimePicker
      value={value}
      mode="time"
      display={Platform.OS === 'ios' ? 'compact' : 'default'}
      accentColor={theme.colors.accent}
      themeVariant={theme.scheme}
      accessibilityLabel="Reminder time"
      onChange={(_event, selected) => {
        if (selected === undefined) return;
        const hours = String(selected.getHours()).padStart(2, '0');
        const minutes = String(selected.getMinutes()).padStart(2, '0');
        onChange(`${hours}:${minutes}`);
      }}
    />
  );
}

const APPEARANCE_OPTIONS: readonly SegmentOption<AppearancePreference>[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

function AppearanceSelector({
  value,
  onChange,
}: {
  value: AppearancePreference;
  onChange: (next: AppearancePreference) => void;
}) {
  return (
    <SegmentedControl
      options={APPEARANCE_OPTIONS}
      value={value}
      onChange={onChange}
      accessibilityLabel="Appearance"
      testIDPrefix="appearance"
    />
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TOUCH_TARGET + 6 },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH_TARGET + 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
