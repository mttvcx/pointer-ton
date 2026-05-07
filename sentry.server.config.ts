import * as Sentry from '@sentry/nextjs';
import { getSentryDsn, getSentryEnvironment } from './lib/sentry/env';

const dsn = getSentryDsn();
if (dsn) {
  Sentry.init({
    dsn,
    environment: getSentryEnvironment(),
    tracesSampleRate: process.env.NODE_ENV === 'development' ? 0.4 : 0.06,
    sendDefaultPii: false,
  });
}
