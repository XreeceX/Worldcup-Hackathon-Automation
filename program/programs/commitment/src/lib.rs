//! Social Commitment Engine — conditional pledges settled by TxLINE Merkle proofs.
//!
//! Fans (individually or as a group) lock SOL against a match condition.
//! If the condition holds at full time — proven on-chain via CPI into TxLINE's
//! `validate_stat_v2` — the vault pays the pre-chosen beneficiary atomically.
//! Otherwise members claim refunds. No admin key exists in any fund path.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_lang::solana_program::system_instruction;

pub mod txoracle;
use txoracle::*;

declare_id!("3uyiF93zMvUcP2o1Cqnt2iS4bXwYeBcTMTvbaTf5B3RJ");

pub const MIN_DEPOSIT_LAMPORTS: u64 = 10_000_000; // 0.01 SOL
pub const MAX_MEMBERS: u32 = 500;
/// Member slots pre-allocated at creation; join reallocs beyond this.
pub const INITIAL_MEMBER_CAPACITY: usize = 25;
pub const TIMEOUT_SECONDS: i64 = 7 * 86_400;
/// Create/join allowed through kickoff + this window (covers live play / ET).
pub const MATCH_WINDOW_SECONDS: i64 = (3 * 3600) + 1800; // 3.5 hours
/// TxLINE marks a fully finalised score record with period == 100.
pub const FINAL_PERIOD: i32 = 100;
/// gameState occupies the top 16 bits of a packed fixture id. 16 = Cancelled.
const GAME_STATE_SHIFT: i64 = 1 << 48;
const GAME_STATE_CANCELLED: i64 = 16;

// Fixed account bytes: 8 disc + 8 fixture + 8 kickoff + 1 template + 8 param
// + 32 beneficiary + 32 vault + 32 founder + 64 name + 1 status + 4 count
// + 1 vault_bump + 1 bump + 4 vec-len prefix
const FIXED_SPACE: usize = 204;
const MEMBER_SPACE: usize = 42;

fn space_for(members: usize) -> usize {
    FIXED_SPACE + members * MEMBER_SPACE
}

#[program]
pub mod commitment {
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
        require!(condition_template <= 7, EngineError::ConditionTemplateInvalid);
        validate_condition_param(condition_template, condition_param)?;
        let now = Clock::get()?.unix_timestamp;
        // Allow create while upcoming or in-play; block after the match window.
        require!(
            now < kickoff_ts + MATCH_WINDOW_SECONDS,
            EngineError::MatchWindowClosed
        );
        require!(deposit_lamports >= MIN_DEPOSIT_LAMPORTS, EngineError::DepositTooSmall);
        // Beneficiary must be someone else — pledges are commitments to a cause/peer, not self-payouts.
        require_keys_neq!(
            beneficiary,
            ctx.accounts.founder.key(),
            EngineError::SelfBeneficiary
        );
        // nonce is part of the PDA seeds (multiple pledges per wallet/fixture).
        let _ = nonce;

        let c = &mut ctx.accounts.commitment;
        c.fixture_id = fixture_id;
        c.kickoff_ts = kickoff_ts;
        c.condition_template = condition_template;
        c.condition_param = condition_param;
        c.beneficiary = beneficiary;
        c.vault = ctx.accounts.vault.key();
        c.founder = ctx.accounts.founder.key();
        c.name = name;
        c.status = CommitmentStatus::Open;
        c.member_count = 1;
        c.members.push(MemberEntry {
            wallet: ctx.accounts.founder.key(),
            deposit_lamports,
            withdrawn: false,
            claimed: false,
        });
        c.vault_bump = ctx.bumps.vault;
        c.bump = ctx.bumps.commitment;

        transfer_in(
            &ctx.accounts.founder,
            &ctx.accounts.vault,
            &ctx.accounts.system_program,
            deposit_lamports,
        )?;

