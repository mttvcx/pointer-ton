import '@fontsource-variable/geist';
import { createRoot } from 'react-dom/client';
import { PopupApp } from './App';
import themeCss from '@/ui/theme.css?inline';

// Inject Pointer's tokens onto :root so the popup matches the app theme exactly.
const style = document.createElement('style');
style.textContent = themeCss.replace(/:host/g, ':root');
document.head.appendChild(style);

const root = document.documentElement;
root.style.background = 'var(--bg-base)';
root.style.colorScheme = 'dark';
document.body.style.margin = '0';
document.body.style.fontFamily = 'var(--pt-font)';
document.body.style.color = 'var(--fg-primary)';
document.body.style.fontSynthesis = 'none';
(document.body.style as unknown as { webkitFontSmoothing: string }).webkitFontSmoothing = 'antialiased';

createRoot(document.getElementById('root')!).render(<PopupApp />);
