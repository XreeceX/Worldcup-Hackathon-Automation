// Pledge store: CRUD, bigint-safe JSON snapshot/restore, totals for the invariant (spec 02 §2/§3).
import fs from "node:fs";
import path from "node:path";

const DEFAULT_SNAPSHOT_PATH = process.env.PLEDGE_STORE_PATH || "_keys/pledges.json";
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function encodeBase32(n, len) {
  let out = "";
  let v = n;
  for (let i = 0; i < len; i++) {
    out = CROCKFORD[Number(v % 32n)] + out;
    v /= 32n;
  }
  return out;
}

/** "plg_" + ulid-shaped id (48-bit timestamp + random suffix, Crockford base32). */
export function generatePledgeId() {
  const time = encodeBase32(BigInt(Date.now()), 10);
  const rand = Array.from({ length: 16 }, () => CROCKFORD[Math.floor(Math.random() * 32)]).join("");
  return `plg_${time}${rand}`;
}

function serializePledge(pledge) {
  if (typeof pledge.amountLamports !== "bigint") {
    throw new TypeError(`Pledge.amountLamports must be a BigInt, got ${typeof pledge.amountLamports}`);
  }
  return { ...pledge, amountLamports: pledge.amountLamports.toString() };
}

function deserializePledge(raw) {
  if (typeof raw.amountLamports !== "string") {
    throw new TypeError("snapshot corrupt: amountLamports must be a decimal string on disk");
  }
  return { ...raw, amountLamports: BigInt(raw.amountLamports) };
}

/** States whose lamports are still sitting in escrow. */
function isActive(pledge) {
  if (pledge.state === "pending" || pledge.state === "condition_met") return true;
  // funds stuck: release tx failed after retries but were never returned (02 §3 state machine note)
  return pledge.state === "failed" && pledge.failureReason === "transfer_error";
}

export function createStore(snapshotPath = DEFAULT_SNAPSHOT_PATH) {
  const pledges = new Map();

  function load() {
    if (!fs.existsSync(snapshotPath)) return;
    const raw = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
    for (const p of raw.pledges || []) {
      pledges.set(p.id, deserializePledge(p));
    }
  }

  function persist() {
    const dir = path.dirname(snapshotPath);
    if (dir && dir !== "." && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const raw = { pledges: [...pledges.values()].map(serializePledge) };
    fs.writeFileSync(snapshotPath, JSON.stringify(raw, null, 2));
  }

  function put(pledge) {
    serializePledge(pledge); // throws on non-BigInt amount before it ever reaches memory or disk
    pledges.set(pledge.id, pledge);
    persist();
    return pledge;
  }

  function get(id) {
    return pledges.get(id) || null;
  }

  function list() {
    return [...pledges.values()];
  }

  function findByCreateTx(createTx) {
    for (const p of pledges.values()) {
      if (p.createTx === createTx) return p;
    }
    return null;
  }

  /** Store-side bookkeeping totals; combined with a live escrow balance read in routes.mjs for the full invariant check. */
  function computeLocalTotals() {
    let depositedLamports = 0n;
    let activeLamports = 0n;
    let releasedLamports = 0n;
    for (const p of pledges.values()) {
      depositedLamports += p.amountLamports;
      if (isActive(p)) activeLamports += p.amountLamports;
      else releasedLamports += p.amountLamports;
    }
    return { depositedLamports, activeLamports, releasedLamports };
  }

  load();
  return { put, get, list, findByCreateTx, computeLocalTotals, snapshotPath };
}

export { serializePledge };
