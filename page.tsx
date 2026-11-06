"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ReleaseNotesPage() {
  useEffect(() => {
    let savedTheme: string | null = null;
    try { savedTheme = window.localStorage.getItem("artha-theme"); } catch { /* Use the system preference when browser storage is unavailable. */ }
    const theme = savedTheme === "dark" || savedTheme === "light"
      ? savedTheme
      : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
  }, []);

  return (
    <main className="releasePage">
      <header className="releaseHeader">
        <Link className="releaseBrand" href="/" aria-label="Artha Compass home"><span aria-hidden="true">✦</span> Artha Compass</Link>
        <Link className="releaseBack" href="/">Back to Artha <span aria-hidden="true">↗</span></Link>
      </header>

      <section className="releaseHero" aria-labelledby="release-title">
        <p className="eyebrow">A CLEAR RECORD OF WHAT&apos;S NEW</p>
        <h1 id="release-title">Release notes</h1>
        <p>Updates to your financial workspace, planning tools, and the way Artha helps you make sense of your money.</p>
      </section>

      <section className="releaseList" aria-label="Artha product updates">
        <article className="releaseEntry releaseLatest">
          <div className="releaseMeta"><time dateTime="2026-11-06">6 November 2026</time><span>Latest update</span></div>
          <h2>Calculations start with your information</h2>
          <p className="releaseSummary">Artha Compass no longer fills in personal planning assumptions or a sample savings amount for you.</p>
          <ul>
            <li>Age, risk profile, investment horizon, and primary goal stay unset until you provide them.</li>
            <li>Dashboard health and cash-flow views show what information is missing instead of presenting zero-based results as financial conclusions.</li>
            <li>Your financial records save to your account when you submit their forms. A changed scenario amount is remembered only in this browser.</li>
            <li>The dashboard greets you by your account name and uses the Artha Compass name with a quieter deep-teal header.</li>
          </ul>
        </article>

        <article className="releaseEntry">
          <div className="releaseMeta"><time dateTime="2026-09-30">30 September 2026</time><span>Visual refresh</span></div>
          <h2>A calmer, clearer Artha</h2>
          <p className="releaseSummary">A visual refresh focused on trust, readability, and everyday use.</p>
          <ul>
            <li>Updated the dashboard, navigation, cards, charts, and forms around Artha&apos;s deep teal, soft green, and warm ivory palette.</li>
            <li>Added a light and dark theme control. Your choice is saved in this browser as a display preference.</li>
            <li>Improved small-screen layouts, keyboard focus visibility, and reduced-motion support.</li>
          </ul>
        </article>

        <article className="releaseEntry">
          <div className="releaseMeta"><span>Artha v0.7</span><span>Planning foundation</span></div>
          <h2>Plan around the decisions that matter</h2>
          <p className="releaseSummary">A planning hub connects common life decisions to Artha&apos;s existing financial picture.</p>
          <ul>
            <li>Explore Home, Car, Goals, Debt, Financial Safety, and Retirement planning from one place.</li>
            <li>Move from a planning prompt to the existing AI Coach, with missing details and assumptions called out.</li>
            <li>Keep financial calculations in Artha&apos;s deterministic engine and account data in the existing Supabase-backed workspace.</li>
          </ul>
        </article>
      </section>

      <p className="releasePrivacy">Artha Compass release notes describe product changes only. They do not access or display your financial records.</p>
      <footer className="releaseFooter"><span>Artha Compass · Personal finance &amp; planning</span><Link href="/auth/">Sign in or create an account</Link></footer>
    </main>
  );
}
