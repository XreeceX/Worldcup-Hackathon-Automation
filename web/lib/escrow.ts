import { AnchorProvider, BN, Program, type Idl, type Wallet } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import type { AnchorWallet } from '@solana/wallet-adapter-react';
// TODO: replace with generated IDL — run `npm run sync-idl` after the Anchor
// build produces program/target/idl/commitment.json. The stub mirrors lib.rs.
import idl from './idl/commitment.json';
import { decodeName64, encodeName64 } from './format';
import type { CommitmentMember, CommitmentStatus } from './types';

export interface CreateParams {
  fixtureId: number;
  kickoffTs: number; // Unix seconds
  conditionTemplate: number;
  conditionParam: number;
  beneficiary: string;
  depositLamports: number;
  name: string;
}

export interface EscrowInterface {
  createCommitment(params: CreateParams): Promise<{ txSig: string; commitment: string }>;
  joinCommitment(pubkey: string, lamports: number): Promise<string>;
  withdraw(pubkey: string): Promise<string>;
  claimRefund(pubkey: string): Promise<string>;
  voidTimeout(pubkey: string): Promise<string>;
}

export interface OnChainCommitment {
  pubkey: string;
  fixtureId: number;
  kickoffTs: number; // Unix seconds
  conditionTemplate: number;
  conditionParam: number;
  beneficiary: string;
  founder: string;
  name: string;
  status: CommitmentStatus;
  memberCount: number;
  members: CommitmentMember[];
}

const PROGRAM_PUBKEY = new PublicKey((idl as { address: string }).address);

export function deriveCommitmentPda(
  fixtureId: number,
  founder: PublicKey,
  nonce: number | BN,
): PublicKey {
  const fixtureLe = new BN(fixtureId).toArrayLike(Buffer, 'le', 8);
  const nonceLe = new BN(nonce).toArrayLike(Buffer, 'le', 8);
  return PublicKey.findProgramAddressSync(
    [Buffer.from('commitment'), fixtureLe, founder.toBuffer(), nonceLe],
    PROGRAM_PUBKEY,
  )[0];
}

export function deriveVaultPda(commitment: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), commitment.toBuffer()],
    PROGRAM_PUBKEY,
  )[0];
}

function makeProgram(connection: Connection, wallet: AnchorWallet): Program {
  const provider = new AnchorProvider(connection, wallet as Wallet, {
    commitment: 'confirmed',
  });
  return new Program(idl as Idl, provider);
}

/** Sole EscrowInterface implementation — all writes are on-chain Anchor txs. */
export class AnchorEscrow implements EscrowInterface {
  private program: Program;
  private wallet: AnchorWallet;

  constructor(connection: Connection, wallet: AnchorWallet) {
    this.wallet = wallet;
    this.program = makeProgram(connection, wallet);
  }

  async createCommitment(params: CreateParams): Promise<{ txSig: string; commitment: string }> {
    const founder = this.wallet.publicKey;
    // Unique PDA per create — allows many pledges on the same match.
    const nonce = Date.now() * 1000 + Math.floor(Math.random() * 1000);
    const commitment = deriveCommitmentPda(params.fixtureId, founder, nonce);
    const vault = deriveVaultPda(commitment);

    const txSig = await this.program.methods
      .createCommitment(
        new BN(params.fixtureId),
        new BN(nonce),
        new BN(params.kickoffTs),
        params.conditionTemplate,
        new BN(params.conditionParam),
        new PublicKey(params.beneficiary),
        new BN(params.depositLamports),
        encodeName64(params.name),
      )
      .accountsPartial({ founder, commitment, vault })
      .rpc();
    return { txSig, commitment: commitment.toBase58() };
  }

  async joinCommitment(pubkey: string, lamports: number): Promise<string> {
    const commitment = new PublicKey(pubkey);
    return this.program.methods
      .join(new BN(lamports))
      .accountsPartial({
        member: this.wallet.publicKey,
        commitment,
        vault: deriveVaultPda(commitment),
      })
      .rpc();
  }

  async withdraw(pubkey: string): Promise<string> {
    const commitment = new PublicKey(pubkey);
    return this.program.methods
      .withdraw()
      .accountsPartial({
        member: this.wallet.publicKey,
        commitment,
        vault: deriveVaultPda(commitment),
      })
      .rpc();
  }

  async claimRefund(pubkey: string): Promise<string> {
    const commitment = new PublicKey(pubkey);
    return this.program.methods
      .claimRefund()
      .accountsPartial({
        member: this.wallet.publicKey,
        commitment,
        vault: deriveVaultPda(commitment),
      })
      .rpc();
  }

  async voidTimeout(pubkey: string): Promise<string> {
    return this.program.methods
      .voidTimeout()
      .accountsPartial({
        member: this.wallet.publicKey,
        commitment: new PublicKey(pubkey),
      })
      .rpc();
  }
}

interface RawMemberEntry {
  wallet: PublicKey;
  depositLamports: BN;
  withdrawn: boolean;
  claimed: boolean;
}

interface RawCommitment {
  fixtureId: BN;
  kickoffTs: BN;
  conditionTemplate: number;
  conditionParam: BN;
  beneficiary: PublicKey;
  founder: PublicKey;
  name: number[];
  status: Record<string, unknown>;
  memberCount: number;
  members: RawMemberEntry[];
}

function decodeStatus(status: Record<string, unknown>): CommitmentStatus {
  const key = Object.keys(status)[0] ?? 'open';
  const map: Record<string, CommitmentStatus> = {
    open: 'Open',
    executed: 'Executed',
    refunded: 'Refunded',
    void: 'Void',
    closed: 'Closed',
  };
  return map[key] ?? 'Open';
}

/**
 * Read a commitment directly from chain (no wallet needed). Used as the
 * source of truth on the detail page; the indexer only augments it.
 */
export async function fetchOnChainCommitment(
  connection: Connection,
  pubkey: string,
): Promise<OnChainCommitment | null> {
  const readonlyWallet = {
    publicKey: PROGRAM_PUBKEY,
    signTransaction: async () => {
      throw new Error('read-only');
    },
    signAllTransactions: async () => {
      throw new Error('read-only');
    },
  } as unknown as AnchorWallet;
  const program = makeProgram(connection, readonlyWallet);
  // Without generated IDL types, the account namespace is untyped.
  const accounts = program.account as unknown as {
    commitment: { fetchNullable(pk: PublicKey): Promise<unknown> };
  };
  const raw = (await accounts.commitment.fetchNullable(
    new PublicKey(pubkey),
  )) as RawCommitment | null;
  if (!raw) return null;
  return {
    pubkey,
    fixtureId: raw.fixtureId.toNumber(),
    kickoffTs: raw.kickoffTs.toNumber(),
    conditionTemplate: raw.conditionTemplate,
    conditionParam: raw.conditionParam.toNumber(),
    beneficiary: raw.beneficiary.toBase58(),
    founder: raw.founder.toBase58(),
    name: decodeName64(raw.name),
    status: decodeStatus(raw.status),
    memberCount: raw.memberCount,
    members: raw.members.map((m) => ({
      wallet: m.wallet.toBase58(),
      depositLamports: m.depositLamports.toNumber(),
      withdrawn: m.withdrawn,
      claimed: m.claimed,
    })),
  };
}
