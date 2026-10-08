import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Platform, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/theme/theme-provider';

/** The SF Symbols the app uses, with vector fallbacks for non-Apple platforms. */
export type IconName =
  | 'chevron.left'
  | 'chevron.right'
  | 'checkmark'
  | 'gearshape'
  | 'xmark'
  | 'book.closed'
  | 'flame'
  | 'calendar'
  | 'bell'
  | 'arrow.counterclockwise';

/** Stroke paths on a 24×24 canvas, mirroring the SF Symbol silhouettes. */
const FALLBACK_PATHS: Record<IconName, string> = {
  'chevron.left': 'M15 5 L8 12 L15 19',
  'chevron.right': 'M9 5 L16 12 L9 19',
  checkmark: 'M5 13 L10 18 L19 6',
  gearshape:
    'M12 15.5 A3.5 3.5 0 1 0 12 8.5 A3.5 3.5 0 1 0 12 15.5 M12 2.5 v2 M12 19.5 v2 M2.5 12 h2 M19.5 12 h2 M5.2 5.2 l1.5 1.5 M17.3 17.3 l1.5 1.5 M18.8 5.2 l-1.5 1.5 M6.7 17.3 l-1.5 1.5',
  xmark: 'M6 6 L18 18 M18 6 L6 18',
  'book.closed': 'M6 3.5 h11 a1.5 1.5 0 0 1 1.5 1.5 v14 a1.5 1.5 0 0 1 -1.5 1.5 h-11 a1.5 1.5 0 0 1 0 -3 h11',
  flame: 'M12 22 C8.5 22 6 19.4 6 16 C6 11.5 12 9.5 11 2 C15 5 18 9 18 16 C18 19.4 15.5 22 12 22',
  calendar:
    'M4.5 7.5 h15 M7 4 v3 M17 4 v3 M5.5 5.5 h13 a1 1 0 0 1 1 1 v13 a1 1 0 0 1 -1 1 h-13 a1 1 0 0 1 -1 -1 v-13 a1 1 0 0 1 1 -1',
  bell: 'M6.5 17.5 v-6 a5.5 5.5 0 0 1 11 0 v6 M4.5 17.5 h15 M10 20.5 a2.2 2.2 0 0 0 4 0',
  'arrow.counterclockwise': 'M5 12 a7 7 0 1 0 2.05 -4.95 M4.5 3.5 v4 h4',
};

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  weight?: SymbolViewProps['weight'];
  accessibilityLabel?: string;
}

export function Icon({ name, size = 20, color, weight = 'semibold', accessibilityLabel }: IconProps) {
  const theme = useTheme();
  const tint = color ?? theme.colors.textPrimary;
  const isDecorative = accessibilityLabel === undefined;

  if (Platform.OS === 'ios') {
    return (
      <SymbolView
        name={name}
        size={size}
        tintColor={tint}
        weight={weight}
        resizeMode="scaleAspectFit"
        accessibilityElementsHidden={isDecorative}
        importantForAccessibility={isDecorative ? 'no-hide-descendants' : 'yes'}
        accessibilityLabel={accessibilityLabel}
      />
    );
  }

  return (
    <View
      accessibilityElementsHidden={isDecorative}
      importantForAccessibility={isDecorative ? 'no-hide-descendants' : 'yes'}
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d={FALLBACK_PATHS[name]}
          stroke={tint}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}
