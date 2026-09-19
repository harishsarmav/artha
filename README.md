# Artha v0.4 — Your AI Financial Coach

Local-first Next.js app using Ollama (`gpt-oss:20b`) for the AI Coach.

## Features
- Ready-made AI Coach prompts that paste into the question box
- Custom questions
- Markdown/GFM AI response rendering
- Income: salary, rental, freelance, business, interest, dividend, pension, capital gains
- Editable/deletable expenses
- Investments: mutual funds, ELSS, SIP, stocks, ETFs, FD, PPF, NPS, bonds, gold
- Investment invested/current value and deterministic gain/loss
- Loans and EMIs
- Insurance cover tracking
- Financial goals and progress
- Cash flow and savings rate
- Responsive mobile layout
- localStorage persistence

## Run

Node 20+ and Ollama required.

```powershell
npm install
ollama pull gpt-oss:20b
npm run dev
```
Open http://localhost:3000

## Ollama check

```powershell
curl http://localhost:11434/api/tags
```

## Architecture
Browser → Next `/api/coach` → AI gateway logic → Ollama.

The finance calculations are deterministic; AI explains the structured context.

## Next production step
Add Supabase Auth/Postgres/RLS for accounts and cloud sync, then move the AI gateway to a hosted backend for mobile/GitHub Pages. Bank aggregation is intentionally not included yet.
