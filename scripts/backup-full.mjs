/**
 * Full pool backup for Supabase migration.
 *
 * Mode 1 — direct Supabase (preferred, includes passwords/emails):
 *   Set SUPABASE_URL, SUPABASE_ANON_KEY (or SERVICE_ROLE_KEY), POOL_ID in .env.local
 *   node scripts/backup-full.mjs
 *
 * Mode 2 — live deployment API (no secrets; picks/results/chat/comments only):
 *   node scripts/backup-full.mjs --from-url https://wc2026-rose-zeta.vercel.app
 *
 * Writes timestamped JSON into ./backups plus a human-readable summary.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const KO_MATCH_IDS = [
  'R32-1', 'R32-2', 'R32-3', 'R32-4', 'R32-5', 'R32-6', 'R32-7', 'R32-8',
  'R32-9', 'R32-10', 'R32-11', 'R32-12', 'R32-13', 'R32-14', 'R32-15', 'R32-16',
  'R16-1', 'R16-2', 'R16-3', 'R16-4', 'R16-5', 'R16-6', 'R16-7', 'R16-8',
  'QF-1', 'QF-2', 'QF-3', 'QF-4',
  'SF-1', 'SF-2',
  '3RD-1',
  'FINAL-1',
];

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
  const h = { apikey: key };
  if (key.startsWith('eyJ')) h.Authorization = `Bearer ${key}`;
  return h;
}

async function readFromSupabase(env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  const poolId = env.POOL_ID;
  if (!url || !key || !poolId) return null;

  const endpoint = `${url}/rest/v1/pool_data?id=eq.${encodeURIComponent(poolId)}&select=*`;
  const res = await fetch(endpoint, { headers: sbHeaders(key) });
  if (!res.ok) throw new Error(`Supabase read failed (${res.status}): ${await res.text()}`);
  const rows = await res.json();
  if (!rows.length) throw new Error(`Pool ${poolId} not found on Supabase`);

  return {
    source: 'supabase',
    poolId,
    exportedAt: new Date().toISOString(),
    row: rows[0],
    data: rows[0].data || rows[0],
    includesSecrets: true,
  };
}

async function readFromLiveUrl(baseUrl) {
  const base = baseUrl.replace(/\/$/, '');
  const poolRes = await fetch(`${base}/api/pool`, { cache: 'no-store' });
  const poolJson = await poolRes.json();
  if (!poolJson.ok) throw new Error(poolJson.error || 'Pool fetch failed');

  const chatRes = await fetch(`${base}/api/chat`, { cache: 'no-store' });
  const chatJson = await chatRes.json();
  const chat = chatJson.ok ? chatJson.messages || [] : [];

  const matchComments = {};
  for (const matchId of KO_MATCH_IDS) {
    const res = await fetch(`${base}/api/comments?matchId=${encodeURIComponent(matchId)}`, {
      cache: 'no-store',
    });
    const json = await res.json();
    if (json.ok && json.comments?.length) matchComments[matchId] = json.comments;
  }

  const data = {
    settings: poolJson.settings,
    participants: poolJson.participants,
    matches: poolJson.matches,
    koBracket: poolJson.koBracket,
    chat,
    matchComments,
  };

  return {
    source: 'live-api',
    poolId: process.env.POOL_ID || 'TVZAQN8G',
    exportedAt: new Date().toISOString(),
    liveUrl: base,
    row: { id: process.env.POOL_ID || 'TVZAQN8G', data },
    data,
    includesSecrets: false,
    warnings: [
      'Live API backup does NOT include email, passHash, or passSalt.',
      'For full migration with existing logins, re-run with Supabase credentials in .env.local.',
    ],
  };
}

function summarize(data) {
  const participants = data.participants || [];
  return {
    participants: participants.length,
    paid: participants.filter((p) => p.paid).length,
    withGroupPicks: participants.filter((p) => Object.keys(p.picks || {}).length).length,
    withKoPicks: participants.filter((p) => Object.keys(p.koPicks || {}).length).length,
    withPasswords: participants.filter((p) => p.passHash).length,
    matchResults: (data.matches || []).filter((m) => m.result?.homeGoals != null).length,
    chatMessages: (data.chat || []).length,
    commentThreads: Object.keys(data.matchComments || {}).length,
    commentCount: Object.values(data.matchComments || {}).reduce((n, arr) => n + arr.length, 0),
  };
}

function participantTable(data) {
  return (data.participants || []).map((p) => ({
    name: p.name,
    paid: !!p.paid,
    champion: p.champion || null,
    totalGoals: p.totalGoals ?? null,
    groupPicks: Object.keys(p.picks || {}).length,
    koPicks: Object.keys(p.koPicks || {}).length,
    hasPassword: !!p.passHash,
    koSubmittedAt: p.koSubmittedAt || null,
  }));
}

async function main() {
  const env = loadEnv();
  const fromUrlIdx = process.argv.indexOf('--from-url');
  const fromUrl = fromUrlIdx >= 0 ? process.argv[fromUrlIdx + 1] : null;

  let snapshot;
  if (fromUrl) {
    console.log(`Downloading from live deployment: ${fromUrl}`);
    snapshot = await readFromLiveUrl(fromUrl);
  } else {
    snapshot = await readFromSupabase(env);
    if (!snapshot) {
      const fallback = 'https://wc2026-rose-zeta.vercel.app';
      console.log('No Supabase credentials found — falling back to live API backup.');
      console.log(`(Add .env.local with SUPABASE_URL + key for a full backup with passwords.)\n`);
      snapshot = await readFromLiveUrl(fallback);
    } else {
      console.log(`Reading pool ${snapshot.poolId} directly from Supabase…`);
    }
  }

  const stats = summarize(snapshot.data);
  const dir = join(root, 'backups');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = join(dir, `full-backup-${snapshot.poolId}-${stamp}.json`);
  const summaryFile = join(dir, `full-backup-${snapshot.poolId}-${stamp}-summary.json`);

  writeFileSync(file, JSON.stringify(snapshot, null, 2), 'utf8');
  writeFileSync(
    summaryFile,
    JSON.stringify({ ...stats, source: snapshot.source, includesSecrets: snapshot.includesSecrets, warnings: snapshot.warnings || [] }, null, 2),
    'utf8',
  );

  console.log(`\n✓ Full backup saved: ${file}`);
  console.log(`✓ Summary saved: ${summaryFile}`);
  console.log(`  Source: ${snapshot.source}`);
  console.log(`  Includes passwords/emails: ${snapshot.includesSecrets ? 'yes' : 'no'}`);
  if (snapshot.warnings?.length) {
    console.log('\nWarnings:');
    for (const w of snapshot.warnings) console.log(`  • ${w}`);
  }
  console.log('\nStats:');
  console.table(stats);
  console.log('\nParticipants:');
  console.table(participantTable(snapshot.data));
}

main().catch((e) => {
  console.error('\n✗ Backup failed:', e.message);
  process.exit(1);
});
