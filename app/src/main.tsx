import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ThemeProvider } from './features/theme/theme-provider';
import { I18nProvider } from './features/i18n/i18n-provider';
import './styles/globals.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <I18nProvider>
      <ThemeProvider defaultTheme="dark" storageKey="patotube-theme">
        <App />
      </ThemeProvider>
    </I18nProvider>
  </StrictMode>,
);
