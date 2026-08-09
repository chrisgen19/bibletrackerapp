import { fireEvent, renderWithTheme } from '@/test-utils/render';
import { getTodayDateKey } from '@/utils/date-key';

import { ReadingPositionFields, type ReadingPosition } from '../reading-position-fields';

const TODAY = getTodayDateKey();

async function renderFields(overrides: Partial<ReadingPosition> = {}, allowStartDate = true) {
  const onChange = jest.fn();
  const value: ReadingPosition = { bookId: 'GEN', chapter: 1, startDate: TODAY, ...overrides };
  const queries = await renderWithTheme(
    <ReadingPositionFields
      canonId="protestant"
      value={value}
      onChange={onChange}
      allowStartDate={allowStartDate}
    />,
  );
  return { onChange, ...queries };
}

describe('ReadingPositionFields', () => {
  it('shows book and chapter', async () => {
    const { getByTestId } = await renderFields();
    expect(getByTestId('field-book')).toBeTruthy();
    expect(getByTestId('field-chapter')).toBeTruthy();
  });

  it('omits the start date entirely when not allowed', async () => {
    const { queryByTestId } = await renderFields({}, false);
    expect(queryByTestId('field-start-date')).toBeNull();
  });

  it('reads "Today" while the plan starts today', async () => {
    const { getByLabelText } = await renderFields();
    // The row's accessibility label is "<label>, <value>".
    expect(getByLabelText('Start date, Today')).toBeTruthy();
  });

  it('shows the chosen date once back-dated', async () => {
    const { getByLabelText } = await renderFields({ startDate: '2026-08-01' });
    expect(getByLabelText('Start date, 1 Aug 2026')).toBeTruthy();
  });

  it('keeps the date picker collapsed until the row is tapped', async () => {
    const { getByTestId, queryByLabelText } = await renderFields();

    expect(queryByLabelText('Plan start date')).toBeNull();
    await fireEvent.press(getByTestId('field-start-date'));
    expect(queryByLabelText('Plan start date')).not.toBeNull();
  });

  it('collapses again on a second tap', async () => {
    const { getByTestId, queryByLabelText } = await renderFields();

    await fireEvent.press(getByTestId('field-start-date'));
    await fireEvent.press(getByTestId('field-start-date'));
    expect(queryByLabelText('Plan start date')).toBeNull();
  });

  it('explains back-dating while the plan still starts today', async () => {
    const { getByText } = await renderFields();
    expect(
      getByText(/Started earlier\? Set the date your plan began/),
    ).toBeTruthy();
  });
});
