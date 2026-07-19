// Solana / Anchor side: wallet, provider, Commitment program, and the
// resolve / void_fixture transaction builders (design-01.md §6.3 / §6.4).

import fs from 'node:fs';
import anchor from '@coral-xyz/anchor';
import { log } from './logger.mjs';
import {
  TXORACLE_PROGRAM_ID,
  windowStartDayFromEpochDay,
} from './mapping.mjs';

const { web3, BN } = anchor;

export const TXORACLE_PUBKEY = new web3.PublicKey(TXORACLE_PROGRAM_ID);

function leU16(value) {
  return new BN(value).toArrayLike(Buffer, 'le', 2);
}

export function deriveDailyScoresRootsPda(epochDay) {
  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from('daily_scores_roots'), leU16(epochDay)],
    TXORACLE_PUBKEY
  )[0];
}

export function deriveTenDailyFixturesRootsPda(epochDay) {
  const windowStartDay = windowStartDayFromEpochDay(epochDay);
  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from('ten_daily_fixtures_roots'), leU16(windowStartDay)],
    TXORACLE_PUBKEY
  )[0];
}

export function deriveVaultPda(commitmentPubkey, programId) {
  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), commitmentPubkey.toBuffer()],
    programId
  )[0];
}

/** Anchor status enum → 'Open' | 'Executed' | 'Refunded' | 'Void' | 'Closed'. */
export function statusName(status) {
  const key = Object.keys(status ?? {})[0] ?? 'unknown';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/** FR-13.5: an already-resolved commitment (NotOpen) is a success-skip. */
export function isAlreadyResolvedError(e) {
  const code = e?.error?.errorCode?.code;
  if (code === 'NotOpen') return true;
  const msg = String(e?.message ?? e ?? '');
  return msg.includes('NotOpen') || msg.includes('Commitment is not open');
}

export function createChain(cfg) {
  const connection = new web3.Connection(cfg.anchorProviderUrl, 'confirmed');

  const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(cfg.anchorWallet, 'utf8')));
  const keypair = web3.Keypair.fromSecretKey(secretKey);
  const wallet = new anchor.Wallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });

  let program = null;
  try {
    const idl = JSON.parse(fs.readFileSync(cfg.idlPath, 'utf8'));
    if (idl.address && idl.address !== cfg.programId) {
      log.warn(
        `[chain] IDL address ${idl.address} differs from PROGRAM_ID ${cfg.programId} — using IDL address`
      );
    }
    program = new anchor.Program(idl, provider);
    log.info(`[chain] Commitment program loaded: ${program.programId.toBase58()}`);
  } catch (e) {
    log.warn(
      `[chain] Could not load IDL from ${cfg.idlPath} (${e.message}). ` +
        'Resolve/void transactions are unavailable until the program is built (anchor build).'
    );
  }

  function requireProgram() {
    if (!program) {
      throw new Error(`Anchor program unavailable — IDL not found at ${cfg.idlPath}`);
    }
    return program;
  }

  const computeBudgetIx = () =>
    web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 });

  async function fetchCommitment(pubkey) {
    const p = requireProgram();
    return p.account.commitment.fetch(new web3.PublicKey(pubkey));
  }

  /**
   * resolve(proof) — no strategy arg; the program rebuilds the strategy
   * on-chain from the stored condition. dailyScoresRoots is derived from the
   * PROOF's epoch day (BUG: never wall-clock).
   */
  async function sendResolveTransaction(commitmentPubkey, payload, epochDay) {
    const p = requireProgram();
    const commitment = new web3.PublicKey(commitmentPubkey);
    const account = await p.account.commitment.fetch(commitment);

    const txSig = await p.methods
      .resolve(payload)
      .accountsStrict({
        resolver: wallet.publicKey,
        commitment,
        vault: deriveVaultPda(commitment, p.programId),
        beneficiary: account.beneficiary,
        dailyScoresRoots: deriveDailyScoresRootsPda(epochDay),
        txlineProgram: TXORACLE_PUBKEY,
        systemProgram: web3.SystemProgram.programId,
      })
      .preInstructions([computeBudgetIx()])
      .rpc(); // provider commitment 'confirmed' — resolves after confirmation
    return txSig;
  }

  /**
   * BUG-03 fix support: read the on-chain commitment AFTER the resolve tx has
   * confirmed to learn the real outcome (Executed vs Refunded).
   */
  async function getResolutionOutcome(commitmentPubkey) {
    const account = await fetchCommitment(commitmentPubkey);
    const status = statusName(account.status);
    return { status, conditionMet: status === 'Executed' };
  }

  async function sendVoidFixtureTransaction(commitmentPubkey, mapped) {
    const p = requireProgram();
    const commitment = new web3.PublicKey(commitmentPubkey);

    const txSig = await p.methods
      .voidFixture(mapped.snapshot, mapped.summary, mapped.subTreeProof, mapped.mainTreeProof)
      .accountsStrict({
        resolver: wallet.publicKey,
        commitment,
        tenDailyFixturesRoots: deriveTenDailyFixturesRootsPda(mapped.epochDay),
        txlineProgram: TXORACLE_PUBKEY,
      })
      .preInstructions([computeBudgetIx()])
      .rpc();
    return txSig;
  }

  /**
   * Indexer fallback: scan every Commitment account on-chain and filter
   * client-side. Returns rows in the indexer's board shape.
   */
  async function scanOpenCommitments(fixtureId = null) {
    const p = requireProgram();
    const all = await p.account.commitment.all();
    return all
      .filter((c) => statusName(c.account.status) === 'Open')
      .filter((c) => fixtureId == null || c.account.fixtureId.toString() === String(fixtureId))
      .map((c) => ({
        pubkey: c.publicKey.toBase58(),
        fixture_id: Number(c.account.fixtureId.toString()),
        conditionTemplate: c.account.conditionTemplate,
        conditionParam: Number(c.account.conditionParam.toString()),
        beneficiary: c.account.beneficiary.toBase58(),
        status: 'Open',
      }));
  }

  return {
    connection,
    wallet,
    provider,
    get program() {
      return program;
    },
    fetchCommitment,
    sendResolveTransaction,
    getResolutionOutcome,
    sendVoidFixtureTransaction,
    scanOpenCommitments,
  };
}
