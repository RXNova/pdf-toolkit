import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { setupBrowserTestEnv } from '../test-utils.js';
import SegmentedControl from './SegmentedControl.jsx';

setupBrowserTestEnv();

const choices = [['a', 'Alpha', 'First letter'], ['b', 'Beta'], ['c', 'Gamma', 'Third-ish']];

it('renders a labelled radio group with the value checked', () => {
  render(<SegmentedControl label="Letter" name="letter" choices={choices} value="b" onChange={vi.fn()} />);
  expect(screen.getByRole('group', { name: 'Letter' })).not.toHaveAttribute('aria-describedby');
  expect(screen.getByRole('radio', { name: 'Beta' })).toBeChecked();
});

it('reports the chosen value, including via arrow keys', async () => {
  const onChange = vi.fn();
  render(<SegmentedControl label="Letter" name="letter" choices={choices} value="a" onChange={onChange} />);
  await userEvent.click(screen.getByRole('radio', { name: 'Gamma' }));
  expect(onChange).toHaveBeenLastCalledWith('c');
});

it('describes the group with the selected choice’s hint', () => {
  render(<SegmentedControl label="Letter" name="letter" choices={choices} value="c" onChange={vi.fn()} />);
  expect(screen.getByRole('group', { name: 'Letter' })).toHaveAccessibleDescription('Third-ish');
});
