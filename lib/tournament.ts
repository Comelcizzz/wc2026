import type { Match, Round } from './types';

// ─────────────────────────────────────────────────────────────
//  Tournament data — FIFA World Cup 2026
//  (ported verbatim from the original single-file pool)
// ─────────────────────────────────────────────────────────────

export const TEAMS: string[] = [
  'Algeria', 'Argentina', 'Australia', 'Austria', 'Belgium', 'Bosnia & Herzegovina',
  'Brazil', 'Canada', 'Cape Verde', 'Colombia', 'Croatia', 'Curaçao', 'Czechia',
  'Congo DR', 'Ecuador', 'Egypt', 'England', 'France', 'Germany', 'Ghana', 'Haiti',
  'Iran', 'Iraq', 'Ivory Coast', 'Japan', 'Jordan', 'Mexico', 'Morocco', 'Netherlands',
  'New Zealand', 'Norway', 'Panama', 'Paraguay', 'Portugal', 'Qatar', 'Saudi Arabia',
  'Scotland', 'Senegal', 'South Africa', 'South Korea', 'Spain', 'Sweden', 'Switzerland',
  'Tunisia', 'Türkiye', 'Uruguay', 'USA', 'Uzbekistan',
];

export const GROUPS: Record<string, { teams: string[] }> = {
  A: { teams: ['Mexico', 'South Africa', 'South Korea', 'Czechia'] },
  B: { teams: ['Canada', 'Bosnia & Herzegovina', 'Qatar', 'Switzerland'] },
  C: { teams: ['Brazil', 'Morocco', 'Haiti', 'Scotland'] },
  D: { teams: ['USA', 'Paraguay', 'Australia', 'Türkiye'] },
  E: { teams: ['Germany', 'Curaçao', 'Ivory Coast', 'Ecuador'] },
  F: { teams: ['Netherlands', 'Japan', 'Sweden', 'Tunisia'] },
  G: { teams: ['Belgium', 'Egypt', 'Iran', 'New Zealand'] },
  H: { teams: ['Spain', 'Cape Verde', 'Saudi Arabia', 'Uruguay'] },
  I: { teams: ['France', 'Senegal', 'Iraq', 'Norway'] },
  J: { teams: ['Argentina', 'Algeria', 'Austria', 'Jordan'] },
  K: { teams: ['Portugal', 'Congo DR', 'Uzbekistan', 'Colombia'] },
  L: { teams: ['England', 'Croatia', 'Ghana', 'Panama'] },
};

const GROUP_MATCH_DATES: Record<string, string> = {
  GA1: 'Jun 11', GA2: 'Jun 11', GA3: 'Jun 18', GA4: 'Jun 18', GA5: 'Jun 24', GA6: 'Jun 24',
  GB1: 'Jun 12', GB2: 'Jun 13', GB3: 'Jun 18', GB4: 'Jun 18', GB5: 'Jun 24', GB6: 'Jun 24',
  GC1: 'Jun 13', GC2: 'Jun 13', GC3: 'Jun 19', GC4: 'Jun 19', GC5: 'Jun 25', GC6: 'Jun 25',
  GD1: 'Jun 12', GD2: 'Jun 13', GD3: 'Jun 19', GD4: 'Jun 19', GD5: 'Jun 25', GD6: 'Jun 25',
  GE1: 'Jun 14', GE2: 'Jun 14', GE3: 'Jun 20', GE4: 'Jun 20', GE5: 'Jun 26', GE6: 'Jun 26',
  GF1: 'Jun 14', GF2: 'Jun 14', GF3: 'Jun 20', GF4: 'Jun 20', GF5: 'Jun 26', GF6: 'Jun 26',
  GG1: 'Jun 15', GG2: 'Jun 15', GG3: 'Jun 21', GG4: 'Jun 21', GG5: 'Jun 27', GG6: 'Jun 27',
  GH1: 'Jun 15', GH2: 'Jun 15', GH3: 'Jun 21', GH4: 'Jun 21', GH5: 'Jun 27', GH6: 'Jun 27',
  GI1: 'Jun 16', GI2: 'Jun 16', GI3: 'Jun 22', GI4: 'Jun 22', GI5: 'Jun 26', GI6: 'Jun 26',
  GJ1: 'Jun 16', GJ2: 'Jun 16', GJ3: 'Jun 22', GJ4: 'Jun 22', GJ5: 'Jun 27', GJ6: 'Jun 27',
  GK1: 'Jun 17', GK2: 'Jun 17', GK3: 'Jun 23', GK4: 'Jun 23', GK5: 'Jun 27', GK6: 'Jun 27',
  GL1: 'Jun 17', GL2: 'Jun 17', GL3: 'Jun 23', GL4: 'Jun 23', GL5: 'Jun 27', GL6: 'Jun 27',
};

