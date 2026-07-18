import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  // Host port 5433: 5432 on this machine is taken by an unrelated Postgres container.
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgres://commitment:commitment@localhost:5433/commitment',
  port: Number(process.env.PORT ?? 3002),
  rpcUrl: process.env.ANCHOR_PROVIDER_URL ?? 'https://api.devnet.solana.com',
  programId: process.env.PROGRAM_ID ?? '3uyiF93zMvUcP2o1Cqnt2iS4bXwYeBcTMTvbaTf5B3RJ',
  idlPath:
    process.env.IDL_PATH ?? path.resolve(here, '../../program/target/idl/commitment.json'),
  txline: {
    origin: 'https://txline-dev.txodds.com',
    competitionId: 72,
    startEpochDay: 20624,
    jwt: process.env.TXLINE_JWT,
    apiToken: process.env.TXLINE_API_TOKEN,
    credsPath: path.join(os.homedir(), '.secrets', 'txline-devnet-creds.json'),
  },
  fixtureRefreshMs: 10 * 60 * 1000,
  reconcileMs: 10 * 60 * 1000,
  idlPollMs: 15 * 1000,
  corsOrigin: 'http://localhost:3000',
};
