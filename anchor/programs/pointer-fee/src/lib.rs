use anchor_lang::prelude::*;

/// Devnet template program id (replace with your deploy key via `anchor keys sync`).
declare_id!("GGKwHCsxMsVRCZEqtgmTZMBp18h9DVpGDERykhHrT2BJ");

pub const FEE_STATE_SEED: &[u8] = b"fee_state";

#[program]
pub mod pointer_fee {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, treasury: Pubkey) -> Result<()> {
        require!(treasury != Pubkey::default(), ErrorCode::InvalidTreasury);
        let state = &mut ctx.accounts.fee_state;
        state.authority = ctx.accounts.authority.key();
        state.treasury = treasury;
        state.bump = ctx.bumps.fee_state;
        Ok(())
    }

    /// Send lamports into the fee-state PDA (simulates an after-swap platform fee).
    pub fn pay_fee(ctx: Context<PayFee>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::ZeroAmount);
        let cpi_accounts = anchor_lang::system_program::Transfer {
            from: ctx.accounts.user.to_account_info(),
            to: ctx.accounts.fee_state.to_account_info(),
        };
        let cpi = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            cpi_accounts,
        );
        anchor_lang::system_program::transfer(cpi, amount)?;
        Ok(())
    }

    /// Authority-only sweep from the PDA vault to the configured treasury.
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::ZeroAmount);

        let bump_seed = [ctx.accounts.fee_state.bump];
        let seeds: &[&[u8]] = &[FEE_STATE_SEED, &bump_seed];
        let signer: &[&[&[u8]]] = &[seeds];

        let cpi_accounts = anchor_lang::system_program::Transfer {
            from: ctx.accounts.fee_state.to_account_info(),
            to: ctx.accounts.treasury.to_account_info(),
        };
        let cpi = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            cpi_accounts,
            signer,
        );
        anchor_lang::system_program::transfer(cpi, amount)?;
        Ok(())
    }

    pub fn set_treasury(ctx: Context<SetTreasury>, new_treasury: Pubkey) -> Result<()> {
        require!(new_treasury != Pubkey::default(), ErrorCode::InvalidTreasury);
        ctx.accounts.fee_state.treasury = new_treasury;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + FeeState::LEN,
        seeds = [FEE_STATE_SEED],
        bump
    )]
    pub fee_state: Account<'info, FeeState>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PayFee<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [FEE_STATE_SEED],
        bump = fee_state.bump
    )]
    pub fee_state: Account<'info, FeeState>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [FEE_STATE_SEED],
        bump = fee_state.bump,
        has_one = authority @ ErrorCode::Unauthorized,
        has_one = treasury @ ErrorCode::WrongTreasury
    )]
    pub fee_state: Account<'info, FeeState>,
    #[account(mut)]
    pub treasury: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetTreasury<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [FEE_STATE_SEED],
        bump = fee_state.bump,
        has_one = authority @ ErrorCode::Unauthorized
    )]
    pub fee_state: Account<'info, FeeState>,
}

#[account]
pub struct FeeState {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub bump: u8,
}

impl FeeState {
    pub const LEN: usize = 32 + 32 + 1;
}

#[error_code]
pub enum ErrorCode {
    #[msg("Amount must be positive")]
    ZeroAmount,
    #[msg("Treasury cannot be the default pubkey")]
    InvalidTreasury,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Treasury does not match config")]
    WrongTreasury,
}
