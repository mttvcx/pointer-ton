import type { PrivyClientConfig } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { PRIVY_APP_ID } from '@/lib/privy/appId';

export { PRIVY_APP_ID };
/** Required for Phantom / Solflare / Backpack to connect — undefined breaks wallet login. */
const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: false,
});

/** `<PrivyProvider config={privyClientConfig} />` */
export const privyClientConfig: PrivyClientConfig = {
  loginMethods: ['wallet', 'email', 'google', 'twitter'],
  appearance: {
    theme: 'dark',
    accentColor: '#7C5CFF',
    logo: '/branding/logo-bird.svg',
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
};
