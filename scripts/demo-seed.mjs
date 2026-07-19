// Seed a demo pledge on a replay fixture for camera recording.
// Usage: node scripts/demo-seed.mjs [kickoffInSeconds] [fixtureId]
//
// Requires:
//   ~/.secrets/txline-devnet-wallet.json  (founder + beneficiary for demo)
//   program/target/idl/commitment.json
import * as anchor from '@coral-xyz/anchor';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const BN = anchor.BN ?? anchor.default.BN;

const FIXTURE_ID = Number(process.argv[3] ?? 18241006);
const KICKOFF_IN_S = Number(process.argv[2] ?? 90);

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const wallet = Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(
      fs.readFileSync(
        path.join(os.homedir(), '.secrets', 'txline-devnet-wallet.json'),
        'utf8',
      ),
    ),
  ),
);
const idl = JSON.parse(
  fs.readFileSync(path.join(root, 'program', 'target', 'idl', 'commitment.json'), 'utf8'),
);
const provider = new anchor.AnchorProvider(
  connection,
  new anchor.Wallet(wallet),
  { commitment: 'confirmed' },
);
const program = new anchor.Program(idl, provider);

const nameBytes = (s) => {
  const b = Buffer.alloc(64);
  Buffer.from(s, 'utf8').copy(b);
  return Array.from(b);
};

const nonce = Date.now() * 1000 + Math.floor(Math.random() * 1000);
const kickoff = Math.floor(Date.now() / 1000) + KICKOFF_IN_S;
const fixtureLe = new BN(FIXTURE_ID).toArrayLike(Buffer, 'le', 8);
const nonceLe = new BN(nonce).toArrayLike(Buffer, 'le', 8);
const [commitment] = PublicKey.findProgramAddressSync(
  [Buffer.from('commitment'), fixtureLe, wallet.publicKey.toBuffer(), nonceLe],
  program.programId,
);
const [vault] = PublicKey.findProgramAddressSync(
  [Buffer.from('vault'), commitment.toBuffer()],
  program.programId,
);

const deposit = new BN(0.05 * LAMPORTS_PER_SOL);

await program.methods
  .createCommitment(
    new BN(FIXTURE_ID),
    new BN(nonce),
    new BN(kickoff),
    0, // BTTS
    new BN(0),
    wallet.publicKey,
    deposit,
    nameBytes('Demo BTTS Collective'),
  )
  .accountsPartial({
    founder: wallet.publicKey,
    commitment,
    vault,
  })
  .rpc();

console.log('created:', commitment.toBase58());
console.log(`fixture ${FIXTURE_ID} · kickoff in ${KICKOFF_IN_S}s · BTTS · 0.05 SOL`);
console.log(`open: http://localhost:3000/commitment/${commitment.toBase58()}`);
console.log(
  'Tip: set REPLAY_FIXTURE_ID and POST /api/replay/run?speedMs=200 on the keeper for paced replay.',
);