        emit!(CommitmentCreated {
            commitment: c.key(),
            fixture_id,
            kickoff_ts,
            condition_template,
            condition_param,
            beneficiary,
            founder: c.founder,
            deposit_lamports,
            name,
        });
        Ok(())
    }

    pub fn join(ctx: Context<Join>, deposit_lamports: u64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        {
            let c = &ctx.accounts.commitment;
            require!(c.status == CommitmentStatus::Open, EngineError::NotOpen);
            require!(
                now < c.kickoff_ts + MATCH_WINDOW_SECONDS,
                EngineError::MatchWindowClosed
            );
            require!(c.member_count < MAX_MEMBERS, EngineError::MemberLimitReached);
            require!(deposit_lamports >= MIN_DEPOSIT_LAMPORTS, EngineError::DepositTooSmall);
            let signer = ctx.accounts.member.key();
            // Any prior entry (active OR withdrawn) blocks joining: rejoin is not allowed.
            require!(
                !c.members.iter().any(|m| m.wallet == signer),
                EngineError::AlreadyMember
            );
        }

        // Grow the account if the pre-allocated member capacity is exhausted.
        let info = ctx.accounts.commitment.to_account_info();
        let needed = space_for(ctx.accounts.commitment.members.len() + 1);
        if info.data_len() < needed {
            let rent = Rent::get()?;
            let new_min = rent.minimum_balance(needed);
            let delta = new_min.saturating_sub(info.lamports());
            if delta > 0 {
                transfer_in(
                    &ctx.accounts.member,
                    &info,
                    &ctx.accounts.system_program,
                    delta,
                )?;
            }
            info.realloc(needed, false)?;
        }

        let c = &mut ctx.accounts.commitment;
        c.members.push(MemberEntry {
            wallet: ctx.accounts.member.key(),
            deposit_lamports,
            withdrawn: false,
            claimed: false,
        });
        c.member_count += 1;

        transfer_in(
            &ctx.accounts.member,
            &ctx.accounts.vault,
            &ctx.accounts.system_program,
            deposit_lamports,
        )?;

        emit!(MemberJoined {
            commitment: c.key(),
            member: ctx.accounts.member.key(),
            deposit_lamports,
        });
        Ok(())
    }

    pub fn withdraw(ctx: Context<MemberAction>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let commitment_key = ctx.accounts.commitment.key();
        let vault_bump;
        let amount;
        let closed;
        {
            let c = &mut ctx.accounts.commitment;
            require!(c.status == CommitmentStatus::Open, EngineError::NotOpen);
            require!(now < c.kickoff_ts, EngineError::KickoffPassed);
            let signer = ctx.accounts.member.key();
            let entry = c
                .members
                .iter_mut()
                .find(|m| m.wallet == signer)
                .ok_or(EngineError::MemberNotFound)?;
            require!(!entry.withdrawn && !entry.claimed, EngineError::AlreadyWithdrawn);
            entry.withdrawn = true;
            amount = entry.deposit_lamports;
            c.member_count -= 1;
            closed = c.member_count == 0;
            if closed {
                c.status = CommitmentStatus::Closed;
            }
            vault_bump = c.vault_bump;
        }

        transfer_out(
            &ctx.accounts.vault,
            &ctx.accounts.member.to_account_info(),
            &commitment_key,
            vault_bump,
            amount,
        )?;

        emit!(MemberWithdrew {
            commitment: commitment_key,
            member: ctx.accounts.member.key(),
            deposit_lamports: amount,
        });
        if closed {
            emit!(CommitmentClosed { commitment: commitment_key });
        }
        Ok(())
    }

    /// Permissionless. Builds the strategy ON-CHAIN from the stored condition —
    /// the resolver supplies only the Merkle proof package. The proof is pinned
    /// to the commitment's fixture, to the template's stat keys in order, and to a
    /// finalised (period == 100) record, so no caller can steer the outcome.
    pub fn resolve(ctx: Context<Resolve>, proof: StatValidationInput) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let commitment_key = ctx.accounts.commitment.key();
        {
            let c = &ctx.accounts.commitment;
            require!(c.status == CommitmentStatus::Open, EngineError::NotOpen);
            require!(now >= c.kickoff_ts, EngineError::MatchNotStarted);

            // Pin the proof to this commitment's fixture and to final-whistle data.
            require!(
                proof.fixture_summary.fixture_id == c.fixture_id as i64,
                EngineError::FixtureMismatch
            );
            require!(proof.stats.len() == 2, EngineError::BadStatKeys);
            let (key_a, key_b) = expected_stat_keys(c.condition_template);
            require!(
                proof.stats[0].stat.key == key_a && proof.stats[1].stat.key == key_b,
                EngineError::BadStatKeys
            );
            require!(
                proof.stats.iter().all(|s| s.stat.period == FINAL_PERIOD),
                EngineError::ProofNotFinal
            );

            // The daily-roots PDA must be the txoracle PDA for the proof's epoch day.
            let epoch_day = (proof.fixture_summary.update_stats.min_timestamp / 86_400_000) as u16;
            let (expected_roots, _) = Pubkey::find_program_address(
                &[b"daily_scores_roots", &epoch_day.to_le_bytes()],
                &TXORACLE_ID,
            );
            require_keys_eq!(
                ctx.accounts.daily_scores_roots.key(),
                expected_roots,
                EngineError::WrongRootsAccount
            );
        }

        let strategy = built_in_strategy(
            ctx.accounts.commitment.condition_template,
            ctx.accounts.commitment.condition_param,
        );
        let condition_met = validate_stat_v2(
            &ctx.accounts.txline_program,
            &ctx.accounts.daily_scores_roots,
            &proof,
            &strategy,
        )?;

        if condition_met {
            let vault_balance = ctx.accounts.vault.lamports();
            let vault_bump = ctx.accounts.commitment.vault_bump;
            transfer_out(
                &ctx.accounts.vault,
                &ctx.accounts.beneficiary,
                &commitment_key,
                vault_bump,
                vault_balance,
            )?;
            let c = &mut ctx.accounts.commitment;
            c.status = CommitmentStatus::Executed;
            emit!(CommitmentExecuted {
                commitment: commitment_key,
                beneficiary: c.beneficiary,
                amount_lamports: vault_balance,
            });
        } else {
            let c = &mut ctx.accounts.commitment;
            c.status = CommitmentStatus::Refunded;
            emit!(CommitmentRefunded { commitment: commitment_key });
        }
        Ok(())
    }

    pub fn claim_refund(ctx: Context<MemberAction>) -> Result<()> {
        let commitment_key = ctx.accounts.commitment.key();
        let vault_bump;
        let amount;
        let all_claimed;
        {
            let c = &mut ctx.accounts.commitment;
            require!(
                c.status == CommitmentStatus::Refunded || c.status == CommitmentStatus::Void,
                EngineError::NotRefundable
            );
            let signer = ctx.accounts.member.key();
            let entry = c
                .members
                .iter_mut()
                .find(|m| m.wallet == signer && !m.withdrawn)
                .ok_or(EngineError::MemberNotFound)?;
            require!(!entry.claimed, EngineError::AlreadyClaimed);
            entry.claimed = true;
            amount = entry.deposit_lamports;
            vault_bump = c.vault_bump;
            all_claimed = c.members.iter().all(|m| m.withdrawn || m.claimed);
        }

        // Last claimer drains the vault entirely (their share + any remainder),
        // which closes the system-owned vault account.
        let payout = if all_claimed {
            ctx.accounts.vault.lamports()
        } else {
            amount
        };
        transfer_out(
            &ctx.accounts.vault,
            &ctx.accounts.member.to_account_info(),
            &commitment_key,
            vault_bump,
            payout,
        )?;

        emit!(RefundClaimed {
            commitment: commitment_key,
            member: ctx.accounts.member.key(),
            amount_lamports: payout,
        });
        Ok(())
    }

    /// Permissionless void: proves via `validate_fixture` CPI that TxLINE marked
    /// this fixture Cancelled (gameState 16 packed into the fixture id's top bits).
    pub fn void_fixture(
        ctx: Context<VoidFixture>,
        snapshot: txoracle::Fixture,
        summary: FixtureBatchSummary,
        sub_tree_proof: Vec<ProofNode>,
        main_tree_proof: Vec<ProofNode>,
    ) -> Result<()> {
        let commitment_key = ctx.accounts.commitment.key();
        {
            let c = &ctx.accounts.commitment;
            require!(c.status == CommitmentStatus::Open, EngineError::NotOpen);

            let game_state = snapshot.fixture_id.div_euclid(GAME_STATE_SHIFT);
            let pure_id = snapshot.fixture_id.rem_euclid(GAME_STATE_SHIFT);
            require!(pure_id == c.fixture_id as i64, EngineError::FixtureMismatch);
            require!(game_state == GAME_STATE_CANCELLED, EngineError::FixtureNotCancelled);

            let epoch_day = (summary.update_stats.min_timestamp / 86_400_000) as u16;
            let window_start = (epoch_day / 10) * 10;
            let (expected_roots, _) = Pubkey::find_program_address(
                &[b"ten_daily_fixtures_roots", &window_start.to_le_bytes()],
                &TXORACLE_ID,
            );
            require_keys_eq!(
                ctx.accounts.ten_daily_fixtures_roots.key(),
                expected_roots,
                EngineError::WrongRootsAccount
            );
        }

        let valid = validate_fixture(
            &ctx.accounts.txline_program,
            &ctx.accounts.ten_daily_fixtures_roots,
            &snapshot,
            &summary,
            &sub_tree_proof,
            &main_tree_proof,
        )?;
        require!(valid, EngineError::ProofInvalid);

        ctx.accounts.commitment.status = CommitmentStatus::Void;
        emit!(CommitmentVoided {
            commitment: commitment_key,
            reason: VoidReason::FixtureCancelled,
        });
        Ok(())
    }

    /// Member-only escape hatch: 7+ days past kickoff with no resolution.
    pub fn void_timeout(ctx: Context<VoidTimeout>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let c = &mut ctx.accounts.commitment;
        require!(c.status == CommitmentStatus::Open, EngineError::NotOpen);
        let signer = ctx.accounts.member.key();
        require!(
            c.members.iter().any(|m| m.wallet == signer && !m.withdrawn),
            EngineError::MemberNotFound
        );
        require!(
            now >= c.kickoff_ts + TIMEOUT_SECONDS,
            EngineError::TimeoutNotReached
        );
        c.status = CommitmentStatus::Void;
        emit!(CommitmentVoided {
            commitment: c.key(),
            reason: VoidReason::Timeout,
        });
        Ok(())
    }
}

