import { useEffect, useState } from 'react';

/**
 * The browser's "install this app" prompt, when it offers one (Chrome, Edge). Returns a
 * function that shows it, or null when installing isn't available or already done.
 */
export function useInstallPrompt() {
  const [prompt, setPrompt] = useState(null);
  useEffect(() => {
    const offer = (e) => {
      e.preventDefault(); // keep the browser's mini-infobar away; we show our own button
      setPrompt(e);
    };
    const done = () => setPrompt(null);
    window.addEventListener('beforeinstallprompt', offer);
    window.addEventListener('appinstalled', done);
    return () => {
      window.removeEventListener('beforeinstallprompt', offer);
      window.removeEventListener('appinstalled', done);
    };
  }, []);
  if (!prompt) return null;
  return async () => {
    await prompt.prompt();
    setPrompt(null); // a prompt can only be used once
  };
}
