import { KO_MATCH_IDS, KO_ROUNDS } from './tournament';
import { isMatchPickLocked } from './matchSchedule';
import { resolveRealKoTeams } from './bracket';
import type { KoBracket, Match, Round, Settings } from './types';

const KO_ROUND_SET = new Set(KO_ROUNDS);

export function getActiveKoPickRound(settings: Settings): Round {
  const r = settings.koPickRound;
  if (r && KO_ROUND_SET.has(r)) return r;
  return 'r32';
}

export function roundOfMatchId(matchId: string): Round | null {
  return KO_MATCH_IDS.find((m) => m.id === matchId)?.round ?? null;
}

/** Admin has assigned both teams for this slot (fixtures or results cascade). */
export function hasAdminTeams(
  matchId: string,
  bracket: KoBracket,
  results: Record<string, Match['result']>,
): boolean {
  const teams = resolveRealKoTeams(matchId, results, bracket);
  return !!(teams?.home && teams?.away);
}

/** Player may edit this match right now. */
export function canPickMatch(
  matchId: string,
  settings: Settings,
  bracket: KoBracket,
  results: Record<string, Match['result']>,
  now = Date.now(),
): boolean {
  const round = roundOfMatchId(matchId);
  if (!round || round === 'group') return false;
  if (round !== getActiveKoPickRound(settings)) return false;
  if (!hasAdminTeams(matchId, bracket, results)) return false;
  if (isMatchPickLocked(matchId, now)) return false;
  return true;
}

export function nextKoRound(round: Round): Round | null {
  const i = KO_ROUNDS.indexOf(round);
  return i >= 0 && i < KO_ROUNDS.length - 1 ? KO_ROUNDS[i + 1] : null;
}
