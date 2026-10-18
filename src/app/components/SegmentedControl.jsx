import { useId } from 'react';

/**
 * Accessible segmented control: a fieldset of native radios, so arrow keys and
 * screen readers work without extra code. Shows the selected choice's hint below.
 */
export default function SegmentedControl({ label, name, choices, value, onChange }) {
  const hintId = useId();
  const hint = choices.find(([v]) => v === value)?.[2];
  return (
    <fieldset className="segmented" aria-describedby={hint ? hintId : undefined}>
      <legend className="field-label">{label}</legend>
      <div className="segments">
        {choices.map(([v, choiceLabel]) => (
          <label key={v} className="segment">
            <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} />
            <span>{choiceLabel}</span>
          </label>
        ))}
      </div>
      {hint && <p className="segment-hint" id={hintId}>{hint}</p>}
    </fieldset>
  );
}
