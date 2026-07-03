import { NextRequest, NextResponse } from 'next/server';
import { readPool } from '@/lib/poolStore';
import {
  verifyPassword,
  makePlayerToken,
  getPlayerId,
  PLAYER_COOKIE_NAME,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET → who is logged in on this device (from the signed cookie)?
export async function GET() {
  try {
    const id = getPlayerId();
    if (!id) return NextResponse.json({ ok: true, id: null, name: null });
    const pool = await readPool();
    const p = pool.participants.find((x) => x.id === id);
    return NextResponse.json({ ok: true, id: p?.id || null, name: p?.name || null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// POST {name, password} → verify and set the session cookie.
// POST {logout:true} → clear it.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  if (body.logout) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(PLAYER_COOKIE_NAME, '', { maxAge: 0, path: '/' });
    return res;
  }

  const name = String(body.name || '').trim();
  const password = String(body.password || '');
  if (!name || !password) {
    return NextResponse.json({ ok: false, error: 'Name and password are required.' }, { status: 400 });
  }

  try {
    const pool = await readPool();
    const p = pool.participants.find(
      (x) => x.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (!p) {
      return NextResponse.json({ ok: false, error: 'No player with that name.' }, { status: 401 });
    }
    if (!p.passHash || !p.passSalt) {
      return NextResponse.json(
        { ok: false, error: 'No password set yet for this name. Ask the admin to send you one.' },
        { status: 403 },
      );
    }
    if (!verifyPassword(password, p.passSalt, p.passHash)) {
      return NextResponse.json({ ok: false, error: 'Wrong password.' }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true, name: p.name });
    res.cookies.set(PLAYER_COOKIE_NAME, makePlayerToken(p.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      // Effectively permanent: stays signed in on this device until logout.
      maxAge: 60 * 60 * 24 * 365 * 10,
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
