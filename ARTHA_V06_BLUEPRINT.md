# Artha v0.6 — Intelligent Financial Platform

## Product architecture

```text
GitHub Pages frontend
  ↓
Supabase Auth + Postgres + RLS
  ↓
Deterministic Financial Engine
  ↓
AI Gateway (Supabase Edge Function)
  ↓
Optional external AI provider
```

Local development uses:

```text
Next.js frontend → localhost:8787 → Ollama
```

## Source-of-truth rule

The Financial Engine is the source of truth for arithmetic. AI receives calculated facts and explains, summarizes, compares scenarios and answers questions. AI must not invent or silently recalculate financial facts.

## v0.6 feature set

### Identity and data
- Signup/login/session
- Supabase profiles
- RLS-protected financial tables
- Profile settings
- Account & security
- Local-session sign out
- One-time localStorage → Supabase migration

### Financial data
- Income
- Recurring expenses
- Investments
- Loans/debt
- Insurance policies
- Financial goals
- Transactions

### Financial Engine
- Frequency normalization
- Monthly income/outflow/free cash flow
- Savings rate
- Investment contribution rate
- Debt-service ratio
- Investment gain/loss
- Outstanding debt
- Cash savings
- Emergency-fund 3–6 month target
- Goal contribution requirement
- Tracked net worth (cash + investments − debt)
- Asset allocation summary
- Twelve-month run-rate cash-flow projection

### AI everywhere
- Conversational coach
- Financial review
- Scenario explanation
- Transaction categorization
- Deterministic fallback when no provider key is configured

## Security model

Browser code only contains Supabase publishable credentials. RLS protects user-owned rows. Production AI provider secrets live only in Edge Function secrets. The Edge Function ignores client-supplied financial totals and recalculates the user's facts from the database before calling the AI provider.

