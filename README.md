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
- Transaction entry and AI/deterministic categorization
- AI coach, financial review and scenario explanation through one gateway contract
- Local Ollama gateway for development
- Supabase Edge Function gateway for production
- Account/security menu with password change and local-session sign out
- Responsive dashboard for desktop, tablet and mobile

## Local setup

1. Copy `.env.local.example` to `.env.local` and add the Supabase URL and publishable key.
2. Run the SQL in `supabase/migrations/001_artha_v06.sql` in the Supabase SQL editor.
3. Make sure Auth > URL Configuration includes your local URL (`http://localhost:3000`) and GitHub Pages URL (`https://harishsarmav.github.io/artha/`). For email confirmation, the GitHub Pages build uses `/artha/auth` as the callback path.
4. Install dependencies with `npm install`. This v0.6 bundle intentionally does not include a stale lockfile; npm will generate a lockfile for your environment.
5. Start the app with `npm run dev`.
6. For local AI, start Ollama and run `npm run ai` in another terminal. The dashboard uses `http://localhost:8787/api/coach` automatically while running on localhost.

## Production AI gateway

Deploy the `supabase/functions/artha-ai` function. The function verifies the user's bearer token, reads that user's data under RLS, recalculates financial facts on the server, then calls an optional OpenAI-compatible provider.

Set production secrets in Supabase Edge Function secrets, for example:

- `AI_PROVIDER=openai_compatible`
- `AI_BASE_URL=https://api.openai.com/v1`
- `AI_MODEL=YOUR_MODEL`
- `AI_API_KEY=YOUR_SERVER_SIDE_KEY`

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
