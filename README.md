# World Cup 2026 Pool - Next.js

Next.js rebuild of the WC2026 pool. Group-stage points are preserved; from the
Round of 32 everyone submits a full knockout bracket with winners and exact
scores through the Final.

## Run Locally

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Environment

This project can run in the same open Supabase mode as the old single-file HTML:

```env
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_ANON_KEY=sb_publishable_your-public-key
SUPABASE_SERVICE_ROLE_KEY=

POOL_ID=TVZAQN8G
ADMIN_SECRET=change-me
SESSION_SECRET=change-me-too

PICKS_DEADLINE=2026-06-28T15:00:00-04:00
NEXT_PUBLIC_TIMEZONE=America/Toronto
```

`SUPABASE_SERVICE_ROLE_KEY` can stay empty. `lib/poolStore.ts` uses
`SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY`, so an empty service key makes
the app use the public key.

New Supabase keys work differently:

- `sb_publishable_...` / `sb_secret_...`: sent as `apikey` only.
- Legacy JWT keys starting with `eyJ`: sent as `apikey` plus `Authorization: Bearer`.

## Deadline

`PICKS_DEADLINE=2026-06-28T15:00:00-04:00` means **June 28, 2026 at 3:00 PM in
Toronto / Eastern Daylight Time**.

`NEXT_PUBLIC_TIMEZONE=America/Toronto` controls the displayed timezone.

The live deadline is stored in `pool_data.data.settings.picksDeadline`, so the
admin can extend it from `/admin`. `PICKS_DEADLINE` is only the seed/default when
older data does not already have a deadline.

## Supabase RLS

For v1-compatible open mode, keep anon read/write access to `pool_data`:

```sql
alter table pool_data enable row level security;

create policy "anon all"
on pool_data
for all
to anon
using (true)
with check (true);
```

If the `anon all` policy already exists from v1, do not create a duplicate.

## Security Tradeoff

In this open mode, anyone who has the public Supabase key can read the whole
`pool_data` row directly through Supabase REST. That includes emails and player
password hashes (`scrypt` hash + salt).

For a friendly pool of roughly 15 people this matches the old v1 trust model:
the old HTML app already had open anon access, and it did not have player
passwords at all.

Later hardening does not require code changes:

1. Create/use a secret key (`sb_secret_...`) or a legacy service-role key.
2. Put it in `SUPABASE_SERVICE_ROLE_KEY`.
3. Remove anon access from RLS, for example by dropping the `anon all` policy.

Then reads/writes still go through the Next.js server, but hashes are no longer
reachable from the public Supabase key.

## Admin Flow

1. `/admin` -> enter `ADMIN_SECRET`.
2. Set the 16 real Round of 32 fixtures.
3. Lock and open the re-draft.
4. Generate player passwords and send each player their name + password.
5. Players log in on `/picks` and submit the full bracket before the deadline.
6. As matches finish, enter real results in `/admin`.

## Backup & Supabase migration

Before moving to a new Supabase project, save a full snapshot:

```powershell
# Best: direct read from current Supabase (includes passwords + emails)
Copy-Item .env.example .env.local
# fill SUPABASE_URL, SUPABASE_ANON_KEY, POOL_ID
npm run backup

# Fallback: live site API (picks, results, chat — no passwords)
npm run backup:live
```

Files land in `./backups/` (gitignored). Use `scripts/supabase-schema.sql` on the
new project, then:

```powershell
# Dry-run export from source
npm run migrate

# Copy to new Supabase
# TARGET_SUPABASE_URL=...
# TARGET_SUPABASE_ANON_KEY=...
# TARGET_POOL_ID=TVZAQN8G
npm run migrate:write

# Or import a saved backup file
node scripts/migrate-supabase.mjs --from-backup backups/full-backup-....json --write
```

After migration, update Vercel env vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`POOL_ID`) to the new project.

## GitHub / Deploy

Do not commit `.env.local`; it is ignored by `.gitignore`.

For Vercel, add the same environment variables in the project settings. If you
deploy in open mode, leave `SUPABASE_SERVICE_ROLE_KEY` empty there too.
