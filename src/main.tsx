import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted, so the terminal reads the same on every machine instead of falling
// back to whatever mono the OS happens to ship. Each face is split by unicode-range;
// an English player only ever downloads the latin subset.
import '@fontsource-variable/jetbrains-mono/wght.css';
import '@fontsource-variable/jetbrains-mono/wght-italic.css';
import { App } from './ui/App';
import { useGame } from './state/store';
import './styles/terminal.css';

// Dev-only handle so the game can be driven from the console during debugging.
if (import.meta.env.DEV) {
  (window as unknown as { cn: unknown }).cn = { useGame };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
