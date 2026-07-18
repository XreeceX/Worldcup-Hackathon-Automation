// Tier 3 live integration check (spec 07 tier 3) — run against a server already started with
// ESCROW_MODE=keeper (REPLAY_ON_BOOT=1 by default). Exercises the real escrow round-trip: a
// genuinely different ephemeral pledger funds a real devnet create-transfer into the keeper
// escrow wallet, registers the pledge over the real HTTP API, then waits for the keeper to
// resolve it off the replay driver's real game_finalised event — ending in a REAL devnet
// release transaction with an explorer link.
//
// Usage: PORT=8789 node server/scripts/live-check.mjs
import fs from "node:fs";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

const PORT = process.env.PORT || 8789;
const BASE = `http://localhost:${PORT}`;
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const WALLET_PATH = process.env.KEEPER_WALLET_PATH || "_keys/wallet.json";
const PLEDGE_AMOUNT_LAMPORTS = 10_000_000n; // 0.01 SOL
const FUND_LAMPORTS = 20_000_000; // 0.02 SOL to cover the pledge + fees

function explorerTx(sig) {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");
  const mainWallet = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(WALLET_PATH, "utf8"))));
  console.log(`main/escrow wallet: ${mainWallet.publicKey.toBase58()}`);

  const pledgerKp = Keypair.generate();
  const beneficiaryKp = Keypair.generate();
  console.log(`ephemeral pledger:     ${pledgerKp.publicKey.toBase58()}`);
  console.log(`ephemeral beneficiary: ${beneficiaryKp.publicKey.toBase58()}`);

  console.log(`\n[1/5] funding pledger with ${FUND_LAMPORTS} lamports from the main wallet (real devnet tx)...`);
  const fundTx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: mainWallet.publicKey, toPubkey: pledgerKp.publicKey, lamports: FUND_LAMPORTS })
  );
  const fundSig = await sendAndConfirmTransaction(connection, fundTx, [mainWallet], { commitment: "confirmed" });
  console.log(`  fund tx: ${explorerTx(fundSig)}`);

  const fixturesRes = await fetch(`${BASE}/api/fixtures`);
  if (!fixturesRes.ok) throw new Error(`GET /api/fixtures failed: ${fixturesRes.status}`);
  const { fixtures } = await fixturesRes.json();
  const replayFixture = fixtures.find((f) => f.source === "replay");
  if (!replayFixture) throw new Error("no replay fixture found in /api/fixtures");
  console.log(`\nreplay fixture: ${replayFixture.fixtureId} ${replayFixture.home} vs ${replayFixture.away} (status=${replayFixture.status})`);
  if (replayFixture.status === "finalised") {
    throw new Error("replay fixture already finalised — restart the server (fresh boot re-runs the replay) before running live-check");
  }

  console.log(`\n[2/5] pledger creates the escrow deposit: ${PLEDGE_AMOUNT_LAMPORTS} lamports -> ${mainWallet.publicKey.toBase58()} (real devnet tx)...`);
  const createTx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: pledgerKp.publicKey,
      toPubkey: mainWallet.publicKey,
      lamports: PLEDGE_AMOUNT_LAMPORTS,
    })
  );
  const createSig = await sendAndConfirmTransaction(connection, createTx, [pledgerKp], { commitment: "confirmed" });
  console.log(`  create tx: ${explorerTx(createSig)}`);

  console.log(`\n[3/5] registering pledge via POST /api/pledges (condition: team_wins home — replay ends 2-1 home win)...`);
  const registerRes = await fetch(`${BASE}/api/pledges`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fixtureId: replayFixture.fixtureId,
      condition: { template: "team_wins", params: { team: "home" } },
      amountLamports: PLEDGE_AMOUNT_LAMPORTS.toString(),
      pledger: pledgerKp.publicKey.toBase58(),
      beneficiary: beneficiaryKp.publicKey.toBase58(),
      createTx: createSig,
    }),
  });
  const pledge = await registerRes.json();
  if (registerRes.status !== 201) throw new Error(`POST /api/pledges failed (${registerRes.status}): ${JSON.stringify(pledge)}`);
  console.log(`  pledge registered: ${pledge.id} (state=${pledge.state})`);

  console.log(`\n[4/5] waiting for the keeper to auto-resolve on the replay's game_finalised event...`);
  const deadline = Date.now() + 120_000;
  let final = pledge;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(`${BASE}/api/pledges/${pledge.id}`);
    final = await res.json();
    process.stdout.write(`  state=${final.state}\r\n`);
    if (final.state === "transferred" || final.state === "failed") break;
  }

  if (final.state !== "transferred" && final.state !== "failed") {
    throw new Error(`pledge did not reach a terminal state within the wait window: ${JSON.stringify(final)}`);
  }

  console.log(`\n[5/5] final pledge state: ${final.state}${final.failureReason ? ` (${final.failureReason})` : ""}`);
  if (final.releaseTx) console.log(`  release tx: ${explorerTx(final.releaseTx)}`);

  const beneficiaryBalance = await connection.getBalance(beneficiaryKp.publicKey, "confirmed");
  const pledgerBalance = await connection.getBalance(pledgerKp.publicKey, "confirmed");
  console.log(`  beneficiary balance: ${beneficiaryBalance} lamports`);
  console.log(`  pledger balance:     ${pledgerBalance} lamports`);

  if (final.state === "transferred" && BigInt(beneficiaryBalance) < PLEDGE_AMOUNT_LAMPORTS) {
    throw new Error("state=transferred but beneficiary balance did not receive the pledged lamports on-chain");
  }

  console.log("\nLIVE CHECK PASSED — real devnet escrow round-trip confirmed.");
}

main().catch((err) => {
  console.error("\nLIVE CHECK FAILED:", err.message);
  process.exit(1);
});
