import { POINTS } from './tournament';
import { resolveRealKoTeams, resolveKoTeams, predictedWinnerOf, type SideTeams } from './bracket';
import { computeTotalGoals } from './tiebreaker';
import type { PoolData, ScoredParticipant, Round, ScorePick, MatchResult } from './types';

// ─────────────────────────────────────────────────────────────
//  Scoring — unchanged rules from the original pool.
//  Group points come from the ORIGINAL group picks vs real group
//  results (so prior standings are preserved). KO points come from
//  the NEW redraft koPicks vs real KO results.
// ─────────────────────────────────────────────────────────────

// Outcome of grading one prediction against a real result. Shared by the
// standings calculation and the player-facing results view on the picks page
// so the scoring rules live in exactly one place.
export type GradeStatus = 'pending' | 'nopick' | 'exact' | 'correct' | 'miss';
export type KoMissReason = 'no_bracket' | 'wrong_matchup' | 'wrong_winner';
export interface MatchGrade {
  status: GradeStatus;
  points: number;
  missReason?: KoMissReason;
}

// ── Group-stage grading (outcome +1, exact +3) ──
export function gradeGroupMatch(
  pick: { h: number; a: number } | undefined,
  res: MatchResult | undefined,
): MatchGrade {
  if (!res || res.homeGoals == null || res.awayGoals == null) return { status: 'pending', points: 0 };
  if (!pick || pick.h == null || pick.a == null) return { status: 'nopick', points: 0 };
  const rOut = res.homeGoals > res.awayGoals ? 'h' : res.awayGoals > res.homeGoals ? 'a' : 'd';
  const pOut = pick.h > pick.a ? 'h' : pick.a > pick.h ? 'a' : 'd';
  if (pOut !== rOut) return { status: 'miss', points: 0 };
  if (pick.h === res.homeGoals && pick.a === res.awayGoals) return { status: 'exact', points: 3 };
  return { status: 'correct', points: 1 };
}

// ── Knockout grading — OFFICIAL-MATCHUP-GATED ──
// A player scores a KO slot only if the matchup they predicted for it
// (resolved from their own picks) equals the official matchup the admin
// entered. If their bracket sent different teams into this slot, they get 0
// here — but later-round picks can still hit if their bracket re-converges
// with reality. R32 always matches (shared fixtures); gating bites from R16 on.
export function gradeKoMatch(
  round: Round,
  pick: ScorePick | undefined,
  myTeams: SideTeams | null,
  res: MatchResult | undefined,
): MatchGrade {
  if (!res || !res.winner || res.homeGoals == null || res.awayGoals == null) {
    return { status: 'pending', points: 0 };
  }
  const offHome = res.home;
  const offAway = res.away;
  if (!offHome || !offAway) return { status: 'pending', points: 0 };

  if (!pick || pick.h == null || pick.a == null) return { status: 'nopick', points: 0 };
  if (!myTeams || !myTeams.home || !myTeams.away) {
    return { status: 'miss', points: 0, missReason: 'no_bracket' };
  }

  // GATE: predicted matchup must equal the official one (order-agnostic).
  const sameMatchup =
    (myTeams.home === offHome && myTeams.away === offAway) ||
    (myTeams.home === offAway && myTeams.away === offHome);
  if (!sameMatchup) return { status: 'miss', points: 0, missReason: 'wrong_matchup' };

  // Winner must match (ET/pens winner on a predicted draw).
  const predicted =
    pick.h === pick.a ? pick.et || null : pick.h > pick.a ? myTeams.home : myTeams.away;
  if (!predicted || predicted !== res.winner) {
    return { status: 'miss', points: 0, missReason: 'wrong_winner' };
  }

  const def = POINTS[round as Exclude<Round, 'group'>];
  if (!def) return { status: 'miss', points: 0 };

  // Exact score, oriented by team (matchup already matches the official one).
  const myForOffHome = myTeams.home === offHome ? pick.h : pick.a;
  const myForOffAway = myTeams.home === offHome ? pick.a : pick.h;
  if (myForOffHome === res.homeGoals && myForOffAway === res.awayGoals) {
    return { status: 'exact', points: def.exact };
  }
  return { status: 'correct', points: def.outcome };
}

export function koMissLabel(reason: KoMissReason | undefined): string {
  if (reason === 'wrong_matchup') return 'Wrong matchup';
  if (reason === 'wrong_winner') return 'Wrong winner';
  if (reason === 'no_bracket') return 'Bracket gap';
  return 'Miss';
}
export function calcScores(pool: PoolData): ScoredParticipant[] {
  const settings = pool.settings || ({} as PoolData['settings']);
  const actualChampion = settings.champion || null;
  const actualTotalGoals =
    settings.totalGoals != null ? Number(settings.totalGoals) : null;

  const scored: ScoredParticipant[] = pool.participants.map((p) => {
    let groupPoints = 0;
    let koPoints = 0;
    let exactCount = 0;

    // ── Group stage (preserved) ──
    for (const m of pool.matches) {
      if (m.round !== 'group') continue;
      const grade = gradeGroupMatch(p.picks?.[m.id], m.result);
      groupPoints += grade.points;
      if (grade.status === 'exact') exactCount++;
    }

    // ── Knockout (redraft) — gated by the shared grader ──
    const koPicks = p.koPicks || {};
    const results = Object.fromEntries(pool.matches.map((m) => [m.id, m.result]));
    for (const m of pool.matches) {
      if (m.round === 'group') continue;
      const myTeams = resolveKoTeams(m.id, koPicks, pool.koBracket);
      const grade = gradeKoMatch(m.round, koPicks[m.id], myTeams, m.result);
      koPoints += grade.points;
      if (grade.status === 'exact') exactCount++;
    }

    // ── Champion bonus (+10). Uses the player's explicit champion pick,
    // falling back to the bracket FINAL winner if they never chose one. ──
    let championCorrect = false;
    const champ = p.champion || predictedWinnerOf('FINAL', koPicks, pool.koBracket) || '';
    if (actualChampion && champ === actualChampion) {
      koPoints += 10;
      championCorrect = true;
    }

    // Tiebreaker total is always derived from saved picks (single source of
    // truth), never the stale stored guess.
    const derivedTotalGoals = computeTotalGoals(p.picks, p.koPicks);
    const goalsDelta =
      actualTotalGoals != null ? Math.abs(derivedTotalGoals - actualTotalGoals) : null;

    return {
      ...p,
      champion: champ,
      totalGoals: derivedTotalGoals,
      groupPoints,
      koPoints,
      totalPoints: groupPoints + koPoints,
      exactCount,
      championCorrect,
      goalsDelta,
    };
  });

  return scored.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    const dA = a.goalsDelta ?? Infinity;
    const dB = b.goalsDelta ?? Infinity;
    if (dA !== dB) return dA - dB;
    if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount;
    const tA = a.koSubmittedAt || a.submittedAt || '';
    const tB = b.koSubmittedAt || b.submittedAt || '';
    return new Date(tA).getTime() - new Date(tB).getTime();
  });
}
