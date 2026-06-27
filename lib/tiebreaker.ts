import { ALL_MATCHES } from './tournament';
import type { GroupPicks, KoPicks } from './types';

// ─────────────────────────────────────────────────────────────
//  Tiebreaker — total predicted goals (single source of truth)
//
//  The tiebreaker equals every goal a participant predicted across
//  the GROUP stage (stored in participant.picks) plus every goal in
//  their KNOCKOUT picks (participant.koPicks). Stored totalGoals from
//  the original pool were manual guesses and are ignored.
//
//  Note: legacy data stored some knockout predictions inside `picks`
//  alongside the group picks. We therefore only count the canonical
//  group-stage match ids from `picks`, and take all knockout goals
//  exclusively from `koPicks`, so nothing is double-counted.
// ─────────────────────────────────────────────────────────────

const GROUP_MATCH_IDS = new Set(
  ALL_MATCHES.filter((m) => m.round === 'group').map((m) => m.id),
);

function goalsOf(pick: { h?: number; a?: number } | undefined | null): number {
  if (!pick) return 0;
  return Number.isInteger(pick.h) && Number.isInteger(pick.a)
    ? (pick.h as number) + (pick.a as number)
    : 0;
}

// Derives the tiebreaker total for one participant from their saved
// group picks + knockout picks. Used by the server recompute and the
// client display so both always agree.
export function computeTotalGoals(
  picks?: GroupPicks | null,
  koPicks?: KoPicks | null,
): number {
  let sum = 0;
  if (picks) {
    for (const [id, p] of Object.entries(picks)) {
      if (GROUP_MATCH_IDS.has(id)) sum += goalsOf(p);
    }
  }
  if (koPicks) {
    for (const p of Object.values(koPicks)) sum += goalsOf(p);
  }
  return sum;
}
