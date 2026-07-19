// End-to-end settlement test against devnet + real TxLINE proofs.
// Creates two commitments on the replay fixture (18241006, final score 1-2):
//   A: BTTS       -> resolves YES -> vault released to beneficiary atomically
//   B: HomeWins   -> resolves NO  -> Refunded -> claim_refund returns deposit + closes vault
// Usage: node scripts/e2e.mjs
import anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram, ComputeBudgetProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { makeApiClient, fetchHistorical, findFinalised, fetchProofPayload, dailyScoresPda, loadJson } from "../keeper/txline.mjs";

const FIXTURE_ID = 18241006;
const RPC_URL = "https://api.devnet.solana.com";
const BN = anchor.BN;

const session = loadJson("_keys/txline-session.json");
const keeper = Keypair.fromSecretKey(Uint8Array.from(loadJson("_keys/wallet.json")));
const pledger = Keypair.fromSecretKey(Uint8Array.from(loadJson("_keys/demo-pledger.json")));
const beneficiary = Keypair.fromSecretKey(Uint8Array.from(loadJson("_keys/demo-joiner.json"))); // circular funds

const connection = new Connection(RPC_URL, "confirmed");
const tifoIdl = loadJson("tifo/target/idl/tifo.json");
const txoracleIdl = loadJson("txline-examples/devnet/idl/txoracle.json");
const txoracleProgramId = new PublicKey(txoracleIdl.address);
const api = makeApiClient(session.apiToken);

const providerFor = (kp) => new anchor.AnchorProvider(connection, new anchor.Wallet(kp), { commitment: "confirmed" });
const programFor = (kp) => new anchor.Program(tifoIdl, providerFor(kp));

const nameBytes = (s) => { const b = Buffer.alloc(64); Buffer.from(s).copy(b); return Array.from(b); };
const commitmentPda = (fixtureId, founder, nonce) => PublicKey.findProgramAddressSync(
  [Buffer.from("commitment"), new BN(fixtureId).toBuffer("le", 8), founder.toBuffer(), new BN(nonce).toBuffer("le", 8)],
  new PublicKey(tifoIdl.address)
)[0];
const vaultPda = (commitment) => PublicKey.findProgramAddressSync(
  [Buffer.from("vault"), commitment.toBuffer()], new PublicKey(tifoIdl.address)
)[0];
const sol = (l) => l / LAMPORTS_PER_SOL;

async function createCommitment(founderKp, { template, param, name, deposit, fixtureId = FIXTURE_ID }) {
  const program = programFor(founderKp);
  const nonce = Date.now();
  const commitment = commitmentPda(fixtureId, founderKp.publicKey, nonce);
  const kickoff = Math.floor(Date.now() / 1000) + 3600; // future kickoff (demo constraint)
  const sig = await program.methods
    .createCommitment(new BN(fixtureId), new BN(nonce), new BN(kickoff), template, new BN(param),
      beneficiary.publicKey, new BN(deposit), nameBytes(name))
    .accounts({ founder: founderKp.publicKey, commitment, vault: vaultPda(commitment), systemProgram: SystemProgram.programId })
    .rpc();
  console.log(`  created "${name}" ${commitment.toBase58()} (${sig.slice(0, 16)}…)`);
  return commitment;
}

async function resolve(commitment) {
  const program = programFor(keeper);
  const account = await program.account.commitment.fetch(commitment);
  const records = await fetchHistorical(api, FIXTURE_ID);
  const fin = findFinalised(records);
  const { payload, epochDay } = await fetchProofPayload(api, FIXTURE_ID, fin.Seq, [1, 2]);
  const sig = await program.methods
    .resolve(payload)
    .accounts({
      resolver: keeper.publicKey, commitment, vault: vaultPda(commitment),
      beneficiary: account.beneficiary,
      dailyScoresMerkleRoots: dailyScoresPda(txoracleProgramId, epochDay),
      txoracleProgram: txoracleProgramId, systemProgram: SystemProgram.programId,
    })
    .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 })])
    .rpc();
  const after = await program.account.commitment.fetch(commitment);
  const status = ["Open", "Executed", "Refunded", "Void", "Closed"][after.status];
  console.log(`  resolved -> ${status} (${sig.slice(0, 16)}…)`);
  return { status, sig };
}

const DEPOSIT = 0.05 * LAMPORTS_PER_SOL;

console.log("[1] YES path — BTTS (both scored in 1-2)");
const benBefore = await connection.getBalance(beneficiary.publicKey);
const cA = await createCommitment(pledger, { template: 0, param: 0, name: "E2E BTTS", deposit: DEPOSIT });
const rA = await resolve(cA);
const benAfter = await connection.getBalance(beneficiary.publicKey);
console.log(`  beneficiary received ${sol(benAfter - benBefore)} SOL`);
if (rA.status !== "Executed" || benAfter - benBefore !== DEPOSIT) throw new Error("YES path FAILED");

console.log("[2] NO path — England wins (they lost 1-2)");
const cB = await createCommitment(beneficiary, { template: 1, param: 0, name: "E2E HomeWin", deposit: DEPOSIT });
const rB = await resolve(cB);
if (rB.status !== "Refunded") throw new Error("NO path FAILED — expected Refunded");

console.log("[3] claim_refund — deposit back, vault closed, rent swept");
const program = programFor(beneficiary);
const balBefore = await connection.getBalance(beneficiary.publicKey);
const claimSig = await program.methods
  .claimRefund()
  .accounts({ member: beneficiary.publicKey, commitment: cB, vault: vaultPda(cB), systemProgram: SystemProgram.programId })
  .rpc();
const balAfter = await connection.getBalance(beneficiary.publicKey);
const vaultBal = await connection.getBalance(vaultPda(cB));
console.log(`  claimed ${sol(balAfter - balBefore)} SOL back (${claimSig.slice(0, 16)}…); vault balance now ${vaultBal}`);
if (vaultBal !== 0) throw new Error("vault not fully swept");

console.log("[4] idempotency — second resolve on settled commitment must fail cleanly");
try { await resolve(cA); throw new Error("second resolve unexpectedly succeeded"); }
catch (e) { if (!/NotOpen/.test(String(e))) throw e; console.log("  rejected with NotOpen ✓"); }

console.log("\nE2E GREEN — full settlement loop verified on devnet with real TxLINE proofs");
