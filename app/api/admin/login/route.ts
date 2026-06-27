import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { ADMIN_COOKIE_NAME } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body.logout) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_COOKIE_NAME, '', { maxAge: 0, path: '/' });
    return res;
  }
  if (!config.adminSecret) {
    return NextResponse.json({ ok: false, error: 'Admin not configured.' }, { status: 500 });
  }
  if (String(body.secret || '') !== config.adminSecret) {
    return NextResponse.json({ ok: false, error: 'Wrong secret.' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, config.adminSecret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
  });
  return res;
}
