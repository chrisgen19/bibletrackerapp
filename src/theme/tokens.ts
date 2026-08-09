import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Centralised design tokens.
 *
 * Nothing in the app hard-codes a colour, radius, duration or type ramp; screens
 * pull from the active {@link Theme} so light and dark stay in lockstep.
 */

export type ColorSchemeName = 'light' | 'dark';

export interface ThemeColors {
  /** Page background. */
  background: string;
  /** Cards and sheets sitting on the background. */
  surface: string;
  /** Recessed fills: inactive chips, missed days, pickers. */
  surfaceSubtle: string;
  /** Pressed state for tappable surfaces. */
  surfacePressed: string;

  separator: string;
  separatorStrong: string;

  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  /** Text drawn on top of `accent`. */
  onAccent: string;

  accent: string;
  /** Low-contrast accent wash for badges and today's outline fill. */
  accentSoft: string;
  /** Mid-contrast accent, used for future scheduled hints. */
  accentMuted: string;

  /** Reserved for genuinely destructive actions — never for missed readings. */
  danger: string;
  dangerSoft: string;
}

const lightColors: ThemeColors = {
  background: '#FBFAF8',
  surface: '#FFFFFF',
  surfaceSubtle: '#F2EFEA',
  surfacePressed: '#E9E4DC',

  separator: '#E8E3DB',
  separatorStrong: '#D7D0C5',

  textPrimary: '#191714',
  textSecondary: '#6B645B',
  textTertiary: '#A69E94',
  onAccent: '#FFFFFF',

  accent: '#8C5A33',
  accentSoft: '#F3E8DC',
  accentMuted: '#C9A583',

  danger: '#A23A2E',
  dangerSoft: '#F7E5E2',
};

const darkColors: ThemeColors = {
  background: '#121110',
  surface: '#1C1A18',
  surfaceSubtle: '#26231F',
  surfacePressed: '#332F2A',

  separator: '#2C2925',
  separatorStrong: '#3B3732',

  textPrimary: '#F5F2ED',
  textSecondary: '#A69F96',
  textTertiary: '#6F6860',
  onAccent: '#1B120A',

  accent: '#E0A876',
  accentSoft: '#2E241B',
  accentMuted: '#7C5C3F',

  danger: '#E28173',
  dangerSoft: '#33211E',
};

/** 4pt base scale. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  jumbo: 56,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 28,
  full: 999,
} as const;

const fontFamily = Platform.select({ ios: 'System', default: undefined });

export const typography = {
  /** Screen titles. */
  largeTitle: {
    fontFamily,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  title: {
    fontFamily,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  /** The hero chapter reference on the Today card. */
  display: {
    fontFamily,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '600',
    letterSpacing: -0.8,
  },
  headline: {
    fontFamily,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  body: {
    fontFamily,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
  },
  callout: {
    fontFamily,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
  },
  footnote: {
    fontFamily,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  /** Section eyebrows: "TODAY'S READING". */
  overline: {
    fontFamily,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  /** Calendar day numerals. */
  calendarDay: {
    fontFamily,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
  },
  weekday: {
    fontFamily,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
} as const satisfies Record<string, TextStyle>;

export type TypographyToken = keyof typeof typography;

export interface ThemeShadows {
  card: ViewStyle;
  raised: ViewStyle;
}

function buildShadows(scheme: ColorSchemeName): ThemeShadows {
  // Shadows read as noise on dark backgrounds; separators carry elevation there.
  if (scheme === 'dark') {
    return {
      card: {},
      raised: {},
    };
  }
  return {
    card: {
      shadowColor: '#3B2E20',
      shadowOpacity: 0.05,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    raised: {
      shadowColor: '#3B2E20',
      shadowOpacity: 0.09,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
      elevation: 5,
    },
  };
}

/** Animation durations in milliseconds. */
export const duration = {
  instant: 120,
  fast: 180,
  base: 240,
  slow: 340,
} as const;

/** Reanimated spring presets — calm, never bouncy. */
export const springs = {
  gentle: { damping: 22, stiffness: 180, mass: 1 },
  press: { damping: 26, stiffness: 320, mass: 0.7 },
} as const;

/** Minimum comfortable tap area on iOS. */
export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;
export const MIN_TOUCH_TARGET = 44;

export interface Theme {
  scheme: ColorSchemeName;
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  shadows: ThemeShadows;
  duration: typeof duration;
  springs: typeof springs;
}

export function createTheme(scheme: ColorSchemeName): Theme {
  return {
    scheme,
    colors: scheme === 'dark' ? darkColors : lightColors,
    spacing,
    radius,
    typography,
    shadows: buildShadows(scheme),
    duration,
    springs,
  };
}

export const lightTheme = createTheme('light');
export const darkTheme = createTheme('dark');
