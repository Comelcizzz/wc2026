import { GROUPS } from './tournament';
import type { Match } from './types';

export interface TeamRow {
  team: string;
  played: number;
  win: number;
  draw: number;
  loss: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
}

// Computes the live table for one group from real match results.
// Ranking follows FIFA order: points → goal difference → goals for →
// head-to-head (points/GD/GF among the tied teams) → name (stable fallback).
export function groupTable(group: string, matches: Match[]): TeamRow[] {
  const teams = GROUPS[group]?.teams ?? [];
  const stats: Record<string, TeamRow> = {};
  for (const t of teams) {
    stats[t] = { team: t, played: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
  }

  const groupMatches = matches.filter((m) => m.round === 'group' && m.group === group);
  for (const m of groupMatches) {
    const res = m.result;
    if (!res || res.homeGoals == null || res.awayGoals == null) continue;
    if (!m.home || !m.away || !stats[m.home] || !stats[m.away]) continue;
    const h = res.homeGoals;
    const a = res.awayGoals;
    const H = stats[m.home];
    const A = stats[m.away];
    H.played++; A.played++;
    H.gf += h; H.ga += a; H.gd += h - a;
    A.gf += a; A.ga += h; A.gd += a - h;
    if (h > a) { H.pts += 3; H.win++; A.loss++; }
    else if (h < a) { A.pts += 3; A.win++; H.loss++; }
    else { H.pts++; A.pts++; H.draw++; A.draw++; }
  }

  // Head-to-head points/GD/GF among an exact subset of tied teams.
  function h2h(tier: string[]): Record<string, { pts: number; gd: number; gf: number }> {
    const sub: Record<string, { pts: number; gd: number; gf: number }> = {};
    for (const t of tier) sub[t] = { pts: 0, gd: 0, gf: 0 };
    for (const m of groupMatches) {
      const res = m.result;
      if (!res || res.homeGoals == null || res.awayGoals == null) continue;
      if (!m.home || !m.away || !sub[m.home] || !sub[m.away]) continue;
      const h = res.homeGoals;
      const a = res.awayGoals;
      sub[m.home].gf += h; sub[m.home].gd += h - a;
      sub[m.away].gf += a; sub[m.away].gd += a - h;
      if (h > a) sub[m.home].pts += 3;
      else if (h < a) sub[m.away].pts += 3;
      else { sub[m.home].pts++; sub[m.away].pts++; }
    }
    return sub;
  }

  const sorted = [...teams].sort(
    (a, b) =>
      stats[b].pts - stats[a].pts ||
      stats[b].gd - stats[a].gd ||
      stats[b].gf - stats[a].gf ||
      a.localeCompare(b),
  );

  // Resolve ties of equal pts/GD/GF with head-to-head, preserving order otherwise.
  const result: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (
      j < sorted.length &&
      stats[sorted[j]].pts === stats[sorted[i]].pts &&
      stats[sorted[j]].gd === stats[sorted[i]].gd &&
      stats[sorted[j]].gf === stats[sorted[i]].gf
    ) {
      j++;
    }
    const tier = sorted.slice(i, j);
    if (tier.length > 1) {
      const sub = h2h(tier);
      tier.sort(
        (a, b) =>
          sub[b].pts - sub[a].pts || sub[b].gd - sub[a].gd || sub[b].gf - sub[a].gf || a.localeCompare(b),
      );
    }
    result.push(...tier);
    i = j;
  }

  return result.map((t) => stats[t]);
}
