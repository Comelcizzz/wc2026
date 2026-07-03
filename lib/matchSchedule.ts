import { KO_KICKOFF, KO_MATCH_IDS, KO_META, PICK_LOCK_HOURS_BEFORE } from './tournament';
import type { Round } from './types';

const LOCK_MS = PICK_LOCK_HOURS_BEFORE * 60 * 60 * 1000;

export function getMatchKickoff(matchId: string): number | null {
  const iso = KO_KICKOFF[matchId];
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

/** When picking/editing closes for this match (kickoff minus 1 hour). */
export function getPickCloseTime(matchId: string): number | null {
  const kick = getMatchKickoff(matchId);
  return kick == null ? null : kick - LOCK_MS;
}

export function isMatchPickLocked(matchId: string, now = Date.now()): boolean {
  const close = getPickCloseTime(matchId);
  return close != null && now >= close;
}

export function msUntilPickClose(matchId: string, now = Date.now()): number | null {
  const close = getPickCloseTime(matchId);
  if (close == null) return null;
  return Math.max(0, close - now);
}

export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export interface UpcomingMatch {
  id: string;
  round: Round;
  label: string;
  kickoffLabel: string;
  closeMs: number;
}

/** Next N matches whose pick window is still open, sorted by close time. */
export function upcomingOpenMatches(now = Date.now(), limit = 3): UpcomingMatch[] {
  const out: UpcomingMatch[] = [];
  for (const m of KO_MATCH_IDS) {
    const closeMs = msUntilPickClose(m.id, now);
    if (closeMs == null || closeMs <= 0) continue;
    const meta = KO_META[m.id];
    out.push({
      id: m.id,
      round: m.round,
      label: m.label,
      kickoffLabel: meta?.date ?? '',
      closeMs,
    });
  }
  out.sort((a, b) => a.closeMs - b.closeMs);
  return out.slice(0, limit);
}

/** Matches closing within the next hour (pick window ending soon). */
export function matchesClosingSoon(now = Date.now(), withinMs = 60 * 60 * 1000): UpcomingMatch[] {
  return upcomingOpenMatches(now, 32).filter((m) => m.closeMs <= withinMs);
}
