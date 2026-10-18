import { Info } from 'lucide-react';
import { useId } from 'react';
import { isOptionVisible } from '../../catalog.js';
import SegmentedControl from './SegmentedControl.jsx';

/** Selects with this many choices or fewer render as segmented controls. */
const SEGMENTED_MAX = 4;

export default function OptionsForm({ tool, values, onChange, onSubmit }) {
  const formId = useId();
  const visible = tool.options.filter((o) => !o.hidden && isOptionVisible(o, values)); // hidden: set by a custom control

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {visible.length === 0 && tool.options.length === 0 && (
        <p className="no-options">
          <Info size={16} aria-hidden="true" />
          {tool.multi ? 'Files are combined in the order shown. Drag them, or use the arrows, to reorder.' : 'No options needed.'}
        </p>
      )}
      {visible.map((o) => {
        if (o.type === 'select' && o.choices.length <= SEGMENTED_MAX) {
          return (
            <SegmentedControl key={o.key} label={o.label} name={`${formId}-${o.key}`} choices={o.choices}
              value={values[o.key]} onChange={(v) => onChange(o.key, v)} />
          );
        }
        // The label points at its control (rather than wrapping it), so a select's name is
        // just its label, not the label plus the chosen option.
        const id = `${formId}-${o.key}`;
        return (
          <div key={o.key} className="field">
            <label className="field-label" htmlFor={id}>{o.label}</label>
            {o.display === 'percent' ? (
              <span className="slider">
                <input id={id} type="range" value={values[o.key]} min={o.min} max={o.max} step={o.step}
                  onChange={(e) => onChange(o.key, Number(e.target.value))} />
                <output className="slider-value">{Math.round(Number(values[o.key]) * 100)}%</output>
              </span>
            ) : o.type === 'select' ? (
              <select id={id} value={values[o.key]} onChange={(e) => onChange(o.key, e.target.value)}>
                {o.choices.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                type={o.type === 'ranges' ? 'text' : o.type}
                value={values[o.key]}
                placeholder={o.placeholder}
                min={o.min}
                max={o.max}
                step={o.step}
                required={o.required}
                autoComplete={o.type === 'password' ? 'new-password' : 'off'}
                onChange={(e) => onChange(o.key, e.target.value)}
              />
            )}
          </div>
        );
      })}
    </form>
  );
}
