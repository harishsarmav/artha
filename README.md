# DhanView v0.7

DhanView is a personal finance workspace built around one core rule: **the Financial Engine calculates facts; AI explains them.**

## Included in v0.7

- Supabase email/password authentication and persistent profiles
- PostgreSQL persistence for income, expenses, investments, loans, insurance, goals and transactions
- Row Level Security so a signed-in user only sees their own rows
- Optional, user-confirmed migration of v0.5 local browser data into the signed-in account
- Deterministic cash-flow, savings rate, debt-service, emergency-fund, investment and goal calculations
- Twelve-month run-rate projection (not a market prediction)
- Scenario lab for extra monthly savings
- Financial summaries stay in an unconfigured state until the user has entered relevant data; profile assumptions are not prefilled
- Portfolio records are saved only when their forms are submitted; a changed scenario amount is stored locally in that browser
- Transaction entry and AI/deterministic categorization
- Local CSV import for bank/card transaction history, with column mapping, a preview, date/type checks, duplicate matching, and explicit save; files remain in the browser until confirmed
- PDF statements are not parsed; export PDF statements to CSV through the bank/card provider before importing
- Month and year transaction views with recorded-spend trends, average active-month spending and a clearly labeled annualized run-rate
- AI coach positioning built around deterministic calculations, connected life planning and explicit unknowns
- AI coach, financial review and scenario explanation through one gateway contract
- Fact-grounding checks on AI output; responses that fail cited-key or numeric checks fall back to deterministic Financial Engine guidance
- Copyable AI responses and Ctrl+Enter / Cmd+Enter prompt submission
- Local Ollama gateway for development
- Supabase Edge Function gateway for production
- Account/security menu with password change and local-session sign out
- Responsive dashboard for desktop, tablet and mobile

## Local setup

1. Copy `.env.local.example` to `.env.local` and add the Supabase URL and publishable key.
2. Run `supabase/migrations/001_artha_v06.sql` in the Supabase SQL editor.
3. Run `supabase/migrations/002_security_hardening.sql` to enable AI usage RLS and install the atomic server-enforced quota.
4. Run `supabase/migrations/003_schema_alignment_and_rls.sql` to align legacy field names and rebuild owner-only policies. Back up first.
5. Run `supabase/migrations/004_ai_required_fields.sql` to safely add/backfill the canonical loan and insurance fields the AI function reads. It does not delete data or change RLS.
6. Make sure Auth > URL Configuration includes your local URL (`http://localhost:3000`) and GitHub Pages URL (`https://harishsarmav.github.io/artha/`). For email confirmation, the GitHub Pages build uses `/artha/auth` as the callback path.
7. Install the reviewed lockfile with `npm ci`, then run `npm audit --audit-level=high`.
8. Start the app with `npm run dev`.
9. On localhost, the dashboard uses `NEXT_PUBLIC_AI_ENDPOINT` when set. To use the Supabase Edge Function, set that value to `https://YOUR_PROJECT.supabase.co/functions/v1/artha-ai` and allow `http://localhost:3000` in its `ALLOWED_ORIGINS`. To use local Ollama instead, set it to `http://localhost:8787/api/coach`, start Ollama, and run `npm run ai` in another terminal. `npm run ai` is only needed while using that local gateway.

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

When the gateway falls back, the dashboard labels whether the provider is not configured, the local model is unavailable, or the answer did not pass fact checks. GitHub `NEXT_PUBLIC_*` variables configure the endpoint but do not configure the provider key; set `AI_API_KEY` only in Supabase Edge Function secrets.

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
- Sign-in never uploads legacy browser data. When an empty account and older Artha records are detected, the dashboard explains the transfer and waits for the user's explicit confirmation. The original local copy is retained.
- CSV statement files are parsed in the browser and kept in memory for preview. Nothing is saved until the user confirms; confirmed transaction rows are sent to Supabase through the signed-in session and owner-scoped RLS. PDF parsing is not included.
- The AI Edge Function fetches only fields required for its calculations. It does not fetch transaction descriptions, profile names, insurance provider names, or loan names for AI analysis.
- AI guidance sends calculated financial summaries to the configured AI provider. For debt-related questions only, anonymized loan type, balance, rate, EMI, and remaining term are included so repayment order can use recorded facts. Goal names are anonymized; login credentials and raw database rows are not sent. Do not configure an AI provider unless you accept that processing. Use deterministic mode by leaving the provider API key unset.
- AI output checks reduce unsupported user-specific claims but cannot prove every qualitative statement is correct. If the gateway response fails the checks, the app shows deterministic engine guidance instead.
- The public Supabase test page and unused Next.js API route have been removed.


## Supabase Free plan availability

Supabase Free projects may pause after a period of inactivity. DhanView does not run artificial keep-alive pings or background scripts. This is a Supabase plan limitation, not a frontend bug. For uninterrupted production availability, move the project to a paid Supabase plan; otherwise resume it from the Supabase dashboard when needed and keep independent backups.
