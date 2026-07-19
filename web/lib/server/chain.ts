import { AnchorProvider, BN, Program, type Idl, type Wallet } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import idl from '../idl/commitment.json';
import { conditionLabel } from '../conditions';
import { decodeName64 } from '../format';
import { WC_2026_SCHEDULE } from '../wcSchedule';
import type { BoardCommitment, CommitmentMember, CommitmentStatus } from '../types';

function rpcUrl(): string {
  return process.env.NEXT_PUBLIC_RPC_URL ?? 'https://api.devnet.solana.com';
}

function statusName(status: Record<string, unknown> | undefined): CommitmentStatus {
  const key = Object.keys(status ?? {})[0] ?? 'open';
  const map: Record<string, CommitmentStatus> = {
    open: 'Open',
    executed: 'Executed',
    refunded: 'Refunded',
    void: 'Void',
    closed: 'Closed',
  };
  return map[key] ?? 'Open';
}

function readonlyWallet(): Wallet {
  return {
    publicKey: PublicKey.default,
    signTransaction: async () => {
      throw new Error('read-only');
    },
    signAllTransactions: async () => {
      throw new Error('read-only');
    },
  } as unknown as Wallet;
}

export function makeReadonlyProgram(): Program {
  const connection = new Connection(rpcUrl(), 'confirmed');
  const provider = new AnchorProvider(connection, readonlyWallet(), {
    commitment: 'confirmed',
  });
  return new Program(idl as Idl, provider);
}

interface RawMember {
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
  members: RawMember[];
}

function teamNames(fixtureId: number): { homeTeam: string; awayTeam: string } {
  const entry = WC_2026_SCHEDULE[fixtureId];
  return {
    homeTeam: entry?.homeTeam ?? 'Home team',
    awayTeam: entry?.awayTeam ?? 'Away team',
  };
}

export function toBoardRow(
  pubkey: string,
  raw: RawCommitment,
): BoardCommitment {
  const fixtureId = Number(raw.fixtureId.toString());
  const { homeTeam, awayTeam } = teamNames(fixtureId);
  const template = Number(raw.conditionTemplate);
  const param = Number(raw.conditionParam.toString());
  const members = (raw.members ?? []).slice(0, raw.memberCount ?? 0);
  const active = members.filter((m) => !m.withdrawn);
  const totalLamports = active.reduce(
    (sum, m) => sum + Number(m.depositLamports.toString()),
    0,
  );

  return {
    pubkey,
    fixtureId,
    kickoffTs: Number(raw.kickoffTs.toString()) * 1000,
    conditionTemplate: template,
    conditionParam: param,
    conditionLabel: conditionLabel(template, param, homeTeam, awayTeam),
    beneficiary: raw.beneficiary.toBase58(),
    founder: raw.founder.toBase58(),
    name: decodeName64(raw.name),
    status: statusName(raw.status),
    memberCount: active.length,
    totalLamports,
    homeTeam,
    awayTeam,
    competition: 'World Cup',
    members: members.map(
      (m): CommitmentMember => ({
        wallet: m.wallet.toBase58(),
        depositLamports: Number(m.depositLamports.toString()),
        withdrawn: m.withdrawn,
        claimed: m.claimed,
      }),
    ),
  };
}

export async function scanAllCommitments(): Promise<BoardCommitment[]> {
  const program = makeReadonlyProgram();
  const accounts = program.account as unknown as {
    commitment: { all(): Promise<{ publicKey: PublicKey; account: RawCommitment }[]> };
  };
  const all = await accounts.commitment.all();
  return all.map((c) => toBoardRow(c.publicKey.toBase58(), c.account));
}

export async function fetchCommitmentBoard(
  pubkey: string,
): Promise<BoardCommitment | null> {
  const program = makeReadonlyProgram();
  const accounts = program.account as unknown as {
    commitment: {
      fetchNullable(pk: PublicKey): Promise<RawCommitment | null>;
    };
  };
  const raw = await accounts.commitment.fetchNullable(new PublicKey(pubkey));
  if (!raw) return null;
  return toBoardRow(pubkey, raw);
}
