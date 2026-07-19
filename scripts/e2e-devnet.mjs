// End-to-end devnet test of the Social Commitment Engine golden path.
// Uses the real deployed program + the real TxLINE Merkle proof for fixture
// 18241006 (England 1-2 Argentina, Jul 15): BTTS = true (YES path),
// HomeWins = false (NO path -> refund claims).
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL, ComputeBudgetProgram } from "@solana/web3.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const BN = anchor.BN ?? anchor.default.BN;

const FIXTURE_ID = 18241006;
const TXORACLE_ID = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");

const wallet = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(
  fs.readFileSync(path.join(os.homedir(), ".secrets", "txline-devnet-wallet.json"), "utf8"))));
const idl = JSON.parse(fs.readFileSync(path.join(root, "program", "target", "idl", "commitment.json"), "utf8"));
const val = JSON.parse(fs.readFileSync(path.join(root, "docs", "fixtures-proof-18241006.json"), "utf8"));

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(wallet), { commitment: "confirmed" });
anchor.setProvider(provider);
const program = new anchor.Program(idl, provider);
console.log("program:", program.programId.toBase58());

const sol = (l) => (l / LAMPORTS_PER_SOL).toFixed(4);
const nameBytes = (s) => { const b = Buffer.alloc(64); Buffer.from(s, "utf8").copy(b); return Array.from(b); };
const commitmentPda = (fixtureId, founder) => PublicKey.findProgramAddressSync(
  [Buffer.from("commitment"), new BN(fixtureId).toArrayLike(Buffer, "le", 8), founder.toBuffer()],
  program.programId)[0];
const vaultPda = (commitment) => PublicKey.findProgramAddressSync(
  [Buffer.from("vault"), commitment.toBuffer()], program.programId)[0];

const mapProof = (a) => a.map(n => ({ hash: Array.from(n.hash), isRightSibling: n.isRightSibling }));
const proofPayload = {
  ts: new BN(val.summary.updateStats.minTimestamp),
  fixtureSummary: {
    fixtureId: new BN(val.summary.fixtureId),
    updateStats: {
      updateCount: val.summary.updateStats.updateCount,
      minTimestamp: new BN(val.summary.updateStats.minTimestamp),
      maxTimestamp: new BN(val.summary.updateStats.maxTimestamp),
    },
    eventsSubTreeRoot: Array.from(val.summary.eventStatsSubTreeRoot),
  },
  fixtureProof: mapProof(val.subTreeProof),
  mainTreeProof: mapProof(val.mainTreeProof),
  eventStatRoot: Array.from(val.eventStatRoot),
  stats: val.statsToProve.map((stat, i) => ({ stat, statProof: mapProof(val.statProofs[i]) })),
};
const epochDay = Math.floor(val.summary.updateStats.minTimestamp / 86_400_000);
const dailyScoresRoots = PublicKey.findProgramAddressSync(
  [Buffer.from("daily_scores_roots"), new BN(epochDay).toArrayLike(Buffer, "le", 2)], TXORACLE_ID)[0];
console.log("epochDay:", epochDay, "dailyScoresRoots:", dailyScoresRoots.toBase58());

const cuIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 });

async function createCommitment(founderKp, template, param, beneficiary, lamports, label) {
  const kickoff = Math.floor(Date.now() / 1000) + 50;
  const commitment = commitmentPda(FIXTURE_ID, founderKp.publicKey);
  const sig = await program.methods
    .createCommitment(new BN(FIXTURE_ID), new BN(kickoff), template, new BN(param), beneficiary, new BN(lamports), nameBytes(label))
    .accounts({
      founder: founderKp.publicKey,
      commitment,
      vault: vaultPda(commitment),
      systemProgram: SystemProgram.programId,
    })
    .signers([founderKp])
    .rpc();
  console.log(`[create ${label}]`, commitment.toBase58(), "tx:", sig);
  return { commitment, kickoff };
}

async function resolve(commitment, beneficiary) {
  const sig = await program.methods
    .resolve(proofPayload)
    .accounts({
      resolver: wallet.publicKey,
      commitment,
      vault: vaultPda(commitment),
      beneficiary,
      dailyScoresRoots,
      txlineProgram: TXORACLE_ID,
      systemProgram: SystemProgram.programId,
    })
    .preInstructions([cuIx])
    .rpc();
  const acct = await program.account.commitment.fetch(commitment);
  const status = Object.keys(acct.status)[0];
  console.log("[resolve]", commitment.toBase58(), "->", status, "tx:", sig);
  return status;
}

