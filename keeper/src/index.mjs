// Keeper entry point — boot sequence per design-01.md §7.2:
//   1. validate env (fail fast)   2. replay short-circuit
//   3. SSE at boot (BUG-04)       4/5. score + fixture poll loops
//   6. load active commitments    7. HTTP server   8. event loop

import { loadEnv } from './env.mjs';
import { log } from './logger.mjs';
import { createTxlineClient } from './txline.mjs';
import { createChain } from './chain.mjs';
import { createKeeper } from './keeper.mjs';
import { createServer } from './server.mjs';

async function main() {
  let cfg;
  try {
    cfg = loadEnv();
  } catch (e) {
    console.error(`\n${e.message}\n`);
    process.exit(1);
  }

  log.info(
    `[boot] keeper starting — mode=${cfg.replayFixtureId != null ? 'replay' : 'live'}, ` +
      `program=${cfg.programId}, indexer=${cfg.indexerUrl}, port=${cfg.port}`
  );

  const txline = createTxlineClient({ jwt: cfg.txlineJwt, apiToken: cfg.txlineApiToken });
  const chain = createChain(cfg);
  const keeper = createKeeper({ cfg, txline, chain });

  await keeper.loadActiveCommitments();
  await createServer({ cfg, keeper });
  keeper.start();

  const shutdown = (signal) => {
    log.info(`[boot] ${signal} received — shutting down`);
    keeper.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // A rejection escaping a poll/SSE callback must never take the process down.
  process.on('unhandledRejection', (reason) => {
    log.error('[boot] unhandled rejection (continuing)', reason instanceof Error ? reason.message : reason);
  });
}

main().catch((e) => {
  console.error(`Keeper failed to start: ${e.stack ?? e.message}`);
  process.exit(1);
});
