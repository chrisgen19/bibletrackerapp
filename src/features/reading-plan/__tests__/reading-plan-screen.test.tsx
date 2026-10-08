// #18: the reading plan screen opened on the plan segment's first chapter, so "Current
// position: Genesis 5" in Settings led to fields reading Genesis 1. The screen is a
// route, and tests never live inside `src/app`, so it is rendered from here.
import ReadingPlanScreen from '@/app/reading-plan';
import { readerPartWayThrough } from '@/test-utils/reading-scenarios';
import { renderWithTheme } from '@/test-utils/render';

let mockReadingData: Record<string, unknown> = {};

jest.mock('@/features/reading-plan/hooks/reading-data-provider', () => ({
  useReadingData: () => mockReadingData,
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));

describe('ReadingPlanScreen', () => {
  it('opens on where the reader is', async () => {
    mockReadingData = { ...readerPartWayThrough(), changePlan: jest.fn() };
    const { getByTestId } = await renderWithTheme(<ReadingPlanScreen />);

    // The rows' accessibility labels are "<label>, <value>".
    expect(getByTestId('field-book').props.accessibilityLabel).toBe('Book, Genesis');
    expect(getByTestId('field-chapter').props.accessibilityLabel).toBe('Chapter, 5');
  });
});
