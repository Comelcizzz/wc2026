import { config } from './config';
import { ALL_MATCHES } from './tournament';
import { computeTotalGoals } from './tiebreaker';
import type { PoolData } from './types';

// Supabase access. In the open-v1-compatible mode this uses the public
// sb_publishable key server-side. If a secret/service key is later provided,
// config.supabaseServiceKey automatically takes priority.

function headers(): Record<string, string> {
  const key = config.supabaseServiceKey || config.supabaseAnonKey;
  const h: Record<string, string> = {
    apikey: key,
    'Content-Type': 'application/json',
  };

  // Legacy Supabase anon/service keys are JWTs and need Authorization: Bearer.
  // New sb_publishable_/sb_secret_ keys are sent only as apikey.
  if (key.startsWith('eyJ')) h.Authorization = `Bearer ${key}`;

  return h;
}

function base(): string {
  if (!config.supabaseUrl) throw new Error('SUPABASE_URL is not configured');
  return `${config.supabaseUrl}/rest/v1/pool_data`;
}

export async function readPool(id: string = config.poolId): Promise<PoolData> {
  const r = await fetch(`${base()}?id=eq.${encodeURIComponent(id)}&select=data`, {
    headers: headers(),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`Read failed (${r.status}): ${await r.text()}`);
  const rows = (await r.json()) as { data: PoolData }[];
  if (!rows.length) throw new Error('Pool not found - check POOL_ID');
  return normalize(rows[0].data);
}

export async function writePool(data: PoolData, id: string = config.poolId): Promise<void> {
  const r = await fetch(`${base()}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { ...headers(), Prefer: 'return=minimal' },
    body: JSON.stringify({ data }),
  });
  if (!r.ok) throw new Error(`Write failed (${r.status}): ${await r.text()}`);
}

// Ensures a pool loaded from an older schema has koBracket etc.
function normalize(data: PoolData): PoolData {
  // Ensure the full fixture skeleton is always present. Older pools were seeded
  // with only the matches that had results entered (e.g. a group could be missing
  // its matchday-3 fixtures), which hid upcoming matches and their predictions.
  // Merge in any missing match from the canonical schedule, keyed by id, while
  // preserving every stored result and field.
  if (!data.matches || data.matches.length === 0) {
    data.matches = ALL_MATCHES.map((m) => ({ ...m }));
  } else {
    const byId = new Set(data.matches.map((m) => m.id));
    for (const m of ALL_MATCHES) {
      if (!byId.has(m.id)) data.matches.push({ ...m });
    }
  }
  if (!data.koBracket) {
    data.koBracket = { r32: [], locked: false };
  }
  if (!data.koBracket.r32) data.koBracket.r32 = [];
  if (!data.chat) data.chat = [];
  if (!data.matchComments) data.matchComments = {};
  if (!data.settings.picksDeadline) {
    data.settings.picksDeadline = config.defaultDeadline;
  }
  if (!data.settings.status) data.settings.status = 'open';

  // Tiebreaker is always derived from saved picks (group + knockout), never the
  // stale manual guess. Recompute for every participant on every read so the
  // display, standings and persisted value share one source of truth.
  if (Array.isArray(data.participants)) {
    for (const p of data.participants) {
      p.totalGoals = computeTotalGoals(p.picks, p.koPicks);
    }
  }
  return data;
}
