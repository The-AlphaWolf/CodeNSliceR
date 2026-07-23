import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
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
