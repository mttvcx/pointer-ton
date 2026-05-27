export const HOLDERS_TABLE_COLUMN_TOGGLES = [
  { id: 'kolLabels', label: 'KOL Labels' },
  { id: 'totalTransactions', label: 'Total Transactions' },
  { id: 'lastActive', label: 'Last Active' },
  { id: 'averageEntry', label: 'Average Entry' },
  { id: 'averageExit', label: 'Average Exit' },
  { id: 'fundingCount', label: 'Funding Count' },
  { id: 'sharedWalletFunding', label: 'Shared Wallet Funding' },
  { id: 'timeLinkedFunding', label: 'Time-linked Funding' },
] as const;

export type HoldersTableColumnId = (typeof HOLDERS_TABLE_COLUMN_TOGGLES)[number]['id'];

export type HoldersTableSettings = {
  columns: Record<HoldersTableColumnId, boolean>;
  sharedFundingLower: number;
  sharedFundingUpper: number;
  sharedFundingLowerColor: string;
  sharedFundingUpperColor: string;
  timeLinkedThreshold: number;
  timeLinkedUnit: 'm' | 'h' | 'd';
};

export const DEFAULT_HOLDERS_TABLE_SETTINGS: HoldersTableSettings = {
  columns: {
    kolLabels: true,
    totalTransactions: true,
    lastActive: true,
    averageEntry: true,
    averageExit: true,
    fundingCount: true,
    sharedWalletFunding: true,
    timeLinkedFunding: true,
  },
  sharedFundingLower: 2,
  sharedFundingUpper: 3,
  sharedFundingLowerColor: '#eab308',
  sharedFundingUpperColor: '#f97316',
  timeLinkedThreshold: 20,
  timeLinkedUnit: 'm',
};

export function cloneHoldersTableSettings(s: HoldersTableSettings): HoldersTableSettings {
  return {
    ...s,
    columns: { ...s.columns },
  };
}