export const POINTS: Record<Exclude<Round, 'group'>, { outcome: number; exact: number }> = {
  r32: { outcome: 2, exact: 4 },
  r16: { outcome: 4, exact: 8 },
  qf: { outcome: 6, exact: 12 },
  sf: { outcome: 8, exact: 16 },
  '3rd': { outcome: 6, exact: 12 },
  final: { outcome: 10, exact: 20 },
};

// Official FIFA World Cup round naming.
export const ROUND_LABELS: Record<Round, string> = {
  group: 'Group stage', r32: 'Round of 32', r16: 'Round of 16',
  qf: 'Quarter-finals', sf: 'Semi-finals', '3rd': 'Play-off for third place', final: 'Final',
};

// Knockout rounds in bracket order (used by the picks form & admin).
export const KO_ROUNDS: Round[] = ['r32', 'r16', 'qf', 'sf', '3rd', 'final'];

// ── Knockout structure (ids + bracket order) ──────────────────
export const KO_MATCH_IDS: { id: string; round: Round; label: string }[] = [
  { id: 'R32-1', round: 'r32', label: 'M73 · 2A v 2B' },
  { id: 'R32-2', round: 'r32', label: 'M74 · 1E v 3(A/B/C/D/F)' },
  { id: 'R32-3', round: 'r32', label: 'M75 · 1F v 2C' },
  { id: 'R32-4', round: 'r32', label: 'M76 · 1C v 2F' },
  { id: 'R32-5', round: 'r32', label: 'M77 · 1I v 3(C/D/F/G/H)' },
  { id: 'R32-6', round: 'r32', label: 'M78 · 2E v 2I' },
  { id: 'R32-7', round: 'r32', label: 'M79 · 1A v 3(C/E/F/H/I)' },
  { id: 'R32-8', round: 'r32', label: 'M80 · 1L v 3(E/H/I/J/K)' },
  { id: 'R32-9', round: 'r32', label: 'M81 · 1D v 3(B/E/F/I/J)' },
  { id: 'R32-10', round: 'r32', label: 'M82 · 1G v 3(A/E/H/I/J)' },
  { id: 'R32-11', round: 'r32', label: 'M83 · 2K v 2L' },
  { id: 'R32-12', round: 'r32', label: 'M84 · 1H v 2J' },
  { id: 'R32-13', round: 'r32', label: 'M85 · 1B v 3(E/F/G/I/J)' },
  { id: 'R32-14', round: 'r32', label: 'M86 · 1J v 2H' },
  { id: 'R32-15', round: 'r32', label: 'M87 · 1K v 3(D/E/I/J/L)' },
  { id: 'R32-16', round: 'r32', label: 'M88 · 2D v 2G' },
  { id: 'R16-1', round: 'r16', label: 'M89 · W74 v W77' },
  { id: 'R16-2', round: 'r16', label: 'M90 · W73 v W75' },
  { id: 'R16-3', round: 'r16', label: 'M91 · W76 v W78' },
  { id: 'R16-4', round: 'r16', label: 'M92 · W79 v W80' },
  { id: 'R16-5', round: 'r16', label: 'M93 · W83 v W84' },
  { id: 'R16-6', round: 'r16', label: 'M94 · W81 v W82' },
  { id: 'R16-7', round: 'r16', label: 'M95 · W86 v W88' },
  { id: 'R16-8', round: 'r16', label: 'M96 · W85 v W87' },
  { id: 'QF-1', round: 'qf', label: 'M97 · W89 v W90' },
  { id: 'QF-2', round: 'qf', label: 'M98 · W93 v W94' },
  { id: 'QF-3', round: 'qf', label: 'M99 · W91 v W92' },
  { id: 'QF-4', round: 'qf', label: 'M100 · W95 v W96' },
  { id: 'SF-1', round: 'sf', label: 'M101 · W97 v W98' },
  { id: 'SF-2', round: 'sf', label: 'M102 · W99 v W100' },
  { id: '3RD', round: '3rd', label: 'M103 · Play-off for 3rd' },
  { id: 'FINAL', round: 'final', label: '🏆 M104 · Final' },
];

