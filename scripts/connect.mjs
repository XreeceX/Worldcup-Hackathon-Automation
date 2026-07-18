// Establish TxLINE devnet connection: subscribe (free tier) -> activate API token -> smoke-test data.
// Usage: node scripts/connect.mjs
import anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import axios from "axios";
import nacl from "tweetnacl";
import fs from "fs";

const RPC_URL = "https://api.devnet.solana.com";
const API_ORIGIN = "https://txline-dev.txodds.com";
const PROGRAM_ID = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
const TXL_MINT = new PublicKey("4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG");
const SERVICE_LEVEL_ID = 1; // devnet free World Cup tier, samplingIntervalSec = 0
const DURATION_WEEKS = 4;
const SELECTED_LEAGUES = [];
const STATE_PATH = "_keys/txline-session.json";

const idl = JSON.parse(fs.readFileSync("txline-examples/devnet/idl/txoracle.json", "utf8"));
const kp = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync("_keys/wallet.json", "utf8")))
);

const connection = new Connection(RPC_URL, "confirmed");
const wallet = new anchor.Wallet(kp);
const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
anchor.setProvider(provider);
const program = new anchor.Program(idl, provider);

if (!program.programId.equals(PROGRAM_ID)) {
  throw new Error(`IDL program ${program.programId.toBase58()} != expected ${PROGRAM_ID.toBase58()}`);
}

const state = fs.existsSync(STATE_PATH) ? JSON.parse(fs.readFileSync(STATE_PATH, "utf8")) : {};

// --- 1. subscribe on-chain (skip if we already have a txSig) ---
if (!state.txSig) {
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_treasury_v2")],
    program.programId
  );
  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    TXL_MINT, tokenTreasuryPda, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pricing_matrix")],
    program.programId
  );
  const userTokenAccount = getAssociatedTokenAddressSync(
    TXL_MINT, wallet.publicKey, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
  );

  state.txSig = await program.methods
    .subscribe(SERVICE_LEVEL_ID, DURATION_WEEKS)
    .preInstructions([
      createAssociatedTokenAccountIdempotentInstruction(
        wallet.publicKey, userTokenAccount, wallet.publicKey, TXL_MINT,
        TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
      ),
    ])
    .accounts({
      user: wallet.publicKey,
      pricingMatrix: pricingMatrixPda,
      tokenMint: TXL_MINT,
      userTokenAccount,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log("subscribe tx:", state.txSig);
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), { mode: 0o600 });
} else {
  console.log("reusing subscribe tx:", state.txSig);
}

// --- 2. guest JWT + activate API token ---
const { data: auth } = await axios.post(`${API_ORIGIN}/auth/guest/start`);
const jwt = auth.token || auth;
console.log("guest JWT ok");

if (!state.apiToken) {
  const messageString = `${state.txSig}:${SELECTED_LEAGUES.join(",")}:${jwt}`;
  const sigBytes = nacl.sign.detached(new TextEncoder().encode(messageString), kp.secretKey);
  const { data: act } = await axios.post(
    `${API_ORIGIN}/api/token/activate`,
    { txSig: state.txSig, walletSignature: Buffer.from(sigBytes).toString("base64"), leagues: SELECTED_LEAGUES },
    { headers: { Authorization: `Bearer ${jwt}` } }
  );
  state.apiToken = act.token || act;
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), { mode: 0o600 });
  console.log("API token activated");
} else {
  console.log("reusing API token from", STATE_PATH);
}

// --- 3. smoke test: fixtures snapshot ---
const api = axios.create({
  baseURL: `${API_ORIGIN}/api`,
  headers: { Authorization: `Bearer ${jwt}`, "X-Api-Token": state.apiToken },
  timeout: 20000,
});

const { data: fixtures } = await api.get("/fixtures/snapshot");
const list = Array.isArray(fixtures) ? fixtures : fixtures.fixtures || [];
console.log(`fixtures snapshot: ${list.length} fixtures`);
for (const f of list.slice(0, 8)) {
  const p1 = f.Participant1 ?? f.participant1;
  const p2 = f.Participant2 ?? f.participant2;
  const st = f.StartTime ?? f.start_time ?? f.startTime;
  const id = f.FixtureId ?? f.fixture_id ?? f.fixtureId;
  console.log(`  ${id}  ${p1} vs ${p2}  @ ${st}`);
}
console.log("CONNECTION ESTABLISHED");
