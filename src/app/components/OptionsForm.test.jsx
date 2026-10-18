import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { defaultFormValues, getToolDef } from '../../catalog.js';
import OptionsForm from './OptionsForm.jsx';
import { setupBrowserTestEnv } from '../test-utils.js';

setupBrowserTestEnv();

const renderForm = (toolId, values, handlers = {}) => {
  const tool = getToolDef(toolId);
  const props = { tool, values: values ?? defaultFormValues(tool), onChange: vi.fn(), onSubmit: vi.fn(), ...handlers };
  render(<OptionsForm {...props} />);
  return props;
};

describe('OptionsForm', () => {
  it('renders each field type with its current value', () => {
    renderForm('watermark');
    expect(screen.getByLabelText('Text')).toHaveValue('CONFIDENTIAL');
    expect(screen.getByLabelText('Font size')).toHaveAttribute('type', 'number');
    expect(screen.getByLabelText('Font size')).toHaveAttribute('min', '8');
    expect(screen.getByLabelText('Color')).toHaveAttribute('type', 'color');
  });

  it('shows percent options as a slider with the value in percent', () => {
    const { onChange } = renderForm('watermark');
    const slider = screen.getByLabelText('Opacity');
    expect(slider).toHaveAttribute('type', 'range');
    expect(screen.getByText('20%')).toBeInTheDocument();
    fireEvent.change(slider, { target: { value: '0.45' } });
    expect(onChange).toHaveBeenCalledWith('opacity', 0.45);
  });

  it('renders short selects as a segmented radio group and reports changes', () => {
    const { onChange } = renderForm('rotate');
    const group = screen.getByRole('group', { name: 'Rotation' });
    expect(within(group).getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: '90° right' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: '180°' }));
    expect(onChange).toHaveBeenCalledWith('angle', '180');
  });

  it('renders longer selects as a dropdown', () => {
    const { onChange } = renderForm('numbers');
    const select = screen.getByLabelText('Position');
    expect(select.tagName).toBe('SELECT');
    fireEvent.change(select, { target: { value: 'top-left' } });
    expect(onChange).toHaveBeenCalledWith('position', 'top-left');
  });

  it('shows the hint of the selected choice', () => {
    renderForm('compress');
    expect(screen.getByRole('group', { name: 'Compression' })).toHaveAccessibleDescription('Much smaller, with images that still look sharp.');
  });

  it('turns off autofill for password fields', () => {
    renderForm('protect');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password');
  });

  it('renders page ranges as text inputs and reports changes', () => {
    const { onChange } = renderForm('extract');
    const input = screen.getByLabelText('Pages to keep');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toBeRequired();
    fireEvent.change(input, { target: { value: '1-2' } });
    expect(onChange).toHaveBeenCalledWith('ranges', '1-2');
  });

  it('hides options whose showIf does not match', () => {
    renderForm('split', { mode: 'every', ranges: '' });
    expect(screen.queryByLabelText(/Ranges/)).not.toBeInTheDocument();
  });

  it('submits on Enter without reloading', () => {
    const { onSubmit } = renderForm('watermark');
    fireEvent.submit(screen.getByLabelText('Text').closest('form'));
    expect(onSubmit).toHaveBeenCalled();
  });

  it('explains tools without options', () => {
    renderForm('merge', {});
    expect(screen.getByText(/combined in the order shown/)).toBeInTheDocument();
  });

  it('says there are no options for single-file tools without any', () => {
    render(<OptionsForm tool={{ options: [], multi: false }} values={{}} onChange={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText('No options needed.')).toBeInTheDocument();
  });
});
