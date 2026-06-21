import { notFound } from 'next/navigation';

// Predictions is hidden on main until Kalshi (US-only) is wired post-launch.
// Full build preserved on the `predictions-market` branch. 404 here blocks
// nav + direct-URL access. To re-enable: restore the PredictionsDesk render
// (see predictions-market branch) + the nav entry in navConfig.
export default function PredictionsPage() {
  notFound();
}
