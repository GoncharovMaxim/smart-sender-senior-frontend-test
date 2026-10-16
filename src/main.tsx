import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { restoreSession } from './auth/session';
import './index.css';

async function enableMocking() {
  const { worker } = await import('./mocks/browser');
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true });
}

const root = document.getElementById('root');
if (!root) throw new Error('#root element is missing');

void enableMocking().then(() => {
  void restoreSession();
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
