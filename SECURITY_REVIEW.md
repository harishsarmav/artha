# Dhanive v0.7 pre-release review

Review date: 15 November 2026

## Scope and limits

This review covered the application source, Supabase migrations and Edge Function, local AI proxy, deployment workflow, dependency lockfile, and the locally rendered sign-in and release-notes screens. It did not access the live Supabase project, GitHub Actions settings, user accounts, or production deployment. The review is not a penetration test or a legal/privacy-policy review.

## Changes made

- Removed silent migration of legacy browser financial records at sign-in. The dashboard now offers an explicit confirmation before copying older Artha data to the signed-in Supabase account, and keeps the original browser copy. If an import fails partway through, the UI warns that some rows may already have been written; inspect the portfolio before retrying.
- Reduced AI Edge Function data access to only the fields needed by the calculation engine. It no longer fetches transaction rows or profile, goal, and insurance identifying names for AI context; goal labels are replaced with generic labels. Deterministic transaction categorization avoids loading portfolio records entirely.
- Added a 32 KB request-body limit to the loopback-only local AI proxy.
- Updated Next.js to 15.5.29, refreshed the stale lockfile, and pinned patched `postcss` 8.5.28 and `source-map-js` 1.2.2 overrides. The deployment workflow now uses `npm ci` so CI follows the reviewed lockfile.
- Reworked dark theme surfaces to near-black neutral shades while keeping teal as an accent.
- Added an authenticated month/year spending view that reads only the selected year's transactions, paginates results, and caps the client view at 5,000 entries. It displays missing months as unrecorded rather than zero and labels annualized spend as an estimate.
- Added product copy explaining Dhanive's numbers-first calculation model, connected planning flows, and visible assumptions.
- Updated package metadata and workflow labels to Dhanive v0.7.

## Source-level controls observed

- The browser uses the Supabase publishable key. No service-role key or AI provider key is referenced by client code; provider secrets are read only by the Supabase Edge Function.
- Data tables have owner-scoped RLS policies in migrations. The quota RPC checks `auth.uid()` against its argument and is granted only to authenticated users.
- AI requests require a valid bearer session. The Edge Function validates request type and body size, constrains allowed browser origins, and enforces an atomic daily quota.
- ReactMarkdown renders coach answers without enabling raw HTML.
- The static GitHub Pages deployment does not run a Next.js server at request time. Server-only Next.js findings still matter for the build toolchain; deployment remains static.

## Query analytics recommendation

The existing `ai_usage` table counts daily requests per signed-in user for quota enforcement; it does not store prompts or answers. Keep product analytics separate from quota data. A privacy-first first version should record only coarse feature/mode, broad user-selected topic, response status/latency, and optional usefulness feedback, then report aggregate counts with small groups suppressed. Do not store raw prompts, names, transaction descriptions, financial values, account IDs, or IP addresses for analytics by default. If raw prompt review is ever needed, add a separate, explicit opt-in with a stated retention window and deletion path.

## Release blockers to verify outside this codebase

1. Confirm migrations `001`, `002`, and `003` are applied to the intended production Supabase project. Verify RLS on every user-data table and test that account A cannot read or mutate account B's rows. Source policy definitions do not prove the live project matches them.
2. Review Supabase Auth URL allowlists, email-confirmation behavior, abuse/rate limits, and recovery settings for the production domain. Add and verify a password-recovery flow before public launch.
3. Publish a privacy notice that identifies Supabase and the configured AI provider, explains which calculated financial facts are sent when the user requests AI guidance, and states retention, deletion, and support contact details. Those operational facts cannot be inferred from this repository.
4. Provide and verify a user account/data deletion process. Database foreign keys cascade when a Supabase Auth user is deleted, but the app currently has no in-product account deletion flow.
5. Confirm the production AI provider's retention and training terms, configure the Edge Function secret only in Supabase, and use the exact production origin in `ALLOWED_ORIGINS`.
6. Confirm GitHub Pages repository variables contain only the Supabase URL, publishable key, AI endpoint, and public base path. Never use the service-role key, database password, or provider key in GitHub Pages variables or any `NEXT_PUBLIC_*` variable.

## Verification

- `npm audit --audit-level=high`: passed, 0 vulnerabilities.
- `npm ci`: passed, lockfile install reported 0 vulnerabilities.
- `npm run build`: passed with dummy public Supabase values; exported static routes `/`, `/auth`, and `/release-notes`.
- Visual review: sign-in and release notes rendered locally; mobile sign-in checked at 390 × 844. Dashboard interaction review was limited because no test account was available in the local browser session.
