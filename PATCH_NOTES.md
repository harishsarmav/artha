# Artha v0.6 security patch notes

## v0.7.1 — user-provided calculator inputs
- Removed prefilled age, risk profile, investment horizon, and primary goal assumptions from the profile and planning calculations.
- Reset the extra-savings scenario slider to zero; it is disabled until cash-flow records exist and is saved to browser storage only after the user changes it.
- Replaced empty portfolio zeroes and health labels with clear prompts until relevant data is provided.
- Existing account records continue to load and update in Supabase when the user submits a form; no data-clearing migration was added.
- Added this update to the public release notes.
- Made the greeting fall back to the signed-in account name when the profile row contains an empty name.
- Extended the visible product name to “Artha Compass” and softened the header and hero gradients while keeping the teal palette.

## Changes included
- Removed the public Supabase connection-test route/component and the unused Next.js API coach route.
- Removed old generated `out/` build artifacts, Git history/metadata, and Supabase CLI `.temp` metadata from this source archive.
- Aligned frontend reads/writes and the Edge Function with the canonical SQL schema.
- Sanitized browser-visible auth/database/provider errors and removed raw error logging.
- Restricted the local Ollama gateway CORS to `http://localhost:3000`; it still binds only to `127.0.0.1`.
- Restricted the production Edge Function to explicit origins, bounded JSON requests, validates modes, requires the authenticated user, and returns generic server errors.
- Production browser requests send no duplicate financial dataset. The Edge Function reads the signed-in user's data under RLS.
- The external AI provider receives calculated summaries only; goal labels are anonymized and transaction amounts are omitted from categorization prompts.
- Hardened `ai_usage`: authenticated users can read only their own quota record; all writes use a server-enforced atomic RPC with a fixed 30/day limit.
- Added schema-alignment and owner-policy migration for known legacy columns.
- Updated Next.js/React/Sharp dependency pins and added a dependency audit gate to GitHub Actions.

## Required deployment steps
1. Back up Supabase before changing schema.
2. If the original schema migration has not run, run `supabase/migrations/001_artha_v06.sql`.
3. Run `supabase/migrations/002_security_hardening.sql`.
4. Run `supabase/migrations/003_schema_alignment_and_rls.sql`.
5. In Supabase Edge Function secrets, set `ALLOWED_ORIGINS` to:
   `https://harishsarmav.github.io,http://localhost:3000,http://127.0.0.1:3000`
6. Deploy the Edge Function: `supabase functions deploy artha-ai`.
7. Regenerate the npm lockfile on a machine with registry access:
   `npm install`
   then run `npm audit` and `npm run build`.
8. Commit the regenerated `package-lock.json` and source changes, then push to `main` to trigger GitHub Pages deployment.

## Validation limits
- TypeScript/TSX syntax transpilation and the local Node gateway syntax check passed.
- A full Next.js build and `npm audit` could not be completed in the preparation environment because the npm registry was unreachable. GitHub Actions now runs `npm audit --audit-level=high` before building.
- The live Supabase database was not accessible from this session. Apply migrations only after taking a backup, then test with two separate accounts.
- Supabase Free inactivity pausing is a platform plan limitation. This patch deliberately adds no artificial keep-alive/ping script. Use a paid plan for uninterrupted production availability.

## Credential handling
The Supabase URL and publishable/anon key are public browser configuration. Never add service-role keys, database passwords, AI provider keys, or private tokens to browser code, `NEXT_PUBLIC_*` variables, the repository, or GitHub Pages artifacts.
