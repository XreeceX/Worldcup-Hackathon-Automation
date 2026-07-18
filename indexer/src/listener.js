import fs from 'node:fs';
import { Connection, PublicKey } from '@solana/web3.js';
import anchorPkg from '@coral-xyz/anchor';
import { config } from './config.js';
import { pool, ensureFixtureRow, getFixture } from './db.js';
import { conditionLabel, decodeName } from './lib.js';

const { BorshCoder, EventParser } = anchorPkg;

export const state = {
  listenerRunning: false,
  lastEventSlot: null,
  idlLoaded: false,
};

let connection = null;
let coder = null;
let eventParser = null;
let accountsDef = null; // idl.accounts entry for Commitment (has discriminator)
let idl = null;

// Anchor's coder may surface fields as snake_case (raw IDL) or camelCase
// depending on version — read both.
function field(obj, snake) {
  if (obj == null) return undefined;
  if (snake in obj) return obj[snake];
  const camel = snake.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  return obj[camel];
}

function statusToString(statusEnum) {
  if (statusEnum == null) return 'Open';
  const key = Object.keys(statusEnum)[0] ?? 'open';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

async function deriveLabel(template, param, fixtureId) {
  const fixture = await getFixture(fixtureId.toString());
  return conditionLabel(template, param, fixture?.home_team, fixture?.away_team);
}

// ---------- event handlers (all idempotent upserts) ----------

async function upsertCommitmentFromCreate(ev) {
  const pubkey = field(ev, 'commitment').toString();
  const fixtureId = field(ev, 'fixture_id').toString();
  const kickoffTs = Number(field(ev, 'kickoff_ts'));
  const template = Number(field(ev, 'condition_template'));
  const param = Number(field(ev, 'condition_param'));
  const deposit = field(ev, 'deposit_lamports').toString();
  const founder = field(ev, 'founder').toString();

  await ensureFixtureRow(fixtureId, kickoffTs * 1000);
  const label = await deriveLabel(template, param, fixtureId);

  await pool.query(
    `INSERT INTO commitments (pubkey, fixture_id, kickoff_ts, condition_template, condition_param,
       condition_label, beneficiary, founder, name, status, member_count, total_lamports, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Open',1,$10, now())
     ON CONFLICT (pubkey) DO NOTHING`,
    [
      pubkey,
      fixtureId,
      kickoffTs,
      template,
      param,
      label,
      field(ev, 'beneficiary').toString(),
      founder,
      decodeName(field(ev, 'name')),
      deposit,
    ]
  );
  await pool.query(
    `INSERT INTO commitment_members (commitment_pubkey, wallet, deposit_lamports, joined_at)
     VALUES ($1,$2,$3, now()) ON CONFLICT DO NOTHING`,
    [pubkey, founder, deposit]
  );
}

async function handleMemberJoined(ev) {
  const pubkey = field(ev, 'commitment').toString();
  const member = field(ev, 'member').toString();
  const deposit = field(ev, 'deposit_lamports').toString();
  const inserted = await pool.query(
    `INSERT INTO commitment_members (commitment_pubkey, wallet, deposit_lamports, joined_at)
     VALUES ($1,$2,$3, now()) ON CONFLICT DO NOTHING`,
    [pubkey, member, deposit]
  );
  if (inserted.rowCount > 0) {
    await pool.query(
      `UPDATE commitments SET member_count = member_count + 1,
         total_lamports = total_lamports + $2 WHERE pubkey = $1`,
      [pubkey, deposit]
    );
  }
}

async function handleMemberWithdrew(ev) {
  const pubkey = field(ev, 'commitment').toString();
  const member = field(ev, 'member').toString();
  const updated = await pool.query(
    `UPDATE commitment_members SET withdrawn = true
     WHERE commitment_pubkey = $1 AND wallet = $2 AND withdrawn = false`,
    [pubkey, member]
  );
  if (updated.rowCount > 0) {
    await pool.query(
      `UPDATE commitments SET member_count = member_count - 1,
         total_lamports = total_lamports - $2 WHERE pubkey = $1`,
      [pubkey, field(ev, 'deposit_lamports').toString()]
    );
  }
}

async function handleExecuted(ev, signature) {
  await pool.query(
    `UPDATE commitments SET status = 'Executed', resolved_at = now(),
       settlement_tx = COALESCE(settlement_tx, $2), total_lamports = 0
     WHERE pubkey = $1`,
    [field(ev, 'commitment').toString(), signature ?? null]
  );
}

async function handleRefunded(ev) {
  await pool.query(
    `UPDATE commitments SET status = 'Refunded', resolved_at = COALESCE(resolved_at, now())
     WHERE pubkey = $1`,
    [field(ev, 'commitment').toString()]
  );
}

async function handleRefundClaimed(ev) {
  await pool.query(
    `UPDATE commitment_members SET claimed = true
     WHERE commitment_pubkey = $1 AND wallet = $2`,
    [field(ev, 'commitment').toString(), field(ev, 'member').toString()]
  );
}

async function handleVoided(ev) {
  await pool.query(
    `UPDATE commitments SET status = 'Void', resolved_at = COALESCE(resolved_at, now())
     WHERE pubkey = $1`,
    [field(ev, 'commitment').toString()]
  );
}

async function handleClosed(ev) {
  await pool.query(
    `UPDATE commitments SET status = 'Closed', total_lamports = 0 WHERE pubkey = $1`,
    [field(ev, 'commitment').toString()]
  );
}

export async function applyEvent(name, data, signature) {
  switch (name.toLowerCase()) {
    case 'commitmentcreated':
      return upsertCommitmentFromCreate(data);
    case 'memberjoined':
      return handleMemberJoined(data);
    case 'memberwithdrew':
      return handleMemberWithdrew(data);
    case 'commitmentexecuted':
      return handleExecuted(data, signature);
    case 'commitmentrefunded':
      return handleRefunded(data);
    case 'refundclaimed':
      return handleRefundClaimed(data);
    case 'commitmentvoided':
      return handleVoided(data);
    case 'commitmentclosed':
      return handleClosed(data);
    default:
      console.warn(`[listener] unknown event: ${name}`);
  }
}

// ---------- IDL loading + onLogs subscription ----------

function tryLoadIdl() {
  try {
    idl = JSON.parse(fs.readFileSync(config.idlPath, 'utf8'));
  } catch {
    return false;
  }
  coder = new BorshCoder(idl);
  eventParser = new EventParser(new PublicKey(config.programId), coder);
  accountsDef = (idl.accounts ?? []).find((a) => a.name.toLowerCase() === 'commitment') ?? null;
  state.idlLoaded = true;
  console.log(`[listener] IDL loaded from ${config.idlPath}`);
  return true;
}

function subscribe() {
  connection = getConnection();
  connection.onLogs(
    new PublicKey(config.programId),
    async (logInfo, ctx) => {
      if (logInfo.err) return; // failed tx — its events did not take effect
      state.lastEventSlot = ctx.slot;
      try {
        for (const event of eventParser.parseLogs(logInfo.logs)) {
          console.log(`[listener] ${event.name} @ slot ${ctx.slot}`);
          await applyEvent(event.name, event.data, logInfo.signature);
        }
      } catch (err) {
        console.error('[listener] failed to process logs:', err.message);
      }
    },
    'confirmed'
  );
  state.listenerRunning = true;
  console.log(`[listener] onLogs subscribed to ${config.programId} via ${config.rpcUrl}`);
}

let sharedConnection = null;
export function getConnection() {
  if (!sharedConnection) {
    sharedConnection = new Connection(config.rpcUrl, 'confirmed');
  }
  return sharedConnection;
}

/**
 * Start the listener. If the IDL file is not on disk yet (program not built),
 * poll for it every 15s and attach once it appears.
 */
export function startListener(onReady) {
  if (tryLoadIdl()) {
    subscribe();
    onReady?.();
    return;
  }
  console.warn(
    `[listener] IDL not found at ${config.idlPath} — waiting for it (polling every ${config.idlPollMs / 1000}s). ` +
      `Build the Anchor program to produce it; the listener will start automatically.`
  );
  const timer = setInterval(() => {
    if (tryLoadIdl()) {
      clearInterval(timer);
      subscribe();
      onReady?.();
    }
  }, config.idlPollMs);
  timer.unref();
}

// ---------- reconciliation (design §8.3 missed-event recovery) ----------

export async function reconcile() {
  if (!state.idlLoaded || !accountsDef) return; // nothing to decode against yet
  const conn = getConnection();
  const filters = accountsDef.discriminator
    ? [{ memcmp: { offset: 0, bytes: anchorPkg.utils.bytes.bs58.encode(Buffer.from(accountsDef.discriminator)) } }]
    : [];
  const accounts = await conn.getProgramAccounts(new PublicKey(config.programId), { filters });
  let touched = 0;

  for (const { pubkey, account } of accounts) {
    let decoded;
    try {
      decoded = coder.accounts.decode(accountsDef.name, account.data);
    } catch {
      continue; // not a Commitment account
    }

    const status = statusToString(field(decoded, 'status'));
    const fixtureId = field(decoded, 'fixture_id').toString();
    const kickoffTs = Number(field(decoded, 'kickoff_ts'));
    const template = Number(field(decoded, 'condition_template'));
    const param = Number(field(decoded, 'condition_param'));
    const members = (field(decoded, 'members') ?? []).filter(
      (m) => field(m, 'wallet') && !field(m, 'wallet').equals?.(PublicKey.default)
    );
    const active = members.filter((m) => !field(m, 'withdrawn'));
    const total = ['Executed', 'Closed'].includes(status)
      ? 0n
      : active.reduce((sum, m) => sum + BigInt(field(m, 'deposit_lamports').toString()), 0n);

    await ensureFixtureRow(fixtureId, kickoffTs * 1000);
    const label = await deriveLabel(template, param, fixtureId);

    await pool.query(
      `INSERT INTO commitments (pubkey, fixture_id, kickoff_ts, condition_template, condition_param,
         condition_label, beneficiary, founder, name, status, member_count, total_lamports, created_at,
         resolved_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now(),
         CASE WHEN $10 IN ('Executed','Refunded','Void') THEN now() ELSE NULL END)
       ON CONFLICT (pubkey) DO UPDATE SET
         status = EXCLUDED.status,
         condition_label = EXCLUDED.condition_label,
         member_count = EXCLUDED.member_count,
         total_lamports = EXCLUDED.total_lamports,
         resolved_at = CASE
           WHEN commitments.resolved_at IS NULL AND EXCLUDED.status IN ('Executed','Refunded','Void')
           THEN now() ELSE commitments.resolved_at END`,
      [
        pubkey.toString(),
        fixtureId,
        kickoffTs,
        template,
        param,
        label,
        field(decoded, 'beneficiary').toString(),
        field(decoded, 'founder').toString(),
        decodeName(field(decoded, 'name')),
        status,
        active.length,
        total.toString(),
      ]
    );

    for (const m of members) {
      await pool.query(
        `INSERT INTO commitment_members (commitment_pubkey, wallet, deposit_lamports, withdrawn, claimed, joined_at)
         VALUES ($1,$2,$3,$4,$5, now())
         ON CONFLICT (commitment_pubkey, wallet) DO UPDATE SET
           deposit_lamports = EXCLUDED.deposit_lamports,
           withdrawn = EXCLUDED.withdrawn,
           claimed = EXCLUDED.claimed`,
        [
          pubkey.toString(),
          field(m, 'wallet').toString(),
          field(m, 'deposit_lamports').toString(),
          Boolean(field(m, 'withdrawn')),
          Boolean(field(m, 'claimed')),
        ]
      );
    }
    touched++;
  }
  console.log(`[reconcile] scanned ${accounts.length} accounts, upserted ${touched} commitments`);
}

export function startReconciler() {
  const run = () =>
    reconcile().catch((err) => console.error('[reconcile] failed:', err.message));
  run();
  setInterval(run, config.reconcileMs).unref();
}
