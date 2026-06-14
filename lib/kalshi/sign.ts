import 'server-only';

import { createSign, createPrivateKey } from 'node:crypto';

/** RSA-PSS SHA256 signature for Kalshi authenticated requests. */
export function kalshiSignRequest(params: {
  privateKeyPem: string;
  timestampMs: number;
  method: string;
  path: string;
}): string {
  const message = `${params.timestampMs}${params.method.toUpperCase()}${params.path}`;
  const key = createPrivateKey(params.privateKeyPem);
  const signer = createSign('RSA-SHA256');
  signer.update(message);
  signer.end();
  return signer.sign(
    {
      key,
      padding: 3, // RSA_PKCS1_PSS_PADDING
      saltLength: 32,
    },
    'base64',
  );
}
