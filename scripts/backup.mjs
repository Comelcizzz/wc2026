// Local backup of the live pool from Supabase.
// Reads credentials from .env.local, downloads the full pool_data row(s),
// and writes a timestamped JSON snapshot into ./backups.
//
//   node scripts/backup.mjs
//
// The snapshot contains EVERYTHING: settings, participants (with their group
// picks, knockout picks, champion, total-goals and paid state), all match
// results and the knockout bracket. It is a verbatim copy of the DB row.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnv() {
  const env = {};
  const path = join(root, '.env.local');
  if (!existsSync(path)) throw new Error('.env.local not found');
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

async function main() {
  const env = loadEnv();
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  const poolId = env.POOL_ID;
  if (!url || !key || !poolId) throw new Error('Missing SUPABASE_URL / key / POOL_ID');

  const headers = { apikey: key };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;

  const endpoint = `${url}/rest/v1/pool_data?id=eq.${encodeURIComponent(poolId)}&select=*`;
  const res = await fetch(endpoint, { headers });
  if (!res.ok) throw new Error(`Read failed (${res.status}): ${await res.text()}`);
  const rows = await res.json();
  if (!rows.length) throw new Error('Pool not found - check POOL_ID');

  const data = rows[0].data || rows[0];
  const participants = data.participants || [];

  const dir = join(root, 'backups');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = join(dir, `pool-${poolId}-${stamp}.json`);
  writeFileSync(file, JSON.stringify(rows[0], null, 2), 'utf8');

  // Quick human-readable summary alongside the raw snapshot.
  const summary = participants.map((p) => ({
    name: p.name,
    paid: !!p.paid,
    champion: p.champion || null,
    totalGoals: p.totalGoals ?? null,
    groupPicks: Object.keys(p.picks || {}).length,
    koPicks: Object.keys(p.koPicks || {}).length,
    koSubmittedAt: p.koSubmittedAt || null,
  }));

  console.log(`\n✓ Backup saved: ${file}`);
  console.log(`  Participants: ${participants.length}`);
  console.log(`  Results entered: ${(data.matches || []).filter((m) => m.result).length}`);
  console.table(summary);
}

main().catch((e) => {
  console.error('\n✗ Backup failed:', e.message);
  process.exit(1);
});
