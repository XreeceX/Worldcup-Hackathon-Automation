// Copies the Anchor-generated IDL over the hand-written stub.
// Run after `anchor build` in program/: npm run sync-idl
import { copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '../../program/target/idl/commitment.json');
const dest = path.resolve(here, '../lib/idl/commitment.json');

if (!existsSync(src)) {
  console.error(`Generated IDL not found at ${src} — run \`anchor build\` in program/ first.`);
  process.exit(1);
}
copyFileSync(src, dest);
console.log(`Synced IDL: ${src} → ${dest}`);
