use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("2VeuFx8b2F5c1y5yuhgkCHdaHPMC5wDN4n1u4k5aMmkP");

declare_program!(txoracle);
use txoracle::program::Txoracle;
use txoracle::types::{
    BinaryExpression, Comparison, NDimensionalStrategy, StatPredicate, StatValidationInput,
    TraderPredicate,
};

pub const MAX_MEMBERS: usize = 200;
pub const MIN_DEPOSIT_LAMPORTS: u64 = 10_000_000; // 0.01 SOL
pub const TIMEOUT_SECONDS: i64 = 7 * 86_400;

// status values (u8 for zero-copy)
pub const STATUS_OPEN: u8 = 0;
pub const STATUS_EXECUTED: u8 = 1;
pub const STATUS_REFUNDED: u8 = 2;
pub const STATUS_VOID: u8 = 3;
pub const STATUS_CLOSED: u8 = 4;

// condition templates
pub const TEMPLATE_BTTS: u8 = 0;
pub const TEMPLATE_TEAM_WINS: u8 = 1;
pub const TEMPLATE_TOTAL_GOALS: u8 = 2;

#[program]
pub mod tifo {
    use super::*;

    pub fn create_commitment(
        ctx: Context<CreateCommitment>,
        fixture_id: u64,
        nonce: u64,
        kickoff_ts: i64,
        condition_template: u8,
        condition_param: u64,
        beneficiary: Pubkey,
        deposit_lamports: u64,
        name: [u8; 64],
    ) -> Result<()> {
        validate_condition(condition_template, condition_param)?;
        let now = Clock::get()?.unix_timestamp;
        require!(kickoff_ts > now, TifoError::KickoffInPast);
        require!(
            deposit_lamports >= MIN_DEPOSIT_LAMPORTS,
            TifoError::DepositTooSmall
        );

        {
            let commitment = &mut ctx.accounts.commitment.load_init()?;
            commitment.fixture_id = fixture_id;
            commitment.kickoff_ts = kickoff_ts;
            commitment.condition_template = condition_template;
            commitment.condition_param = condition_param;
            commitment.beneficiary = beneficiary;
            commitment.founder = ctx.accounts.founder.key();
            commitment.name = name;
            commitment.status = STATUS_OPEN;
            commitment.member_count = 1;
            commitment.vault_bump = ctx.bumps.vault;
            commitment.bump = ctx.bumps.commitment;
            commitment.members[0] = MemberEntry {
                wallet: ctx.accounts.founder.key(),
                deposit_lamports,
                withdrawn: 0,
                claimed: 0,
                _pad: [0; 6],
            };
        }

        deposit_to_vault(
            &ctx.accounts.founder,
            &ctx.accounts.vault,
            &ctx.accounts.system_program,
            deposit_lamports,
        )?;

        emit!(CommitmentCreated {
            commitment: ctx.accounts.commitment.key(),
            fixture_id,
            kickoff_ts,
            condition_template,
            condition_param,
            beneficiary,
            founder: ctx.accounts.founder.key(),
            deposit_lamports,
            name,
        });
        Ok(())
    }

