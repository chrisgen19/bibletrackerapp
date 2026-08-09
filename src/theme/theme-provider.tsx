import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import type { AppearancePreference } from '@/db/settings-repository';

import { createTheme, type ColorSchemeName, type Theme } from './tokens';

interface ThemeContextValue {
  theme: Theme;
  /** What the user chose, which may be `system`. */
  preference: AppearancePreference;
  /** What is actually being rendered right now. */
  scheme: ColorSchemeName;
  setPreference: (preference: AppearancePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
  /** Test seam; production callers let the stored preference hydrate after the database opens. */
  initialPreference?: AppearancePreference;
}

/**
 * Owns appearance state only.
 *
 * It deliberately knows nothing about SQLite so that database loading and failure
 * screens are already themed before any query has run. Persistence is layered on
 * top by `useAppearanceSetting`.
 */
export function ThemeProvider({ children, initialPreference = 'system' }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<AppearancePreference>(initialPreference);

  const value = useMemo<ThemeContextValue>(() => {
    const scheme: ColorSchemeName =
      preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
    return { theme: createTheme(scheme), preference, scheme, setPreference };
  }, [preference, systemScheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useThemeContext(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (value === null) {
    throw new Error('useTheme must be used inside a ThemeProvider.');
  }
  return value;
}

export function useTheme(): Theme {
  return useThemeContext().theme;
}

export function useAppearance(): Pick<ThemeContextValue, 'preference' | 'scheme' | 'setPreference'> {
  const { preference, scheme, setPreference } = useThemeContext();
  return { preference, scheme, setPreference };
}
