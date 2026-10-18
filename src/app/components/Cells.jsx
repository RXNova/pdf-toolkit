/** A row of mono tabs acting as a single-choice toggle (craft-launcher's cells()). */
export default function Cells({ label, options, value, onChange }) {
  return (
    <div className="cells" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" className={`tab${value === v ? ' active' : ''}`} aria-pressed={value === v} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}