    pub fn join(ctx: Context<Join>, deposit_lamports: u64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        {
            let commitment = &mut ctx.accounts.commitment.load_mut()?;
            require!(commitment.status == STATUS_OPEN, TifoError::NotOpen);
            require!(now < commitment.kickoff_ts, TifoError::KickoffPassed);
            require!(
                (commitment.member_count as usize) < MAX_MEMBERS,
                TifoError::MemberLimitReached
            );
            require!(
                deposit_lamports >= MIN_DEPOSIT_LAMPORTS,
                TifoError::DepositTooSmall
            );

            let member_key = ctx.accounts.member.key();
            let mut slot: Option<usize> = None;
            for i in 0..MAX_MEMBERS {
                let entry = &commitment.members[i];
                if entry.wallet == Pubkey::default() {
                    slot = Some(i);
                    break;
                }
                // present or previously-withdrawn wallets may not (re)join
                require!(entry.wallet != member_key, TifoError::AlreadyMember);
            }
            let slot = slot.ok_or(TifoError::MemberLimitReached)?;
            commitment.members[slot] = MemberEntry {
                wallet: member_key,
                deposit_lamports,
                withdrawn: 0,
                claimed: 0,
                _pad: [0; 6],
            };
            commitment.member_count += 1;
        }

        deposit_to_vault(
            &ctx.accounts.member,
            &ctx.accounts.vault,
            &ctx.accounts.system_program,
            deposit_lamports,
        )?;

        emit!(MemberJoined {
            commitment: ctx.accounts.commitment.key(),
            member: ctx.accounts.member.key(),
            deposit_lamports,
        });
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let vault_bump;
        let (amount, closed) = {
            let commitment = &mut ctx.accounts.commitment.load_mut()?;
            require!(commitment.status == STATUS_OPEN, TifoError::NotOpen);
            require!(now < commitment.kickoff_ts, TifoError::KickoffPassed);

            let member_key = ctx.accounts.member.key();
            let idx = find_member(commitment, &member_key)?;
            let entry = &mut commitment.members[idx];
            require!(entry.withdrawn == 0, TifoError::AlreadyWithdrawn);
            require!(entry.claimed == 0, TifoError::AlreadyClaimed);
            entry.withdrawn = 1;
            let amount = entry.deposit_lamports;
            commitment.member_count -= 1;
            let closed = commitment.member_count == 0;
            if closed {
                commitment.status = STATUS_CLOSED;
            }
            vault_bump = commitment.vault_bump;
            (amount, closed)
        };

        vault_pay(
            &ctx.accounts.vault,
            ctx.accounts.member.to_account_info(),
            &ctx.accounts.system_program,
            &ctx.accounts.commitment.key(),
            vault_bump,
            amount,
            closed, // last withdrawer of a closing commitment sweeps any dust
        )?;

        emit!(MemberWithdrew {
            commitment: ctx.accounts.commitment.key(),
            member: ctx.accounts.member.key(),
            deposit_lamports: amount,
        });
        if closed {
            emit!(CommitmentClosed {
                commitment: ctx.accounts.commitment.key(),
            });
        }
        Ok(())
    }

    pub fn resolve(ctx: Context<Resolve>, payload: StatValidationInput) -> Result<()> {
        let (fixture_id, template, param, vault_bump) = {
            let commitment = &ctx.accounts.commitment.load()?;
            require!(commitment.status == STATUS_OPEN, TifoError::NotOpen);
            require_keys_eq!(
                ctx.accounts.beneficiary.key(),
                commitment.beneficiary,
                TifoError::BeneficiaryMismatch
            );
            (
                commitment.fixture_id,
                commitment.condition_template,
                commitment.condition_param,
                commitment.vault_bump,
            )
        };

        // The proof must be for this commitment's fixture — a resolver cannot
        // substitute another match's result.
        require!(
            payload.fixture_summary.fixture_id == fixture_id as i64,
            TifoError::FixtureMismatch
        );

        // Strategy is derived on-chain from the stored template. Callers cannot
        // supply their own strategy, otherwise the outcome would be attacker-chosen.
        let strategy = build_strategy(template, param)?;

        let cpi_ctx = CpiContext::new(
            ctx.accounts.txoracle_program.to_account_info(),
            txoracle::cpi::accounts::ValidateStatV2 {
                daily_scores_merkle_roots: ctx.accounts.daily_scores_merkle_roots.to_account_info(),
            },
        );
        let condition_met = txoracle::cpi::validate_stat_v2(cpi_ctx, payload, strategy)?.get();

        if condition_met {
            let amount = ctx.accounts.vault.lamports();
            {
                let commitment = &mut ctx.accounts.commitment.load_mut()?;
                commitment.status = STATUS_EXECUTED;
            }
            vault_pay(
                &ctx.accounts.vault,
                ctx.accounts.beneficiary.to_account_info(),
                &ctx.accounts.system_program,
                &ctx.accounts.commitment.key(),
                vault_bump,
                amount,
                true, // full sweep: vault empties to beneficiary in the same tx
            )?;
            emit!(CommitmentExecuted {
                commitment: ctx.accounts.commitment.key(),
                beneficiary: ctx.accounts.beneficiary.key(),
                amount_lamports: amount,
            });
        } else {
            let commitment = &mut ctx.accounts.commitment.load_mut()?;
            commitment.status = STATUS_REFUNDED;
            emit!(CommitmentRefunded {
                commitment: ctx.accounts.commitment.key(),
            });
        }
        Ok(())
    }

    pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
        let vault_bump;
        let (amount, all_claimed) = {
            let commitment = &mut ctx.accounts.commitment.load_mut()?;
            require!(
                commitment.status == STATUS_REFUNDED || commitment.status == STATUS_VOID,
                TifoError::NotRefundable
            );
            let member_key = ctx.accounts.member.key();
            let idx = find_member(commitment, &member_key)?;
            let entry = &mut commitment.members[idx];
            require!(entry.withdrawn == 0, TifoError::AlreadyWithdrawn);
            require!(entry.claimed == 0, TifoError::AlreadyClaimed);
            entry.claimed = 1;
            let amount = entry.deposit_lamports;

            let mut all_claimed = true;
            for i in 0..MAX_MEMBERS {
                let e = &commitment.members[i];
                if e.wallet == Pubkey::default() {
                    break;
                }
                if e.withdrawn == 0 && e.claimed == 0 {
                    all_claimed = false;
                    break;
                }
            }
            vault_bump = commitment.vault_bump;
            (amount, all_claimed)
        };

        vault_pay(
            &ctx.accounts.vault,
            ctx.accounts.member.to_account_info(),
            &ctx.accounts.system_program,
            &ctx.accounts.commitment.key(),
            vault_bump,
            amount,
            all_claimed, // final claimer sweeps the vault to zero (rent back)
        )?;

        emit!(RefundClaimed {
            commitment: ctx.accounts.commitment.key(),
            member: ctx.accounts.member.key(),
            amount_lamports: amount,
        });
        Ok(())
    }

    pub fn void_timeout(ctx: Context<VoidTimeout>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let commitment = &mut ctx.accounts.commitment.load_mut()?;
        require!(commitment.status == STATUS_OPEN, TifoError::NotOpen);
        // only members may trigger timeout — guards against griefing by outsiders
        let member_key = ctx.accounts.member.key();
        let idx = find_member(commitment, &member_key)?;
        require!(
            commitment.members[idx].withdrawn == 0,
            TifoError::AlreadyWithdrawn
        );
        require!(
            now >= commitment.kickoff_ts + TIMEOUT_SECONDS,
            TifoError::TimeoutNotReached
        );
        commitment.status = STATUS_VOID;
        emit!(CommitmentVoided {
            commitment: ctx.accounts.commitment.key(),
            reason: 1, // 0 = fixture cancelled, 1 = timeout
        });
        Ok(())
    }
}

// ---------- helpers ----------

fn validate_condition(template: u8, param: u64) -> Result<()> {
    match template {
        TEMPLATE_BTTS => Ok(()),
        TEMPLATE_TEAM_WINS => {
            require!(param <= 1, TifoError::ConditionParamInvalid);
            Ok(())
        }
        TEMPLATE_TOTAL_GOALS => {
            require!(param >= 1 && param <= 20, TifoError::ConditionParamInvalid);
            Ok(())
        }
        _ => err!(TifoError::ConditionTemplateInvalid),
    }
}

