import { useEffect, useState } from 'react';
import { TOOL_CATALOG } from '../catalog.js';
import Footer from './components/Footer.jsx';
import Header from './components/Header.jsx';
import Home from './components/Home.jsx';
import ToolView from './components/ToolView.jsx';
import { useStoredState } from './hooks/useStoredState.js';

export default function App() {
  // The open tool, any files it starts with (from the previous tool), and a counter so
  // continuing into a tool always starts it fresh.
  const [open, setOpen] = useState({ tool: null, files: [], run: 0 });
  const { tool } = open;
  const setTool = (next, files = []) => setOpen((o) => ({ tool: next, files, run: o.run + 1 }));
  const [view, setView] = useStoredState('pdf-toolkit:view', 'grid', ['grid', 'list']);

  useEffect(() => {
    document.title = tool ? `${tool.title} · PDF Toolkit · Files never leave your device` : 'PDF Toolkit · Free PDF tools. Your files never leave your device';
    window.scrollTo?.({ top: 0, behavior: 'instant' });
  }, [tool]);

  const home = () => setTool(null);

  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>
      <Header onHome={home} view={view} onViewChange={setView} showViewToggle={!tool} />
      <main id="main" tabIndex={-1}>
        {tool ? (
          // key resets files, options and status whenever a tool is opened
          <ToolView key={`${tool.id}-${open.run}`} tool={tool} onBack={home} initialFiles={open.files} onContinue={setTool} />
        ) : (
          <Home tools={TOOL_CATALOG} onOpen={(t) => setTool(t)} view={view} />
        )}
      </main>
      <Footer />
    </div>
  );
}
