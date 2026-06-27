// Server-side config. These env vars are read at request time.
export const config = {
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  poolId: process.env.POOL_ID || '',
  adminSecret: process.env.ADMIN_SECRET || '',
  // Used to sign player session cookies (falls back to the admin secret).
  sessionSecret: process.env.SESSION_SECRET || process.env.ADMIN_SECRET || '',
  // Seed value used only when a brand-new pool is created. Live deadline lives in
  // pool.settings.picksDeadline so the admin can extend it from the panel.
  defaultDeadline: process.env.PICKS_DEADLINE || '2026-06-28T15:00:00-04:00',
};
