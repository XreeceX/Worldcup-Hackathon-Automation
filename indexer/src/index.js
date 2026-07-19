import { config } from './config.js';
import { ensureSchema } from './db.js';
import { startFixtureLoader } from './fixtures.js';
import { startListener, startReconciler } from './listener.js';
import { createApp } from './api.js';

async function main() {
  console.log('[boot] commitment indexer starting');
  await ensureSchema();

  startFixtureLoader(); // TxLINE snapshot now + every 10 min (no-crash without creds)
  startListener(() => startReconciler()); // reconcile needs the IDL; runs once listener is up

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`[boot] query API listening on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error('[boot] fatal:', err);
  process.exit(1);
});
