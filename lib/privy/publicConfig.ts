import type { PrivyClientConfig } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';
import { mainnet, base, bsc } from 'viem/chains';
import { PRIVY_APP_ID } from '@/lib/privy/appId';
import { robinhoodChain } from '@/lib/evm/evmTradeChains';
import { getClientSolanaRpcUrls } from '@/lib/solana/clientRpcUrl';

const solanaRpcUrls = getClientSolanaRpcUrls();

export { PRIVY_APP_ID };
/** Required for Phantom / Solflare / Backpack to connect — undefined breaks wallet login. */
const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: false,
});

/** `<PrivyProvider config={privyClientConfig} />` */
export const privyClientConfig: PrivyClientConfig = {
  loginMethods: ['wallet', 'email', 'google', 'twitter'],
  // EVM chains the embedded wallet may switch to — without these, switchChain()
  // to Base/BNB fails and swaps error with "current chain does not match target".
  defaultChain: mainnet,
  supportedChains: [mainnet, base, bsc, robinhoodChain],
  appearance: {
    theme: 'dark',
    accentColor: '#7C5CFF',
    logo: '/branding/pointer-bird-transparent.png',
    showWalletLoginFirst: false,
    walletChainType: 'ethereum-and-solana',
    walletList: [
      'phantom',
      'solflare',
      'backpack',
      'detected_solana_wallets',
      'detected_ethereum_wallets',
      'wallet_connect_qr_solana',
    ],
  },
  embeddedWallets: {
    showWalletUIs: false,
    solana: {
      createOnLogin: 'users-without-wallets',
    },
    ethereum: {
      createOnLogin: 'users-without-wallets',
    },
  },
  externalWallets: {
    solana: {
      connectors: solanaConnectors,
    },
  },
  /** Required for embedded-wallet `signAndSendTransaction` (Privy UI hooks). */
  solana: {
    rpcs: {
      'solana:mainnet': {
        rpc: createSolanaRpc(solanaRpcUrls.http),
        rpcSubscriptions: createSolanaRpcSubscriptions(solanaRpcUrls.ws),
      },
    },
  },
};
