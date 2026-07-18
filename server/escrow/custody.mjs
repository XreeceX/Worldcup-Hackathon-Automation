// Path B: keeper-custody escrow (spec 02 §1). Create = plain SystemProgram.transfer from the
// pledger to the keeper wallet; release = keeper-signed SystemProgram.transfer to the
// beneficiary (condition true) or back to the pledger (condition false).
import fs from "node:fs";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { assertEscrowClient } from "./interface.mjs";

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const WALLET_PATH = process.env.KEEPER_WALLET_PATH || "_keys/wallet.json";

export function createCustodyEscrow({ walletPath = WALLET_PATH, rpcUrl = RPC_URL } = {}) {
  const keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf8"))));
  const connection = new Connection(rpcUrl, "confirmed");

  async function prepareCreate({ pledger, amountLamports }) {
    const ix = SystemProgram.transfer({
      fromPubkey: new PublicKey(pledger),
      toPubkey: keypair.publicKey,
      lamports: amountLamports,
    });
    return { instructions: [ix], destination: keypair.publicKey.toBase58() };
  }

  async function confirmCreate(signature) {
    const tx = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (!tx) throw new Error(`transaction not found or not yet confirmed: ${signature}`);
    if (tx.meta?.err) throw new Error(`transaction failed on-chain: ${signature}`);

    const keys = tx.transaction.message.getAccountKeys
      ? tx.transaction.message.getAccountKeys().staticAccountKeys
      : tx.transaction.message.accountKeys;
    const dest = keypair.publicKey.toBase58();
    const idx = keys.findIndex((k) => k.toBase58() === dest);
    if (idx === -1) throw new Error(`escrow destination ${dest} not present in transaction ${signature}`);

    const delta = BigInt(tx.meta.postBalances[idx]) - BigInt(tx.meta.preBalances[idx]);
    if (delta <= 0n) throw new Error(`no lamports moved into escrow destination in ${signature}`);
    return { lamports: delta };
  }

  async function release(pledge, outcome) {
    const toPubkey = new PublicKey(outcome === "success" ? pledge.beneficiary : pledge.pledger);
    const tx = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: keypair.publicKey, toPubkey, lamports: pledge.amountLamports })
    );
    const signature = await sendAndConfirmTransaction(connection, tx, [keypair], { commitment: "confirmed" });
    return { signature };
  }

  async function getBalanceLamports() {
    const lamports = await connection.getBalance(keypair.publicKey, "confirmed");
    return BigInt(lamports);
  }

  return assertEscrowClient({
    mode: "keeper",
    escrowPubkey: keypair.publicKey.toBase58(),
    prepareCreate,
    confirmCreate,
    release,
    getBalanceLamports,
  });
}
