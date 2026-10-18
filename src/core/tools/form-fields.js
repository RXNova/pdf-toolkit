// Form helpers for Fill & sign: list a PDF's fields for the UI, and fill them.
import { PDFCheckBox, PDFDropdown, PDFOptionList, PDFRadioGroup, PDFTextField } from 'pdf-lib';
import { UserError } from '../errors.js';
import { loadPdf } from '../pdf.js';

/**
 * Fill the form's fields from { fieldName: value }; unknown names are ignored.
 * @returns {number} how many fields were set
 */
export function fillForm(form, values) {
  let filled = 0;
  for (const field of form.getFields()) {
    const name = field.getName();
    if (!(name in values)) continue;
    try {
      setValue(field, values[name]);
      filled++;
    } catch (err) {
      throw new UserError(`“${name}” couldn’t take that value: ${err.message}`, { cause: err });
    }
  }
  return filled;
}

/** Set a pdf-lib form field from a plain value: text, true/false, or a chosen option. */
export function setValue(field, value) {
  if (field instanceof PDFTextField) field.setText(value === '' || value == null ? undefined : String(value));
  else if (field instanceof PDFCheckBox) (value === true || value === 'true' ? field.check() : field.uncheck());
  else if (field instanceof PDFRadioGroup || field instanceof PDFDropdown) {
    if (value === '' || value == null) return field.clear();
    const choice = String(value);
    const editable = field instanceof PDFDropdown && field.isEditable();
    if (!editable && !field.getOptions().includes(choice)) throw new Error(`“${choice}” isn’t one of its options`);
    field.select(choice);
  } else if (field instanceof PDFOptionList) {
    const list = (Array.isArray(value) ? value : [value]).filter((v) => v !== '' && v != null).map(String);
    if (list.length) field.select(list);
    else field.clear();
  }
}

/**
 * The form's fields, simplified for the UI: [{ name, type, value, options?, multiline?, readOnly }],
 * type one of text | checkbox | radio | select. Uses the same library as filling, so option
 * names always match what setValue accepts. Buttons and signature fields are left out.
 * @param {import('../pdf.js').NamedBytes} file
 */
export async function listFormFields(file) {
  const form = (await loadPdf(file)).getForm();
  return form.getFields().flatMap((field) => {
    const base = { name: field.getName(), readOnly: field.isReadOnly() };
    if (field instanceof PDFTextField) return [{ ...base, type: 'text', value: field.getText() ?? '', multiline: field.isMultiline() }];
    if (field instanceof PDFCheckBox) return [{ ...base, type: 'checkbox', value: field.isChecked() }];
    if (field instanceof PDFRadioGroup) return [{ ...base, type: 'radio', value: field.getSelected() ?? '', options: field.getOptions() }];
    if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
      return [{ ...base, type: 'select', value: field.getSelected()[0] ?? '', options: field.getOptions() }];
    }
    return [];
  });
}