/// Unpack `team * 256 + n` used by TeamScoresAtLeast / WinsByAtLeast.
fn unpack_team_threshold(param: u64) -> (u8, u64) {
    let team = (param / 256) as u8;
    let n = param % 256;
    (team, n)
}

fn validate_condition_param(template: u8, param: u64) -> Result<()> {
    match template {
        0 | 2 | 7 => Ok(()), // BTTS / Draw / GoesToPens — param ignored
        1 | 6 => {
            require!(param <= 1, EngineError::ConditionParamInvalid);
            Ok(())
        }
        3 => {
            // Team scores ≥ N: team ∈ {0,1}, N ∈ 1..=8
            let (team, n) = unpack_team_threshold(param);
            require!(team <= 1, EngineError::ConditionParamInvalid);
            require!((1..=8).contains(&n), EngineError::ConditionParamInvalid);
            Ok(())
        }
        4 => {
            // Total goals ≥ N: N ∈ 1..=10
            require!((1..=10).contains(&param), EngineError::ConditionParamInvalid);
            Ok(())
        }
        5 => {
            // Wins by ≥ N: team ∈ {0,1}, margin ∈ 1..=5
            let (team, n) = unpack_team_threshold(param);
            require!(team <= 1, EngineError::ConditionParamInvalid);
            require!((1..=5).contains(&n), EngineError::ConditionParamInvalid);
            Ok(())
        }
        _ => err!(EngineError::ConditionTemplateInvalid),
    }
}