// Bracket grid layout (FIFA-style): left half feeds the final from the left,
// right half from the right, finals in the middle. Shared by the player picks
// board and the admin bracket grid so both stay in sync.
export const BRACKET_COLUMNS: { key: string; title: string; ids: string[] }[] = [
  { key: 'left-r32', title: 'Round of 32', ids: ['R32-2', 'R32-5', 'R32-1', 'R32-3', 'R32-11', 'R32-12', 'R32-9', 'R32-10'] },
  { key: 'left-r16', title: 'Round of 16', ids: ['R16-1', 'R16-2', 'R16-5', 'R16-6'] },
  { key: 'left-qf', title: 'Quarter-finals', ids: ['QF-1', 'QF-2'] },
  { key: 'left-sf', title: 'Semi-finals', ids: ['SF-1'] },
  { key: 'center', title: 'Final', ids: ['FINAL', '3RD'] },
  { key: 'right-sf', title: 'Semi-finals', ids: ['SF-2'] },
  { key: 'right-qf', title: 'Quarter-finals', ids: ['QF-3', 'QF-4'] },
  { key: 'right-r16', title: 'Round of 16', ids: ['R16-3', 'R16-4', 'R16-7', 'R16-8'] },
  { key: 'right-r32', title: 'Round of 32', ids: ['R32-4', 'R32-6', 'R32-7', 'R32-8', 'R32-14', 'R32-16', 'R32-13', 'R32-15'] },
];

// Maps each KO match to its two feeder matches + role (w=winner, l=loser).
// Graph matches the OFFICIAL FIFA WC 2026 bracket (M89→M104). Home/away order
// follows the official top/bottom seeding so the picks UI mirrors FIFA exactly.
//   R16: M89=W74/W77 M90=W73/W75 M91=W76/W78 M92=W79/W80
//        M93=W83/W84 M94=W81/W82 M95=W86/W88 M96=W85/W87
//   QF : M97=W89/W90 M98=W93/W94 M99=W91/W92 M100=W95/W96
//   SF : M101=W97/W98  M102=W99/W100
//   Final M104=W101/W102 · 3rd M103=loser M101 / loser M102
export const KO_FEED: Record<string, { src: string; r: 'w' | 'l' }[]> = {
  'R16-1': [{ src: 'R32-2', r: 'w' }, { src: 'R32-5', r: 'w' }], // M89
  'R16-2': [{ src: 'R32-1', r: 'w' }, { src: 'R32-3', r: 'w' }], // M90
  'R16-3': [{ src: 'R32-4', r: 'w' }, { src: 'R32-6', r: 'w' }], // M91
  'R16-4': [{ src: 'R32-7', r: 'w' }, { src: 'R32-8', r: 'w' }], // M92
  'R16-5': [{ src: 'R32-11', r: 'w' }, { src: 'R32-12', r: 'w' }], // M93
  'R16-6': [{ src: 'R32-9', r: 'w' }, { src: 'R32-10', r: 'w' }], // M94
  'R16-7': [{ src: 'R32-14', r: 'w' }, { src: 'R32-16', r: 'w' }], // M95
  'R16-8': [{ src: 'R32-13', r: 'w' }, { src: 'R32-15', r: 'w' }], // M96
  'QF-1': [{ src: 'R16-1', r: 'w' }, { src: 'R16-2', r: 'w' }], // M97
  'QF-2': [{ src: 'R16-5', r: 'w' }, { src: 'R16-6', r: 'w' }], // M98
  'QF-3': [{ src: 'R16-3', r: 'w' }, { src: 'R16-4', r: 'w' }], // M99
  'QF-4': [{ src: 'R16-7', r: 'w' }, { src: 'R16-8', r: 'w' }], // M100
  'SF-1': [{ src: 'QF-1', r: 'w' }, { src: 'QF-2', r: 'w' }], // M101
  'SF-2': [{ src: 'QF-3', r: 'w' }, { src: 'QF-4', r: 'w' }], // M102
  '3RD': [{ src: 'SF-1', r: 'l' }, { src: 'SF-2', r: 'l' }], // M103
  FINAL: [{ src: 'SF-1', r: 'w' }, { src: 'SF-2', r: 'w' }], // M104
};

