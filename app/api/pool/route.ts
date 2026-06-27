import { NextResponse } from 'next/server';
import { readPool } from '@/lib/poolStore';
import { calcScores } from '@/lib/scoring';
import { isLocked } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pool = await readPool();
    const standings = calcScores(pool);
    // Strip secrets from the public payload.
    const participants = pool.participants.map(({ email, passHash, passSalt, ...p }) => p);
    return NextResponse.json({
      ok: true,
      settings: pool.settings,
      koBracket: pool.koBracket,
      matches: pool.matches,
      participants,
      standings: standings.map(({ email, passHash, passSalt, ...s }) => s),
      locked: isLocked(pool),
      now: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
