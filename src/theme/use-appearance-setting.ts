import { useCallback, useEffect } from 'react';

import { useDatabase } from '@/db/database-provider';
import {
  getAppearancePreference,
  setAppearancePreference,
  type AppearancePreference,
} from '@/db/settings-repository';
import { settingChangedHaptic } from '@/utils/haptics';

import { useAppearance } from './theme-provider';

/**
 * Bridges the stored appearance preference into the theme.
 *
 * The theme provider itself stays database-free so it can render loading and
 * failure screens; this hook hydrates it once SQLite is available.
 */
export function useAppearanceSetting() {
  const db = useDatabase();
  const { preference, scheme, setPreference } = useAppearance();

  useEffect(() => {
    setPreference(getAppearancePreference(db));
  }, [db, setPreference]);

  const setAppearance = useCallback(
    (next: AppearancePreference) => {
      setAppearancePreference(db, next);
      setPreference(next);
      settingChangedHaptic();
    },
    [db, setPreference],
  );

  return { preference, scheme, setAppearance };
}
