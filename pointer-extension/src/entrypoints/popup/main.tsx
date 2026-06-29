import { createRoot } from 'react-dom/client';
import { PopupApp } from './App';
import themeCss from '@/ui/theme.css?inline';

// Inject Pointer's tokens onto :root so the popup matches the app theme.
const style = document.createElement('style');
style.textContent = themeCss.replace(/:host/g, ':root');
document.head.appendChild(style);
document.documentElement.style.background = 'var(--bg-base)';

createRoot(document.getElementById('root')!).render(<PopupApp />);
