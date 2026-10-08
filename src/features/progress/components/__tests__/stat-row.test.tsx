import { renderWithTheme } from '@/test-utils/render';

import { StatRow } from '../stat-row';

const FOUR_STATS = [
  { icon: 'flame', value: '3', label: 'day streak' },
  { icon: 'calendar', value: '12', label: 'longest streak' },
  { icon: 'book.closed', value: '1,189', label: 'chapters this read-through' },
  { icon: 'arrow.counterclockwise', value: '1', label: 'times through the Bible' },
] as const;

describe('StatRow', () => {
  it('shows every tile, each read as its value and label', async () => {
    const { getByLabelText } = await renderWithTheme(<StatRow stats={FOUR_STATS} />);

    for (const stat of FOUR_STATS) {
      expect(getByLabelText(`${stat.value} ${stat.label}`)).toBeTruthy();
    }
  });
});
