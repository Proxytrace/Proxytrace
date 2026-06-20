import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from '@lingui/react';
import '@fontsource-variable/inter/index.css';
import '@fontsource-variable/jetbrains-mono/index.css';
import './index.css';
import App from './App';
import { i18n, dynamicActivate, resolveInitialLocale } from './i18n';

const rootElement = document.getElementById('root');
// eslint-disable-next-line lingui/no-unlocalized-strings -- thrown developer error, not UI copy
if (!rootElement) throw new Error('Root element #root not found');

// Activate the best-effort locale (cache → browser → English) before first paint; the
// authenticated user's stored language is applied later by LocaleSync once /me resolves.
async function bootstrap() {
  await dynamicActivate(resolveInitialLocale());
  createRoot(rootElement as HTMLElement).render(
    <StrictMode>
      <I18nProvider i18n={i18n}>
        <App />
      </I18nProvider>
    </StrictMode>,
  );
}

void bootstrap();
