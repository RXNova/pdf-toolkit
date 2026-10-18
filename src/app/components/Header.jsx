import Cells from './Cells.jsx';
import { THEMES, useTheme } from '../hooks/useTheme.js';

const THEME_LABELS = { system: 'Auto', dark: 'Dark', light: 'Light' };

export default function Header({ onHome, view, onViewChange, showViewToggle }) {
  const { theme, setTheme } = useTheme();
  return (
    <header className="topbar">
      <div className="column">
        <button className="wordmark" type="button" onClick={onHome} aria-label="PDF Toolkit home">PDF Toolkit</button>
        <nav className="topnav" aria-label="Sections">
          <button type="button" className="tab active" aria-current="page" onClick={onHome}>Tools</button>
          <span className="topnav-note">Runs in your browser</span>
        </nav>
        {showViewToggle && (
          <div className="topbar-cell layout">
            <Cells label="Layout" options={[['grid', 'Grid'], ['list', 'List']]} value={view} onChange={onViewChange} />
          </div>
        )}
        <div className="topbar-cell">
          <Cells label="Theme" options={THEMES.map((t) => [t, THEME_LABELS[t]])} value={theme} onChange={setTheme} />
        </div>
      </div>
    </header>
  );
}
