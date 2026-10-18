import '@fontsource-variable/inter';
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/geist-mono';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { applyTheme, THEMES } from './hooks/useTheme.js';
import './styles.css';

// Apply the saved theme before first paint to avoid a flash of the wrong theme.
try {
  const saved = localStorage.getItem('pdf-toolkit:theme');
  applyTheme(THEMES.includes(saved) ? saved : 'system');
} catch {
  applyTheme('system');
}

// Stop the browser from opening a file dropped outside the drop zone.
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

// Offline support: cache the app once it has loaded (production builds only).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
