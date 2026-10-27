import './harness';
import { createRoot } from 'react-dom/client';
import '@tokens/tokens.css';
import './styles/app.css';
import { App } from './App';
import { init } from './store';
init().then(() => { createRoot(document.getElementById('root')!).render(<App />); requestAnimationFrame(() => ((window as any).__tempoReady = true)); });
