import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptics are reserved for moments that matter: completing a reading and toggling
 * a meaningful setting. Navigation and calendar taps stay silent on purpose.
 */

const SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';

function ignoreFailure(): void {
  // A device with haptics disabled or unavailable must never break the interaction.
}

export function completionHaptic(): void {
  if (!SUPPORTED) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignoreFailure);
}

export function undoHaptic(): void {
  if (!SUPPORTED) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(ignoreFailure);
}

export function settingChangedHaptic(): void {
  if (!SUPPORTED) return;
  Haptics.selectionAsync().catch(ignoreFailure);
}
