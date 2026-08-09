import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Local daily reminders. No push service, no remote token, nothing leaves the device.
 */

export const DAILY_REMINDER_IDENTIFIER = 'daily-reading-reminder';
const ANDROID_CHANNEL_ID = 'daily-reading';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type PermissionOutcome = 'granted' | 'denied';

/** Parses `HH:mm`. Returns `null` rather than throwing on a corrupt stored value. */
export function parseReminderTime(time: string): { hour: number; minute: number } | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (match === null) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return Number.isNaN(hour) || Number.isNaN(minute) ? null : { hour, minute };
}

export function formatReminderTime(time: string): string {
  const parsed = parseReminderTime(time);
  if (parsed === null) return time;
  const date = new Date();
  date.setHours(parsed.hour, parsed.minute, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Daily reading',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function requestReminderPermission(): Promise<PermissionOutcome> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return 'granted';
  if (!current.canAskAgain) return 'denied';

  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted' ? 'granted' : 'denied';
}

export async function cancelDailyReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_IDENTIFIER);
  } catch {
    // Nothing scheduled under that identifier — already in the desired state.
  }
}

/**
 * Replaces any existing reminder with one that repeats daily at `time`.
 *
 * Returns `false` when the time cannot be parsed so the caller can leave the
 * toggle off rather than silently pretending it succeeded.
 */
export async function scheduleDailyReminder(time: string): Promise<boolean> {
  const parsed = parseReminderTime(time);
  if (parsed === null) return false;

  await ensureAndroidChannel();
  await cancelDailyReminder();

  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_REMINDER_IDENTIFIER,
    content: {
      title: 'Time to read',
      body: 'Your chapter for today is ready.',
      sound: false,
      data: { target: 'today' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: parsed.hour,
      minute: parsed.minute,
      ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
  });

  return true;
}
