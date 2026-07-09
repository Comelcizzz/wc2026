/**
 * Migrate pool_data from one Supabase project to another.
 *
 * Setup — add to .env.local (or export in shell):
 *   SOURCE_SUPABASE_URL=...
 *   SOURCE_SUPABASE_ANON_KEY=...   (or SERVICE_ROLE_KEY)
 *   SOURCE_POOL_ID=TVZAQN8G
 *
 *   TARGET_SUPABASE_URL=...
 *   TARGET_SUPABASE_ANON_KEY=...
 *   TARGET_POOL_ID=TVZAQN8G          (same or new id)
 *
 * Usage:
 *   node scripts/migrate-supabase.mjs              # dry-run (read only)
 *   node scripts/migrate-supabase.mjs --write      # copy to target
 *
 * The target row is upserted by id. Create the table + RLS on the new project first
 * (see README.md Supabase RLS section).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnv() {
  const env = { ...process.env };
  const path = join(root, '.env.local');
  if (existsSync(path)) {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2];
    }
  }
  return env;
}

function sbHeaders(key) {
  const h = { apikey: key, 'Content-Type': 'application/json' };
  if (key.startsWith('eyJ')) h.Authorization = `Bearer ${key}`;
  return h;
}

async function readRow(url, key, poolId) {
  const endpoint = `${url}/rest/v1/pool_data?id=eq.${encodeURIComponent(poolId)}&select=*`;
  const res = await fetch(endpoint, { headers: sbHeaders(key) });
  if (!res.ok) throw new Error(`Source read failed (${res.status}): ${await res.text()}`);
  const rows = await res.json();
  if (!rows.length) throw new Error(`Pool ${poolId} not found on source`);
  return rows[0];
}

async function writeRow(url, key, row) {
  const endpoint = `${url}/rest/v1/pool_data`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { ...sbHeaders(key), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`Target write failed (${res.status}): ${await res.text()}`);
}

async function main() {
  const env = loadEnv();
  const write = process.argv.includes('--write');

  const srcUrl = env.SOURCE_SUPABASE_URL || env.SUPABASE_URL;
  const srcKey = env.SOURCE_SUPABASE_SERVICE_ROLE_KEY || env.SOURCE_SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  const srcId = env.SOURCE_POOL_ID || env.POOL_ID;

  const tgtUrl = env.TARGET_SUPABASE_URL;
  const tgtKey = env.TARGET_SUPABASE_SERVICE_ROLE_KEY || env.TARGET_SUPABASE_ANON_KEY;
  const tgtId = env.TARGET_POOL_ID || srcId;

  if (!srcUrl || !srcKey || !srcId) {
    throw new Error('Set SOURCE_SUPABASE_URL, SOURCE key, SOURCE_POOL_ID (or SUPABASE_* / POOL_ID)');
  }

  console.log(`Reading pool ${srcId} from source…`);
  const row = await readRow(srcUrl, srcKey, srcId);
  const data = row.data || row;
  const participants = data.participants || [];
  const results = (data.matches || []).filter((m) => m.result?.homeGoals != null).length;

  const dir = join(root, 'backups');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = join(dir, `migrate-export-${srcId}-${stamp}.json`);
  writeFileSync(file, JSON.stringify(row, null, 2), 'utf8');

  console.log(`\n✓ Exported snapshot: ${file}`);
  console.log(`  Participants: ${participants.length}`);
  console.log(`  Match results: ${results}`);

  if (!write) {
    console.log('\nDry-run only. To copy to a new Supabase project:');
    console.log('  1. Create pool_data table on target (same schema as v1)');
    console.log('  2. Set TARGET_SUPABASE_URL, TARGET key, TARGET_POOL_ID in .env.local');
    console.log('  3. Run: node scripts/migrate-supabase.mjs --write');
    return;
  }

  if (!tgtUrl || !tgtKey) throw new Error('Set TARGET_SUPABASE_URL and TARGET key for --write');

  const payload = { ...row, id: tgtId };
  console.log(`\nWriting to target pool ${tgtId}…`);
  await writeRow(tgtUrl, tgtKey, payload);
  console.log('✓ Migration complete. Update Vercel env vars to point at the new Supabase project.');
}

main().catch((e) => {
  console.error('\n✗', e.message);
  process.exit(1);
});