fn build_strategy(template: u8, param: u64) -> Result<NDimensionalStrategy> {
    let gt = |threshold: i32| TraderPredicate {
        threshold,
        comparison: Comparison::GreaterThan,
    };
    let discrete_predicates = match template {
        TEMPLATE_BTTS => vec![
            StatPredicate::Single {
                index: 0,
                predicate: gt(0),
            },
            StatPredicate::Single {
                index: 1,
                predicate: gt(0),
            },
        ],
        TEMPLATE_TEAM_WINS => {
            let (index_a, index_b) = if param == 0 { (0, 1) } else { (1, 0) };
            vec![StatPredicate::Binary {
                index_a,
                index_b,
                op: BinaryExpression::Subtract,
                predicate: gt(0),
            }]
        }
        TEMPLATE_TOTAL_GOALS => vec![StatPredicate::Binary {
            index_a: 0,
            index_b: 1,
            op: BinaryExpression::Add,
            predicate: gt(param as i32 - 1),
        }],
        _ => return err!(TifoError::ConditionTemplateInvalid),
    };
    Ok(NDimensionalStrategy {
        geometric_targets: vec![],
        distance_predicate: None,
        discrete_predicates,
    })
}

fn find_member(commitment: &Commitment, wallet: &Pubkey) -> Result<usize> {
    for i in 0..MAX_MEMBERS {
        let entry = &commitment.members[i];
        if entry.wallet == Pubkey::default() {
            break;
        }
        if entry.wallet == *wallet {
            return Ok(i);
        }
    }
    err!(TifoError::MemberNotFound)
}

fn deposit_to_vault<'info>(
    from: &Signer<'info>,
    vault: &SystemAccount<'info>,
    system_program: &Program<'info, System>,
    amount: u64,
) -> Result<()> {
    system_program::transfer(
        CpiContext::new(
            system_program.to_account_info(),
            system_program::Transfer {
                from: from.to_account_info(),
                to: vault.to_account_info(),
            },
        ),
        amount,
    )
}

fn vault_pay<'info>(
    vault: &SystemAccount<'info>,
    to: AccountInfo<'info>,
    system_program: &Program<'info, System>,
    commitment_key: &Pubkey,
    vault_bump: u8,
    amount: u64,
    sweep: bool,
) -> Result<()> {
    // A sweeping outflow drains the entire remaining balance so the vault account
    // closes and its lamports (incl. any dust) go to the last recipient.
    let pay = if sweep { vault.lamports() } else { amount };
    let seeds: &[&[u8]] = &[b"vault", commitment_key.as_ref(), &[vault_bump]];
    system_program::transfer(
        CpiContext::new_with_signer(
            system_program.to_account_info(),
            system_program::Transfer {
                from: vault.to_account_info(),
                to,
            },
            &[seeds],
        ),
        pay,
    )
}

// ---------- accounts ----------

#[account(zero_copy)]
#[repr(C)]
pub struct Commitment {
    pub fixture_id: u64,
    pub kickoff_ts: i64,
    pub condition_param: u64,
    pub beneficiary: Pubkey,
    pub founder: Pubkey,
    pub name: [u8; 64],
    pub member_count: u32,
    pub condition_template: u8,
    pub status: u8,
    pub vault_bump: u8,
    pub bump: u8,
    pub members: [MemberEntry; MAX_MEMBERS],
}

#[zero_copy]
#[repr(C)]
pub struct MemberEntry {
    pub wallet: Pubkey,
    pub deposit_lamports: u64,
    pub withdrawn: u8,
    pub claimed: u8,
    pub _pad: [u8; 6],
}

pub const COMMITMENT_SPACE: usize = 8 + core::mem::size_of::<Commitment>();

