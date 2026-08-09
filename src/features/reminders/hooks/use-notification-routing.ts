import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { getTodayDateKey } from '@/utils/date-key';

/**
 * Opens today's reading when the user taps the daily reminder.
 *
 * The identifier of the handled response is remembered so a re-render — or a warm
 * start that replays the last response — cannot push the sheet twice.
 */
export function useNotificationResponseRouting(): void {
  const router = useRouter();
  const response = Notifications.useLastNotificationResponse();
  const handledId = useRef<string | null>(null);

  useEffect(() => {
    if (response === null || response === undefined) return;

    const id = response.notification.request.identifier;
    if (handledId.current === id) return;
    handledId.current = id;

    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;

    router.navigate(`/day/${getTodayDateKey()}`);
  }, [response, router]);
}
