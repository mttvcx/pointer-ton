import '@fontsource-variable/geist';
import '../popup/styles.css';
import { createRoot } from 'react-dom/client';
import { PopupApp } from '../popup/App';
import themeCss from '@/ui/theme.css?inline';

// Same token bridge as the popup — the side panel shares every component, only
// the shell stretches to full height (PopupApp mode="sidepanel").
const style = document.createElement('style');
style.textContent = themeCss.replace(/:host/g, ':root');
document.head.appendChild(style);

document.documentElement.style.colorScheme = 'dark';
document.body.style.margin = '0';
document.body.style.fontFamily = 'var(--pt-font)';
document.body.style.color = 'var(--fg-primary)';
(document.body.style as unknown as { webkitFontSmoothing: string }).webkitFontSmoothing = 'antialiased';

createRoot(document.getElementById('root')!).render(<PopupApp mode="sidepanel" />);
