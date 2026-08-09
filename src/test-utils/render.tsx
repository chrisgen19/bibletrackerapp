import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { AppearancePreference } from '@/db/settings-repository';
import { ThemeProvider } from '@/theme/theme-provider';

const INSET_FRAME = { x: 0, y: 0, width: 390, height: 844 };
const INSETS = { top: 47, left: 0, right: 0, bottom: 34 };

interface RenderWithThemeOptions {
  appearance?: AppearancePreference;
}

/**
 * Renders a component inside the providers every screen relies on.
 *
 * `render` is asynchronous in React Native Testing Library 14, so call sites must
 * await this helper before querying.
 */
export function renderWithTheme(ui: ReactElement, { appearance = 'light' }: RenderWithThemeOptions = {}) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SafeAreaProvider initialMetrics={{ frame: INSET_FRAME, insets: INSETS }}>
        <ThemeProvider initialPreference={appearance}>{children}</ThemeProvider>
      </SafeAreaProvider>
    );
  }

  return render(ui, { wrapper: Wrapper });
}

export * from '@testing-library/react-native';
