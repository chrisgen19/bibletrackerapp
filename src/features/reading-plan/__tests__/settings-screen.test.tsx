// #18: Settings named the plan segment's first chapter as the "current position", and the
// reset note counted stored rows as completed chapters. The screen is a route, and tests
// never live inside `src/app`, so it is rendered from here.
import SettingsScreen from '@/app/settings';
import { readerPartWayThrough } from '@/test-utils/reading-scenarios';
import { renderWithTheme } from '@/test-utils/render';

let mockReadingData: Record<string, unknown> = {};

jest.mock('@/features/reading-plan/hooks/reading-data-provider', () => ({
  useReadingData: () => mockReadingData,
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));
jest.mock('@/theme/use-appearance-setting', () => ({
  useAppearanceSetting: () => ({ preference: 'system', setAppearance: jest.fn() }),
}));
jest.mock('@/features/reminders/hooks/use-reminder-settings', () => ({
  useReminderSettings: () => ({
    settings: { enabled: false, time: '07:00' },
    busy: false,
    error: null,
    setEnabled: jest.fn(),
    setTime: jest.fn(),
  }),
}));

function renderSettings(overrides: Record<string, unknown> = {}) {
  mockReadingData = { ...readerPartWayThrough(), resetProgress: jest.fn(), ...overrides };
  return renderWithTheme(<SettingsScreen />);
}

describe('SettingsScreen', () => {
  it('shows where the reader is, not where the plan segment began', async () => {
    const { getByTestId } = await renderSettings();

    // The row's accessibility label is "<label>, <value>".
    expect(getByTestId('settings-reading-plan').props.accessibilityLabel).toBe(
      'Current position, Genesis 5',
    );
  });

  it('says Finished once every chapter has been read', async () => {
    const reader = readerPartWayThrough();
    const { getByTestId } = await renderSettings({
      scheduleContext: { ...reader.scheduleContext, unread: [] },
    });

    expect(getByTestId('settings-reading-plan').props.accessibilityLabel).toBe(
      'Current position, Finished',
    );
  });

  it('says No plan yet before onboarding', async () => {
    const { getByTestId } = await renderSettings({ activePlan: null });

    expect(getByTestId('settings-reading-plan').props.accessibilityLabel).toBe(
      'Current position, No plan yet',
    );
  });

  it('counts chapters read in the reset warning, not stored rows', async () => {
    const { getByText } = await renderSettings();

    // Six rows: one chapter in two sittings, one only part-read. Four chapters, as the
    // progress screen's "chapters read" counts them.
    expect(getByText('This will remove 4 completed chapters.')).toBeTruthy();
  });
});
