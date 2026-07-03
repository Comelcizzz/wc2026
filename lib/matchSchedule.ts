import { KO_KICKOFF, KO_MATCH_IDS, KO_META, KO_ROUNDS, PICK_LOCK_HOURS_BEFORE } from './tournament';
import { publicConfig } from './publicConfig';
import type { Round } from './types';

/** All kickoffs and pick-close times use America/Toronto (see KO_KICKOFF). */
export const PICK_TIMEZONE = publicConfig.timezone;

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

function roundIdx(round: Round): number {
  const i = KO_ROUNDS.indexOf(round);
  return i < 0 ? 0 : i;
}

/** Next N open matches up to maxRound (inclusive), sorted by close time. */
export function upcomingOpenMatches(
  now = Date.now(),
  limit = 3,
  maxRound?: Round,
): UpcomingMatch[] {
  const maxIdx = maxRound ? roundIdx(maxRound) : KO_ROUNDS.length - 1;
  const out: UpcomingMatch[] = [];
  for (const m of KO_MATCH_IDS) {
    if (roundIdx(m.round) > maxIdx) continue;
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

/** Matches closing within the next hour, within maxRound. */
export function matchesClosingSoon(
  now = Date.now(),
  withinMs = 60 * 60 * 1000,
  maxRound?: Round,
): UpcomingMatch[] {
  const closingIds = new Set(
    upcomingOpenMatches(now, 32, maxRound)
      .filter((m) => m.closeMs <= withinMs)
      .map((m) => m.id),
  );
  return upcomingOpenMatches(now, 32, maxRound).filter((m) => closingIds.has(m.id));
}
