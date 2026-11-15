"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ReleaseNotesPage() {
  useEffect(() => {
    let savedTheme: string | null = null;
    try { savedTheme = window.localStorage.getItem("artha-theme"); } catch { /* Use the system preference when browser storage is unavailable. */ }
    const systemPreference = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const theme = savedTheme === "dark" || savedTheme === "light"
        ? savedTheme
        : systemPreference.matches ? "dark" : "light";
      document.documentElement.dataset.theme = theme;
    };
    applyTheme();
    systemPreference.addEventListener("change", applyTheme);
    return () => systemPreference.removeEventListener("change", applyTheme);
  }, []);

  return (
    <main className="releasePage">
      <header className="releaseHeader">
        <Link className="releaseBrand" href="/" aria-label="DhanView home"><span aria-hidden="true">✦</span> DhanView</Link>
        <Link className="releaseBack" href="/">Back to DhanView <span aria-hidden="true">↗</span></Link>
      </header>

      <section className="releaseHero" aria-labelledby="release-title">
        <p className="eyebrow">A CLEAR RECORD OF WHAT&apos;S NEW</p>
        <h1 id="release-title">Release notes</h1>
        <p>Updates to your financial workspace, planning tools, and the way DhanView helps you make sense of your money.</p>
      </section>

      <section className="releaseList" aria-label="DhanView product updates">
        <article className="releaseEntry releaseLatest">
          <div className="releaseMeta"><time dateTime="2026-11-15">15 November 2026</time><span>AI setup</span></div>
          <h2>Choose the AI gateway for local development</h2>
          <p className="releaseSummary">A configured AI endpoint now works on localhost too. Use the Supabase Edge Function for cloud AI, or point the endpoint to the optional local Ollama gateway.</p>
          <ul>
            <li>Local AI status distinguishes a missing provider key, unavailable Ollama model, and an answer rejected by fact checks.</li>
            <li>When AI is unavailable or unverified, DhanView labels its deterministic fallback.</li>
          </ul>
        </article>

        <article className="releaseEntry releaseLatest">
          <div className="releaseMeta"><time dateTime="2026-11-15">15 November 2026</time><span>Debt guidance</span></div>
          <h2>Debt questions use recorded loan details</h2>
          <p className="releaseSummary">Debt guidance can now compare recorded balances, rates, EMIs, and remaining terms. It identifies missing prepayment details rather than making up scenario results.</p>
          <ul>
            <li>Only anonymized loan type and repayment fields are included for debt-related AI questions.</li>
            <li>If a response fails fact checks, engine guidance lists available loans and explains what is needed for a prepayment estimate.</li>
          </ul>
        </article>

        <article className="releaseEntry releaseLatest">
          <div className="releaseMeta"><time dateTime="2026-11-15">15 November 2026</time><span>AI Coach</span></div>
          <h2>A cleaner AI Coach, separate from Planning</h2>
          <p className="releaseSummary">Planning decisions stay in Planning. The AI Coach now offers three compact starting questions about this month, spending patterns, and cash flow.</p>
          <ul>
            <li>Answers that fail fact and number checks fall back to deterministic Financial Engine guidance.</li>
            <li>Copy a response or press Ctrl+Enter / Cmd+Enter to ask with your financial context.</li>
          </ul>
        </article>

        <article className="releaseEntry releaseLatest">
          <div className="releaseMeta"><time dateTime="2026-11-15">15 November 2026</time><span>Accessibility and reliability</span></div>
          <h2>System theme and clearer dark surfaces</h2>
          <p className="releaseSummary">DhanView follows your device theme by default, with improved text and control contrast across dialogs, alerts, and planning cards.</p>
          <ul>
            <li>AI schema errors now show a database error code and the migration sequence needed to resolve missing fields.</li>
            <li>A safe, additive Supabase migration backfills known legacy loan and insurance values.</li>
          </ul>
        </article>

        <article className="releaseEntry releaseLatest">
          <div className="releaseMeta"><time dateTime="2026-11-15">15 November 2026</time><span>Planning visuals</span></div>
          <h2>Planning cards now have their own illustrations</h2>
          <p className="releaseSummary">Home, car, goals, debt, financial safety, and retirement cards use coordinated editorial artwork with text-safe fades.</p>
          <ul>
            <li>Images are stored with the app and served locally, with no third-party image requests.</li>
            <li>Light and dark themes keep the card copy readable over the artwork.</li>
          </ul>
        </article>

        <article className="releaseEntry releaseLatest">
          <div className="releaseMeta"><time dateTime="2026-11-15">15 November 2026</time><span>Dashboard clarity</span></div>
          <h2>A more focused portfolio view</h2>
          <p className="releaseSummary">Income, expenses, investments, loans, insurance, and goals now share one compact Portfolio panel with category tabs and on-demand record management.</p>
          <ul>
            <li>The 12-month cash-flow run-rate sits with Financial Health, without the repetitive month bars.</li>
            <li>Scenario Lab compares spare cash with the combined monthly amount needed across goals, and shows the investment contribution already included.</li>
            <li>Use one dated entry form with a category and source to review actual activity by month.</li>
            <li>Recurring plan amounts remain separate so they can continue to support cash-flow calculations.</li>
          </ul>
        </article>

        <article className="releaseEntry releaseLatest">
          <div className="releaseMeta"><time dateTime="2026-11-15">15 November 2026</time><span>Spending insights</span></div>
          <h2>Follow spending month by month</h2>
          <p className="releaseSummary">Transaction entries can now be reviewed across months and years to help you spot patterns and plan ahead.</p>
          <ul>
            <li>Choose a transaction date, then filter the spending chart and entries by month or year.</li>
            <li>See total spending, average spending in recorded months, and a simple 12-month run-rate after enough history exists.</li>
            <li>Months without entries are shown as unrecorded, not treated as zero. The run-rate is an estimate, not a prediction.</li>
          </ul>
        </article>

        <article className="releaseEntry releaseLatest">
          <div className="releaseMeta"><time dateTime="2026-11-15">15 November 2026</time><span>Entry tracking</span></div>
          <h2>One dated entry, organized by month</h2>
          <p className="releaseSummary">Record income or spending once with a date, category, and source, then review, edit, or remove it from the monthly history.</p>
          <ul>
            <li>New entries refresh the selected year&apos;s history after Supabase confirms the save.</li>
            <li>If a save fails, the form stays open and shows a safe, actionable error instead of hiding it behind the dialog.</li>
            <li>The separate recurring plan remains available for monthly cash-flow calculations.</li>
          </ul>
        </article>

        <article className="releaseEntry releaseLatest">
          <div className="releaseMeta"><time dateTime="2026-11-15">15 November 2026</time><span>Numbers-first coaching</span></div>
          <h2>AI that explains your plan, not just your prompt</h2>
          <p className="releaseSummary">DhanView's Financial Engine remains responsible for the calculations; the coach explains what they mean across connected life decisions.</p>
          <ul>
            <li>Home, car, debt, safety, goals and retirement planning use one financial picture.</li>
            <li>Missing information and assumptions are made visible so guidance can be reviewed instead of taken on trust.</li>
          </ul>
        </article>

        <article className="releaseEntry releaseLatest">
          <div className="releaseMeta"><time dateTime="2026-11-15">15 November 2026</time><span>Privacy and security</span></div>
          <h2>More control over your financial data</h2>
          <p className="releaseSummary">DhanView makes data sharing more deliberate and keeps the dark theme close to black.</p>
          <ul>
            <li>Older browser data stays on this device unless you choose to import it into your account.</li>
            <li>AI analysis uses only the account fields needed for calculations; transaction descriptions are not included.</li>
            <li>Dark mode now uses neutral near-black surfaces with teal accents.</li>
          </ul>
        </article>

        <article className="releaseEntry releaseLatest">
          <div className="releaseMeta"><time dateTime="2026-11-15">15 November 2026</time><span>Brand update</span></div>
          <h2>Dhanive is now DhanView</h2>
          <p className="releaseSummary">The dashboard, sign-in pages, AI coach, and browser title now use DhanView. Your account, financial data, calculations, and Supabase integration continue to work as before.</p>
          <ul>
            <li>The npm package name now matches the product name.</li>
            <li>Existing deployment paths, Supabase function names, and saved browser data keys remain unchanged.</li>
          </ul>
        </article>

        <article className="releaseEntry">
          <div className="releaseMeta"><time dateTime="2026-11-15">15 November 2026</time><span>Profile reliability</span></div>
          <h2>Profile settings save more reliably</h2>
          <p className="releaseSummary">Profile changes now save through one account-owned upsert, including accounts whose profile row was not created at signup.</p>
          <ul>
            <li>Profile updates remain scoped to the signed-in user.</li>
            <li>If Supabase blocks a save, DhanView shows a safe error code and the next step without displaying entered values.</li>
            <li>Profile changes continue to follow the account&apos;s existing Supabase access policies.</li>
            <li>Authentication network failures show retry guidance instead of an unhandled Next.js error overlay.</li>
          </ul>
        </article>

        <article className="releaseEntry">
          <div className="releaseMeta"><time dateTime="2026-11-06">6 November 2026</time><span>Planning defaults</span></div>
          <h2>Calculations start with your information</h2>
          <p className="releaseSummary">DhanView no longer fills in personal planning assumptions or a sample savings amount for you.</p>
          <ul>
            <li>Age, risk profile, investment horizon, and primary goal stay unset until you provide them.</li>
            <li>Dashboard health and cash-flow views show what information is missing instead of presenting zero-based results as financial conclusions.</li>
            <li>Your financial records save to your account when you submit their forms. A changed scenario amount is remembered only in this browser.</li>
            <li>The dashboard greets you by your account name and introduced a quieter deep-teal Artha Compass header.</li>
          </ul>
        </article>

        <article className="releaseEntry">
          <div className="releaseMeta"><time dateTime="2026-09-30">30 September 2026</time><span>Visual refresh</span></div>
          <h2>A calmer, clearer DhanView</h2>
          <p className="releaseSummary">A visual refresh focused on trust, readability, and everyday use.</p>
          <ul>
            <li>Updated the dashboard, navigation, cards, charts, and forms around DhanView&apos;s deep teal, soft green, and warm ivory palette.</li>
            <li>Added a light and dark theme control. Your choice is saved in this browser as a display preference.</li>
            <li>Improved small-screen layouts, keyboard focus visibility, and reduced-motion support.</li>
          </ul>
        </article>

        <article className="releaseEntry">
          <div className="releaseMeta"><span>DhanView v0.7</span><span>Planning foundation</span></div>
          <h2>Plan around the decisions that matter</h2>
          <p className="releaseSummary">A planning hub connects common life decisions to DhanView&apos;s existing financial picture.</p>
          <ul>
            <li>Explore Home, Car, Goals, Debt, Financial Safety, and Retirement planning from one place.</li>
            <li>Move from a planning prompt to the existing AI Coach, with missing details and assumptions called out.</li>
            <li>Keep financial calculations in DhanView&apos;s deterministic engine and account data in the existing Supabase-backed workspace.</li>
          </ul>
        </article>
      </section>

      <p className="releasePrivacy">DhanView release notes describe product changes only. They do not access or display your financial records.</p>
      <footer className="releaseFooter"><span>DhanView · Personal finance &amp; planning</span><Link href="/auth/">Sign in or create an account</Link></footer>
    </main>
  );
}
