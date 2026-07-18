//! Hand-rolled CPI types + invocation for the TxLINE `txoracle` program.
//! Field layouts mirror txoracle IDL (devnet 6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J).
//! We use raw `invoke` with the known Anchor discriminators instead of
//! `declare_program!` so the dependency surface stays fully auditable.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::{get_return_data, invoke};

pub const TXORACLE_ID: Pubkey = pubkey!("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");

/// Anchor discriminator for `validate_stat_v2`
const VALIDATE_STAT_V2_DISC: [u8; 8] = [208, 215, 194, 214, 241, 71, 246, 178];
/// Anchor discriminator for `validate_fixture`
const VALIDATE_FIXTURE_DISC: [u8; 8] = [231, 129, 218, 86, 223, 114, 21, 126];

// ---------- scores / stat validation ----------

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ProofNode {
    pub hash: [u8; 32],
    pub is_right_sibling: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ScoreStat {
    pub key: u32,
    pub value: i32,
    pub period: i32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct StatLeaf {
    pub stat: ScoreStat,
    pub stat_proof: Vec<ProofNode>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ScoresUpdateStats {
    pub update_count: i32,
    pub min_timestamp: i64,
    pub max_timestamp: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ScoresBatchSummary {
    pub fixture_id: i64,
    pub update_stats: ScoresUpdateStats,
    pub events_sub_tree_root: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct StatValidationInput {
    pub ts: i64,
    pub fixture_summary: ScoresBatchSummary,
    pub fixture_proof: Vec<ProofNode>,
    pub main_tree_proof: Vec<ProofNode>,
    pub event_stat_root: [u8; 32],
    pub stats: Vec<StatLeaf>,
}

// ---------- strategy ----------

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum Comparison {
    GreaterThan,
    LessThan,
    EqualTo,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum BinaryExpression {
    Add,
    Subtract,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TraderPredicate {
    pub threshold: i32,
    pub comparison: Comparison,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum StatPredicate {
    Single {
        index: u8,
        predicate: TraderPredicate,
    },
    Binary {
        index_a: u8,
        index_b: u8,
        op: BinaryExpression,
        predicate: TraderPredicate,
    },
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct GeometricTarget {
    pub stat_index: u8,
    pub prediction: i32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct NDimensionalStrategy {
    pub geometric_targets: Vec<GeometricTarget>,
    pub distance_predicate: Option<TraderPredicate>,
    pub discrete_predicates: Vec<StatPredicate>,
}

// ---------- fixture validation ----------

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Fixture {
    pub ts: i64,
    pub start_time: i64,
    pub competition: String,
    pub competition_id: i32,
    pub fixture_group_id: i32,
    pub participant1_id: i32,
    pub participant1: String,
    pub participant2_id: i32,
    pub participant2: String,
    pub fixture_id: i64,
    pub participant1_is_home: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct FixtureUpdateStats {
    pub update_count: u32,
    pub min_timestamp: i64,
    pub max_timestamp: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct FixtureBatchSummary {
    pub fixture_id: i64,
    pub competition_id: i32,
    pub competition: String,
    pub update_stats: FixtureUpdateStats,
    pub update_sub_tree_root: [u8; 32],
}

// ---------- CPI helpers ----------

fn call_txoracle_bool<'info>(
    txline_program: &AccountInfo<'info>,
    roots_account: &AccountInfo<'info>,
    data: Vec<u8>,
) -> Result<bool> {
    let ix = Instruction {
        program_id: TXORACLE_ID,
        accounts: vec![AccountMeta::new_readonly(*roots_account.key, false)],
        data,
    };
    invoke(&ix, &[roots_account.clone(), txline_program.clone()])?;

    let (pid, ret) = get_return_data().ok_or(error!(TxoracleError::NoReturnData))?;
    require_keys_eq!(pid, TXORACLE_ID, TxoracleError::WrongReturnProgram);
    require!(!ret.is_empty(), TxoracleError::NoReturnData);
    Ok(ret[0] == 1)
}

/// CPI into `validate_stat_v2`. Returns whether the strategy holds against the proof.
pub fn validate_stat_v2<'info>(
    txline_program: &AccountInfo<'info>,
    daily_scores_roots: &AccountInfo<'info>,
    payload: &StatValidationInput,
    strategy: &NDimensionalStrategy,
) -> Result<bool> {
    let mut data = Vec::with_capacity(1024);
    data.extend_from_slice(&VALIDATE_STAT_V2_DISC);
    payload.serialize(&mut data)?;
    strategy.serialize(&mut data)?;
    call_txoracle_bool(txline_program, daily_scores_roots, data)
}

/// CPI into `validate_fixture`. Returns whether the fixture snapshot is proven.
pub fn validate_fixture<'info>(
    txline_program: &AccountInfo<'info>,
    ten_daily_fixtures_roots: &AccountInfo<'info>,
    snapshot: &Fixture,
    summary: &FixtureBatchSummary,
    sub_tree_proof: &Vec<ProofNode>,
    main_tree_proof: &Vec<ProofNode>,
) -> Result<bool> {
    let mut data = Vec::with_capacity(1024);
    data.extend_from_slice(&VALIDATE_FIXTURE_DISC);
    snapshot.serialize(&mut data)?;
    summary.serialize(&mut data)?;
    sub_tree_proof.serialize(&mut data)?;
    main_tree_proof.serialize(&mut data)?;
    call_txoracle_bool(txline_program, ten_daily_fixtures_roots, data)
}

#[error_code]
pub enum TxoracleError {
    #[msg("txoracle CPI returned no data")]
    NoReturnData,
    #[msg("return data came from unexpected program")]
    WrongReturnProgram,
}