/// Stat keys proven at resolve: goals [1,2] or shootout [6001,6002].
fn expected_stat_keys(template: u8) -> (u32, u32) {
    match template {
        6 | 7 => (6001, 6002),
        _ => (1, 2),
    }
}

/// Strategy templates, reconstructed on-chain — never taken from the caller.
fn built_in_strategy(template: u8, param: u64) -> NDimensionalStrategy {
    match template {
        // BTTS: P1 goals > 0 AND P2 goals > 0
        0 => NDimensionalStrategy {
            geometric_targets: vec![],
            distance_predicate: None,
            discrete_predicates: vec![
                StatPredicate::Single {
                    index: 0,
                    predicate: TraderPredicate {
                        threshold: 0,
                        comparison: Comparison::GreaterThan,
                    },
                },
                StatPredicate::Single {
                    index: 1,
                    predicate: TraderPredicate {
                        threshold: 0,
                        comparison: Comparison::GreaterThan,
                    },
                },
            ],
        },
        // TeamWins: (winner − loser) > 0; param 0 = home, 1 = away
        1 => {
            let (a, b) = if param == 0 { (0u8, 1u8) } else { (1u8, 0u8) };
            NDimensionalStrategy {
                geometric_targets: vec![],
                distance_predicate: None,
                discrete_predicates: vec![StatPredicate::Binary {
                    index_a: a,
                    index_b: b,
                    op: BinaryExpression::Subtract,
                    predicate: TraderPredicate {
                        threshold: 0,
                        comparison: Comparison::GreaterThan,
                    },
                }],
            }
        }
        // Draw: P1 − P2 == 0
        2 => NDimensionalStrategy {
            geometric_targets: vec![],
            distance_predicate: None,
            discrete_predicates: vec![StatPredicate::Binary {
                index_a: 0,
                index_b: 1,
                op: BinaryExpression::Subtract,
                predicate: TraderPredicate {
                    threshold: 0,
                    comparison: Comparison::EqualTo,
                },
            }],
        },
        // Team scores ≥ N: that side's goals > N−1
        3 => {
            let (team, n) = unpack_team_threshold(param);
            let threshold = (n as i32) - 1;
            NDimensionalStrategy {
                geometric_targets: vec![],
                distance_predicate: None,
                discrete_predicates: vec![StatPredicate::Single {
                    index: team,
                    predicate: TraderPredicate {
                        threshold,
                        comparison: Comparison::GreaterThan,
                    },
                }],
            }
        }
        // Total goals ≥ N: P1 + P2 > N−1
        4 => {
            let threshold = (param as i32) - 1;
            NDimensionalStrategy {
                geometric_targets: vec![],
                distance_predicate: None,
                discrete_predicates: vec![StatPredicate::Binary {
                    index_a: 0,
                    index_b: 1,
                    op: BinaryExpression::Add,
                    predicate: TraderPredicate {
                        threshold,
                        comparison: Comparison::GreaterThan,
                    },
                }],
            }
        }
        // Wins by ≥ N: (winner − loser) > N−1
        5 => {
            let (team, n) = unpack_team_threshold(param);
            let (a, b) = if team == 0 { (0u8, 1u8) } else { (1u8, 0u8) };
            let threshold = (n as i32) - 1;
            NDimensionalStrategy {
                geometric_targets: vec![],
                distance_predicate: None,
                discrete_predicates: vec![StatPredicate::Binary {
                    index_a: a,
                    index_b: b,
                    op: BinaryExpression::Subtract,
                    predicate: TraderPredicate {
                        threshold,
                        comparison: Comparison::GreaterThan,
                    },
                }],
            }
        }
        // Wins on penalties: shootout goals (6001/6002) winner − loser > 0
        6 => {
            let (a, b) = if param == 0 { (0u8, 1u8) } else { (1u8, 0u8) };
            NDimensionalStrategy {
                geometric_targets: vec![],
                distance_predicate: None,
                discrete_predicates: vec![StatPredicate::Binary {
                    index_a: a,
                    index_b: b,
                    op: BinaryExpression::Subtract,
                    predicate: TraderPredicate {
                        threshold: 0,
                        comparison: Comparison::GreaterThan,
                    },
                }],
            }
        }
        // Goes to penalties: at least one shootout goal recorded (6001+6002 > 0)
        7 => NDimensionalStrategy {
            geometric_targets: vec![],
            distance_predicate: None,
            discrete_predicates: vec![StatPredicate::Binary {
                index_a: 0,
                index_b: 1,
                op: BinaryExpression::Add,
                predicate: TraderPredicate {
                    threshold: 0,
                    comparison: Comparison::GreaterThan,
                },
            }],
        },
        // Unreachable when create validates template ≤ 7
        _ => {
            let (a, b) = if param == 0 { (0u8, 1u8) } else { (1u8, 0u8) };
            NDimensionalStrategy {
                geometric_targets: vec![],
                distance_predicate: None,
                discrete_predicates: vec![StatPredicate::Binary {
                    index_a: a,
                    index_b: b,
                    op: BinaryExpression::Subtract,
                    predicate: TraderPredicate {
                        threshold: 0,
                        comparison: Comparison::GreaterThan,
                    },
                }],
            }
        }
    }
}

