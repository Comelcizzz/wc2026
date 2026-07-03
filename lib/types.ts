// ─────────────────────────────────────────────────────────────
//  Shared types
// ─────────────────────────────────────────────────────────────

export type Round = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | '3rd' | 'final';

export interface Match {
  id: string;
  round: Round;
  group?: string;
  matchday?: number;
  date?: string | null;
  label?: string;
  home?: string;
  away?: string;
  result?: MatchResult;
}

// Group result: just the scoreline. KO result: scoreline + the two real teams + winner.
export interface MatchResult {
  homeGoals: number;
  awayGoals: number;
  // KO only — real teams in this slot + who advanced (after ET/pens)
  home?: string;
  away?: string;
  winner?: string;
}

// A score pick. `et` = winner team name when the participant predicts a draw
// in a knockout match (extra-time / penalties winner).
export interface ScorePick {
  h: number;
  a: number;
  et?: string;
}

export type GroupPicks = Record<string, { h: number; a: number }>;
export type KoPicks = Record<string, ScorePick>;

export interface Participant {
  id: string;
  name: string;
  email?: string;
  paid: boolean;
  picks: GroupPicks; // group stage — PRESERVED from the original pool
  koPicks?: KoPicks; // redraft (Round of 32 → Final), one-and-done
  champion?: string;
  totalGoals?: number | null;
  submittedAt?: string; // original group submission
  koSubmittedAt?: string; // redraft submission
  // Login: scrypt hash of the admin-generated password (plaintext never stored).
  passHash?: string;
  passSalt?: string;
}

// 16 real Round-of-32 fixtures entered by the admin once the bracket is locked.
export interface KoFixture {
  id: string; // 'R32-1' … 'R32-16'
  home: string;
  away: string;
}

export interface KoBracket {
  r32: KoFixture[];
  locked: boolean; // R32 fixtures locked → redraft is open
  // Optional manual team assignments for later rounds (admin overrides cascade).
  r16?: KoFixture[];
  qf?: KoFixture[];
  sf?: KoFixture[];
  '3rd'?: KoFixture[];
  final?: KoFixture[];
}

export interface ChatMessage {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface MatchComment {
  id: string;
  matchId: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface Settings {
  name: string;
  entryFee: number;
  prizeFirst: number;
  prizeSecond: number;
  prizeThird: number;
  status: 'open' | 'locked';
  picksDeadline: string; // ISO 8601 with tz offset
  champion?: string; // actual champion (admin) for +10 bonus / display
  totalGoals?: number | null; // actual total goals (tiebreak)
}

export interface PoolData {
  settings: Settings;
  participants: Participant[];
  matches: Match[];
  koBracket: KoBracket;
  chat?: ChatMessage[];
  matchComments?: Record<string, MatchComment[]>;
}

export interface ScoredParticipant extends Participant {
  totalPoints: number;
  groupPoints: number;
  koPoints: number;
  exactCount: number;
  championCorrect: boolean;
  goalsDelta: number | null;
}
