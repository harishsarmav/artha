# Artha security remediation

This source package contains a security-focused update for the existing Artha v0.6 architecture.

## Security changes
- Removed the public Supabase test page and obsolete Next.js API route.
- Removed generated static build output from the source bundle; rebuild before publishing.
- Frontend database field names now match `001_artha_v06.sql`.
- Browser UI no longer displays raw database/provider errors or logs raw database errors.
- Production AI requests no longer send a duplicate copy of financial context from the browser; the authenticated Edge Function reads the current user's rows under RLS.
- Edge Function restricts browser origins, validates JSON/mode/request size, returns generic server errors, and does not echo calculated financial records in its response.
- Daily AI quota is enforced atomically by PostgreSQL with a fixed server-side limit. Users cannot reset or raise their quota by directly editing `ai_usage`.
- Next.js and React are pinned to patched releases; Sharp is pinned to a patched release.

## Apply the database security migration
1. Export a backup of your current Supabase database first.
2. In Supabase SQL Editor, run `supabase/migrations/001_artha_v06.sql` if this is a fresh project.
3. Run `supabase/migrations/002_security_hardening.sql`.
4. Run `supabase/migrations/003_schema_alignment_and_rls.sql`. It aligns known legacy field names and rebuilds owner-only RLS policies without exporting rows.
5. Deploy the updated Edge Function:
   `supabase functions deploy artha-ai`
6. Configure the Edge Function secret `ALLOWED_ORIGINS` with exact origins (no trailing slash):
   `https://harishsarmav.github.io,http://localhost:3000,http://127.0.0.1:3000`
7. Confirm `supabase/config.toml` has `verify_jwt = true` for `artha-ai`.
8. Test with two separate accounts. Each account must only see, update, and delete its own rows.

The migrations do not export, print, or transmit financial records. Migration 003 may copy existing values from legacy columns into canonical columns inside the same database; it does not return those values to the browser or an external service.

## Database schema compatibility
The frontend now targets the canonical schema defined in `001_artha_v06.sql`:
- `profiles.id` and `profiles.name`
- `income.name` and `income.type`
- `expenses.name`
- `investments.mode`
- `loans.name`, `loans.outstanding`, `loans.emi`, `loans.tenure_months`
- `insurance.coverage`, `insurance.premium`, `insurance.frequency`
- `goals` without a `type` column

Do not run manual/destructive renames on a live database. Migration 003 conditionally renames only known legacy columns when the canonical column is absent; if both exist, it copies missing values and retains the legacy column. Back up first. This source archive cannot inspect your live Supabase database.

## Dependencies
The environment used to prepare this patch could not reach npm registry, so `package.json` is updated but the included lockfile still needs regeneration. On a machine with npm registry access, run:
`npm install`
then:
`npm audit`
Commit the regenerated `package-lock.json` only after reviewing the audit output.

## Public configuration
The Supabase URL and publishable/anon key are designed to be present in a browser app. They are not secret credentials. Never put a Supabase service-role key, database password, AI provider key, or private token in a `NEXT_PUBLIC_*` variable, GitHub Pages artifact, or source repository.
