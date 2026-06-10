'use client';

import { CipherSuite, DhkemP256HkdfSha256, HkdfSha256 } from '@hpke/core';
import { Chacha20Poly1305 } from '@hpke/chacha20poly1305';

function base64ToBytes(base64: string): ArrayBuffer {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function bytesToBase64(bytes: ArrayBuffer): string {
  const u8 = new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < u8.length; i += 1) bin += String.fromCharCode(u8[i]!);
  return btoa(bin);
}

/** Ephemeral P-256 keypair for Privy HPKE wallet export. */
export async function generateP256ExportKeyPair(): Promise<{
  recipientPublicKey: string;
  recipientPrivateKeyPkcs8: ArrayBuffer;
}> {
  const keypair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits'],
  );
  const [spki, pkcs8] = await Promise.all([
    crypto.subtle.exportKey('spki', keypair.publicKey),
    crypto.subtle.exportKey('pkcs8', keypair.privateKey),
  ]);
  return {
    recipientPublicKey: bytesToBase64(spki),
    recipientPrivateKeyPkcs8: pkcs8,
  };
}

/** Decrypt Privy HPKE export payload (DHKEM_P256 + HKDF_SHA256 + ChaCha20Poly1305). */
export async function decryptHpkeWalletExport(
  recipientPrivateKeyPkcs8: ArrayBuffer,
  encapsulatedKeyBase64: string,
  ciphertextBase64: string,
): Promise<string> {
  const suite = new CipherSuite({
    kem: new DhkemP256HkdfSha256(),
    kdf: new HkdfSha256(),
    aead: new Chacha20Poly1305(),
  });

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    recipientPrivateKeyPkcs8,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits'],
  );

  const recipient = await suite.createRecipientContext({
    recipientKey: privateKey,
    enc: base64ToBytes(encapsulatedKeyBase64),
  });

  const pt = await recipient.open(base64ToBytes(ciphertextBase64));
  return new TextDecoder().decode(pt);
}
