import { NextRequest, NextResponse } from 'next/server';
import { readPool, writePool } from '@/lib/poolStore';
import { getPlayerId } from '@/lib/auth';
import type { ChatMessage } from '@/lib/types';

export const dynamic = 'force-dynamic';

const MAX_MESSAGES = 200;
const MAX_LEN = 500;

export async function GET() {
  try {
    const pool = await readPool();
    const messages = (pool.chat || []).slice(-MAX_MESSAGES);
    return NextResponse.json({ ok: true, messages });
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
    const text = String(body.text || '').trim();
    if (!text) return NextResponse.json({ ok: false, error: 'Message is empty.' }, { status: 400 });
    if (text.length > MAX_LEN) {
      return NextResponse.json({ ok: false, error: `Max ${MAX_LEN} characters.` }, { status: 400 });
    }

    const pool = await readPool();
    const p = pool.participants.find((x) => x.id === playerId);
    if (!p) return NextResponse.json({ ok: false, error: 'Account not found.' }, { status: 404 });

    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      authorId: p.id,
      authorName: p.name,
      text,
      createdAt: new Date().toISOString(),
    };

    if (!pool.chat) pool.chat = [];
    pool.chat.push(msg);
    if (pool.chat.length > MAX_MESSAGES) {
      pool.chat = pool.chat.slice(-MAX_MESSAGES);
    }

    await writePool(pool);
    return NextResponse.json({ ok: true, message: msg });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
