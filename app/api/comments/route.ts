import { NextRequest, NextResponse } from 'next/server';
import { readPool, writePool } from '@/lib/poolStore';
import { getPlayerId } from '@/lib/auth';
import { KO_MATCH_IDS } from '@/lib/tournament';
import type { MatchComment } from '@/lib/types';

export const dynamic = 'force-dynamic';

const KO_IDS = new Set(KO_MATCH_IDS.map((m) => m.id));
const MAX_PER_MATCH = 100;
const MAX_LEN = 400;

export async function GET(req: NextRequest) {
  try {
    const matchId = req.nextUrl.searchParams.get('matchId') || '';
    if (!KO_IDS.has(matchId)) {
      return NextResponse.json({ ok: false, error: 'Unknown match.' }, { status: 400 });
    }
    const pool = await readPool();
    const comments = (pool.matchComments?.[matchId] || []).slice(-MAX_PER_MATCH);
    return NextResponse.json({ ok: true, comments });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const playerId = getPlayerId();
    if (!playerId) {
      return NextResponse.json({ ok: false, error: 'Please log in first.' }, { status: 401 });
    }

    const body = await req.json();
    const matchId = String(body.matchId || '');
    const text = String(body.text || '').trim();
    if (!KO_IDS.has(matchId)) {
      return NextResponse.json({ ok: false, error: 'Unknown match.' }, { status: 400 });
    }
    if (!text) return NextResponse.json({ ok: false, error: 'Comment is empty.' }, { status: 400 });
    if (text.length > MAX_LEN) {
      return NextResponse.json({ ok: false, error: `Max ${MAX_LEN} characters.` }, { status: 400 });
    }

    const pool = await readPool();
    const p = pool.participants.find((x) => x.id === playerId);
    if (!p) return NextResponse.json({ ok: false, error: 'Account not found.' }, { status: 404 });

    const comment: MatchComment = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      matchId,
      authorId: p.id,
      authorName: p.name,
      text,
      createdAt: new Date().toISOString(),
    };

    if (!pool.matchComments) pool.matchComments = {};
    if (!pool.matchComments[matchId]) pool.matchComments[matchId] = [];
    pool.matchComments[matchId].push(comment);
    if (pool.matchComments[matchId].length > MAX_PER_MATCH) {
      pool.matchComments[matchId] = pool.matchComments[matchId].slice(-MAX_PER_MATCH);
    }

    await writePool(pool);
    return NextResponse.json({ ok: true, comment });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
