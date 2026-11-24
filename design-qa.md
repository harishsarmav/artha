# FinBuddy dashboard refresh

## Changes

- Rebranded the app shell, browser metadata, sign-in and release-note copy, AI descriptions, package name, and app icon as FinBuddy. Supabase table names, function route names, auth behavior, and the existing `artha-theme` preference key remain unchanged.
- Replaced the centered header with a responsive navy workspace rail on desktop and a compact horizontal menu on smaller screens. The primary workspace links point to existing Overview, Planning, Portfolio, and AI Coach areas plus the new Reminders section.
- Added a reminders and renewals panel. It combines user-created due dates with upcoming insurance renewal dates and goal target dates already present in the account.
- User-created reminders persist locally under the current profile ID. The reminder feature makes no Supabase writes and needs no database migration. The interface explains that reminders are browser-local and not scheduled background notifications.
- Kept the existing financial engine, transaction and CSV workflows, account and profile flows, auth, AI gateway, theme preference, and Supabase-backed records intact.

## Build verification

- `npm run build` completed successfully with Next.js 15.5.29, TypeScript checks, static generation, and export.
- The build used placeholder public Supabase settings supplied only to the build process. No actual project URL, key, account session, or financial records were loaded.
- No test suite was added or run.

## Privacy boundary

- The user-provided archive contained `.env.local`. It was not opened or copied into the working folder or deliverable ZIP.
- The deliverable excludes `.env.local`, `.git`, dependency folders, `.next`, static build output, and Supabase CLI temporary project metadata.
- The authenticated dashboard was not opened against the user's Supabase account during this pass, so existing user records were not accessed for visual review.
