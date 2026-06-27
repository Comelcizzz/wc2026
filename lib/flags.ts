// ─────────────────────────────────────────────────────────────
//  Flag emoji per national team. Keyed by the exact names in TEAMS.
//  Display-only: never used for identity, matching, or scoring.
// ─────────────────────────────────────────────────────────────
export const TEAM_FLAGS: Record<string, string> = {
  Algeria: '🇩🇿',
  Argentina: '🇦🇷',
  Australia: '🇦🇺',
  Austria: '🇦🇹',
  Belgium: '🇧🇪',
  'Bosnia & Herzegovina': '🇧🇦',
  Brazil: '🇧🇷',
  Canada: '🇨🇦',
  'Cape Verde': '🇨🇻',
  Colombia: '🇨🇴',
  Croatia: '🇭🇷',
  'Curaçao': '🇨🇼',
  Czechia: '🇨🇿',
  'Congo DR': '🇨🇩',
  Ecuador: '🇪🇨',
  Egypt: '🇪🇬',
  England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  France: '🇫🇷',
  Germany: '🇩🇪',
  Ghana: '🇬🇭',
  Haiti: '🇭🇹',
  Iran: '🇮🇷',
  Iraq: '🇮🇶',
  'Ivory Coast': '🇨🇮',
  Japan: '🇯🇵',
  Jordan: '🇯🇴',
  Mexico: '🇲🇽',
  Morocco: '🇲🇦',
  Netherlands: '🇳🇱',
  'New Zealand': '🇳🇿',
  Norway: '🇳🇴',
  Panama: '🇵🇦',
  Paraguay: '🇵🇾',
  Portugal: '🇵🇹',
  Qatar: '🇶🇦',
  'Saudi Arabia': '🇸🇦',
  Scotland: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  Senegal: '🇸🇳',
  'South Africa': '🇿🇦',
  'South Korea': '🇰🇷',
  Spain: '🇪🇸',
  Sweden: '🇸🇪',
  Switzerland: '🇨🇭',
  Tunisia: '🇹🇳',
  'Türkiye': '🇹🇷',
  Uruguay: '🇺🇾',
  USA: '🇺🇸',
  Uzbekistan: '🇺🇿',
};

// Returns the flag emoji for a team, or a neutral globe when unknown/TBD.
// NOTE: regional-indicator emoji do NOT render as flags on Windows browsers —
// prefer the <TeamFlag> image component in UI. This stays for text-only spots.
export function teamFlag(team?: string | null): string {
  if (!team) return '🏳️';
  return TEAM_FLAGS[team] ?? '🏳️';
}

// "🇩🇪 Germany" — flag + name in one string (for places that take plain text).
export function teamLabel(team?: string | null, fallback = 'TBD'): string {
  if (!team) return fallback;
  return `${teamFlag(team)} ${team}`;
}

// ISO 3166-1 alpha-2 codes (flagcdn uses these; gb-eng / gb-sct for home nations).
// Used by <TeamFlag> to render real flag images that work on every OS/browser.
export const TEAM_CODES: Record<string, string> = {
  Algeria: 'dz',
  Argentina: 'ar',
  Australia: 'au',
  Austria: 'at',
  Belgium: 'be',
  'Bosnia & Herzegovina': 'ba',
  Brazil: 'br',
  Canada: 'ca',
  'Cape Verde': 'cv',
  Colombia: 'co',
  Croatia: 'hr',
  'Curaçao': 'cw',
  Czechia: 'cz',
  'Congo DR': 'cd',
  Ecuador: 'ec',
  Egypt: 'eg',
  England: 'gb-eng',
  France: 'fr',
  Germany: 'de',
  Ghana: 'gh',
  Haiti: 'ht',
  Iran: 'ir',
  Iraq: 'iq',
  'Ivory Coast': 'ci',
  Japan: 'jp',
  Jordan: 'jo',
  Mexico: 'mx',
  Morocco: 'ma',
  Netherlands: 'nl',
  'New Zealand': 'nz',
  Norway: 'no',
  Panama: 'pa',
  Paraguay: 'py',
  Portugal: 'pt',
  Qatar: 'qa',
  'Saudi Arabia': 'sa',
  Scotland: 'gb-sct',
  Senegal: 'sn',
  'South Africa': 'za',
  'South Korea': 'kr',
  Spain: 'es',
  Sweden: 'se',
  Switzerland: 'ch',
  Tunisia: 'tn',
  'Türkiye': 'tr',
  Uruguay: 'uy',
  USA: 'us',
  Uzbekistan: 'uz',
};

export function teamCode(team?: string | null): string | null {
  if (!team) return null;
  return TEAM_CODES[team] ?? null;
}
