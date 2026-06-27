import { KO_FEED } from './tournament';
import type { KoBracket, KoPicks, MatchResult } from './types';

export interface SideTeams {
  home: string | null;
  away: string | null;
}

// Returns {home, away} team names for any KO match.
// R32 base = the real fixtures the admin entered (koBracket.r32).
// Downstream rounds flow recursively from the participant's own KO picks,
// exactly like the original pool: the winner of a match is whichever side
// the participant gave more goals (or their ET pick on a draw).
export function resolveKoTeams(matchId: string, picks: KoPicks, bracket: KoBracket): SideTeams | null {
  if (matchId.startsWith('R32-')) {
    const fx = bracket.r32.find((f) => f.id === matchId);
    return fx ? { home: fx.home || null, away: fx.away || null } : { home: null, away: null };
  }
  const feed = KO_FEED[matchId];
  if (!feed) return null;

  const resolveSide = ({ src, r }: { src: string; r: 'w' | 'l' }): string | null => {
    const srcPick = picks[src];
    if (!srcPick || srcPick.h == null || srcPick.a == null) return null;
    const srcTeams = resolveKoTeams(src, picks, bracket) || { home: 'TBD', away: 'TBD' };
    if (srcPick.h === srcPick.a) {
      // Draw → extra time / penalties; use the participant's ET winner pick.
      if (!srcPick.et) return null;
      const etWinner = srcPick.et;
      const etLoser = etWinner === srcTeams.home ? srcTeams.away : srcTeams.home;
      return r === 'w' ? etWinner : etLoser;
    }
    const homeWon = srcPick.h > srcPick.a;
    const winner = homeWon ? srcTeams.home : srcTeams.away;
    const loser = homeWon ? srcTeams.away : srcTeams.home;
    return r === 'w' ? winner : loser;
  };

  return { home: resolveSide(feed[0]), away: resolveSide(feed[1]) };
}

// ── REAL bracket (admin side) ────────────────────────────────
// Same cascade as resolveKoTeams, but driven by the REAL results the admin
// enters instead of a participant's picks. R32 seeds from the fixtures; every
// later round's teams are the real winners (or losers, for 3rd place) of the
// two feeder matches. This is how the bracket "reconciles to the real World
// Cup": the admin only enters scores, and the next round's pairings fill in.
export function resolveRealKoTeams(
  matchId: string,
  results: Record<string, MatchResult | undefined>,
  bracket: KoBracket,
): SideTeams | null {
  if (matchId.startsWith('R32-')) {
    const fx = bracket.r32.find((f) => f.id === matchId);
    return fx ? { home: fx.home || null, away: fx.away || null } : { home: null, away: null };
  }
  const feed = KO_FEED[matchId];
  if (!feed) return null;

  const resolveSide = ({ src, r }: { src: string; r: 'w' | 'l' }): string | null => {
    const res = results[src];
    if (!res || !res.winner) return null;
    const srcTeams = resolveRealKoTeams(src, results, bracket);
    const srcHome = res.home ?? srcTeams?.home ?? null;
    const srcAway = res.away ?? srcTeams?.away ?? null;
    const winner = res.winner;
    const loser = winner === srcHome ? srcAway : srcHome;
    return r === 'w' ? winner : loser;
  };

  return { home: resolveSide(feed[0]), away: resolveSide(feed[1]) };
}

// The team the participant has advancing OUT of a given KO match (their predicted winner).
export function predictedWinnerOf(matchId: string, picks: KoPicks, bracket: KoBracket): string | null {
  const pick = picks[matchId];
  if (!pick || pick.h == null || pick.a == null) return null;
  const teams = resolveKoTeams(matchId, picks, bracket);
  if (!teams || !teams.home || !teams.away) return null;
  if (pick.h === pick.a) return pick.et || null;
  return pick.h > pick.a ? teams.home : teams.away;
}
