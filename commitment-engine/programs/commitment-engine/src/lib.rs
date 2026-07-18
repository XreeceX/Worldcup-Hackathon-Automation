use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("3gAQVjVjHdC4vzVuidMKRtHUmfNgo84uH6HBcp3jiWf7");

pub const STATE_PENDING: u8 = 0;
pub const STATE_CONDITION_MET: u8 = 1;
pub const STATE_TRANSFERRED: u8 = 2;
pub const STATE_FAILED: u8 = 3;

#[program]
pub mod commitment_engine {
    use super::*;

    pub fn create_pledge(
        ctx: Context<CreatePledge>,
        nonce: u64,
        fixture_id: u64,
        condition_id: u8,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, EngineError::ZeroAmount);
        let pledge = &mut ctx.accounts.pledge;
        pledge.pledger = ctx.accounts.pledger.key();
        pledge.beneficiary = ctx.accounts.beneficiary.key();
        pledge.keeper = ctx.accounts.keeper.key();
        pledge.nonce = nonce;
        pledge.fixture_id = fixture_id;
        pledge.condition_id = condition_id;
        pledge.amount = amount;
        pledge.state = STATE_PENDING;
        pledge.bump = ctx.bumps.pledge;

        // escrow: move the pledged lamports into the PDA account
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.pledger.to_account_info(),
                    to: ctx.accounts.pledge.to_account_info(),
                },
            ),
            amount,
        )?;
        Ok(())
    }

    pub fn resolve(ctx: Context<Resolve>, condition_met: bool) -> Result<()> {
        let pledge = &ctx.accounts.pledge;
        require!(pledge.state == STATE_PENDING, EngineError::AlreadyResolved);
        require_keys_eq!(
            ctx.accounts.keeper.key(),
            pledge.keeper,
            EngineError::UnauthorizedKeeper
        );
        let expected_recipient = if condition_met {
            pledge.beneficiary
        } else {
            pledge.pledger
        };
        require_keys_eq!(
            ctx.accounts.recipient.key(),
            expected_recipient,
            EngineError::WrongRecipient
        );

        let amount = pledge.amount;
        // PDA is program-owned: debit/credit lamports directly
        **ctx
            .accounts
            .pledge
            .to_account_info()
            .try_borrow_mut_lamports()? -= amount;
        **ctx
            .accounts
            .recipient
            .to_account_info()
            .try_borrow_mut_lamports()? += amount;

        let pledge = &mut ctx.accounts.pledge;
        pledge.state = if condition_met {
            STATE_TRANSFERRED
        } else {
            STATE_FAILED
        };
        emit!(PledgeResolved {
            pledge: pledge.key(),
            fixture_id: pledge.fixture_id,
            condition_met,
            amount,
            recipient: expected_recipient,
        });
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct CreatePledge<'info> {
    #[account(mut)]
    pub pledger: Signer<'info>,
    /// CHECK: recipient of funds if the condition is met; stored, validated at resolve
    pub beneficiary: UncheckedAccount<'info>,
    /// CHECK: authority allowed to call resolve; stored at create
    pub keeper: UncheckedAccount<'info>,
    #[account(
        init,
        payer = pledger,
        space = 8 + Pledge::INIT_SPACE,
        seeds = [b"pledge", pledger.key().as_ref(), &nonce.to_le_bytes()],
        bump
    )]
    pub pledge: Account<'info, Pledge>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Resolve<'info> {
    pub keeper: Signer<'info>,
    #[account(mut)]
    pub pledge: Account<'info, Pledge>,
    /// CHECK: must equal beneficiary (condition met) or pledger (failed); enforced in handler
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct Pledge {
    pub pledger: Pubkey,
    pub beneficiary: Pubkey,
    pub keeper: Pubkey,
    pub nonce: u64,
    pub fixture_id: u64,
    pub condition_id: u8,
    pub amount: u64,
    pub state: u8,
    pub bump: u8,
}

#[event]
pub struct PledgeResolved {
    pub pledge: Pubkey,
    pub fixture_id: u64,
    pub condition_met: bool,
    pub amount: u64,
    pub recipient: Pubkey,
}

#[error_code]
pub enum EngineError {
    #[msg("amount must be > 0")]
    ZeroAmount,
    #[msg("pledge already resolved")]
    AlreadyResolved,
    #[msg("signer is not the registered keeper")]
    UnauthorizedKeeper,
    #[msg("recipient does not match expected payout target")]
    WrongRecipient,
}
