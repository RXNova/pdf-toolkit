import { Download } from 'lucide-react';
import { useInstallPrompt } from '../hooks/useInstallPrompt.js';
import { THEMES, useTheme } from '../hooks/useTheme.js';
import Cells from './Cells.jsx';

const THEME_LABELS = { system: 'Auto', dark: 'Dark', light: 'Light' };

export default function Header({ onHome, view, onViewChange, showViewToggle }) {
  const { theme, setTheme } = useTheme();
  const install = useInstallPrompt();
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
        {install && (
          <div className="topbar-cell install">
            <button type="button" className="tab" onClick={install} title="Install PDF Toolkit as an app: it works offline">
              <Download size={13} aria-hidden="true" /> Install
            </button>
          </div>
        )}
        <div className="topbar-cell">
          <Cells label="Theme" options={THEMES.map((t) => [t, THEME_LABELS[t]])} value={theme} onChange={setTheme} />
        </div>
      </div>
    </header>
  );
}
