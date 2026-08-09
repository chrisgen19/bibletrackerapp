import { useCallback, useState } from 'react';

import { useDatabase } from '@/db/database-provider';
import {
  getReminderSettings,
  setReminderSettings,
  type ReminderSettings,
} from '@/db/settings-repository';
import { settingChangedHaptic } from '@/utils/haptics';

import { cancelDailyReminder, requestReminderPermission, scheduleDailyReminder } from '../notifications';

export type ReminderError = 'permission-denied' | 'schedule-failed' | null;

/**
 * Keeps the stored reminder preference and the OS notification schedule in step.
 *
 * The preference is only persisted once scheduling actually succeeds, so a denied
 * permission leaves the toggle visibly off instead of lying to the user.
 */
export function useReminderSettings() {
  const db = useDatabase();
  const [settings, setSettings] = useState<ReminderSettings>(() => getReminderSettings(db));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReminderError>(null);

  const persist = useCallback(
    (next: ReminderSettings) => {
      setReminderSettings(db, next);
      setSettings(next);
    },
    [db],
  );

  const setEnabled = useCallback(
    async (enabled: boolean) => {
      setBusy(true);
      setError(null);
      try {
        if (!enabled) {
          await cancelDailyReminder();
          persist({ ...settings, enabled: false });
          settingChangedHaptic();
          return;
        }

        const permission = await requestReminderPermission();
        if (permission === 'denied') {
          setError('permission-denied');
          persist({ ...settings, enabled: false });
          return;
        }

        const scheduled = await scheduleDailyReminder(settings.time);
        if (!scheduled) {
          setError('schedule-failed');
          return;
        }

        persist({ ...settings, enabled: true });
        settingChangedHaptic();
      } finally {
        setBusy(false);
      }
    },
    [persist, settings],
  );

  const setTime = useCallback(
    async (time: string) => {
      setBusy(true);
      setError(null);
      try {
        if (settings.enabled) {
          const scheduled = await scheduleDailyReminder(time);
          if (!scheduled) {
            setError('schedule-failed');
            return;
          }
        }
        persist({ ...settings, time });
      } finally {
        setBusy(false);
      }
    },
    [persist, settings],
  );

  return { settings, busy, error, setEnabled, setTime };
}