fn transfer_in<'info>(
    from: &Signer<'info>,
    to: &AccountInfo<'info>,
    system_program: &Program<'info, System>,
    lamports: u64,
) -> Result<()> {
    anchor_lang::system_program::transfer(
        CpiContext::new(
            system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: from.to_account_info(),
                to: to.clone(),
            },
        ),
        lamports,
    )
}

/// Move lamports out of the system-owned vault PDA via invoke_signed.
fn transfer_out<'info>(
    vault: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    commitment_key: &Pubkey,
    vault_bump: u8,
    lamports: u64,
) -> Result<()> {
    let seeds: &[&[u8]] = &[b"vault", commitment_key.as_ref(), &[vault_bump]];
    invoke_signed(
        &system_instruction::transfer(vault.key, to.key, lamports),
        &[vault.clone(), to.clone()],
        &[seeds],
    )?;
    Ok(())
}

// ---------- accounts ----------

#[account]
pub struct Commitment {
    pub fixture_id: u64,
    pub kickoff_ts: i64,
    pub condition_template: u8,
    pub condition_param: u64,
    pub beneficiary: Pubkey,
    pub vault: Pubkey,
    pub founder: Pubkey,
    pub name: [u8; 64],
    pub status: CommitmentStatus,
    pub member_count: u32,
    pub vault_bump: u8,
    pub bump: u8,
    pub members: Vec<MemberEntry>,
}

