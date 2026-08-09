import { Alert } from 'react-native';

import { confirmResetProgress, describeResetImpact } from '../reset-progress';

interface AlertButton {
  text: string;
  style?: string;
  onPress?: () => void;
}

function lastAlert() {
  const spy = Alert.alert as jest.Mock;
  const [title, message, buttons] = spy.mock.calls.at(-1) ?? [];
  return { title, message, buttons: (buttons ?? []) as AlertButton[] };
}

function makeActions() {
  return {
    resetProgress: jest.fn(),
    disableReminder: jest.fn(),
    onComplete: jest.fn(),
  };
}

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('confirmResetProgress', () => {
  it('asks before doing anything', () => {
    const actions = makeActions();
    confirmResetProgress(actions);

    expect(Alert.alert).toHaveBeenCalledTimes(1);
    // Nothing may happen on the strength of tapping the button alone.
    expect(actions.resetProgress).not.toHaveBeenCalled();
    expect(actions.disableReminder).not.toHaveBeenCalled();
    expect(actions.onComplete).not.toHaveBeenCalled();
  });

  it('warns that the action is permanent', () => {
    confirmResetProgress(makeActions());
    const { title, message } = lastAlert();

    expect(title).toBe('Reset progress?');
    expect(message).toMatch(/permanently deletes/i);
    expect(message).toMatch(/cannot be undone/i);
  });

  it('offers Cancel first, and marks the destructive choice as such', () => {
    confirmResetProgress(makeActions());
    const { buttons } = lastAlert();

    expect(buttons).toHaveLength(2);
    // Order matters: the safe option must not be the one under the thumb.
    expect(buttons[0]?.text).toBe('Cancel');
    expect(buttons[0]?.style).toBe('cancel');
    expect(buttons[1]?.text).toBe('Reset Everything');
    expect(buttons[1]?.style).toBe('destructive');
  });

  it('does nothing at all when cancelled', () => {
    const actions = makeActions();
    confirmResetProgress(actions);

    const { buttons } = lastAlert();
    buttons[0]?.onPress?.();

    expect(actions.resetProgress).not.toHaveBeenCalled();
    expect(actions.disableReminder).not.toHaveBeenCalled();
    expect(actions.onComplete).not.toHaveBeenCalled();
  });

  it('resets, silences the reminder and moves on when confirmed', () => {
    const actions = makeActions();
    confirmResetProgress(actions);

    const { buttons } = lastAlert();
    buttons[1]?.onPress?.();

    expect(actions.resetProgress).toHaveBeenCalledTimes(1);
    expect(actions.disableReminder).toHaveBeenCalledTimes(1);
    expect(actions.onComplete).toHaveBeenCalledTimes(1);
  });

  it('cancels the reminder, not just the data', () => {
    // Regression: a reminder left scheduled fires for a plan that no longer
    // exists, and tapping it lands on a day with nothing to read.
    const actions = makeActions();
    confirmResetProgress(actions);
    lastAlert().buttons[1]?.onPress?.();

    expect(actions.disableReminder).toHaveBeenCalled();
  });
});

describe('describeResetImpact', () => {
  it('says there is nothing to lose when the user has read nothing', () => {
    expect(describeResetImpact(0)).toBe('You have no completed readings yet.');
  });

  it('names how much will be lost', () => {
    expect(describeResetImpact(17)).toBe('This will remove 17 completed chapters.');
  });

  it('uses the singular for one chapter', () => {
    expect(describeResetImpact(1)).toBe('This will remove 1 completed chapter.');
  });
});
