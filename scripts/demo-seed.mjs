// Seed a live-demo DAO commitment on the replay fixture:
//   demo-pledger founds "Three Lions Collective" (BTTS), demo-joiner joins.
// Kickoff is now + KICKOFF_IN_S (default 60) so the lock moment happens on camera.
// Usage: node scripts/demo-seed.mjs [kickoffInSeconds]
import anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { loadJson } from "../keeper/txline.mjs";

const FIXTURE_ID = 18241006;
const KICKOFF_IN_S = Number(process.argv[2] ?? 60);
const BN = anchor.BN;

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const tifoIdl = loadJson("tifo/target/idl/tifo.json");
const pledger = Keypair.fromSecretKey(Uint8Array.from(loadJson("_keys/demo-pledger.json")));
const joiner = Keypair.fromSecretKey(Uint8Array.from(loadJson("_keys/demo-joiner.json")));
const keeper = Keypair.fromSecretKey(Uint8Array.from(loadJson("_keys/wallet.json")));

const programFor = (kp) =>
  new anchor.Program(tifoIdl, new anchor.AnchorProvider(connection, new anchor.Wallet(kp), { commitment: "confirmed" }));
const nameBytes = (s) => { const b = Buffer.alloc(64); Buffer.from(s).copy(b); return Array.from(b); };
const pdas = (fixtureId, founder, nonce) => {
  const programId = new PublicKey(tifoIdl.address);
  const [commitment] = PublicKey.findProgramAddressSync(
    [Buffer.from("commitment"), new BN(fixtureId).toBuffer("le", 8), founder.toBuffer(), new BN(nonce).toBuffer("le", 8)], programId);
  const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), commitment.toBuffer()], programId);
  return { commitment, vault };
};

const kickoff = Math.floor(Date.now() / 1000) + KICKOFF_IN_S;
const nonce = Date.now();
const { commitment, vault } = pdas(FIXTURE_ID, pledger.publicKey, nonce);

await programFor(pledger).methods
  .createCommitment(new BN(FIXTURE_ID), new BN(nonce), new BN(kickoff), 0, new BN(0),
    keeper.publicKey, new BN(0.1 * LAMPORTS_PER_SOL), nameBytes("Three Lions Collective"))
  .accounts({ founder: pledger.publicKey, commitment, vault, systemProgram: SystemProgram.programId })
  .rpc();
console.log("created:", commitment.toBase58(), `kickoff in ${KICKOFF_IN_S}s`);

await programFor(joiner).methods
  .join(new BN(0.05 * LAMPORTS_PER_SOL))
  .accounts({ member: joiner.publicKey, commitment, vault, systemProgram: SystemProgram.programId })
  .rpc();
console.log("joiner joined with 0.05 SOL — memberCount should be 2");
console.log(`open: http://localhost:3000/commitment/${commitment.toBase58()}`);
