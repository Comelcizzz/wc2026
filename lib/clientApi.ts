'use client';
import type { Settings, KoBracket, Match, Participant, ScoredParticipant } from '@/lib/types';

export interface PoolResponse {
  ok: boolean;
  error?: string;
  settings: Settings;
  koBracket: KoBracket;
  matches: Match[];
  participants: Participant[];
  standings: ScoredParticipant[];
  locked: boolean;
  now: string;
}

export async function getPool(): Promise<PoolResponse> {
  const r = await fetch('/api/pool', { cache: 'no-store' });
  return r.json();
}

export async function postJSON(url: string, body: any) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}
