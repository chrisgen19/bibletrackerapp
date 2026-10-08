// Starting the next read-through (#19), ported from bibletrackerweb's
// next-read-through-card.dom.test.tsx. The confirmation is a native alert.
import { Alert } from 'react-native';

import { fireEvent, renderWithTheme } from '@/test-utils/render';

import { NextReadThroughCard } from '../next-read-through-card';

async function renderCard() {
  const onStart = jest.fn();
  const queries = await renderWithTheme(<NextReadThroughCard nextReadThrough={2} onStart={onStart} />);
  return { onStart, ...queries };
}

/** The most recent alert: its title, message and buttons. */
function lastAlert() {
  const [title, message, buttons] = (Alert.alert as jest.Mock).mock.calls.at(-1) ?? [];
  return { title, message, buttons: (buttons ?? []) as { text: string; onPress?: () => void }[] };
}

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('NextReadThroughCard', () => {
  it('offers the next read-through by number', async () => {
    const { getByText } = await renderCard();
    expect(getByText('Start Read-Through #2')).toBeTruthy();
    expect(getByText('You have finished the Bible')).toBeTruthy();
  });

  it('asks before starting, and starts on confirm', async () => {
    const { onStart, getByTestId } = await renderCard();

    await fireEvent.press(getByTestId('start-next-read-through'));
    const { title, message, buttons } = lastAlert();
    expect(title).toBe('Start read-through #2?');
    expect(message).toContain('stays on your calendar');
    expect(buttons.map((button) => button.text)).toEqual(['Not yet', 'Start']);
    expect(onStart).not.toHaveBeenCalled();

    buttons[1]?.onPress?.();
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the reader is not ready yet', async () => {
    const { onStart, getByTestId } = await renderCard();

    await fireEvent.press(getByTestId('start-next-read-through'));
    lastAlert().buttons[0]?.onPress?.();

    expect(onStart).not.toHaveBeenCalled();
  });
});
