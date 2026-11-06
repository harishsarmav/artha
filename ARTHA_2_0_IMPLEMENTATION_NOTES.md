# Artha 2.0 — visual identity and planning foundation

## Included in this handoff
- Trust-first palette: deep teal `#123C3A`, teal `#1F6B5C`, soft green `#DCECE5`, warm ivory `#F7F5EF`, dark text `#263532`.
- Updated existing purple-accented dashboard and authentication styling.
- Responsive section navigation: Overview, Planning, Portfolio and AI Coach.
- Planning hub with six entry points: Home, Car, Goals, Debt, Financial Safety and Retirement.
- Selecting a planning card pre-fills a tailored question in the existing AI Coach and scrolls to it.
- System-preference dark theme styles via `prefers-color-scheme`.
- Updated page metadata.

## Important implementation boundary
The planning hub is an initial, AI-connected entry point. It does not yet add independent loan calculators, new database tables, or a new AI orchestration service. Those should be implemented as tested domain modules in later milestones. Existing financial calculations, authentication, Supabase data access and AI request handling were intentionally left in place.

## Privacy
No diagnostic route, data-export script, keep-alive ping, or new external data transfer was added. The existing source security remediations and SQL migrations are retained. Review and apply Supabase migrations only after a backup and validation against the live schema.

## Validation
- Source-level edits were made to the existing project.
- A full Next.js build and live Supabase integration test have not been run in this environment.
- Run `npm ci` and `npm run build` locally before deployment. Then test sign-in, sign-out, CRUD operations, AI Coach, and cross-user data isolation with separate test accounts.
- No deployment was performed.

## Continuation update — 2026-09-30
- Added an in-app light/dark theme control in the authenticated header. It honors the system preference on first visit and stores only the visual preference under `artha-theme` in local storage.
- Replaced remaining purple accents with the requested teal/green palette; strengthened focus indicators, input borders, card hierarchy, chart colors, and reduced-motion behavior; improved small-screen header spacing.
- Added a public `/release-notes/` page with the current visual update and the v0.7 planning foundation, linked from the dashboard and sign-in screen.
- Kept the existing account flows, Supabase queries, financial engine, planning prompts, and AI gateway contract unchanged. No data export, diagnostics, or new external transfer was added.
- Files updated: `app/page.tsx`, `app/auth/page.tsx`, `app/globals.css`, `app/release-notes/page.tsx`, `app/release-notes/layout.tsx`, and this implementation note.
- Validation: CSS structure check passed (394 balanced rule blocks). `npm ci` could not complete: the default npm cache is outside the writable workspace, and a temporary cache retry failed registry TLS validation (`CERT_NOT_YET_VALID`). I did not bypass certificate validation. The Next.js build and end-to-end auth/CRUD/AI checks remain unverified. No live Supabase test or deployment was performed.
