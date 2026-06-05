export const POINTER_REPORT_VERSION = 1 as const;

/** Display + wire format for diagnostics reports. */
export const BUG_CATEGORY_OPTIONS = [
  { id: 'trade_execution', label: 'Trade / execution' },
  { id: 'wallet', label: 'Wallet' },
  { id: 'token_page', label: 'Token page' },
  { id: 'pulse_feed', label: 'Pulse / feed' },
  { id: 'track_alerts', label: 'Track / Twitter alerts' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'ui_glitch', label: 'UI glitch' },
  { id: 'other', label: 'Other' },
] as const;

export type BugReportCategoryId = (typeof BUG_CATEGORY_OPTIONS)[number]['id'];

export const BUG_SEVERITY_OPTIONS = [
  { id: 'minor', label: 'Minor' },
  { id: 'annoying', label: 'Annoying' },
  { id: 'blocking', label: 'Blocking' },
  { id: 'urgent_funds', label: 'Urgent / funds-related' },
] as const;

export type BugSeverityId = (typeof BUG_SEVERITY_OPTIONS)[number]['id'];

export type ClientErrorBrief = {
  atIso: string;
  kind: 'error' | 'rejection';
  message: string;
  /** Filename:line — no query strings persisted to avoid leaking tokens in URLs */
  origin?: string;
  stackSnippet?: string;
};

export type BugReportContext = {
  route: string;
  submittedAtIso: string;
  activeChain: string;
  /**
   * Public mint snapshot only (route or UI flash). Never private keys / auth.
   */
  tokenMintHints: string[];
  pulseHighlightMint?: string | null;
  hoverLock?: {
    type: 'wallet' | 'token';
    idFingerprint: string;
    labelSnippet?: string;
  } | null;
  viewport: { w: number; h: number; dpr: number };
  userAgent: string;
  appVersion: string;
  connectionStatus?: string | null;
  region?: string | null;
  sessionAuthenticated?: boolean;
  activeWalletMasked?: string | null;
  activeWalletLabel?: string | null;
  walletPageMasked?: string | null;
  includeScreenshotRequested: boolean;
  /** PNG data URL when user opted in and capture succeeded (may be omitted server-side if too large). */
  screenshotDataUrl?: string | null;
  recentClientErrors?: ClientErrorBrief[];
};

export type BugReportPayload = {
  reportVersion: typeof POINTER_REPORT_VERSION;
  category: BugReportCategoryId;
  severity: BugSeverityId;
  description: string;
  context: BugReportContext;
};
