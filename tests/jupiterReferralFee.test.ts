import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import {
  deriveJupiterFeeTokenAccount,
  resolveJupiterFeeMint,
} from '@/lib/jupiter/feeAccountPure';
import { SOL_MINT } from '@/lib/utils/addresses';

const WIF = 'CExejcGZSEnk4FBsBQa3nMnU1jjCYsjw4x9d7cJ4pump';
const OWNER = 'cZAaqAgu8QfK3SAfy9axt9tE1mpq6kicKhwQmGTPS8a';

describe('jupiter fee account resolution', () => {
  it('ExactIn SOL buy uses wrapped SOL fee mint', () => {
    assert.equal(
      resolveJupiterFeeMint({ inputMint: SOL_MINT, outputMint: WIF, swapMode: 'ExactIn' }),
      SOL_MINT,
    );
  });

  it('ExactOut sell uses input mint for fees', () => {
    assert.equal(
      resolveJupiterFeeMint({ inputMint: WIF, outputMint: SOL_MINT, swapMode: 'ExactOut' }),
      WIF,
    );
  });

  it('derives owner SOL ATA when JUPITER_REFERRAL_ACCOUNT is set', () => {
    process.env.JUPITER_REFERRAL_ACCOUNT = OWNER;
    delete process.env.JUPITER_FEE_TOKEN_ACCOUNT;

    const ata = deriveJupiterFeeTokenAccount({
      inputMint: SOL_MINT,
      outputMint: WIF,
      swapMode: 'ExactIn',
    });
    const owner = new PublicKey(OWNER);
    const expected = getAssociatedTokenAddressSync(
      new PublicKey(SOL_MINT),
      owner,
      !PublicKey.isOnCurve(owner.toBytes()),
    ).toBase58();
    assert.equal(ata, expected);
    assert.notEqual(ata, OWNER);
  });

  it('supports off-curve fee owners (PDAs / program wallets)', () => {
    process.env.JUPITER_REFERRAL_ACCOUNT = 'AYq7mi2a3jkzD5MKgCZZCwqhnuKBnuR4qcczqRGee8wy';
    delete process.env.JUPITER_FEE_TOKEN_ACCOUNT;

    const ata = deriveJupiterFeeTokenAccount({
      inputMint: SOL_MINT,
      outputMint: WIF,
      swapMode: 'ExactIn',
    });
    assert.equal(ata, '5Kb16KW8DnNY7TMTbZzjRfSyxVvUExRGnZ8fds18mWVs');
  });
});
