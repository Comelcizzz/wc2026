import { POINTS } from './tournament';
import { predictedWinnerOf } from './bracket';
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
export type KoMissReason = 'wrong_winner';
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

// ── Knockout grading — official admin matchups only ──
// Players enter scores for the admin-confirmed home/away teams in each slot.
// pick.h / pick.a are always relative to that official pairing (as on My Picks).
export function gradeKoMatch(
  round: Round,
  pick: ScorePick | undefined,
  res: MatchResult | undefined,
): MatchGrade {
  if (!res || !res.winner || res.homeGoals == null || res.awayGoals == null) {
    return { status: 'pending', points: 0 };
  }
  const offHome = res.home;
  const offAway = res.away;
  if (!offHome || !offAway) return { status: 'pending', points: 0 };

  if (!pick || pick.h == null || pick.a == null) return { status: 'nopick', points: 0 };

  const predicted =
    pick.h === pick.a ? pick.et || null : pick.h > pick.a ? offHome : offAway;
  if (!predicted || predicted !== res.winner) {
    return { status: 'miss', points: 0, missReason: 'wrong_winner' };
  }

  const def = POINTS[round as Exclude<Round, 'group'>];
  if (!def) return { status: 'miss', points: 0 };

  if (pick.h === res.homeGoals && pick.a === res.awayGoals) {
    return { status: 'exact', points: def.exact };
  }
  return { status: 'correct', points: def.outcome };
}

export function koMissLabel(reason: KoMissReason | undefined): string {
  if (reason === 'wrong_winner') return 'Wrong winner';
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
      const grade = gradeKoMatch(m.round, koPicks[m.id], m.result);
      koPoints += grade.points;
      if (grade.status === 'exact') exactCount++;
    }

    // ── Champion bonus (+10). Uses the player's explicit champion pick,
    // falling back to the FINAL winner from their official-matchup pick. ──
    let championCorrect = false;
    const champ = p.champion || predictedWinnerOf('FINAL', koPicks, results, pool.koBracket) || '';
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
