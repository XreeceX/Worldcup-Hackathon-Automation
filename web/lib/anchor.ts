"use client";
// EscrowInterface (design §9.5) — AnchorEscrow is the sole implementation.
// All writes go straight to the on-chain program; the keeper never holds funds.
import { AnchorProvider, Program, BN, Idl } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { RPC_URL } from "./config";
import tifoIdl from "./idl/tifo.json";

export function getProgram(wallet: AnchorWallet) {
  const connection = new Connection(RPC_URL, "confirmed");
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  return new Program(tifoIdl as Idl, provider);
}

export const programId = new PublicKey((tifoIdl as { address: string }).address);

export function commitmentPda(fixtureId: number, founder: PublicKey, nonce: number) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("commitment"), new BN(fixtureId).toBuffer("le", 8), founder.toBuffer(), new BN(nonce).toBuffer("le", 8)],
    programId
  );
  return pda;
}
export function vaultPda(commitment: PublicKey) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), commitment.toBuffer()],
    programId
  );
  return pda;
}

function nameBytes(name: string): number[] {
  const buf = Buffer.alloc(64);
  Buffer.from(name.slice(0, 64), "utf8").copy(buf);
  return Array.from(buf);
}

export type CreateParams = {
  fixtureId: number;
  kickoffTs: number; // unix seconds
  conditionTemplate: number;
  conditionParam: number;
  beneficiary: string;
  depositLamports: number;
  name: string;
};

export async function createCommitment(wallet: AnchorWallet, p: CreateParams) {
  const program = getProgram(wallet);
  const nonce = Date.now();
  const commitment = commitmentPda(p.fixtureId, wallet.publicKey, nonce);
  const sig = await program.methods
    .createCommitment(
      new BN(p.fixtureId),
      new BN(nonce),
      new BN(p.kickoffTs),
      p.conditionTemplate,
      new BN(p.conditionParam),
      new PublicKey(p.beneficiary),
      new BN(p.depositLamports),
      nameBytes(p.name)
    )
    .accounts({
      founder: wallet.publicKey,
      commitment,
      vault: vaultPda(commitment),
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  return { sig, commitment: commitment.toBase58() };
}

export async function joinCommitment(wallet: AnchorWallet, commitment: string, depositLamports: number) {
  const program = getProgram(wallet);
  const c = new PublicKey(commitment);
  return program.methods
    .join(new BN(depositLamports))
    .accounts({ member: wallet.publicKey, commitment: c, vault: vaultPda(c), systemProgram: SystemProgram.programId })
    .rpc();
}

export async function withdrawFromCommitment(wallet: AnchorWallet, commitment: string) {
  const program = getProgram(wallet);
  const c = new PublicKey(commitment);
  return program.methods
    .withdraw()
    .accounts({ member: wallet.publicKey, commitment: c, vault: vaultPda(c), systemProgram: SystemProgram.programId })
    .rpc();
}

export async function claimRefund(wallet: AnchorWallet, commitment: string) {
  const program = getProgram(wallet);
  const c = new PublicKey(commitment);
  return program.methods
    .claimRefund()
    .accounts({ member: wallet.publicKey, commitment: c, vault: vaultPda(c), systemProgram: SystemProgram.programId })
    .rpc();
}

export async function voidTimeout(wallet: AnchorWallet, commitment: string) {
  const program = getProgram(wallet);
  return program.methods
    .voidTimeout()
    .accounts({ member: wallet.publicKey, commitment: new PublicKey(commitment) })
    .rpc();
}

export function programErrorMessage(e: unknown): string {
  const s = String((e as Error)?.message ?? e);
  const map: [RegExp, string][] = [
    [/KickoffPassed/, "Kickoff has passed — this pledge is locked."],
    [/DepositTooSmall/, "Minimum deposit is 0.01 SOL."],
    [/MemberLimitReached/, "This DAO has reached its 200-member limit."],
    [/AlreadyMember/, "This wallet is already a member (or previously withdrew)."],
    [/AlreadyClaimed/, "Refund already claimed."],
    [/NotRefundable/, "Nothing to claim on this commitment."],
    [/NotOpen/, "This commitment has already been settled."],
    [/User rejected/, "Transaction cancelled."],
  ];
  for (const [re, msg] of map) if (re.test(s)) return msg;
  return s.length > 140 ? s.slice(0, 140) + "…" : s;
}
