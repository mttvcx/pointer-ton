import type { PrivyClientConfig } from '@privy-io/react-auth';

/** Public app id — safe for client bundles. */
export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';

/** `<PrivyProvider config={privyClientConfig} />` */
export const privyClientConfig: PrivyClientConfig = {
  loginMethods: ['email', 'google', 'twitter', 'wallet'],
  appearance: {
    theme: 'dark',
    accentColor: '#7C5CFF',
    logo: '/branding/logo-bird.svg',
    showWalletLoginFirst: false,
    walletChainType: 'ethereum-and-solana',
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
      connectors: undefined,
    },
  },
};
