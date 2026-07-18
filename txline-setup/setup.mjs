// TxLINE devnet free-tier setup: keypair -> airdrop -> on-chain subscribe -> API token activation.
// Credentials land in ~/.secrets/ (outside the repo). Re-runnable: skips steps already done.
// Source of the flow: https://txline.txodds.com/documentation/worldcup (scraped 2026-07-18).
import * as anchor from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import axios from "axios";
import nacl from "tweetnacl";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CONFIG = {
  rpcUrl: "https://api.devnet.solana.com",
  apiOrigin: "https://txline-dev.txodds.com",
  programId: new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J"),
  txlTokenMint: new PublicKey("4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG"),
};
const SERVICE_LEVEL_ID = 1; // devnet free tier, samplingIntervalSec = 0
const DURATION_WEEKS = 4;
const SELECTED_LEAGUES = []; // standard free bundle -> activation message is `${txSig}::${jwt}`

const secretsDir = path.join(os.homedir(), ".secrets");
const walletPath = path.join(secretsDir, "txline-devnet-wallet.json");
const credsPath = path.join(secretsDir, "txline-devnet-creds.json");
fs.mkdirSync(secretsDir, { recursive: true, mode: 0o700 });

// 1. Keypair
let keypair;
if (fs.existsSync(walletPath)) {
  keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf8"))));
  console.log("[1] wallet loaded:", keypair.publicKey.toBase58());
} else {
  keypair = Keypair.generate();
  fs.writeFileSync(walletPath, JSON.stringify(Array.from(keypair.secretKey)), { mode: 0o600 });
  console.log("[1] wallet created:", keypair.publicKey.toBase58());
}

const connection = new Connection(CONFIG.rpcUrl, "confirmed");

// 2. Devnet SOL
let balance = await connection.getBalance(keypair.publicKey);
console.log("[2] balance:", balance / LAMPORTS_PER_SOL, "SOL");
if (balance < 0.05 * LAMPORTS_PER_SOL) {
  console.log("[2] requesting 1 SOL airdrop...");
  const sig = await connection.requestAirdrop(keypair.publicKey, 1 * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig, "confirmed");
  balance = await connection.getBalance(keypair.publicKey);
  console.log("[2] balance after airdrop:", balance / LAMPORTS_PER_SOL, "SOL");
}

// 3. Anchor program (IDL fetched from chain — no local IDL file needed)
const wallet = new anchor.Wallet(keypair);
const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
anchor.setProvider(provider);
const idl = await anchor.Program.fetchIdl(CONFIG.programId, provider);
if (!idl) throw new Error("Could not fetch IDL from chain for " + CONFIG.programId.toBase58());
if (idl.address && idl.address !== CONFIG.programId.toBase58()) {
  throw new Error(`IDL address ${idl.address} != expected ${CONFIG.programId.toBase58()}`);
}
const program = new anchor.Program(idl, provider);
console.log("[3] IDL fetched, program ready:", program.programId.toBase58());

// 4. Subscribe on-chain (skip if we already have a saved txSig)
let txSig;
const prior = fs.existsSync(credsPath) ? JSON.parse(fs.readFileSync(credsPath, "utf8")) : {};
if (prior.txSig) {
  txSig = prior.txSig;
  console.log("[4] reusing prior subscribe tx:", txSig);
} else {
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_treasury_v2")],
    program.programId
  );
  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    CONFIG.txlTokenMint, tokenTreasuryPda, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pricing_matrix")],
    program.programId
  );
  const userTokenAccount = getAssociatedTokenAddressSync(
    CONFIG.txlTokenMint, keypair.publicKey, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
  );
  // The subscribe ix requires the TxL ATA to exist, even for the free tier.
  const ataInfo = await connection.getAccountInfo(userTokenAccount);
  if (!ataInfo) {
    const { Transaction, sendAndConfirmTransaction } = await import("@solana/web3.js");
    const ataTx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        keypair.publicKey, userTokenAccount, keypair.publicKey, CONFIG.txlTokenMint,
        TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
    const ataSig = await sendAndConfirmTransaction(connection, ataTx, [keypair], { commitment: "confirmed" });
    console.log("[4] TxL ATA created:", ataSig);
  }
  txSig = await program.methods
    .subscribe(SERVICE_LEVEL_ID, DURATION_WEEKS)
    .accounts({
      user: keypair.publicKey,
      pricingMatrix: pricingMatrixPda,
      tokenMint: CONFIG.txlTokenMint,
      userTokenAccount,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log("[4] subscribe tx:", txSig);
}

// 5. Guest JWT + activation
const authResponse = await axios.post(`${CONFIG.apiOrigin}/auth/guest/start`);
const jwt = authResponse.data.token;
console.log("[5] guest JWT acquired");

const messageString = `${txSig}:${SELECTED_LEAGUES.join(",")}:${jwt}`;
const signatureBytes = nacl.sign.detached(new TextEncoder().encode(messageString), keypair.secretKey);
const walletSignature = Buffer.from(signatureBytes).toString("base64");

const activationResponse = await axios.post(
  `${CONFIG.apiOrigin}/api/token/activate`,
  { txSig, walletSignature, leagues: SELECTED_LEAGUES },
  { headers: { Authorization: `Bearer ${jwt}` } }
);
const apiToken = activationResponse.data.token || activationResponse.data;
console.log("[5] API token ACTIVATED");

// 6. Persist credentials (0600, outside repo)
fs.writeFileSync(
  credsPath,
  JSON.stringify({ network: "devnet", apiOrigin: CONFIG.apiOrigin, pubkey: keypair.publicKey.toBase58(), txSig, jwt, apiToken, activatedAt: new Date().toISOString() }, null, 2),
  { mode: 0o600 }
);
console.log("[6] credentials saved to", credsPath);
console.log("DONE — use headers: Authorization: Bearer <jwt> + X-Api-Token: <apiToken>");
