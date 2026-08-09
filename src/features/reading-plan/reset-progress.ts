import { Alert } from 'react-native';

export interface ResetProgressActions {
  /** Deletes every plan and completion. */
  readonly resetProgress: () => void;
  /**
   * Turns the daily reminder off. Without this it keeps firing for a plan that no
   * longer exists, and tapping it opens a day with nothing to read.
   */
  readonly disableReminder: () => void;
  /** Runs after a confirmed reset, to send the user back to onboarding. */
  readonly onComplete: () => void;
}

export function describeResetImpact(completionCount: number): string {
  if (completionCount === 0) return 'You have no completed readings yet.';
  const noun = completionCount === 1 ? 'chapter' : 'chapters';
  return `This will remove ${completionCount} completed ${noun}.`;
}

/**
 * Presents the destructive confirmation for Reset Progress.
 *
 * Extracted from the settings screen so the wiring is testable: nothing may run
 * unless the user explicitly confirms, and confirming must also silence the
 * reminder. This is the only irreversible action in the app, so the ordering of
 * the buttons and what each one triggers is worth pinning down.
 */
export function confirmResetProgress(actions: ResetProgressActions): void {
  Alert.alert(
    'Reset progress?',
    'This permanently deletes your reading plan and every completed day on this device. It cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset Everything',
        style: 'destructive',
        onPress: () => {
          actions.resetProgress();
          actions.disableReminder();
          actions.onComplete();
        },
      },
    ],
  );
}
