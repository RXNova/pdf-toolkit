import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { formPdfBytes, pdfBytes } from '../../../tests/helpers/fixtures.js';
import { setupBrowserTestEnv } from '../test-utils.js';
import FormFields from './FormFields.jsx';

setupBrowserTestEnv();

function setup(bytes) {
  let json = '{}';
  const file = new File([bytes], 'f.pdf', { type: 'application/pdf' }); // stable, as in ToolView
  function Harness() {
    const [value, setValue] = useState('{}');
    json = value;
    return <FormFields file={file} value={value} onChange={setValue} />;
  }
  render(<Harness />);
  return { values: () => JSON.parse(json) };
}

describe('FormFields', () => {
  it('lists the fields and records only what you change', async () => {
    const { values } = setup(await formPdfBytes());
    await userEvent.type(await screen.findByRole('textbox', { name: 'name' }), 'Asha');
    await userEvent.click(screen.getByRole('checkbox', { name: 'agree' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'plan' }), 'pro');
    expect(values()).toEqual({ name: 'Asha', agree: true, plan: 'pro' });
    expect(screen.getByRole('combobox', { name: 'country' })).toHaveValue('');
  });

  it('says when there is nothing to fill', async () => {
    setup(await pdfBytes({ pages: 1 }));
    expect(await screen.findByText('This PDF has no fillable fields.')).toBeInTheDocument();
  });
});
