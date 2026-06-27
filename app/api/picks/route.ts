import { NextRequest, NextResponse } from 'next/server';
import { readPool, writePool } from '@/lib/poolStore';
import { isLocked, getPlayerId } from '@/lib/auth';
import { predictedWinnerOf } from '@/lib/bracket';
import { computeTotalGoals } from '@/lib/tiebreaker';
import { KO_MATCH_IDS, TEAMS } from '@/lib/tournament';
import type { KoPicks } from '@/lib/types';

export const dynamic = 'force-dynamic';

const KO_IDS = new Set(KO_MATCH_IDS.map((m) => m.id));
const TEAM_SET = new Set(TEAMS);

export async function POST(req: NextRequest) {
  try {
    // Must be a logged-in player (signed cookie). Identity comes from the
    // session, never from the request body — you can only submit as yourself.
    const playerId = getPlayerId();
    if (!playerId) {
      return NextResponse.json({ ok: false, error: 'Please log in first.' }, { status: 401 });
    }

    const body = await req.json();
    const pool = await readPool();

    const idx = pool.participants.findIndex((p) => p.id === playerId);
    if (idx < 0) {
      return NextResponse.json({ ok: false, error: 'Your account was not found.' }, { status: 404 });
    }

    // Incremental open: accept picks as soon as any real R32 fixture exists,
    // even before the admin fully locks the bracket.
    const anyOpen = pool.koBracket.r32.some((f) => f.home && f.away);
    if (!anyOpen) {
      return NextResponse.json({ ok: false, error: 'No knockout fixtures are open yet.' }, { status: 403 });
    }
    if (isLocked(pool)) {
      return NextResponse.json({ ok: false, error: 'The deadline has passed. Picks are locked.' }, { status: 403 });
    }

    // Sanitize incoming KO picks.
    const raw = (body.koPicks || {}) as Record<string, any>;
    const koPicks: KoPicks = {};
    for (const [id, v] of Object.entries(raw)) {
      if (!KO_IDS.has(id) || !v) continue;
      const h = Number(v.h);
      const a = Number(v.a);
      if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0) continue;
      const pick: any = { h, a };
      if (h === a && typeof v.et === 'string' && v.et) pick.et = v.et;
      koPicks[id] = pick;
    }

    // Tiebreaker is derived from the player's saved group picks + the knockout
    // picks being saved now — never trusted from the request body.
    const totalGoals = computeTotalGoals(pool.participants[idx].picks, koPicks);

    // Champion is an explicit, independent pick (any team) for the +10 bonus.
    // If the player hasn't chosen one, fall back to the bracket final winner.
    const rawChampion = typeof body.champion === 'string' ? body.champion.trim() : '';
    const champion = TEAM_SET.has(rawChampion)
      ? rawChampion
      : predictedWinnerOf('FINAL', koPicks, pool.koBracket) || '';

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
