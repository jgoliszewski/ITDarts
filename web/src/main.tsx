import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';

// The kiosk (on localhost) keeps the screen on like a fullscreen video. The browser drops the lock when the page is
// hidden, so it is taken again on return.
if (location.hostname === 'localhost' && 'wakeLock' in navigator) {
  const lock = () => void navigator.wakeLock.request('screen').catch(() => undefined);
  lock();
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && lock());
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
