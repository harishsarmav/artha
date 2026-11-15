# DhanView YouTube demo: recording brief

## Generated video

- The local renderer creates a 16:9 1080p captioned video of about 49 seconds. It prefers H.264 MP4 when the browser supports it and falls back to WebM.
- The earlier WebM had only a few captured frames and may not play reliably; rerender after updating this project.
- The generated clip is silent. The voice-over text below is ready to record or add during editing.
- The slides use a recreated DhanView-style interface and fictional figures rather than a signed-in account recording.
- Label every sample figure as illustrative.

## Render and play locally

1. Run `node marketing/demo-video/render-server.mjs` from the project root.
2. Open `http://127.0.0.1:4178/` in current Edge or Chrome and select **Render and save 1080p video**. Keep the tab open for about a minute.
3. Open `marketing/demo-video/play-demo.html` in Edge or Chrome. It plays the MP4 if created, then falls back to WebM.

## Voice-over and shot list

### 0:00–0:10 — Opening

**On screen:** DhanView wordmark, then the dashboard.

**Voice-over:** “Meet DhanView: a personal finance workspace that helps you see your money clearly, plan ahead, and understand the numbers behind each decision.”

### 0:10–0:32 — One financial overview

**On screen:** Dashboard summary, with the demo account’s cash flow and planning cards.

**Voice-over:** “Start with a clear view of the information you choose to enter. DhanView brings income, spending, savings, debt, investments, insurance, and goals together in one place.”

### 0:32–0:55 — Record spending over time

**On screen:** Add a fictional transaction, select a month and category, then show the monthly and yearly history/trend view.

**Voice-over:** “Record transactions by date and category. Monthly and yearly views help you spot patterns and plan for future costs. The projections are based on the records you enter; they are not market forecasts.”

### 0:55–1:17 — Plan a goal

**On screen:** Add or open a fictional goal and show the calculated monthly contribution.

**Voice-over:** “Turn a goal into a practical plan. The financial engine calculates the contribution needed from the target, current amount, and timeline you provide.”

### 1:17–1:40 — Explore a scenario

**On screen:** Adjust an illustrative monthly savings amount in the scenario lab and show how the result changes.

**Voice-over:** “Try a what-if scenario before changing your real plan. See how a different monthly amount could affect the timeline, using the assumptions shown in the app.”

### 1:40–2:05 — Ask for an explanation

**On screen:** Ask a generic question using fictional demo data; show the response and the deterministic financial review option.

**Voice-over:** “When you want an explanation, DhanView combines its deterministic calculations with AI guidance. The engine supplies the financial facts; AI helps explain them. Guidance is educational, and you should verify product-specific decisions independently.”

### 2:05–2:20 — Close

**On screen:** Dashboard and DhanView name; show the real public website address only after launch is verified.

**Voice-over:** “DhanView. A clearer view of your money, and a more thoughtful way to plan what comes next.”

## Before recording

1. Create a dedicated demo login and enter only invented names, dates, merchants, balances, and goals. Do not use a real account, real email address, or copied financial records.
2. Use a demo environment/project if available. If the production backend must be used, keep the account isolated and remove its sample records after recording.
3. Confirm that demo AI requests use non-sensitive fictional data. AI guidance requests send calculated financial facts and the question to the configured AI provider; transaction categorization can send the transaction description and type when AI classification is used.
4. Close password managers, email, notifications, terminals, browser developer tools, and any tab showing Supabase, GitHub secrets, environment files, or personal information.
5. Use a clean browser profile, hide bookmarks, and check the address bar and account menu before capture.
6. Review the entire recording frame-by-frame before uploading. Blur or cut any accidental personal detail, token, project secret, or internal URL.
7. Add captions and a short description explaining that figures are fictional and guidance is educational. Do not claim live stock/news data, bank connections, or guaranteed financial outcomes unless those features are actually available and verified.

## Current product/privacy notes for the video

- The demo should describe entries as user-provided records, not automatic bank imports.
- Do not show real portfolio or account data. The public website being viewable does not make signed-in financial records public by itself; the deployed Supabase grants and row-level policies must still be correct.
- A Supabase publishable key and project URL are expected to be visible in a browser build. Never show or publish a Supabase secret/service-role key, database password, or AI provider key.
- The app's AI gateway sends a minimized calculated financial summary plus the question to the configured provider. Review that provider's data-processing and retention terms and disclose this transfer to users before public launch.
