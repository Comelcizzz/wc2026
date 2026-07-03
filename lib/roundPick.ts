import { KO_MATCH_IDS, KO_ROUNDS } from './tournament';
import { isMatchPickLocked } from './matchSchedule';
import { resolveRealKoTeams } from './bracket';
import type { KoBracket, Match, Round } from './types';

function roundIndex(round: Round): number {
  return KO_ROUNDS.indexOf(round);
}

export function roundOfMatchId(matchId: string): Round | null {
  return KO_MATCH_IDS.find((m) => m.id === matchId)?.round ?? null;
}

export function adminTeamsForMatch(
  matchId: string,
  bracket: KoBracket,
  results: Record<string, Match['result']>,
) {
  return resolveRealKoTeams(matchId, results, bracket);
}

/** Admin has approved at least one full matchup in this round. */
export function roundHasOfficialMatch(
  round: Round,
  bracket: KoBracket,
  results: Record<string, Match['result']>,
): boolean {
  return KO_MATCH_IDS.filter((m) => m.round === round).some((m) => {
    const t = adminTeamsForMatch(m.id, bracket, results);
    return !!(t?.home && t?.away);
  });
}

function roundComplete(round: Round, bracket: KoBracket, results: Record<string, Match['result']>): boolean {
  const matches = KO_MATCH_IDS.filter((m) => m.round === round);
  return matches.every((m) => {
    const t = adminTeamsForMatch(m.id, bracket, results);
    return !!(t?.home && t?.away);
  });
}

/**
 * Furthest round players may access. A next round opens only when every prior
 * round has official matchups and the target round has at least one full match.
 */
export function getMaxOpenPickRound(
  bracket: KoBracket,
  results: Record<string, Match['result']>,
): Round {
  let max: Round = 'r32';
  for (let i = 1; i < KO_ROUNDS.length; i++) {
    const prev = KO_ROUNDS[i - 1];
    const round = KO_ROUNDS[i];
    if (!roundComplete(prev, bracket, results)) break;
    if (!roundHasOfficialMatch(round, bracket, results)) break;
    max = round;
  }
  return max;
}

/** Player can view and pick matches in this round (and any earlier round with open matches). */
export function isRoundAccessible(
  round: Round,
  bracket: KoBracket,
  results: Record<string, Match['result']>,
): boolean {
  const max = getMaxOpenPickRound(bracket, results);
  return roundIndex(round) <= roundIndex(max);
}

/** Admin has assigned both teams for this slot. */
export function hasAdminTeams(
  matchId: string,
  bracket: KoBracket,
  results: Record<string, Match['result']>,
): boolean {
  const teams = adminTeamsForMatch(matchId, bracket, results);
  return !!(teams?.home && teams?.away);
}

/** Player may edit this match: in range, both teams set, not locked by kickoff. */
export function canPickMatch(
  matchId: string,
  bracket: KoBracket,
  results: Record<string, Match['result']>,
  now = Date.now(),
): boolean {
  const round = roundOfMatchId(matchId);
  if (!round || round === 'group') return false;
  if (!isRoundAccessible(round, bracket, results)) return false;
  if (!hasAdminTeams(matchId, bracket, results)) return false;
  if (isMatchPickLocked(matchId, now)) return false;
  return true;
}

export function nextKoRound(round: Round): Round | null {
  const i = roundIndex(round);
  return i >= 0 && i < KO_ROUNDS.length - 1 ? KO_ROUNDS[i + 1] : null;
}

/** How many matchups in a round have both teams assigned. */
export function countRoundFixturesSet(round: Round, bracket: KoBracket): { set: number; total: number } {
  const total = KO_MATCH_IDS.filter((m) => m.round === round).length;
  const stored =
    round === 'r32'
      ? bracket.r32
      : (bracket[round as keyof KoBracket] as { id: string; home: string; away: string }[] | undefined) || [];
  const set = stored.filter((f) => f.home && f.away).length;
  return { set, total };
}

/** Matches with a full official matchup in this round (for UI hints). */
export function countPartialTeamsInRound(
  round: Round,
  bracket: KoBracket,
  results: Record<string, Match['result']>,
): number {
  return KO_MATCH_IDS.filter((m) => m.round === round).filter((m) => {
    const t = adminTeamsForMatch(m.id, bracket, results);
    return !!(t?.home && t?.away);
  }).length;
}
