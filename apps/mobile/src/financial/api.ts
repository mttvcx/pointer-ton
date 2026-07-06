/**
 * Client for the Pointer Financial backend facade (`/api/financial/*`). The
 * backend wraps the card/rails provider (Bridge) behind a key gate: when it isn't
 * configured yet it replies `{ configured: false }`, and the app stays on the
 * local simulation. Never throws into the UI — callers treat a throw as
 * "not configured".
 */
import { authToken } from '../auth';
import { api } from '../api/client';
import type { CardInfo, FinStatus } from './types';

export type ActivateInput = { legalName: string; country: string; fullKyc: boolean };

type StatusResponse = { configured: boolean; status: FinStatus; card: CardInfo | null };
type ActivateResponse = { configured: boolean; card: CardInfo | null };
type ProvisionResponse = {
  configured: boolean;
  // Opaque PassKit push-provisioning payload from the issuer, forwarded to the
  // native add-to-wallet call. Absent when unconfigured / not yet approved.
  provisioning?: { cardholderName: string; primaryAccountSuffix: string; payload: unknown } | null;
};

export async function fetchFinancialStatus(): Promise<StatusResponse> {
  return api<StatusResponse>('/api/financial/status', { token: await authToken() });
}

export async function activateFinancial(input: ActivateInput): Promise<ActivateResponse> {
  return api<ActivateResponse>('/api/financial/activate', { token: await authToken(), method: 'POST', body: input });
}

export async function provisionCard(): Promise<ProvisionResponse> {
  return api<ProvisionResponse>('/api/financial/card/provision', { token: await authToken(), method: 'POST', body: {} });
}

type YieldResponse = { configured: boolean; apyPct: number | null };

export async function fetchYieldRate(): Promise<YieldResponse> {
  return api<YieldResponse>('/api/financial/yield', { token: await authToken() });
}

type YieldDepositResponse = { configured: boolean; transaction: string | null; error?: string };

/** Prepare the unsigned Lulo deposit tx (the app signs + sends it). */
export async function prepareYieldDeposit(owner: string, amountUsd: number): Promise<YieldDepositResponse> {
  return api<YieldDepositResponse>('/api/financial/yield/deposit', { token: await authToken(), method: 'POST', body: { owner, amountUsd } });
}

type BorrowResponse = { simulated: boolean; txBase64?: string };

/** Credit mode: prepare an unsigned Kamino deposit+borrow tx (the app signs it via
 *  Privy). `simulated:true` = Kamino not wired yet → reflect the borrow locally. */
export async function prepareBorrow(input: {
  amountUsd: number;
  collateralMint: string;
  collateralUsd: number;
  borrowedUsd: number;
}): Promise<BorrowResponse> {
  return api<BorrowResponse>('/api/financial/credit/borrow', { token: await authToken(), method: 'POST', body: input });
}
