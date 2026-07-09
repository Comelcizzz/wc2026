// All Picks is a private view — only this participant may access /all-picks.
const ALL_PICKS_VIEWER = 'ivan';

export function canAccessAllPicks(name: string | null | undefined): boolean {
  return name?.trim().toLowerCase() === ALL_PICKS_VIEWER;
}
