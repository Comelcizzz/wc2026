import { NextRequest, NextResponse } from 'next/server';
import { readPool, writePool } from '@/lib/poolStore';
import { getPlayerId } from '@/lib/auth';
import { resultsFromMatches } from '@/lib/bracket';
import { computeTotalGoals } from '@/lib/tiebreaker';
import { isMatchPickLocked } from '@/lib/matchSchedule';
import { canPickMatch, roundOfMatchId } from '@/lib/roundPick';
import { KO_MATCH_IDS } from '@/lib/tournament';
import type { KoPicks } from '@/lib/types';

export const dynamic = 'force-dynamic';

const KO_IDS = new Set(KO_MATCH_IDS.map((m) => m.id));

export async function POST(req: NextRequest) {
  try {
    const playerId = getPlayerId();
    if (!playerId) {
      return NextResponse.json({ ok: false, error: 'Please log in first.' }, { status: 401 });
    }

    const body = await req.json();
    const pool = await readPool();
    const now = Date.now();

    if (pool.settings.status === 'locked') {
      return NextResponse.json({ ok: false, error: 'Picks are locked by the admin.' }, { status: 403 });
    }

    const idx = pool.participants.findIndex((p) => p.id === playerId);
    if (idx < 0) {
      return NextResponse.json({ ok: false, error: 'Your account was not found.' }, { status: 404 });
    }

    const anyOpen = pool.koBracket.r32.some((f) => f.home && f.away);
    if (!anyOpen) {
      return NextResponse.json({ ok: false, error: 'No knockout fixtures are open yet.' }, { status: 403 });
    }

    const results = resultsFromMatches(pool.matches);
    const existing = pool.participants[idx].koPicks || {};
    const raw = (body.koPicks || {}) as Record<string, any>;

    const koPicks: KoPicks = { ...existing };

    for (const [id, v] of Object.entries(raw)) {
      if (!KO_IDS.has(id)) continue;
      if (!roundOfMatchId(id)) continue;

      if (isMatchPickLocked(id, now)) continue;

      if (!canPickMatch(id, pool.koBracket, results, now)) continue;

      if (!v) {
        delete koPicks[id];
        continue;
      }

      const h = Number(v.h);
      const a = Number(v.a);
      if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0) continue;
      const pick: KoPicks[string] = { h, a };
      if (h === a && typeof v.et === 'string' && v.et) pick.et = v.et;
      koPicks[id] = pick;
    }

    const totalGoals = computeTotalGoals(pool.participants[idx].picks, koPicks);
    const champion = pool.participants[idx].champion || '';

    pool.participants[idx] = {
      ...pool.participants[idx],
      koPicks,
      champion,
      totalGoals,
      koSubmittedAt: new Date().toISOString(),
    };

    await writePool(pool);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
