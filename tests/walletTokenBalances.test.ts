import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { tokenProgramFromMintOwner } from '@/lib/solana/tokenProgramId';

describe('tokenProgramFromMintOwner', () => {
  it('returns Token-2022 when mint owner is Token-2022 program', () => {
    assert.ok(
      tokenProgramFromMintOwner(TOKEN_2022_PROGRAM_ID).equals(TOKEN_2022_PROGRAM_ID),
    );
  });

  it('returns legacy Token program for other owners', () => {
    assert.ok(tokenProgramFromMintOwner(TOKEN_PROGRAM_ID).equals(TOKEN_PROGRAM_ID));
    assert.ok(
      tokenProgramFromMintOwner(PublicKey.default).equals(TOKEN_PROGRAM_ID),
    );
  });
});