#[derive(Accounts)]
#[instruction(fixture_id: u64, nonce: u64)]
pub struct CreateCommitment<'info> {
    #[account(mut)]
    pub founder: Signer<'info>,
    #[account(
        init,
        payer = founder,
        space = COMMITMENT_SPACE,
        // nonce lets one founder raise any number of commitments on the same fixture
        seeds = [b"commitment", fixture_id.to_le_bytes().as_ref(), founder.key().as_ref(), nonce.to_le_bytes().as_ref()],
        bump
    )]
    pub commitment: AccountLoader<'info, Commitment>,
    #[account(mut, seeds = [b"vault", commitment.key().as_ref()], bump)]
    pub vault: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Join<'info> {
    #[account(mut)]
    pub member: Signer<'info>,
    #[account(mut)]
    pub commitment: AccountLoader<'info, Commitment>,
    #[account(mut, seeds = [b"vault", commitment.key().as_ref()], bump)]
    pub vault: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub member: Signer<'info>,
    #[account(mut)]
    pub commitment: AccountLoader<'info, Commitment>,
    #[account(mut, seeds = [b"vault", commitment.key().as_ref()], bump)]
    pub vault: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Resolve<'info> {
    #[account(mut)]
    pub resolver: Signer<'info>,
    #[account(mut)]
    pub commitment: AccountLoader<'info, Commitment>,
    #[account(mut, seeds = [b"vault", commitment.key().as_ref()], bump)]
    pub vault: SystemAccount<'info>,
    /// CHECK: verified in handler against commitment.beneficiary
    #[account(mut)]
    pub beneficiary: UncheckedAccount<'info>,
    /// CHECK: TxLINE PDA; validated by the txoracle program itself
    pub daily_scores_merkle_roots: UncheckedAccount<'info>,
    pub txoracle_program: Program<'info, Txoracle>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimRefund<'info> {
    #[account(mut)]
    pub member: Signer<'info>,
    #[account(mut)]
    pub commitment: AccountLoader<'info, Commitment>,
    #[account(mut, seeds = [b"vault", commitment.key().as_ref()], bump)]
    pub vault: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VoidTimeout<'info> {
    pub member: Signer<'info>,
    #[account(mut)]
    pub commitment: AccountLoader<'info, Commitment>,
}

// ---------- events ----------

#[event]
pub struct CommitmentCreated {
    pub commitment: Pubkey,
    pub fixture_id: u64,
    pub kickoff_ts: i64,
    pub condition_template: u8,
    pub condition_param: u64,
    pub beneficiary: Pubkey,
    pub founder: Pubkey,
    pub deposit_lamports: u64,
    pub name: [u8; 64],
}

#[event]
pub struct MemberJoined {
    pub commitment: Pubkey,
    pub member: Pubkey,
    pub deposit_lamports: u64,
}

#[event]
pub struct MemberWithdrew {
    pub commitment: Pubkey,
    pub member: Pubkey,
    pub deposit_lamports: u64,
}

#[event]
pub struct CommitmentExecuted {
    pub commitment: Pubkey,
    pub beneficiary: Pubkey,
    pub amount_lamports: u64,
}

#[event]
pub struct CommitmentRefunded {
    pub commitment: Pubkey,
}

#[event]
pub struct RefundClaimed {
    pub commitment: Pubkey,
    pub member: Pubkey,
    pub amount_lamports: u64,
}

#[event]
pub struct CommitmentVoided {
    pub commitment: Pubkey,
    pub reason: u8,
}

#[event]
pub struct CommitmentClosed {
    pub commitment: Pubkey,
}

// ---------- errors ----------

#[error_code]
pub enum TifoError {
    #[msg("Unknown condition template")]
    ConditionTemplateInvalid,
    #[msg("Invalid condition parameter for this template")]
    ConditionParamInvalid,
    #[msg("Kickoff timestamp is in the past")]
    KickoffInPast,
    #[msg("Deposit below 0.01 SOL minimum")]
    DepositTooSmall,
    #[msg("Commitment is not open")]
    NotOpen,
    #[msg("Kickoff has passed — membership is locked")]
    KickoffPassed,
    #[msg("This DAO has reached its 200-member limit")]
    MemberLimitReached,
    #[msg("Wallet is already a member (or previously withdrew)")]
    AlreadyMember,
    #[msg("Wallet is not a member of this commitment")]
    MemberNotFound,
    #[msg("Member already withdrew")]
    AlreadyWithdrawn,
    #[msg("Refund already claimed")]
    AlreadyClaimed,
    #[msg("Commitment is not in a refundable state")]
    NotRefundable,
    #[msg("Proof fixture does not match commitment fixture")]
    FixtureMismatch,
    #[msg("Beneficiary account does not match commitment")]
    BeneficiaryMismatch,
    #[msg("7-day timeout not yet reached")]
    TimeoutNotReached,
}
