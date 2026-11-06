# Artha v0.6

Artha is a personal finance workspace built around one core rule: **the Financial Engine calculates facts; AI explains them.**

## Included in v0.6

- Supabase email/password authentication and persistent profiles
- PostgreSQL persistence for income, expenses, investments, loans, insurance, goals and transactions
- Row Level Security so a signed-in user only sees their own rows
- Automatic migration of the v0.5 localStorage prototype into the signed-in account when the database is empty
- Deterministic cash-flow, savings rate, debt-service, emergency-fund, investment and goal calculations
- Twelve-month run-rate projection (not a market prediction)
- Scenario lab for extra monthly savings
- Financial summaries stay in an unconfigured state until the user has entered relevant data; profile assumptions are not prefilled
- Portfolio records are saved only when their forms are submitted; a changed scenario amount is stored locally in that browser
- Transaction entry and AI/deterministic categorization
- AI coach, financial review and scenario explanation through one gateway contract
- Local Ollama gateway for development
- Supabase Edge Function gateway for production
- Account/security menu with password change and local-session sign out
- Responsive dashboard for desktop, tablet and mobile

## Local setup

1. Copy `.env.local.example` to `.env.local` and add the Supabase URL and publishable key.
2. Run `supabase/migrations/001_artha_v06.sql` in the Supabase SQL editor.
3. Run `supabase/migrations/002_security_hardening.sql` to enable AI usage RLS and install the atomic server-enforced quota.
4. Run `supabase/migrations/003_schema_alignment_and_rls.sql` to align legacy field names and rebuild owner-only policies. Back up first.
5. Make sure Auth > URL Configuration includes your local URL (`http://localhost:3000`) and GitHub Pages URL (`https://harishsarmav.github.io/artha/`). For email confirmation, the GitHub Pages build uses `/artha/auth` as the callback path.
6. Install dependencies with `npm install`, then run `npm audit`.
7. Start the app with `npm run dev`.
8. For local AI, start Ollama and run `npm run ai` in another terminal. The dashboard uses `http://localhost:8787/api/coach` automatically while running on localhost.

## Production AI gateway

Deploy the `supabase/functions/artha-ai` function. The function verifies the user's bearer token, reads that user's data under RLS, recalculates financial facts on the server, then calls an optional OpenAI-compatible provider.

Set production secrets in Supabase Edge Function secrets, for example:

- `AI_PROVIDER=openai_compatible`
- `AI_BASE_URL=https://api.openai.com/v1`
- `AI_MODEL=YOUR_MODEL`
- `AI_API_KEY=YOUR_SERVER_SIDE_KEY`
- `ALLOWED_ORIGINS=https://harishsarmav.github.io,http://localhost:3000,http://127.0.0.1:3000`

Never put `AI_API_KEY` in `.env.local` variables prefixed with `NEXT_PUBLIC_`, and never ship it in the GitHub Pages bundle.

Set `NEXT_PUBLIC_AI_ENDPOINT` during the GitHub Pages build to:

`https://YOUR_PROJECT.supabase.co/functions/v1/artha-ai`

Without an external AI key, the gateway still returns deterministic engine-based guidance for supported questions and deterministic categorization, so the product remains usable.

## GitHub Pages

The static deployment workflow builds with `/artha` as the base path. Create these repository Variables in GitHub → Settings → Secrets and variables → Actions → Variables:

- `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = your Supabase publishable key
- `NEXT_PUBLIC_AI_ENDPOINT` = `https://YOUR_PROJECT.supabase.co/functions/v1/artha-ai`

The publishable key is intended for browser use when Row Level Security is enabled; never put a secret/service-role key in the client bundle.

## Notes on the numbers

The dashboard never adds loan EMI twice. Monthly outflow is living expenses + debt payments + investment contributions. The emergency-fund target uses essential recurring expenses plus debt payments. The 12-month outlook assumes today's recurring values stay constant; it does not forecast market returns or future salary changes.


## Security and privacy

- Public GitHub Pages configuration may contain only the Supabase project URL and publishable/anon key. Never expose a service-role key, database password, AI provider key, or private token in browser code or `NEXT_PUBLIC_*` variables.
- Database tables use owner-scoped RLS. The `ai_usage` table is read-only to authenticated users; writes are permitted only through the authenticated quota RPC.
- Production AI requests send the question and mode to the Edge Function. The Edge Function retrieves the signed-in user's own records under RLS; the browser does not send a second copy of the financial dataset.
- AI guidance sends calculated financial summaries to the configured AI provider. Goal names are anonymized before provider submission; login credentials and raw database rows are not sent. Do not configure an AI provider unless you accept that processing. Use deterministic mode by leaving the provider API key unset.
- The public Supabase test page and unused Next.js API route have been removed.


## Supabase Free plan availability

Supabase Free projects may pause after a period of inactivity. Artha does not run artificial keep-alive pings or background scripts. This is a Supabase plan limitation, not a frontend bug. For uninterrupted production availability, move the project to a paid Supabase plan; otherwise resume it from the Supabase dashboard when needed and keep independent backups.