(async () => {
  console.log("wallet:", wallet.publicKey.toBase58(), "balance:", sol(await connection.getBalance(wallet.publicKey)), "SOL");

  // Actors: founder B and member C funded from main wallet; fresh beneficiary.
  const founderB = Keypair.generate();
  const memberC = Keypair.generate();
  const beneficiary = Keypair.generate();
  {
    const tx = new anchor.web3.Transaction().add(
      SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: founderB.publicKey, lamports: 0.30 * LAMPORTS_PER_SOL }),
      SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: memberC.publicKey, lamports: 0.10 * LAMPORTS_PER_SOL }),
    );
    await provider.sendAndConfirm(tx);
    console.log("funded founderB:", founderB.publicKey.toBase58(), "memberC:", memberC.publicKey.toBase58());
  }

  // A: BTTS pledge by main wallet -> YES path (England 1-2 Argentina, both scored)
  const A = await createCommitment(wallet, 0, 0, beneficiary.publicKey, 0.05 * LAMPORTS_PER_SOL, "E2E BTTS Pledge");
  // B: HomeWins DAO by founderB -> NO path (England lost at home)
  const B = await createCommitment(founderB, 1, 0, beneficiary.publicKey, 0.03 * LAMPORTS_PER_SOL, "E2E England DAO");

  // memberC joins B before kickoff
  {
    const sig = await program.methods
      .join(new BN(0.02 * LAMPORTS_PER_SOL))
      .accounts({
        member: memberC.publicKey,
        commitment: B.commitment,
        vault: vaultPda(B.commitment),
        systemProgram: SystemProgram.programId,
      })
      .signers([memberC])
      .rpc();
    console.log("[join] memberC -> England DAO tx:", sig);
    const acct = await program.account.commitment.fetch(B.commitment);
    console.log("       members:", acct.memberCount, "vault:", sol(await connection.getBalance(vaultPda(B.commitment))), "SOL");
  }

  // wait for kickoff to pass
  const waitMs = (B.kickoff + 3) * 1000 - Date.now();
  if (waitMs > 0) { console.log(`waiting ${Math.ceil(waitMs / 1000)}s for kickoff...`); await new Promise(r => setTimeout(r, waitMs)); }

  // YES path
  const stA = await resolve(A.commitment, beneficiary.publicKey);
  const benBal = await connection.getBalance(beneficiary.publicKey);
  console.log("beneficiary received:", sol(benBal), "SOL (expected 0.0500)");
  if (stA !== "executed" || benBal !== 0.05 * LAMPORTS_PER_SOL) throw new Error("YES path failed");

  // NO path
  const stB = await resolve(B.commitment, beneficiary.publicKey);
  if (stB !== "refunded") throw new Error("NO path failed");

  // claims: founderB then memberC (last claimer drains vault incl. rent)
  for (const [kp, label] of [[founderB, "founderB"], [memberC, "memberC"]]) {
    const before = await connection.getBalance(kp.publicKey);
    const sig = await program.methods
      .claimRefund()
      .accounts({
        member: kp.publicKey,
        commitment: B.commitment,
        vault: vaultPda(B.commitment),
        systemProgram: SystemProgram.programId,
      })
      .signers([kp])
      .rpc();
    const after = await connection.getBalance(kp.publicKey);
    console.log(`[claim ${label}] +${sol(after - before)} SOL tx:`, sig);
  }
  const vaultLeft = await connection.getBalance(vaultPda(B.commitment));
  console.log("vault after all claims:", vaultLeft, "lamports (expected 0)");
  if (vaultLeft !== 0) throw new Error("vault not drained");

  // idempotency: second resolve must fail cleanly with NotOpen
  try {
    await resolve(A.commitment, beneficiary.publicKey);
    throw new Error("second resolve unexpectedly succeeded");
  } catch (e) {
    const msg = String(e.message || e);
    if (!msg.includes("NotOpen") && !msg.includes("not open")) throw e;
    console.log("[idempotency] second resolve rejected with NotOpen — correct");
  }

  console.log("\nE2E_ALL_GREEN — explorer:");
  console.log(`  https://explorer.solana.com/address/${A.commitment.toBase58()}?cluster=devnet`);
  console.log(`  https://explorer.solana.com/address/${B.commitment.toBase58()}?cluster=devnet`);
})().catch(e => { console.error("E2E_FAILED:", e.message?.slice(0, 800) || e); if (e.logs) console.error(e.logs.slice(-12).join("\n")); process.exit(1); });
