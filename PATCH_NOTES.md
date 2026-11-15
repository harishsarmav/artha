# Dhanive v0.7 release and security patch notes

## v0.7.2 — monthly spending and privacy controls
- Added month/year filters, spending trends, recorded-month averages, and a clearly labeled annualized run-rate to the transaction tracker.
- Months without expense entries remain unrecorded instead of being treated as zero; recurring expenses are not duplicated into future months.
- Made the Financial Engine, connected planning paths, and visible assumptions clearer as Dhanive's product difference.
- Refreshed release notes and build documentation.
- Build verified with dummy public Supabase values; npm audit reported zero vulnerabilities.

## v0.7.1 — privacy and dependency hardening
- Legacy browser data is no longer uploaded automatically at sign-in. The user must confirm an import, and the local copy is retained.
- The AI Edge Function avoids fetching transaction details for categorization and requests only calculation fields for coach answers.
- Added a request-size limit to the local loopback AI proxy.
- Updated Next.js to 15.5.29 and pinned patched PostCSS and source-map-js versions.
- Changed the deployment workflow to install from the committed lockfile with `npm ci`.
- Updated dark mode to neutral near-black surfaces with teal accents.

## v0.7.1 — user-provided calculator inputs
- Removed prefilled age, risk profile, investment horizon, and primary goal assumptions from the profile and planning calculations.
- Reset the extra-savings scenario slider to zero; it is disabled until cash-flow records exist and is saved to browser storage only after the user changes it.
- Replaced empty portfolio zeroes and health labels with clear prompts until relevant data is provided.
- Existing account records continue to load and update in Supabase when the user submits a form; no data-clearing migration was added.
- Added this update to the public release notes.
- Made the greeting fall back to the signed-in account name when the profile row contains an empty name.
- Extended the visible product name to “Dhanive” and softened the header and hero gradients while keeping the teal palette.

## Profile save repair
- Profile writes use an id-keyed upsert so existing profile rows and accounts without a pre-created row both save through the same path.
- Profile save errors now show a safe database error code and a relevant next step without exposing raw database details or entered values.

## Brand update
- Renamed the visible product and financial coach from Artha Compass to Dhanive. Kept the existing route names, Supabase function identifiers, and local storage keys so saved data and deployment paths continue to work.
- Supabase authentication fetch failures are caught and shown with retry guidance instead of surfacing as an unhandled Next.js error overlay.

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
7. Install the committed lockfile with `npm ci`, then run `npm audit --audit-level=high` and `npm run build`.
8. Commit the regenerated `package-lock.json` and source changes, then push to `main` to trigger GitHub Pages deployment.

## Validation limits
- `npm ci` completed, `npm audit --audit-level=high` found 0 vulnerabilities, and `npm run build` exported the static app with dummy public Supabase values.
- The live Supabase database was not accessed from this session. Apply migrations only after taking a backup, then test with two separate accounts.
- Dashboard interactions were not tested against a live account in this session.
- The live Supabase database was not accessible from this session. Apply migrations only after taking a backup, then test with two separate accounts.
- Supabase Free inactivity pausing is a platform plan limitation. This patch deliberately adds no artificial keep-alive/ping script. Use a paid plan for uninterrupted production availability.

## Credential handling
The Supabase URL and publishable/anon key are public browser configuration. Never add service-role keys, database passwords, AI provider keys, or private tokens to browser code, `NEXT_PUBLIC_*` variables, the repository, or GitHub Pages artifacts.

## Dashboard list cleanup
- Income and recurring expense cards show monthly totals and entry counts by default; records open on demand under Manage entries.
- Tightened dashboard row spacing and edit/delete controls, and let cards size to their own content.
- Added this UI update to the in-app release notes.



## Monthly entry and dashboard consolidation
- Replaced the duplicate recent-activity list with the dated monthly transaction history, including category, source, and edit/delete actions.
- Refresh the selected year's history only after the server confirms a transaction save; use the local calendar date for new entries.
- Surface safe database error codes inside save dialogs so failed expense, goal, insurance, and other writes are visible while form data stays open.
- Group cash-flow run-rate with financial health and merge portfolio summaries into one tabbed panel.

- Added Insurance and Goals as Portfolio tabs with coverage, target, progress, and monthly contribution summaries.
- Scenario Lab now evaluates all goal contributions together and explicitly shows current investment contributions already included in free cash flow.


## Planning card artwork
- Added six local WebP illustrations for home, car, goals, debt, financial safety, and retirement planning cards.
- Applied responsive text-safe overlays with dark theme contrast; assets are served from the app and make no third-party image requests.



## Dhanive AI request diagnostics
- Replaced the generic AI Edge Function failure with safe actionable messages for provider credentials, provider limits/endpoints, missing quota/schema migrations, authentication, and RLS errors.
- Provider network/time-out failures are classified as temporary provider outages.
- Edge logs contain only a safe error code and provider status; they never include user prompts, financial facts, credentials, or provider response bodies.
- GitHub Pages deploy does not deploy Supabase Edge Functions; deploy the function source separately with the Supabase CLI.
- Verified: `npm run build` succeeds. Live Edge Function behavior still requires deployment and a retry.

## AI coach error visibility
- Display AI request failures beside the Ask Dhanive controls, and inside the scenario dialog when the scenario explanation fails.
- Clear the coach error when the user retries or edits their question.
