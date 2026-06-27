// ─────────────────────────────────────────────────────────────
//  Flair & easter eggs — purely cosmetic, kind and fun.
//  Display-only: never used for identity, login, or scoring.
// ─────────────────────────────────────────────────────────────

// Nickname overrides. Matched against the full lowercased name OR the first
// name, so "Chris Dritsas" still becomes the cool guy.
const NICKNAMES: Record<string, { nick: string; emoji?: string }> = {
  chris: { nick: 'Chris Cool Guy', emoji: '😎' },
};

function lookup(name: string): { nick: string; emoji?: string } | null {
  const key = name.trim().toLowerCase();
  if (NICKNAMES[key]) return NICKNAMES[key];
  const first = key.split(/\s+/)[0];
  return NICKNAMES[first] ?? null;
}

// Decorate a participant name for display. The real name is preserved
// everywhere it matters (login, scoring, storage) — this is just UI sugar.
export function displayName(name: string): string {
  const hit = lookup(name);
  if (!hit) return name;
  return hit.emoji ? `${hit.nick} ${hit.emoji}` : hit.nick;
}

// True when this name has a special nickname (for styling a sparkle, etc.).
export function hasNickname(name: string): boolean {
  return !!lookup(name);
}

// Rank flair sits next to the player's name. rank is 0-indexed.
// First place gets the shades. Everyone else stays clean.
export function rankFlair(rank: number): string {
  if (rank === 0) return '😎';
  return '';
}

// A small, friendly title shown under the name in standings.
// `total` is the participant count so we only roast the last place
// when there is a real field to be last in.
export function rankTitle(rank: number, total: number): string | null {
  if (total < 2) return null;
  if (rank === 0) return 'Big Boss';
  if (rank === 1) return 'So close';
  if (rank === 2) return 'On the podium';
  if (rank === total - 1 && total >= 5) return 'Wooden spoon 🥄';
  return null;
}

// Fun rotating loading lines.
export const LOADING_LINES = [
  'Warming up the pitch…',
  'Polishing the trophy…',
  'Checking VAR…',
  'Counting the cash…',
  'Lacing up the boots…',
];

export function randomLoadingLine(): string {
  return LOADING_LINES[Math.floor(Math.random() * LOADING_LINES.length)];
}

// Cool one-liners sprinkled around the UI for flavour.
export const COOL_PHRASES = [
  'No guts, no glory. ⚡',
  'Trust the bracket. 🧠',
  'Ball don’t lie. 🎯',
  'Big tournament, bigger calls. 🔥',
  'Pressure makes diamonds. 💎',
  'Send it. 🚀',
  'Champions are made in the group stage. 🏆',
  'Fortune favours the bold. 🎲',
  'Believe the upset. 😮',
  'Glory awaits the brave. 🛡️',
];

// Deterministic-ish pick so it can be stable per key, or random when no key.
export function coolPhrase(seed?: string): string {
  if (seed == null) return COOL_PHRASES[Math.floor(Math.random() * COOL_PHRASES.length)];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return COOL_PHRASES[h % COOL_PHRASES.length];
}
