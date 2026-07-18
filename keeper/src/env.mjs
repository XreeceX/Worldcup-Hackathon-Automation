// Env loading + validation (design-01.md §7.1). Fails fast with one clear
// error listing everything that is missing or unreadable.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { log } from './logger.mjs';

const KEEPER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CREDS_FALLBACK_PATH = path.join(os.homedir(), '.secrets', 'txline-devnet-creds.json');

export function loadEnv(env = process.env) {
  // Fallback: txline-setup/setup.mjs writes { jwt, apiToken } to ~/.secrets.
  let jwt = env.TXLINE_JWT;
  let apiToken = env.TXLINE_API_TOKEN;
  if (!jwt || !apiToken) {
    try {
      const creds = JSON.parse(fs.readFileSync(CREDS_FALLBACK_PATH, 'utf8'));
      jwt = jwt || creds.jwt;
      apiToken = apiToken || creds.apiToken;
      if (jwt && apiToken) {
        log.info(`TXLINE credentials loaded from fallback file ${CREDS_FALLBACK_PATH}`);
      }
    } catch {
      // File absent or unparseable — handled by the required-var check below.
    }
  }

  const problems = [];
  const require = (name, value, hint) => {
    if (!value) problems.push(`  - ${name} is not set${hint ? ` (${hint})` : ''}`);
    return value;
  };

  const cfg = {
    anchorWallet: require('ANCHOR_WALLET', env.ANCHOR_WALLET, 'path to resolver keypair JSON'),
    anchorProviderUrl: require('ANCHOR_PROVIDER_URL', env.ANCHOR_PROVIDER_URL, 'Solana devnet RPC URL'),
    txlineJwt: require('TXLINE_JWT', jwt, `also checked ${CREDS_FALLBACK_PATH}`),
    txlineApiToken: require('TXLINE_API_TOKEN', apiToken, `also checked ${CREDS_FALLBACK_PATH}`),
    escrowMode: require('ESCROW_MODE', env.ESCROW_MODE, '"on-chain"'),
    programId: require('PROGRAM_ID', env.PROGRAM_ID, 'deployed Commitment program address'),
    indexerUrl: require('INDEXER_URL', env.INDEXER_URL, 'base URL of indexer query API'),
    port: Number(env.PORT || 3001),
    replayFixtureId: env.REPLAY_FIXTURE_ID ? Number(env.REPLAY_FIXTURE_ID) : null,
    pollIntervalMs: Number(env.POLL_INTERVAL_MS || 30_000),
    idlPath: env.IDL_PATH
      ? path.resolve(env.IDL_PATH)
      : path.resolve(KEEPER_ROOT, '..', 'program', 'target', 'idl', 'commitment.json'),
  };

  if (cfg.anchorWallet && !fs.existsSync(cfg.anchorWallet)) {
    problems.push(`  - ANCHOR_WALLET points to a file that does not exist: ${cfg.anchorWallet}`);
  }
  if (env.REPLAY_FIXTURE_ID && !Number.isFinite(cfg.replayFixtureId)) {
    problems.push(`  - REPLAY_FIXTURE_ID is not a number: ${env.REPLAY_FIXTURE_ID}`);
  }

  if (problems.length > 0) {
    throw new Error(
      `Keeper cannot start — fix the following environment problems:\n${problems.join('\n')}\n` +
        'See keeper/.env.example for the full variable list.'
    );
  }

  return cfg;
}
