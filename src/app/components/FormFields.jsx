import { useEffect, useState } from 'react';
import { readFiles } from '../files.js';

/**
 * The PDF's form fields as inputs. Only fields you change are sent; others keep their value.
 * `value` and `onChange` carry a JSON object of { fieldName: value }.
 */
export default function FormFields({ file, value, onChange, onFields, quietWhenEmpty = false }) {
  const [state, setState] = useState({ file: null, fields: null, error: null });
  const values = parse(value);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [{ listFormFields }, [named]] = await Promise.all([import('../../core/tools/form-fields.js'), readFiles([file])]);
        const fields = await listFormFields(named);
        if (live) {
          setState({ file, fields, error: null });
          onFields?.(fields);
        }
      } catch (err) {
        if (live) {
          setState({ file, fields: [], error: err.message });
          onFields?.([]);
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [file]); // eslint-disable-line react-hooks/exhaustive-deps -- onFields is a notification, not an input

  const { fields, error } = state.file === file ? state : { fields: null, error: null };
  if (error) return quietWhenEmpty ? null : <p className="run-hint">{error}</p>;
  if (!fields) return quietWhenEmpty ? null : <p className="run-hint">Reading the form…</p>;
  if (!fields.length) return quietWhenEmpty ? null : <p className="run-hint">This PDF has no fillable fields.</p>;

  const set = (name, v) => onChange(JSON.stringify({ ...values, [name]: v }));
  const current = (f) => (f.name in values ? values[f.name] : f.value);

  return (
    <fieldset className="form-fields">
      <legend className="field-label">Form fields · {fields.length}</legend>
      {fields.map((f) => {
        const id = `ff-${f.name}`;
        if (f.type === 'checkbox') {
          return (
            <label key={f.name} className="ff-check">
              <input type="checkbox" checked={Boolean(current(f))} disabled={f.readOnly} onChange={(e) => set(f.name, e.target.checked)} />
              <span>{f.name}</span>
            </label>
          );
        }
        return (
          <div key={f.name} className="field">
            <label className="field-label ff-name" htmlFor={id}>{f.name}</label>
            {f.type === 'text' ? (
              f.multiline
                ? <textarea id={id} rows={3} value={current(f)} disabled={f.readOnly} onChange={(e) => set(f.name, e.target.value)} />
                : <input id={id} type="text" value={current(f)} disabled={f.readOnly} onChange={(e) => set(f.name, e.target.value)} />
            ) : (
              <select id={id} value={current(f)} disabled={f.readOnly} onChange={(e) => set(f.name, e.target.value)}>
                <option value="">—</option>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}

function parse(json) {
  try {
    const v = JSON.parse(json || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}