#[derive(Clone, Copy, AnchorSerialize, AnchorDeserialize)]
pub struct MemberEntry {
    pub wallet: Pubkey,
    pub deposit_lamports: u64,
    pub withdrawn: bool,
    pub claimed: bool,
}

#[derive(Clone, Copy, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub enum CommitmentStatus {
    Open,
    Executed,
    Refunded,
    Void,
    Closed,
}

#[derive(Clone, Copy, AnchorSerialize, AnchorDeserialize)]
pub enum VoidReason {
    FixtureCancelled,
    Timeout,
}

// ---------- instruction contexts ----------

#[derive(Accounts)]
#[instruction(fixture_id: u64, nonce: u64)]
pub struct CreateCommitment<'info> {
    #[account(mut)]
    pub founder: Signer<'info>,
    #[account(
        init,
        payer = founder,
        space = space_for(INITIAL_MEMBER_CAPACITY),
        seeds = [
            b"commitment",
            fixture_id.to_le_bytes().as_ref(),
            founder.key().as_ref(),
            nonce.to_le_bytes().as_ref(),
        ],
        bump
    )]
    pub commitment: Account<'info, Commitment>,
    /// CHECK: system-owned lamport vault PDA; only ever moved via invoke_signed with these seeds
    #[account(mut, seeds = [b"vault", commitment.key().as_ref()], bump)]
    pub vault: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Join<'info> {
    #[account(mut)]
    pub member: Signer<'info>,
    #[account(mut)]
    pub commitment: Account<'info, Commitment>,
    /// CHECK: vault PDA, seeds verified
    #[account(mut, seeds = [b"vault", commitment.key().as_ref()], bump = commitment.vault_bump)]
    pub vault: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

