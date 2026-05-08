import 'server-only';

import { StonApiClient } from '@ston-fi/api';
import { Client as StonTonClient, dexFactory } from '@ston-fi/sdk';
import { Address } from '@ton/core';
import { normalizeTonAddress } from '@/lib/utils/tonAddress';
import type { TonConnectTradePayload } from '@/lib/trading/quoteTypes';

const OFFER_TON = 'ton';

function tonCenterEndpoint(): string {
  const raw = process.env.TON_CENTER_API_URL?.trim();
  if (raw) return raw.replace(/\/$/, '');
  return 'https://toncenter.com/api/v2/jsonRPC';
}

function slippageToleranceFromBps(bps: number): string {
  return String(Math.max(0.0001, bps / 10_000));
}

function solToNanoString(sol: number): string {
  if (!Number.isFinite(sol) || sol <= 0) throw new Error('invalid_sol_amount');
  return String(BigInt(Math.round(sol * 1e9)));
}

export type PointerStonQuoteParams = {
  userWalletAddress: string;
  jettonMaster: string;
  side: 'buy' | 'sell';
  amountSol?: number;
  amountTokenRaw?: string;
  /** Exact TON out (SOL, float) for reverse swap / exact-out sells. */
  amountSolOut?: number;
  slippageBps: number;
  includeSwapTx: boolean;
};

export type PointerStonQuoteResult = {
  quote: Record<string, unknown>;
  tonConnect: TonConnectTradePayload;
  summary: {
    amountInRaw: string;
    amountOutRaw: string;
    amountSolEstimate: number;
  };
};

export async function buildPointerStonSwapQuote(params: PointerStonQuoteParams): Promise<PointerStonQuoteResult> {
  const masterNorm = normalizeTonAddress(params.jettonMaster);
  if (!masterNorm) throw new Error('invalid_jetton_master');
  const walletNorm = normalizeTonAddress(params.userWalletAddress);
  if (!walletNorm) throw new Error('invalid_wallet');

  const jettonAddr = Address.parse(masterNorm);
  const userAddr = Address.parse(walletNorm);

  const client = new StonTonClient({
    endpoint: tonCenterEndpoint(),
    apiKey: process.env.TON_CENTER_API_KEY?.trim() || undefined,
  });
  const api = new StonApiClient();

  const slip = slippageToleranceFromBps(params.slippageBps);
  const referralAddress = process.env.STONFI_REFERRAL_ADDRESS?.trim();
  const referralFeeBps = process.env.STONFI_REFERRAL_FEE_BPS?.trim();
  const referralOpts =
    referralAddress != null && referralAddress.length > 0
      ? { referralAddress, referralFeeBps: referralFeeBps ?? '10' }
      : {};

  const jettonMasterApi = jettonAddr.toRawString();

  let simulation: {
    offerUnits: string;
    askUnits: string;
    minAskUnits: string;
    offerJettonWallet: string;
    askJettonWallet: string;
    routerAddress: string;
    router: {
      address: string;
      majorVersion: number;
      minorVersion: number;
      ptonMasterAddress: string;
      ptonVersion: string;
      ptonWalletAddress: string;
      routerType: string;
      poolCreationEnabled: boolean;
    };
    gasParams: { forwardGas: string; gasBudget?: string };
  };

  if (params.side === 'buy') {
    if (params.amountSol == null) throw new Error('amount_sol_required');
    const offerUnits = solToNanoString(params.amountSol);
    simulation = await api.simulateSwap({
      offerAddress: OFFER_TON,
      askAddress: jettonMasterApi,
      offerUnits,
      slippageTolerance: slip,
      dexV2: true,
      ...referralOpts,
    });
  } else if (params.amountSolOut != null) {
    const askUnits = solToNanoString(params.amountSolOut);
    simulation = await api.simulateReverseSwap({
      offerAddress: jettonMasterApi,
      askAddress: OFFER_TON,
      askUnits,
      slippageTolerance: slip,
      dexV2: true,
      ...referralOpts,
    });
  } else {
    const raw = params.amountTokenRaw;
    if (raw == null || !/^\d+$/.test(raw)) throw new Error('amount_token_raw_required');
    simulation = await api.simulateSwap({
      offerAddress: jettonMasterApi,
      askAddress: OFFER_TON,
      offerUnits: raw,
      slippageTolerance: slip,
      dexV2: true,
      ...referralOpts,
    });
  }

  const dex = dexFactory(simulation.router);
  const router = client.open(dex.Router.create(Address.parse(simulation.router.address)));
  const proxyTon = dex.pTON.create(Address.parse(simulation.router.ptonMasterAddress));

  const queryId = BigInt(Date.now() % Number.MAX_SAFE_INTEGER);
  const forwardGas = BigInt(simulation.gasParams.forwardGas);

  const txParams = await (params.side === 'buy'
    ? router.getSwapTonToJettonTxParams({
        userWalletAddress: userAddr,
        proxyTon,
        offerAmount: simulation.offerUnits,
        minAskAmount: simulation.minAskUnits,
        askJettonAddress: jettonAddr,
        askJettonWalletAddress: simulation.askJettonWallet,
        forwardGasAmount: forwardGas,
        queryId,
      })
    : router.getSwapJettonToTonTxParams({
        userWalletAddress: userAddr,
        proxyTon,
        offerJettonAddress: jettonAddr,
        offerJettonWalletAddress: simulation.offerJettonWallet,
        offerAmount: simulation.offerUnits,
        minAskAmount: simulation.minAskUnits,
        forwardGasAmount: forwardGas,
        queryId,
      }));

  const validUntil = Math.floor(Date.now() / 1000) + 600;
  const messages: TonConnectTradePayload['messages'] = [];

  if (params.includeSwapTx) {
    const body = txParams.body ?? null;
    messages.push({
      address: txParams.to.toString({ bounceable: true, urlSafe: true }),
      amount: txParams.value.toString(),
      payload: body ? body.toBoc().toString('base64') : undefined,
    });
  }

  let amountSolEstimate: number;
  if (params.side === 'buy') {
    amountSolEstimate = params.amountSol ?? Number(simulation.offerUnits) / 1e9;
  } else {
    amountSolEstimate = params.amountSolOut ?? Number(simulation.askUnits) / 1e9;
  }

  return {
    quote: { ...simulation, side: params.side, jettonMaster: masterNorm } as unknown as Record<string, unknown>,
    tonConnect: { validUntil, messages },
    summary: {
      amountInRaw: simulation.offerUnits,
      amountOutRaw: simulation.askUnits,
      amountSolEstimate,
    },
  };
}