// Official FIFA match numbers + kickoff (from the published bracket) per app id.
export const KO_META: Record<string, { m: number; date: string }> = {
  'R32-1': { m: 73, date: 'Jun 28 · 15:00' }, 'R32-2': { m: 74, date: 'Jun 29 · 16:30' },
  'R32-3': { m: 75, date: 'Jun 29 · 21:00' }, 'R32-4': { m: 76, date: 'Jun 29 · 13:00' },
  'R32-5': { m: 77, date: 'Jun 30 · 17:00' }, 'R32-6': { m: 78, date: 'Jun 30 · 13:00' },
  'R32-7': { m: 79, date: 'Jun 30 · 21:00' }, 'R32-8': { m: 80, date: 'Jul 1 · 12:00' },
  'R32-9': { m: 81, date: 'Jul 1 · 20:00' }, 'R32-10': { m: 82, date: 'Jul 1 · 16:00' },
  'R32-11': { m: 83, date: 'Jul 2 · 19:00' }, 'R32-12': { m: 84, date: 'Jul 2 · 15:00' },
  'R32-13': { m: 85, date: 'Jul 2 · 23:00' }, 'R32-14': { m: 86, date: 'Jul 3 · 18:00' },
  'R32-15': { m: 87, date: 'Jul 3 · 21:30' }, 'R32-16': { m: 88, date: 'Jul 3 · 14:00' },
  'R16-1': { m: 89, date: 'Jul 4 · 17:00' }, 'R16-2': { m: 90, date: 'Jul 4 · 13:00' },
  'R16-3': { m: 91, date: 'Jul 5 · 16:00' }, 'R16-4': { m: 92, date: 'Jul 5 · 20:00' },
  'R16-5': { m: 93, date: 'Jul 6 · 15:00' }, 'R16-6': { m: 94, date: 'Jul 6 · 20:00' },
  'R16-7': { m: 95, date: 'Jul 7 · 12:00' }, 'R16-8': { m: 96, date: 'Jul 7 · 16:00' },
  'QF-1': { m: 97, date: 'Jul 9 · 16:00' }, 'QF-2': { m: 98, date: 'Jul 10 · 15:00' },
  'QF-3': { m: 99, date: 'Jul 11 · 17:00' }, 'QF-4': { m: 100, date: 'Jul 11 · 21:00' },
  'SF-1': { m: 101, date: 'Jul 14 · 15:00' }, 'SF-2': { m: 102, date: 'Jul 15 · 15:00' },
  '3RD': { m: 103, date: 'Jul 18 · 17:00' }, FINAL: { m: 104, date: 'Jul 19 · 15:00' },
};

// ISO 8601 kickoff times (America/Toronto / EDT, UTC-4) for per-match pick locks.
export const KO_KICKOFF: Record<string, string> = {
  'R32-1': '2026-06-28T15:00:00-04:00', 'R32-2': '2026-06-29T16:30:00-04:00',
  'R32-3': '2026-06-29T21:00:00-04:00', 'R32-4': '2026-06-29T13:00:00-04:00',
  'R32-5': '2026-06-30T17:00:00-04:00', 'R32-6': '2026-06-30T13:00:00-04:00',
  'R32-7': '2026-06-30T21:00:00-04:00', 'R32-8': '2026-07-01T12:00:00-04:00',
  'R32-9': '2026-07-01T20:00:00-04:00', 'R32-10': '2026-07-01T16:00:00-04:00',
  'R32-11': '2026-07-02T19:00:00-04:00', 'R32-12': '2026-07-02T15:00:00-04:00',
  'R32-13': '2026-07-02T23:00:00-04:00', 'R32-14': '2026-07-03T18:00:00-04:00',
  'R32-15': '2026-07-03T21:30:00-04:00', 'R32-16': '2026-07-03T14:00:00-04:00',
  'R16-1': '2026-07-04T17:00:00-04:00', 'R16-2': '2026-07-04T13:00:00-04:00',
  'R16-3': '2026-07-05T16:00:00-04:00', 'R16-4': '2026-07-05T20:00:00-04:00',
  'R16-5': '2026-07-06T15:00:00-04:00', 'R16-6': '2026-07-06T20:00:00-04:00',
  'R16-7': '2026-07-07T12:00:00-04:00', 'R16-8': '2026-07-07T16:00:00-04:00',
  'QF-1': '2026-07-09T16:00:00-04:00', 'QF-2': '2026-07-10T15:00:00-04:00',
  'QF-3': '2026-07-11T17:00:00-04:00', 'QF-4': '2026-07-11T21:00:00-04:00',
  'SF-1': '2026-07-14T15:00:00-04:00', 'SF-2': '2026-07-15T15:00:00-04:00',
  '3RD': '2026-07-18T17:00:00-04:00', FINAL: '2026-07-19T15:00:00-04:00',
};

/** Picks close one hour before kickoff. */
export const PICK_LOCK_HOURS_BEFORE = 1;

// Build all 72 group matches + 32 KO skeleton matches (104 total).
export function generateAllMatches(): Match[] {
  const matches: Match[] = [];
  const pairings = [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]];
  const mdays = [1, 1, 2, 2, 3, 3];
  for (const [g, grp] of Object.entries(GROUPS)) {
    pairings.forEach(([i, j], idx) => {
      const id = `G${g}${idx + 1}`;
      matches.push({
        id, round: 'group', group: g, matchday: mdays[idx],
        date: GROUP_MATCH_DATES[id] || null,
        home: grp.teams[i], away: grp.teams[j], result: undefined,
      });
    });
  }
  for (const ko of KO_MATCH_IDS) {
    matches.push({ id: ko.id, round: ko.round, label: ko.label, result: undefined });
  }
  return matches;
}

export const ALL_MATCHES = generateAllMatches();