/// Shared by `withdraw` and `claim_refund`.
#[derive(Accounts)]
pub struct MemberAction<'info> {
    #[account(mut)]
    pub member: Signer<'info>,
    #[account(mut)]
    pub commitment: Account<'info, Commitment>,
    /// CHECK: vault PDA, seeds verified
    #[account(mut, seeds = [b"vault", commitment.key().as_ref()], bump = commitment.vault_bump)]
    pub vault: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Resolve<'info> {
    pub resolver: Signer<'info>,
    #[account(mut)]
    pub commitment: Account<'info, Commitment>,
    /// CHECK: vault PDA, seeds verified
    #[account(mut, seeds = [b"vault", commitment.key().as_ref()], bump = commitment.vault_bump)]
    pub vault: AccountInfo<'info>,
    /// CHECK: must equal the beneficiary stored on the commitment
    #[account(mut, address = commitment.beneficiary @ EngineError::WrongBeneficiary)]
    pub beneficiary: AccountInfo<'info>,
    /// CHECK: txoracle daily_scores_roots PDA — re-derived in the handler from the proof's epoch day
    pub daily_scores_roots: AccountInfo<'info>,
    /// CHECK: pinned to the TxLINE oracle program id
    #[account(address = TXORACLE_ID @ EngineError::WrongOracleProgram, executable)]
    pub txline_program: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VoidFixture<'info> {
    pub resolver: Signer<'info>,
    #[account(mut)]
    pub commitment: Account<'info, Commitment>,
    /// CHECK: txoracle ten_daily_fixtures_roots PDA — re-derived in the handler
    pub ten_daily_fixtures_roots: AccountInfo<'info>,
    /// CHECK: pinned to the TxLINE oracle program id
    #[account(address = TXORACLE_ID @ EngineError::WrongOracleProgram, executable)]
    pub txline_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct VoidTimeout<'info> {
    pub member: Signer<'info>,
    #[account(mut)]
    pub commitment: Account<'info, Commitment>,
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
    pub reason: VoidReason,
}

#[event]
pub struct CommitmentClosed {
    pub commitment: Pubkey,
}

// ---------- errors ----------

#[error_code]
pub enum EngineError {
    #[msg("Unknown condition template")]
    ConditionTemplateInvalid,
    #[msg("Invalid condition parameter")]
    ConditionParamInvalid,
    #[msg("Kickoff timestamp is in the past")]
    KickoffInPast,
    #[msg("Match window closed — pledging only while upcoming or live")]
    MatchWindowClosed,
    #[msg("Deposit below 0.01 SOL minimum")]
    DepositTooSmall,
    #[msg("Commitment is not open")]
    NotOpen,
    #[msg("Kickoff has passed — membership is locked")]
    KickoffPassed,
    #[msg("Member limit (500) reached")]
    MemberLimitReached,
    #[msg("Wallet already joined this commitment")]
    AlreadyMember,
    #[msg("Wallet is not a member")]
    MemberNotFound,
    #[msg("Deposit already withdrawn")]
    AlreadyWithdrawn,
    #[msg("Refund already claimed")]
    AlreadyClaimed,
    #[msg("Commitment is not refundable")]
    NotRefundable,
    #[msg("Match has not started yet")]
    MatchNotStarted,
    #[msg("Proof is for a different fixture")]
    FixtureMismatch,
    #[msg("Proof must cover stat keys [1, 2] in order")]
    BadStatKeys,
    #[msg("Proof is not from a finalised score record")]
    ProofNotFinal,
    #[msg("Wrong Merkle roots account for this proof")]
    WrongRootsAccount,
    #[msg("Beneficiary account does not match commitment")]
    WrongBeneficiary,
    #[msg("Beneficiary cannot be your own wallet")]
    SelfBeneficiary,
    #[msg("Not the TxLINE oracle program")]
    WrongOracleProgram,
    #[msg("Fixture is not cancelled")]
    FixtureNotCancelled,
    #[msg("Merkle proof failed validation")]
    ProofInvalid,
    #[msg("7-day timeout not reached")]
    TimeoutNotReached,
}
