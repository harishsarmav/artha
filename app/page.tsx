"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "./lib/supabase";
import { calculateFinancials } from "./lib/financial-engine";
import { prompts } from "./lib/prompts";
import { TransactionCsvImport } from "./components/TransactionCsvImport";
import type { ImportedTransaction } from "./lib/transaction-csv";

type Profile = { id: string; name: string; age: number; dependents: number; country: string; riskProfile: string; investmentHorizon: string; primaryGoal: string; lifeCover: number; healthCover: number; cashSavings: number };
type Income = { id: string; name: string; type: string; amount: number; frequency: string };
type Expense = { id: string; name: string; category: string; amount: number; frequency: string };
type Investment = { id: string; name: string; type: string; category: string; mode: string; monthlyAmount: number; investedAmount: number; currentValue: number; startDate: string | null };
type Loan = { id: string; name: string; type: string; originalAmount: number; outstanding: number; emi: number; interestRate: number; tenureMonths: number };
type Insurance = { id: string; type: string; provider: string; coverage: number; premium: number; frequency: string; renewalDate: string | null };
type Goal = { id: string; name: string; targetAmount: number; currentAmount: number; targetDate: string };
type Transaction = { id: string; transactionDate: string; description: string; amount: number; transactionType: string; category: string; source: string };

type FormState = Record<string, string | number>;
type ModalType = "profile" | "security" | "income" | "expense" | "investment" | "loan" | "insurance" | "goal" | "transaction" | "scenario" | "";

const money = (n: number) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const numberValue = (v: string | number | null | undefined) => Number(v) || 0;
const profileDefaults: Omit<Profile, "id"> = { name: "", age: 0, dependents: 0, country: "", riskProfile: "", investmentHorizon: "", primaryGoal: "", lifeCover: 0, healthCover: 0, cashSavings: 0 };
const frequencies = ["Monthly", "Weekly", "Quarterly", "Half-yearly", "Yearly"];
const incomeTypes = ["Salary", "Rental", "Freelance", "Business", "Interest", "Dividend", "Pension", "Capital gains", "Other"];
const expenseCategories = ["Housing", "Food", "Transport", "Utilities", "Healthcare", "Insurance", "Education", "Shopping", "Entertainment", "Subscriptions", "Other"];
const investmentTypes = ["Mutual Fund", "ELSS", "Stock", "ETF", "FD", "PPF", "NPS", "Bond", "Gold", "Other"];
const investmentCategories = ["Equity", "Debt", "Hybrid", "Cash", "Gold", "Real Estate", "Other"];
const loanTypes = ["Home Loan", "Car Loan", "Personal Loan", "Education Loan", "Credit Card", "Two-wheeler Loan", "Other"];
const insuranceTypes = ["Life / Term", "Health", "Personal Accident", "Other"];
const goalTypes = ["Emergency fund", "Marriage", "Home", "Education", "Vehicle", "Retirement", "Travel", "Other"];
const planningBackgrounds = ["home.webp", "car.webp", "goals.webp", "debt.webp", "safety.webp", "retirement.webp"];
const LOCAL_AI_ENDPOINT = "http://localhost:8787/api/coach";
function getAiTarget() {
  const configuredEndpoint = process.env.NEXT_PUBLIC_AI_ENDPOINT?.trim();
  if (configuredEndpoint) return configuredEndpoint;
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    return LOCAL_AI_ENDPOINT;
  }
  return "";
}

function normalizeProfile(row: any, fallbackName = "") : Profile {
  return { id: row?.user_id ?? row?.id ?? "", name: String(row?.full_name || row?.name || fallbackName || "").trim(), age: numberValue(row?.age), dependents: numberValue(row?.dependents), country: row?.country ?? "", riskProfile: row?.risk_profile ?? row?.riskProfile ?? "", investmentHorizon: row?.investment_horizon ?? row?.investmentHorizon ?? "", primaryGoal: row?.primary_goal ?? row?.primaryGoal ?? "", lifeCover: numberValue(row?.life_cover ?? row?.lifeCover), healthCover: numberValue(row?.health_cover ?? row?.healthCover), cashSavings: numberValue(row?.cash_savings ?? row?.cashSavings) };
}
function profileSaveErrorMessage(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code || "")
    : "";
  if (code === "42501") return "Profile not saved (42501): Supabase row security denied the write. Check that signed-in users can update only their own profile row.";
  if (code === "PGRST204" || code === "PGRST205") return `Profile not saved (${code}): Supabase's API schema is missing a profile field or table. Refresh its schema cache and check that the app uses the updated project.`;
  if (code === "23505") return "Profile not saved (23505): The profile row already exists but could not be updated. Refresh the app and try again.";
  return code
    ? `Profile not saved (${code}). Check the Supabase profile schema and access policies, then try again.`
    : "Profile not saved. Check your connection and Supabase profile access, then try again.";
}
function recordSaveErrorMessage(error: unknown, record: string) {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code || "")
    : "";
  if (code === "42501") return `${record} was not saved: your account does not have permission to write this record. Check the Supabase owner policies. (42501)`;
  if (code === "PGRST204" || code === "PGRST205") return `${record} was not saved: Supabase is missing a required table or column. Apply the current schema migrations and refresh the API schema cache. (${code})`;
  if (code === "23502" || code === "23503" || code === "23505" || code === "23514") return `${record} was not saved because the submitted fields do not match a database requirement. Review the fields and schema. (${code})`;
  if (code) return `${record} was not saved. Check your connection and Supabase schema, then try again. (${code})`;
  return `${record} was not saved. Check your connection and sign-in, then try again.`;
}
function mapRows<T extends Record<string, any>>(rows: T[] | null) { return (rows ?? []).map((row) => ({ ...row })); }
function todayLocalDate() { const date = new Date(); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 10); }

function AiResponse({ answer, grounding }: { answer: string; grounding: string }) {
  const [copyStatus, setCopyStatus] = useState("");
  const copyResponse = async () => {
    try {
      await navigator.clipboard.writeText(answer);
      setCopyStatus("Response copied.");
    } catch {
      setCopyStatus("Clipboard access is unavailable. Select the response text to copy it.");
    }
  };
  return <div className="output">
    <div className="outputHeader">
      <div><div className="outputTitle">DhanView says</div><small className="outputGrounding">{grounding}</small></div>
      <button className="mini" type="button" onClick={() => void copyResponse()}>Copy response</button>
    </div>
    <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown></div>
    <small className="copyStatus" role="status" aria-live="polite">{copyStatus}</small>
  </div>;
}

export default function Home() {
  const router = useRouter();
  const [sessionReady, setSessionReady] = useState(false);
  const [authConnectionError, setAuthConnectionError] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [saveBusy, setSaveBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [profileMenu, setProfileMenu] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [themeMode, setThemeMode] = useState<"system" | "light" | "dark">("system");
  const [modal, setModal] = useState<ModalType>("");
  const [edit, setEdit] = useState<any>(null);
  const [form, setForm] = useState<FormState>({});
  const [securityPassword, setSecurityPassword] = useState("");
  const [securityConfirm, setSecurityConfirm] = useState("");
  const [profile, setProfile] = useState<Profile>({ id: "", ...profileDefaults });
  const [authEmail, setAuthEmail] = useState("");
  const [legacyDataAvailable, setLegacyDataAvailable] = useState(false);
  const [legacyImportBusy, setLegacyImportBusy] = useState(false);
  const [income, setIncome] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showAllIncome, setShowAllIncome] = useState(false);
  const [showAllExpenses, setShowAllExpenses] = useState(false);
  const [showAllInvestments, setShowAllInvestments] = useState(false);
  const [showAllLoans, setShowAllLoans] = useState(false);
  const [showAllGoals, setShowAllGoals] = useState(false);
  const [showAllInsurance, setShowAllInsurance] = useState(false);
  const [portfolioTab, setPortfolioTab] = useState<"income" | "expenses" | "investments" | "loans" | "insurance" | "goals">("income");
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [insurance, setInsurance] = useState<Insurance[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [spendingYear, setSpendingYear] = useState(new Date().getFullYear());
  const [spendingMonth, setSpendingMonth] = useState("all");
  const [yearTransactions, setYearTransactions] = useState<Transaction[]>([]);
  const [yearTransactionsLoading, setYearTransactionsLoading] = useState(false);
  const [yearTransactionsError, setYearTransactionsError] = useState("");
  const [yearTransactionsTruncated, setYearTransactionsTruncated] = useState(false);
  const [yearTransactionsReload, setYearTransactionsReload] = useState(0);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [answerGrounding, setAnswerGrounding] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [scenarioExtra, setScenarioExtra] = useState(0);
  const [categorizing, setCategorizing] = useState(false);

  useEffect(() => {
    let savedTheme: string | null = null;
    try { savedTheme = window.localStorage.getItem("artha-theme"); } catch { /* Use the system preference when browser storage is unavailable. */ }
    const mode = savedTheme === "dark" || savedTheme === "light" ? savedTheme : "system";
    setThemeMode(mode);
    const initialTheme = mode === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : mode;
    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
  }, []);

  useEffect(() => {
    if (themeMode !== "system") return;
    const systemPreference = window.matchMedia("(prefers-color-scheme: dark)");
    const followSystemPreference = () => {
      const nextTheme = systemPreference.matches ? "dark" : "light";
      setTheme(nextTheme);
      document.documentElement.dataset.theme = nextTheme;
    };
    followSystemPreference();
    systemPreference.addEventListener("change", followSystemPreference);
    return () => systemPreference.removeEventListener("change", followSystemPreference);
  }, [themeMode]);

  useEffect(() => {
    try {
      const savedScenario = window.localStorage.getItem("artha-scenario-extra");
      if (savedScenario !== null) setScenarioExtra(Math.max(0, numberValue(savedScenario)));
    } catch { /* Scenario values remain available for this visit if storage is unavailable. */ }
  }, []);

  const toggleTheme = () => {
    const nextMode = themeMode === "system" ? "light" : themeMode === "light" ? "dark" : "system";
    const nextTheme = nextMode === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : nextMode;
    setThemeMode(nextMode);
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    try {
      if (nextMode === "system") window.localStorage.removeItem("artha-theme");
      else window.localStorage.setItem("artha-theme", nextMode);
    } catch { /* The selected theme still applies for this visit. */ }
  };

  const closeModal = () => { setModal(""); setEdit(null); setForm({}); setSecurityPassword(""); setSecurityConfirm(""); };
  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2600); };
  const setField = (key: string, value: string | number) => setForm((old) => ({ ...old, [key]: value }));

  const loadAll = useCallback(async (userId: string, userName: string) => {
    setLoadingData(true); setError("");
    const [profileRes, incomeRes, expenseRes, investmentRes, loanRes, insuranceRes, goalRes, txRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("income").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("expenses").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("investments").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("loans").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("insurance").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("goals").select("*").eq("user_id", userId).order("target_date", { ascending: true }),
      supabase.from("transactions").select("*").eq("user_id", userId).order("transaction_date", { ascending: false }).limit(40),
    ]);
    const results = [profileRes, incomeRes, expenseRes, investmentRes, loanRes, insuranceRes, goalRes, txRes];
    const firstError = results.find((item) => item.error)?.error;
    if (firstError) throw firstError;

    const rowsEmpty = [incomeRes.data, expenseRes.data, investmentRes.data, loanRes.data, insuranceRes.data, goalRes.data, txRes.data].every((v) => !v?.length);
    const legacyKeys = ["artha-profile", "artha-income", "artha-expenses", "artha-investments", "artha-loans", "artha-goals"];
    const hasLegacy = typeof window !== "undefined" && legacyKeys.some((key) => {
      try { return window.localStorage.getItem(key) !== null; } catch { return false; }
    });
    // Legacy browser data is never transferred during sign-in. Offer an explicit,
    // user-initiated import only when the account has no portfolio records.
    setLegacyDataAvailable(rowsEmpty && hasLegacy);

    setProfile(profileRes.data ? normalizeProfile(profileRes.data, userName) : { id: userId, ...profileDefaults, name: userName });
    setIncome(mapRows(incomeRes.data).map((r: any) => ({
      id: r.id,
      name: r.name || "Income",
      type: r.type || "Other",
      amount: numberValue(r.amount),
      frequency: r.frequency || "Monthly",
    })));
    setExpenses(mapRows(expenseRes.data).map((r: any) => ({
      id: r.id,
      name: r.name || "Expense",
      category: r.category || "Other",
      amount: numberValue(r.amount),
      frequency: r.frequency || "Monthly",
    })));
    setInvestments(mapRows(investmentRes.data).map((r: any) => ({
      id: r.id,
      name: r.name || r.fund_name || "Investment",
      type: r.type || "Other",
      category: r.category || "Other",
      mode: r.mode || "Lump sum",
      monthlyAmount: numberValue(r.monthly_amount),
      investedAmount: numberValue(r.invested_amount),
      currentValue: numberValue(r.current_value),
      startDate: r.start_date,
    })));
    setLoans(mapRows(loanRes.data).map((r: any) => ({
      id: r.id,
      name: r.name || r.type || "Loan",
      type: r.type || "Other",
      originalAmount: numberValue(r.original_amount),
      outstanding: numberValue(r.outstanding),
      emi: numberValue(r.emi),
      interestRate: numberValue(r.interest_rate),
      tenureMonths: numberValue(r.tenure_months),
    })));
    setInsurance(mapRows(insuranceRes.data).map((r: any) => ({
      id: r.id,
      type: r.type || "Other",
      provider: r.provider || "",
      coverage: numberValue(r.coverage),
      premium: numberValue(r.premium),
      frequency: r.frequency || "Yearly",
      renewalDate: r.renewal_date,
    })));
    setGoals(mapRows(goalRes.data).map((r: any) => ({
      id: r.id,
      name: r.name,
      targetAmount: numberValue(r.target_amount),
      currentAmount: numberValue(r.current_amount),
      targetDate: r.target_date,
    })));
    setTransactions(mapRows(txRes.data).map((r: any) => ({
      id: r.id,
      transactionDate: r.transaction_date,
      description: r.description,
      amount: numberValue(r.amount),
      transactionType: r.transaction_type,
      category: r.category || "",
      source: r.source || "",
    })));
    setLoadingData(false);
  }, []);

  async function importLegacyData() {
    if (!legacyDataAvailable || !profile.id || legacyImportBusy) return;
    const approved = window.confirm("Import older Artha data? This copies profile and portfolio records from this browser into your signed-in DhanView Supabase account. Nothing is transferred unless you choose OK. The browser copy will be kept.");
    if (!approved) return;
    const read = (key: string) => { try { return JSON.parse(window.localStorage.getItem(key) || "null"); } catch { return null; } };
    const list = (key: string) => { const value = read(key); return Array.isArray(value) ? value.filter((row) => row && typeof row === "object") : []; };
    const oldProfile = read("artha-profile");
    const oldIncome = list("artha-income");
    const oldExpenses = list("artha-expenses");
    const oldInvestments = list("artha-investments");
    const oldLoans = list("artha-loans");
    const oldGoals = list("artha-goals");
    setLegacyImportBusy(true); setError("");
    try {
      if (oldProfile && typeof oldProfile === "object") {
        const payload = {
          id: profile.id, name: String(profile.name || oldProfile.name || "").slice(0, 120),
          age: profile.age || numberValue(oldProfile.age), dependents: profile.dependents || numberValue(oldProfile.dependents),
          country: String(profile.country || oldProfile.country || "").slice(0, 100),
          risk_profile: String(profile.riskProfile || oldProfile.risk || oldProfile.riskProfile || "").slice(0, 80),
          investment_horizon: String(profile.investmentHorizon || oldProfile.horizon || oldProfile.investmentHorizon || "").slice(0, 80),
          primary_goal: String(profile.primaryGoal || oldProfile.goal || oldProfile.primaryGoal || "").slice(0, 120),
          life_cover: profile.lifeCover || numberValue(oldProfile.lifeCover), health_cover: profile.healthCover || numberValue(oldProfile.healthCover), cash_savings: profile.cashSavings || numberValue(oldProfile.cashSavings),
        };
        const { error: profileError } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
        if (profileError) throw profileError;
      }
      const imports = [
        ["income", oldIncome.map((r) => ({ user_id: profile.id, name: String(r.name || "Income").slice(0, 120), type: String(r.type || "Other").slice(0, 80), amount: numberValue(r.amount), frequency: String(r.frequency || "Monthly").slice(0, 40) }))],
        ["expenses", oldExpenses.map((r) => ({ user_id: profile.id, name: String(r.name || "Expense").slice(0, 120), category: String(r.category || "Other").slice(0, 80), amount: numberValue(r.amount), frequency: String(r.frequency || "Monthly").slice(0, 40) }))],
        ["investments", oldInvestments.map((r) => ({ user_id: profile.id, name: String(r.name || "Investment").slice(0, 120), type: String(r.type || "Other").slice(0, 80), category: String(r.category || "Other").slice(0, 80), mode: String(r.mode || "Lump sum").slice(0, 40), monthly_amount: numberValue(r.monthlyAmount), invested_amount: numberValue(r.investedAmount), current_value: numberValue(r.currentValue), start_date: r.startDate || null }))],
        ["loans", oldLoans.map((r) => ({ user_id: profile.id, type: String(r.type || "Other").slice(0, 80), name: String(r.name || "Loan").slice(0, 120), original_amount: numberValue(r.originalAmount), outstanding: numberValue(r.outstanding), emi: numberValue(r.emi), interest_rate: numberValue(r.interestRate), tenure_months: numberValue(r.tenureMonths) }))],
        ["goals", oldGoals.filter((r) => r.targetDate).map((r) => ({ user_id: profile.id, name: String(r.name || "Goal").slice(0, 120), target_amount: numberValue(r.targetAmount), current_amount: numberValue(r.currentAmount), target_date: r.targetDate }))],
      ] as const;
      for (const [table, rows] of imports) {
        if (!rows.length) continue;
        const { error: insertError } = await supabase.from(table).insert(rows as any);
        if (insertError) throw insertError;
      }
      setLegacyDataAvailable(false);
      showToast("Older data was copied to your account. The browser copy remains here.");
      await loadAll(profile.id, profile.name);
    } catch {
      setLegacyDataAvailable(false);
      setError("The import did not finish. Some records may have reached your account; check your portfolio before trying again. Your browser copy was kept.");
    } finally { setLegacyImportBusy(false); }
  }

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!mounted) return;
        if (!data.session) { router.replace("/auth"); return; }
        setSessionReady(true);
        setAuthEmail(data.session.user.email || "");
        const name = data.session.user.user_metadata?.full_name || data.session.user.email?.split("@")[0] || "there";
        try { await loadAll(data.session.user.id, name); }
        catch { setError("Unable to load your financial data. Please check your connection and try again."); setLoadingData(false); }
      } catch {
        if (!mounted) return;
        setAuthConnectionError(true);
        setSessionReady(true);
        setLoadingData(false);
      }
    };
    bootstrap();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") router.replace("/auth"); });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, [loadAll, router]);

  useEffect(() => {
    if (!profile.id) return;
    let active = true;
    const loadYearTransactions = async () => {
      setYearTransactionsLoading(true);
      setYearTransactionsError("");
      setYearTransactionsTruncated(false);
      const startDate = `${spendingYear}-01-01`;
      const endDate = `${spendingYear + 1}-01-01`;
      const pageSize = 1000;
      const maxRows = 5000;
      const rows: any[] = [];
      try {
        for (let offset = 0; offset <= maxRows; offset += pageSize) {
          const { data, error: queryError } = await supabase
            .from("transactions")
            .select("id,transaction_date,description,amount,transaction_type,category,source")
            .eq("user_id", profile.id)
            .gte("transaction_date", startDate)
            .lt("transaction_date", endDate)
            .order("transaction_date", { ascending: false })
            .range(offset, offset + pageSize - 1);
          if (queryError) throw queryError;
          rows.push(...(data ?? []));
          if ((data?.length ?? 0) < pageSize) break;
          if (offset >= maxRows) break;
        }
        if (!active) return;
        const truncated = rows.length > maxRows;
        setYearTransactionsTruncated(truncated);
        setYearTransactions(rows.slice(0, maxRows).map((row) => ({
          id: row.id,
          transactionDate: row.transaction_date,
          description: row.description,
          amount: numberValue(row.amount),
          transactionType: row.transaction_type || "Expense",
          category: row.category || "Other",
          source: row.source || "",
        })));
      } catch {
        if (active) {
          setYearTransactions([]);
          setYearTransactionsError("Could not load this year's transaction history. Please try again.");
        }
      } finally {
        if (active) setYearTransactionsLoading(false);
      }
    };
    void loadYearTransactions();
    return () => { active = false; };
  }, [profile.id, spendingYear, yearTransactionsReload]);

  const financials = useMemo(() => calculateFinancials({
    profile: { name: profile.name, age: profile.age, dependents: profile.dependents, riskProfile: profile.riskProfile, investmentHorizon: profile.investmentHorizon, primaryGoal: profile.primaryGoal, lifeCover: profile.lifeCover, healthCover: profile.healthCover, cashSavings: profile.cashSavings },
    income, expenses, investments, loans, insurance, goals,
  }), [profile, income, expenses, investments, loans, insurance, goals]);

  const hasCashFlowInputs = income.length > 0 || expenses.length > 0 || loans.length > 0 || investments.length > 0;
  const hasFinancialInputs = hasCashFlowInputs || insurance.length > 0 || goals.length > 0 || transactions.length > 0
    || profile.age > 0 || profile.cashSavings > 0 || profile.lifeCover > 0 || profile.healthCover > 0;

  function updateScenarioExtra(value: number) {
    const nextValue = Math.max(0, value);
    setScenarioExtra(nextValue);
    try { window.localStorage.setItem("artha-scenario-extra", String(nextValue)); } catch { /* Keep the selected scenario for this visit. */ }
  }

  const spendingByCategory = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((item) => map.set(item.category, (map.get(item.category) || 0) + convertMonthly(item.amount, item.frequency)));
    return [...map.entries()].sort((a,b)=>b[1]-a[1]);
  }, [expenses]);

  const monthlyTransactionSummary = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, month) => ({ month, expenses: 0, income: 0, count: 0 }));
    for (const item of yearTransactions) {
      const month = Number(item.transactionDate.slice(5, 7)) - 1;
      if (month < 0 || month > 11) continue;
      const amount = Math.max(0, numberValue(item.amount));
      if (/income|credit/i.test(item.transactionType)) months[month].income += amount;
      else months[month].expenses += amount;
      months[month].count += 1;
    }
    return months;
  }, [yearTransactions]);

  const filteredYearTransactions = useMemo(() => spendingMonth === "all"
    ? yearTransactions
    : yearTransactions.filter((item) => Number(item.transactionDate.slice(5, 7)) === Number(spendingMonth) + 1),
  [yearTransactions, spendingMonth]);
  const visibleYearTransactions = filteredYearTransactions.slice(0, 30);
  const selectedPeriodSpending = spendingMonth === "all"
    ? monthlyTransactionSummary.reduce((total, item) => total + item.expenses, 0)
    : monthlyTransactionSummary[Number(spendingMonth)]?.expenses ?? 0;
  const yearSpending = monthlyTransactionSummary.reduce((total, item) => total + item.expenses, 0);
  const monthsWithRecordedSpending = monthlyTransactionSummary.filter((item) => item.expenses > 0).length;
  const averageRecordedMonth = monthsWithRecordedSpending ? yearSpending / monthsWithRecordedSpending : 0;
  const annualizedSpending = monthsWithRecordedSpending >= 3 ? averageRecordedMonth * 12 : null;
  const peakSpendingMonth = monthlyTransactionSummary.reduce((peak, item) => item.expenses > peak.expenses ? item : peak, { month: 0, expenses: 0, income: 0, count: 0 });

  const scenario = useMemo(() => {
    const extra = Math.max(0, scenarioExtra);
    const nextFreeCashFlow = financials.freeCashFlow + extra;
    const currentEmergency = financials.cashSavings;
    const nextEmergencyMonths = financials.essentialMonthlyExpenses > 0 ? (currentEmergency + extra * 12) / financials.essentialMonthlyExpenses : 0;
    const goalContributionNeed = financials.goals.reduce((total, goal) => total + goal.requiredMonthlyContribution, 0);
    const cashAfterGoals = nextFreeCashFlow - goalContributionNeed;
    return { nextFreeCashFlow, nextEmergencyMonths, goalContributionNeed, cashAfterGoals, investmentContributions: financials.investmentContributions };
  }, [financials, scenarioExtra]);

  const aiContext = useMemo(() => ({
    financials,
    profile: {
      name: profile.name,
      age: profile.age,
      dependents: profile.dependents,
      country: profile.country,
      riskProfile: profile.riskProfile,
      investmentHorizon: profile.investmentHorizon,
      primaryGoal: profile.primaryGoal,
    },
    records: {
      income,
      expenses,
      investments,
      loans,
      insurance,
      goals,
      transactions: transactions.slice(0, 50),
    },
  }), [financials, profile, income, expenses, investments, loans, insurance, goals, transactions]);

  function localFallbackAnswer(nextQuestion: string, mode: "chat" | "review" | "scenario") {
    const f = financials;
    const q = nextQuestion.toLowerCase();
    const lines = ["### DhanView's engine-based view", ""];

    if (f.monthlyIncome > 0) {
      lines.push(
        `Your normalized monthly income is **${Math.round(f.monthlyIncome).toLocaleString("en-IN")}** and monthly outflow is **${Math.round(f.monthlyOutflow).toLocaleString("en-IN")}**.`
      );
      lines.push(
        `That leaves free cash flow of **${Math.round(f.freeCashFlow).toLocaleString("en-IN")}**, with a savings rate of **${f.savingsRate.toFixed(1)}%**.`
      );
    } else {
      lines.push("You have not entered recurring income yet, so cash-flow conclusions are limited.");
    }

    if (mode === "review") {
      lines.push(
        f.emergencyCoverageMonths >= 3
          ? `Emergency coverage is currently **${f.emergencyCoverageMonths.toFixed(1)} months** against essential monthly expenses.`
          : `Emergency coverage is currently **${f.emergencyCoverageMonths.toFixed(1)} months**, so building cash reserves is an item worth reviewing.`
      );
      lines.push(
        `Tracked debt is **${Math.round(f.outstandingDebt).toLocaleString("en-IN")}** and monthly debt payments are **${Math.round(f.debtPayments).toLocaleString("en-IN")}**.`
      );
      lines.push(
        `Tracked investments are worth **${Math.round(f.currentInvestmentValue).toLocaleString("en-IN")}** with **${Math.round(f.investmentContributions).toLocaleString("en-IN")}** of monthly contributions.`
      );
    }

    if (/emergency|fund|cash/.test(q)) {
      lines.push(
        `Cash savings are **${Math.round(f.cashSavings).toLocaleString("en-IN")}**, while the engine's 3–6 month target range is **${Math.round(f.emergencyFundTarget3Months).toLocaleString("en-IN")}–${Math.round(f.emergencyFundTarget6Months).toLocaleString("en-IN")}**.`
      );
    }
    if (/invest|sip|stock|mutual|portfolio/.test(q)) {
      lines.push(
        `Tracked investments are worth **${Math.round(f.currentInvestmentValue).toLocaleString("en-IN")}** versus **${Math.round(f.investedAmount).toLocaleString("en-IN")}** invested.`
      );
    }
    if (/loan|debt|emi/.test(q)) {
      lines.push(
        `Outstanding debt is **${Math.round(f.outstandingDebt).toLocaleString("en-IN")}** with monthly debt payments of **${Math.round(f.debtPayments).toLocaleString("en-IN")}** (${f.debtServiceRatio.toFixed(1)}% of monthly income).`
      );
      const openLoans = loans.filter((loan) => loan.outstanding > 0);
      if (!openLoans.length) {
        lines.push("No outstanding loan records are available in the data currently loaded, so I cannot rank your debts or calculate an EMI or prepayment scenario.");
      } else {
        lines.push("Recorded loan details:");
        openLoans.forEach((loan) => {
          const loanLabel = loan.name || loan.type || "Loan";
          const rate = loan.interestRate > 0 ? `${loan.interestRate}% annual rate` : "interest rate not recorded";
          const emi = loan.emi > 0 ? `${money(loan.emi)} monthly EMI` : "EMI not recorded";
          const term = loan.tenureMonths > 0 ? `${loan.tenureMonths} months remaining` : "remaining term not recorded";
          lines.push(`- **${loanLabel}**: ${money(loan.outstanding)} outstanding · ${rate} · ${emi} · ${term}.`);
        });
        const avalanche = [...openLoans].filter((loan) => loan.interestRate > 0).sort((a, b) => b.interestRate - a.interestRate);
        const missingRate = openLoans.some((loan) => loan.interestRate <= 0);
        lines.push(avalanche.length ? `Avalanche order from recorded rates: ${avalanche.map((loan) => loan.name || loan.type || "Loan").join(" → ")}${missingRate ? "; loans without a recorded rate cannot be ranked" : ""}.` : "Avalanche order cannot be ranked because interest rates are not recorded.");
        const snowball = [...openLoans].sort((a, b) => a.outstanding - b.outstanding);
        lines.push(`Snowball order by recorded balance: ${snowball.map((loan) => loan.name || loan.type || "Loan").join(" → ")}.`);
      }
      lines.push("In general, avalanche directs extra payments to the highest-rate loan after paying each loan's minimum EMI; snowball directs them to the smallest balance. These are strategy descriptions, not a prepayment calculation.");
      lines.push("To compare EMI or prepayment scenarios, provide the extra monthly amount or lump sum, any lender prepayment fees, and whether the lender would reduce the EMI or shorten the term.");
    }
    if (/goal|save more|saving/.test(q)) {
      if (f.goals.length) {
        f.goals.slice(0, 5).forEach((g) => {
          lines.push(
            `**${g.name || "Goal"}:** ${Math.round(g.requiredMonthlyContribution).toLocaleString("en-IN")}/month required for the remaining amount by the target date.`
          );
        });
      } else {
        lines.push("You have not added a financial goal yet.");
      }
    }
    if (/insurance|cover|term|health/.test(q)) {
      lines.push(
        `Tracked protection is **${Math.round(f.lifeCover).toLocaleString("en-IN")}** of life/term cover and **${Math.round(f.healthCover).toLocaleString("en-IN")}** of health cover.`
      );
    }
    if (mode === "scenario") {
      lines.push(
        `With the selected extra saving of **${money(scenarioExtra)}/month**, the next free cash flow becomes **${money(scenario.nextFreeCashFlow)}** and projected emergency coverage after 12 months becomes **${scenario.nextEmergencyMonths.toFixed(1)} months**.`
      );
    }

    lines.push("", "This fallback uses DhanView's deterministic engine facts only; no AI inference was used.");
    return lines.join("\n");
  }

  function convertMonthly(amount: number, frequency: string) {
    switch (String(frequency || "").toLowerCase()) {
      case "weekly": return amount * 52 / 12;
      case "quarterly": return amount / 3;
      case "half-yearly":
      case "half yearly": return amount / 6;
      case "yearly":
      case "annual": return amount / 12;
      default: return amount;
    }
  }

  function openModal(type: ModalType, item?: any) {
    setModal(type); setEdit(item || null); setError("");
    if (type === "profile") setForm({ name: profile.name, age: profile.age, dependents: profile.dependents, country: profile.country, riskProfile: profile.riskProfile, investmentHorizon: profile.investmentHorizon, primaryGoal: profile.primaryGoal, lifeCover: profile.lifeCover, healthCover: profile.healthCover, cashSavings: profile.cashSavings });
    else if (type === "income") setForm(item ? { name:item.name, type:item.type, amount:item.amount, frequency:item.frequency } : { name:"Salary", type:"Salary", amount:"", frequency:"Monthly" });
    else if (type === "expense") setForm(item ? { name:item.name, category:item.category, amount:item.amount, frequency:item.frequency } : { name:"", category:"Housing", amount:"", frequency:"Monthly" });
    else if (type === "investment") setForm(item ? { name:item.name, type:item.type, category:item.category, mode:item.mode, monthlyAmount:item.monthlyAmount, investedAmount:item.investedAmount, currentValue:item.currentValue, startDate:item.startDate || "" } : { name:"", type:"Mutual Fund", category:"Equity", mode:"SIP", monthlyAmount:"", investedAmount:"", currentValue:"", startDate:"" });
    else if (type === "loan") setForm(item ? { name:item.name, type:item.type, originalAmount:item.originalAmount, outstanding:item.outstanding, emi:item.emi, interestRate:item.interestRate, tenureMonths:item.tenureMonths } : { name:"", type:"Car Loan", originalAmount:"", outstanding:"", emi:"", interestRate:"", tenureMonths:"" });
    else if (type === "insurance") setForm(item ? { type:item.type, provider:item.provider, coverage:item.coverage, premium:item.premium, frequency:item.frequency, renewalDate:item.renewalDate || "" } : { type:"Life / Term", provider:"", coverage:"", premium:"", frequency:"Yearly", renewalDate:"" });
    else if (type === "goal") setForm(item ? { type:item.type || "Other", name:item.name, targetAmount:item.targetAmount, currentAmount:item.currentAmount, targetDate:item.targetDate } : { type:"Other", name:"", targetAmount:"", currentAmount:"", targetDate:"" });
    else if (type === "transaction") setForm(item ? { transactionDate:item.transactionDate, description:item.description, amount:item.amount, transactionType:item.transactionType, category:item.category, source:item.source } : { transactionDate:todayLocalDate(), description:"", amount:"", transactionType:"Expense", category:"", source:"Manual" });
  }

  async function saveModal() {
    setSaveBusy(true);
    setError("");

    try {
      const {
        data: { user },
        error: sessionError,
      } = await supabase.auth.getUser();

      if (sessionError || !user) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const userId = user.id;

      if (modal === "profile") {
        const payload = {
          name: String(form.name || "").trim(),
          age: numberValue(form.age),
          dependents: numberValue(form.dependents),
          country: String(form.country || "India").trim(),
          risk_profile: String(form.riskProfile || "").trim() || null,
          investment_horizon: String(form.investmentHorizon || "").trim() || null,
          primary_goal: String(form.primaryGoal || "").trim() || null,
          life_cover: numberValue(form.lifeCover),
          health_cover: numberValue(form.healthCover),
          cash_savings: numberValue(form.cashSavings),
        };

        // Upsert handles both existing profiles and accounts created before the
        // profile trigger existed. RLS must allow only the signed-in user's row.
        const saved = await supabase
          .from("profiles")
          .upsert({ ...payload, id: userId }, { onConflict: "id" })
          .select("*")
          .single();

        if (saved.error) throw saved.error;

        setProfile(normalizeProfile(saved.data, payload.name));
        closeModal();
        showToast("Profile saved successfully.");
        return;
      }

      if (modal === "income") {
        const name = String(form.name || "Income").trim();
        const type = String(form.type || "Other").trim();
        const payload = {
          name,
          type,
          amount: numberValue(form.amount),
          frequency: String(form.frequency || "Monthly"),
        };

        const result = edit
          ? await supabase.from("income").update(payload).eq("id", edit.id).eq("user_id", userId).select("*").single()
          : await supabase.from("income").insert({ ...payload, user_id: userId }).select("*").single();

        if (result.error) throw result.error;
        if (!result.data) throw new Error("Income was saved but no row was returned.");

        const row = result.data;
        const item: Income = {
          id: row.id,
          name: row.name || "Income",
          type: row.type || "Other",
          amount: numberValue(row.amount),
          frequency: row.frequency || "Monthly",
        };

        setIncome((items) =>
          edit ? items.map((v) => (v.id === edit.id ? item : v)) : [item, ...items]
        );
        closeModal();
        showToast("Income saved.");
        return;
      }

      if (modal === "expense") {
        const name = String(form.name || "Expense").trim();
        const payload = {
          name,
          category: String(form.category || "Other"),
          amount: numberValue(form.amount),
          frequency: String(form.frequency || "Monthly"),
        };

        const result = edit
          ? await supabase.from("expenses").update(payload).eq("id", edit.id).eq("user_id", userId).select("*").single()
          : await supabase.from("expenses").insert({ ...payload, user_id: userId }).select("*").single();

        if (result.error) throw result.error;
        if (!result.data) throw new Error("Expense was saved but no row was returned.");

        const row = result.data;
        const item: Expense = {
          id: row.id,
          name: row.name || "Expense",
          category: row.category || "Other",
          amount: numberValue(row.amount),
          frequency: row.frequency || "Monthly",
        };

        setExpenses((items) =>
          edit ? items.map((v) => (v.id === edit.id ? item : v)) : [item, ...items]
        );
        closeModal();
        showToast("Expense saved.");
        return;
      }

      if (modal === "investment") {
        const payload = {
          name: String(form.name || "Investment"),
          type: String(form.type || "Other"),
          category: String(form.category || "Other"),
          mode: String(form.mode || "Lump sum"),
          monthly_amount: numberValue(form.monthlyAmount),
          invested_amount: numberValue(form.investedAmount),
          current_value: numberValue(form.currentValue),
          start_date: String(form.startDate || "") || null,
        };

        const result = edit
          ? await supabase.from("investments").update(payload).eq("id", edit.id).eq("user_id", userId).select("*").single()
          : await supabase.from("investments").insert({ ...payload, user_id: userId }).select("*").single();

        if (result.error) throw result.error;
        if (!result.data) throw new Error("Investment was saved but no row was returned.");

        const row = result.data;
        const item: Investment = {
          id: row.id,
          name: row.name || row.fund_name || "Investment",
          type: row.type || "Other",
          category: row.category || "Other",
          mode: row.mode || "Lump sum",
          monthlyAmount: numberValue(row.monthly_amount),
          investedAmount: numberValue(row.invested_amount),
          currentValue: numberValue(row.current_value),
          startDate: row.start_date,
        };

        setInvestments((items) =>
          edit ? items.map((v) => (v.id === edit.id ? item : v)) : [item, ...items]
        );
        closeModal();
        showToast("Investment saved.");
        return;
      }

      if (modal === "loan") {
        const payload = {
          type: String(form.type || "Other"),
          name: String(form.name || "Loan"),
          original_amount: numberValue(form.originalAmount),
          outstanding: numberValue(form.outstanding),
          emi: numberValue(form.emi),
          interest_rate: numberValue(form.interestRate),
          tenure_months: numberValue(form.tenureMonths),
        };

        const result = edit
          ? await supabase.from("loans").update(payload).eq("id", edit.id).eq("user_id", userId).select("*").single()
          : await supabase.from("loans").insert({ ...payload, user_id: userId }).select("*").single();

        if (result.error) throw result.error;
        if (!result.data) throw new Error("Loan was saved but no row was returned.");

        const row = result.data;
        const item: Loan = {
          id: row.id,
          name: row.name || row.type || "Loan",
          type: row.type || "Other",
          originalAmount: numberValue(row.original_amount),
          outstanding: numberValue(row.outstanding),
          emi: numberValue(row.emi),
          interestRate: numberValue(row.interest_rate),
          tenureMonths: numberValue(row.tenure_months),
        };

        setLoans((items) =>
          edit ? items.map((v) => (v.id === edit.id ? item : v)) : [item, ...items]
        );
        closeModal();
        showToast("Loan saved.");
        return;
      }

      if (modal === "insurance") {
        const payload = {
          type: String(form.type || "Other"),
          provider: String(form.provider || "").trim() || null,
          coverage: numberValue(form.coverage),
          premium: numberValue(form.premium),
          frequency: String(form.frequency || "Yearly"),
          renewal_date: String(form.renewalDate || "") || null,
        };

        const result = edit
          ? await supabase.from("insurance").update(payload).eq("id", edit.id).eq("user_id", userId).select("*").single()
          : await supabase.from("insurance").insert({ ...payload, user_id: userId }).select("*").single();

        if (result.error) throw result.error;
        if (!result.data) throw new Error("Insurance was saved but no row was returned.");

        const row = result.data;
        const item: Insurance = {
          id: row.id,
          type: row.type || "Other",
          provider: row.provider || "",
          coverage: numberValue(row.coverage),
          premium: numberValue(row.premium),
          frequency: row.frequency || "Yearly",
          renewalDate: row.renewal_date,
        };

        setInsurance((items) =>
          edit ? items.map((v) => (v.id === edit.id ? item : v)) : [item, ...items]
        );
        await syncCoverageFromInsurance(edit, item);
        closeModal();
        showToast("Insurance saved.");
        return;
      }

      if (modal === "goal") {
        const payload = {
          name: String(form.name || "Goal"),
          target_amount: numberValue(form.targetAmount),
          current_amount: numberValue(form.currentAmount),
          target_date: String(form.targetDate || ""),
        };

        if (!payload.target_date) throw new Error("Please choose a target date.");

        const result = edit
          ? await supabase.from("goals").update(payload).eq("id", edit.id).eq("user_id", userId).select("*").single()
          : await supabase.from("goals").insert({ ...payload, user_id: userId }).select("*").single();

        if (result.error) throw result.error;
        if (!result.data) throw new Error("Goal was saved but no row was returned.");

        const row = result.data;
        const item: Goal = {
          id: row.id,
          name: row.name,
          targetAmount: numberValue(row.target_amount),
          currentAmount: numberValue(row.current_amount),
          targetDate: row.target_date,
        };

        setGoals((items) =>
          edit ? items.map((v) => (v.id === edit.id ? item : v)) : [item, ...items]
        );
        closeModal();
        showToast("Goal saved.");
        return;
      }

      if (modal === "transaction") {
        const payload = {
          transaction_date: String(form.transactionDate || todayLocalDate()),
          description: String(form.description || "Transaction"),
          amount: numberValue(form.amount),
          transaction_type: String(form.transactionType || "Expense"),
          category: String(form.category || "Other"),
          source: String(form.source || "Manual"),
        };

        const res = edit
          ? await supabase.from("transactions").update(payload).eq("id", edit.id).eq("user_id", userId).select("*").single()
          : await supabase.from("transactions").insert({ ...payload, user_id: userId }).select("*").single();

        if (res.error) throw res.error;

        if (!res.data) throw new Error("Transaction was saved but the database did not confirm it.");
        const row = res.data;
        const item: Transaction = {
          id: row.id,
          transactionDate: row.transaction_date,
          description: row.description,
          amount: numberValue(row.amount),
          transactionType: row.transaction_type,
          category: row.category || "",
          source: row.source || "",
        };

        setTransactions((items) => edit ? items.map((v) => v.id === edit.id ? item : v) : [item, ...items]);
        setYearTransactionsReload((value) => value + 1);
        closeModal();
        showToast("Transaction saved.");
        return;
      }
    } catch (err) {
      // Surface only the stable database error code for profile diagnosis; never
      // render raw server details that could contain user supplied values.
      setError(modal === "profile" ? profileSaveErrorMessage(err) : recordSaveErrorMessage(err, modal === "income" ? "Income" : modal === "expense" ? "Expense" : modal === "investment" ? "Investment" : modal === "loan" ? "Loan" : modal === "insurance" ? "Insurance" : modal === "goal" ? "Goal" : "Transaction"));
    } finally {
      setSaveBusy(false);
    }
  }

  async function importCsvTransactions(rows: ImportedTransaction[]) {
    if (!profile.id) throw new Error("Sign in again before importing transactions.");
    if (!rows.length || rows.length > 3000) throw new Error("Import between 1 and 3,000 transaction rows at a time.");
    const startDate = rows.reduce((value, row) => row.transactionDate < value ? row.transactionDate : value, rows[0].transactionDate);
    const endDate = rows.reduce((value, row) => row.transactionDate > value ? row.transactionDate : value, rows[0].transactionDate);
    const existingRows: any[] = [];
    const pageSize = 1000;
    for (let offset = 0; offset <= 5000; offset += pageSize) {
      const { data, error: queryError } = await supabase
        .from("transactions")
        .select("transaction_date,description,amount,transaction_type")
        .eq("user_id", profile.id)
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate)
        .order("transaction_date", { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (queryError) throw new Error("Could not check existing entries. Nothing was imported; try again.");
      existingRows.push(...(data || []));
      if ((data || []).length < pageSize) break;
      if (offset >= 5000) throw new Error("There are too many saved entries in this date range to check safely. Import a smaller date range.");
    }
    const keyFor = (date: string, description: string, amount: number, type: string) => {
      const normalizedType = /income|credit/i.test(type) ? "income" : "expense";
      return `${date}|${description.trim().toLocaleLowerCase().replace(/\s+/g, " ")}|${Math.round(amount * 100)}|${normalizedType}`;
    };
    const occurrenceCounts = new Map<string, number>();
    for (const row of existingRows) {
      const key = keyFor(row.transaction_date, String(row.description || ""), numberValue(row.amount), String(row.transaction_type || ""));
      occurrenceCounts.set(key, (occurrenceCounts.get(key) || 0) + 1);
    }
    const toSave: ImportedTransaction[] = [];
    let duplicates = 0;
    for (const row of rows) {
      const key = keyFor(row.transactionDate, row.description, row.amount, row.transactionType);
      const existingCount = occurrenceCounts.get(key) || 0;
      const seenCount = occurrenceCounts.get(`imported:${key}`) || 0;
      if (seenCount < existingCount) {
        occurrenceCounts.set(`imported:${key}`, seenCount + 1);
        duplicates++;
      } else {
        occurrenceCounts.set(`imported:${key}`, seenCount + 1);
        toSave.push(row);
      }
    }
    if (!toSave.length) return { inserted: 0, duplicates };
    const payload = toSave.map((row) => ({
      user_id: profile.id,
      transaction_date: row.transactionDate,
      description: row.description,
      amount: row.amount,
      transaction_type: row.transactionType,
      category: row.category || "Other",
      source: "Imported",
    }));
    const { data, error: insertError } = await supabase.from("transactions").insert(payload).select("id");
    if (insertError) throw new Error("DhanView could not save the imported entries. Nothing from this import was added; please retry.");
    if (!data || data.length !== payload.length) throw new Error("Supabase did not confirm every imported entry. Reload your transaction history before retrying.");
    setYearTransactionsReload((value) => value + 1);
    setTransactions((current) => [...payload.map((row, index) => ({
      id: data[index].id,
      transactionDate: row.transaction_date,
      description: row.description,
      amount: row.amount,
      transactionType: row.transaction_type,
      category: row.category,
      source: row.source,
    })), ...current].slice(0, 40));
    showToast(`${data.length} imported transaction${data.length === 1 ? "" : "s"} saved.`);
    return { inserted: data.length, duplicates };
  }

  async function syncCoverageFromInsurance(currentEdit: any, savedItem: any) {
    const next = currentEdit ? insurance.map(v => v.id === currentEdit.id ? savedItem : v) : [savedItem, ...insurance];
    const life = next.filter((v:any)=>/life|term/i.test(v.type)).reduce((a:number,v:any)=>a+numberValue(v.coverage),0);
    const health = next.filter((v:any)=>/health|medical/i.test(v.type)).reduce((a:number,v:any)=>a+numberValue(v.coverage),0);
    const payload = { life_cover:life, health_cover:health };
    const { error } = await supabase.from("profiles").update(payload).eq("id", profile.id); if (!error) setProfile((p)=>({...p,lifeCover:life,healthCover:health}));
  }

  async function removeRow(table: string, id: string) {
    if (!window.confirm("Delete this item from your DhanView account?")) return;
    const { error } = await supabase.from(table).delete().eq("id", id).eq("user_id", profile.id);
    if (error) { setError("Unable to delete this item. Please try again."); return; }
    if (table === "income") setIncome(v=>v.filter(x=>x.id!==id));
    if (table === "expenses") setExpenses(v=>v.filter(x=>x.id!==id));
    if (table === "investments") setInvestments(v=>v.filter(x=>x.id!==id));
    if (table === "loans") setLoans(v=>v.filter(x=>x.id!==id));
    if (table === "insurance") {
      const nextInsurance = insurance.filter(x=>x.id!==id);
      setInsurance(nextInsurance);
      const life = nextInsurance.filter(v=>/life|term/i.test(v.type)).reduce((a,v)=>a+numberValue(v.coverage),0);
      const health = nextInsurance.filter(v=>/health|medical/i.test(v.type)).reduce((a,v)=>a+numberValue(v.coverage),0);
      const coverageUpdate = await supabase.from("profiles").update({ life_cover: life, health_cover: health }).eq("id", profile.id);
      if (!coverageUpdate.error) setProfile(p=>({...p, lifeCover: life, healthCover: health}));
    }
    if (table === "goals") setGoals(v=>v.filter(x=>x.id!==id));
    if (table === "transactions") setTransactions(v=>v.filter(x=>x.id!==id));
    if (table === "transactions") setYearTransactions(v=>v.filter(x=>x.id!==id));
    showToast("Deleted.");
  }

  async function askDhanView(
    nextQuestion = question,
    mode: "chat" | "review" | "scenario" = "chat",
    scenarioPayload: any = undefined
  ) {
    if (!nextQuestion.trim()) {
      setError("Choose a question or type your own first.");
      return;
    }

    setAiLoading(true);
    setError("");
    setAnswer("");
    setAnswerGrounding("");

    const target = getAiTarget();
    const isLocal = typeof window !== "undefined" && window.location.hostname === "localhost";
    const usesLocalGateway = isLocal && target === LOCAL_AI_ENDPOINT;
    const needsLoanDetails = /loan|debt|emi|avalanche|snowball|prepay/i.test(nextQuestion);
    const localFinancialContext = usesLocalGateway ? {
      financials: aiContext.financials,
      ...(needsLoanDetails ? {
        records: {
          loans: loans.map((loan) => ({
            type: loan.type,
            outstanding: loan.outstanding,
            interestRate: loan.interestRate,
            emi: loan.emi,
            tenureMonths: loan.tenureMonths,
          })),
        },
      } : {}),
    } : undefined;

    if (!target) {
      setAnswer(localFallbackAnswer(nextQuestion, mode));
      setAnswerGrounding("Financial Engine facts only · AI gateway is not configured");
      showToast("AI gateway is not configured; showing engine-based guidance.");
      setAiLoading(false);
      return;
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      const { data: authData } = await supabase.auth.getSession();
      if (authData.session) {
        headers.Authorization = `Bearer ${authData.session.access_token}`;
        headers.apikey =
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
      }

      const response = await fetch(target, {
        method: "POST",
        headers,
        body: JSON.stringify({
          question: nextQuestion,
          mode,
          scenario: scenarioPayload,
          ...(usesLocalGateway ? { financialContext: localFinancialContext } : {}),
        }),
      });

      const raw = await response.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data.error || `AI gateway returned HTTP ${response.status}.`
        );
      }

      if (data.grounding === "verified" && typeof data.answer === "string" && data.answer.trim()) {
        setAnswer(data.answer);
        setAnswerGrounding("AI answer passed source-reference and number checks");
      } else {
        setAnswer(localFallbackAnswer(nextQuestion, mode));
        const reason = data.fallbackReason;
        const fallbackLabel = reason === "provider_not_configured"
          ? "AI provider not configured · Financial Engine only"
          : reason === "local_model_unavailable"
            ? "Local AI model unavailable · Financial Engine only"
            : reason === "answer_not_verified"
              ? "AI answer failed fact checks · Financial Engine only"
              : "AI answer was not verified · Financial Engine only";
        setAnswerGrounding(fallbackLabel);
        showToast(reason === "provider_not_configured"
          ? "AI provider is not configured in Supabase Edge Function secrets; showing engine guidance."
          : reason === "local_model_unavailable"
            ? "Local AI model is unavailable; showing engine guidance."
            : "AI answer could not be verified; showing engine guidance.");
      }
    } catch (err) {
      if (usesLocalGateway) {
        setAnswer(localFallbackAnswer(nextQuestion, mode));
        setAnswerGrounding("Financial Engine facts only · local AI was unavailable");
        showToast("Local AI is unavailable; showing engine-based guidance.");
      } else {
        setError(
          err instanceof Error ? err.message : "Unable to get guidance."
        );
      }
    } finally {
      setAiLoading(false);
    }
  }

  async function autoCategorize() {
    const description = String(form.description || "").trim();
    if (!description) {
      setError("Enter a transaction description first.");
      return;
    }

    const deterministicCategory = (text: string, type: string) => {
      const t = text.toLowerCase();
      if (/salary|payroll|dividend|interest credit/.test(t)) return "Income";
      if (/rent|housing|maintenance|society/.test(t)) return "Housing";
      if (/swiggy|zomato|restaurant|cafe|food|grocer|blinkit|zepto|bigbasket/.test(t)) return "Food";
      if (/uber|ola|rapido|petrol|fuel|parking|metro|transport/.test(t)) return "Transport";
      if (/electric|water|internet|mobile|jio|airtel|utility|gas/.test(t)) return "Utilities";
      if (/hospital|pharmacy|medical|doctor|clinic|apollo/.test(t)) return "Healthcare";
      if (/amazon|flipkart|myntra|shopping|mall/.test(t)) return "Shopping";
      if (/netflix|prime|spotify|movie|cinema|entertainment/.test(t)) return "Entertainment";
      if (/emi|loan|hdfc loan|sbi loan|card payment/.test(t)) return "Debt / EMI";
      if (/sip|mutual fund|zerodha|groww|upstox|stock|etf|nps|ppf|fd/.test(t)) return "Investments";
      if (type.toLowerCase() === "income") return "Income";
      return "Other";
    };

    const localCategory = deterministicCategory(
      description,
      String(form.transactionType || "Expense")
    );

    setCategorizing(true);
    setError("");

    try {
      const target = getAiTarget();
      const isLocal =
        typeof window !== "undefined" && window.location.hostname === "localhost";

      if (!target) {
        setField("category", localCategory);
        showToast(`DhanView categorized this as ${localCategory}.`);
        return;
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      const { data: authData } = await supabase.auth.getSession();
      if (authData.session) {
        headers.Authorization = `Bearer ${authData.session.access_token}`;
        headers.apikey =
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
      }

      const response = await fetch(target, {
        method: "POST",
        headers,
        body: JSON.stringify({
          mode: "categorize",
          question: description,
          amount: numberValue(form.amount),
          transactionType: String(form.transactionType || "Expense"),
        }),
      });

      const raw = await response.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(data.error || "Unable to categorize.");
      }

      const category = data.category || localCategory;
      setField("category", category);
      showToast(`DhanView categorized this as ${category}.`);
    } catch (err) {
      if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        setField("category", localCategory);
        showToast(`DhanView categorized this as ${localCategory}.`);
      } else {
        setError(err instanceof Error ? err.message : "Unable to categorize.");
      }
    } finally {
      setCategorizing(false);
    }
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut({ scope:"local" });
    if (error) { setError("Unable to sign out. Please try again."); return; }
    router.replace("/auth"); router.refresh();
  }

  async function updatePassword() {
    if (securityPassword.length < 8) { setError("Use at least 8 characters."); return; }
    if (securityPassword !== securityConfirm) { setError("Passwords do not match."); return; }
    const { error } = await supabase.auth.updateUser({ password: securityPassword });
    if (error) { setError("Unable to update your password. Please try again."); return; }
    closeModal(); showToast("Password updated.");
  }

  if (!sessionReady || loadingData) return <div className="loading"><div><div className="loadingMark">✦</div><strong>Loading your DhanView workspace…</strong></div></div>;
  if (authConnectionError) return <main className="loading"><div role="alert"><div className="loadingMark">!</div><strong>Can&apos;t reach Supabase</strong><p>Check your internet connection and that this app uses the active Supabase project URL, then retry.</p><button className="primary" type="button" onClick={() => window.location.reload()}>Retry connection</button></div></main>;

  return (
    <main className="shell">
      <header className="appHeader"><div className="headerInner"><div className="brandWrap"><div className="brandSymbol" aria-hidden="true">✦</div><div><div className="brand">DhanView</div><div className="tag">Personal finance &amp; planning</div></div></div><div className="headerActions"><button className="themeToggle" type="button" onClick={toggleTheme} aria-label={`Theme is ${themeMode}; switch to ${themeMode === "system" ? "light" : themeMode === "light" ? "dark" : "system"}`} title={`Theme: ${themeMode}. Click to switch to ${themeMode === "system" ? "light" : themeMode === "light" ? "dark" : "system"}.`}><span aria-hidden="true">{themeMode === "system" ? "◐" : theme === "dark" ? "☼" : "☾"}</span><span className="themeToggleLabel">{themeMode === "system" ? "System" : theme === "dark" ? "Light" : "Dark"}</span></button><div className="secureBadge"><span>●</span> Secure</div><div className="profileArea"><button className="profileButton" onClick={()=>setProfileMenu(v=>!v)} aria-expanded={profileMenu}><span className="profileAvatar">{(profile.name||"A").charAt(0).toUpperCase()}</span><span className="profileButtonText">{profile.name || "Profile"}</span><span className="profileChevron">{profileMenu?"⌃":"⌄"}</span></button>{profileMenu && <div className="profileMenu"><button className="profileMenuUser profileMenuUserButton" onClick={()=>{setProfileMenu(false);openModal("profile");}}><span className="profileMenuAvatar">{(profile.name||"A").charAt(0).toUpperCase()}</span><span><strong>{profile.name||"Your profile"}</strong><small>Personal account</small></span></button><div className="profileMenuDivider"/><button className="profileMenuItem" onClick={()=>{setProfileMenu(false);openModal("profile");}}>👤 <span>Profile settings</span></button><button className="profileMenuItem" onClick={()=>{setProfileMenu(false);openModal("security");}}>🔐 <span>Account & security</span></button><button className="profileMenuItem signOut" onClick={handleSignOut}>↪ <span>Sign out</span></button></div>}</div></div></div></header>

      <section className="hero" id="overview"><div><div className="eyebrow">YOUR MONEY, ONE PLACE</div><h1>Hi {profile.name || "there"} 👋<br/>Let&apos;s understand your money.</h1><p>Track cash flow, investments, loans, protection and goals. DhanView keeps the calculations deterministic and uses AI to explain what the numbers mean.</p></div><div className="heroActions"><button className="primary" onClick={()=>openModal("transaction")}>＋ Add transaction</button><button className="secondary" onClick={()=>openModal("profile")}>Edit profile</button></div></section>

      {legacyDataAvailable && <section className="card" role="status" style={{ marginTop: 20, padding: 20 }}><div className="eyebrow">OLDER BROWSER DATA</div><h2>We found data from an earlier Artha version</h2><p>It remains in this browser and has not been uploaded. You can leave it here, or explicitly copy profile and portfolio records into this signed-in account. The local copy will be kept.</p><button className="primary" type="button" onClick={importLegacyData} disabled={legacyImportBusy}>{legacyImportBusy ? "Importing…" : "Review and import older data"}</button></section>}

      <nav className="sectionNav" aria-label="Main sections">
        <a href="#overview">Overview</a>
        <a href="#planning">Planning</a>
        <a href="#portfolio">Portfolio</a>
        <a href="#ai-coach">AI Coach</a>
        <Link href="/release-notes/">Release notes</Link>
      </nav>

      <section className="planningSection" id="planning">
        <div className="planningHeading">
          <div>
            <div className="eyebrow">PLAN YOUR NEXT MOVE</div>
            <h2>Make your next big decision with confidence.</h2>
            <p>Choose a life goal and DhanView will use your financial picture to help you explore the trade-offs.</p>
          </div>
          <span className="planningBadge">Portfolio-aware guidance</span>
        </div>
        <div className="planningGrid">
          {[
            ["⌂", "Home planning", "Explore a home budget, down payment, EMI and affordability.", "Help me plan a home purchase. Assess an appropriate property budget, down payment, loan amount, EMI, upfront costs and the impact on my cash flow, emergency fund and other goals. Ask me for any missing information."],
            ["▣", "Car planning", "Compare purchase price, EMI and total ownership cost.", "Help me plan a car purchase. Evaluate on-road price, down payment, loan EMI, fuel, insurance, maintenance and total ownership cost. Check the impact on my savings, emergency fund and other goals. Ask for missing information."],
            ["◎", "Goal planning", "Turn a target amount and timeline into a savings plan.", "Help me create a goal-based savings plan. Review my existing goals and portfolio, calculate the monthly contribution needed for a target and timeline, and explain assumptions and trade-offs. Ask me for missing information."],
            ["⇄", "Debt planning", "Prioritise repayments and compare prepayment scenarios.", "Review my debts and help me build a repayment strategy. Compare avalanche and snowball approaches, EMI changes and prepayment scenarios using my actual loan data. Explain any assumptions and ask for missing information."],
            ["◇", "Financial safety", "Review emergency savings, insurance and cash-flow resilience.", "Run a financial safety review using my DhanView data. Assess emergency fund coverage, debt exposure, insurance information and cash-flow resilience. Identify missing information and prioritise practical next steps."],
            ["↗", "Retirement planning", "Estimate your future needs and long-term savings gap.", "Help me plan for retirement. Estimate inflation-adjusted future expenses and the savings gap using my age, existing investments and goals where available. Clearly label assumptions and ask for missing information."]
          ].map(([icon, title, description, prompt], index) => (
            <button className="planningCard" key={title} onClick={() => {
              setQuestion(prompt);
              setAnswer("");
              setError("");
              document.getElementById("ai-coach")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}>
              <span className="planningArt" aria-hidden="true" style={{ backgroundImage: `url("${process.env.NEXT_PUBLIC_BASE_PATH || ""}/planning/${planningBackgrounds[index]}")` }} />
              <span className="planningIcon" aria-hidden="true">{icon}</span>
              <strong>{title}</strong>
              <span>{description}</span>
              <em>Plan with DhanView <b>→</b></em>
            </button>
          ))}
        </div>
        <p className="planningDisclaimer">Planning guidance is educational, depends on the information you provide, and is not a loan approval or guaranteed financial outcome.</p>
      </section>

      {error && <div className="error pageError">{error}<button onClick={()=>setError("")}>×</button></div>}
      {toast && <div className="toast">✓ {toast}</div>}

      <section className="stats"><Stat label="Monthly income" value={income.length ? money(financials.monthlyIncome) : "—"} note={income.length ? `${income.length} source${income.length===1?"":"s"}` : "Add income to calculate"} /><Stat label="Monthly outflow" value={expenses.length || loans.length || investments.length ? money(financials.monthlyOutflow) : "—"} note={expenses.length || loans.length || investments.length ? "Living + EMI + investments" : "Add expenses or commitments"} /><Stat label="Free cash flow" value={hasCashFlowInputs ? money(financials.freeCashFlow) : "—"} note={hasCashFlowInputs ? `${financials.savingsRate.toFixed(1)}% savings rate` : "Add portfolio details to calculate"} positive={hasCashFlowInputs && financials.freeCashFlow>=0} /><Stat label="Tracked net worth" value={investments.length || loans.length || profile.cashSavings > 0 ? money(financials.trackedNetWorth) : "—"} note={investments.length || loans.length || profile.cashSavings > 0 ? `${money(financials.currentInvestmentValue)} investments · ${money(financials.outstandingDebt)} debt` : "Add assets or debt to calculate"} /></section>

      <section className="card insightCard financialHealth" aria-labelledby="financial-health-title">
        <div className="cardHeader">
          <div><div className="eyebrow">FINANCIAL HEALTH</div><h2 id="financial-health-title">What the engine sees</h2><p>Deterministic metrics from the information you entered.</p></div>
          {hasCashFlowInputs && <span className="healthPill">{financials.health.cashFlow === "positive" ? "Cash flow positive" : "Cash flow needs attention"}</span>}
        </div>
        {hasFinancialInputs ? <>
          <div className="healthGrid"><Metric label="Savings rate" value={hasCashFlowInputs && income.length ? `${financials.savingsRate.toFixed(1)}%` : "—"} /><Metric label="Debt service" value={income.length ? `${financials.debtServiceRatio.toFixed(1)}%` : "—"} /><Metric label="Emergency cover" value={financials.essentialMonthlyExpenses > 0 ? `${financials.emergencyCoverageMonths.toFixed(1)} mo` : "—"} /><Metric label="Investing rate" value={income.length ? `${financials.investmentContributionRate.toFixed(1)}%` : "—"} /></div>
          <div className="healthNotes"><div><b>Emergency target</b><span>{financials.essentialMonthlyExpenses > 0 ? `${money(financials.emergencyFundTarget3Months)}–${money(financials.emergencyFundTarget6Months)}` : "Add essential expenses to estimate"}</span></div><div><b>Goal funding</b><span>{goals.length ? financials.health.goalFunding === "covered" ? "Current free cash flow covers required goal contributions." : "Required goal contributions need review against current free cash flow." : "Add a financial goal to assess funding."}</span></div></div>
        </> : <Empty text="Your financial health metrics will appear after you add portfolio or profile details. Nothing is assumed or saved for you." />}
        <div className="runRateReview"><div><div className="eyebrow">12-MONTH RUN RATE</div><strong>{hasCashFlowInputs ? money(financials.freeCashFlow * 12) : "—"}</strong><span>Annual free cash flow at today&apos;s pace</span></div><p>This is a simple estimate based on your current monthly entries staying the same. It is not a forecast of changing income or costs.</p></div>
      </section>

      <section className="card portfolioPanel" id="portfolio" aria-labelledby="portfolio-title">
        <div className="portfolioHead"><div><div className="eyebrow">PORTFOLIO</div><h2 id="portfolio-title">Your money</h2><p>Cash flow, holdings, protection, and goals together in one place.</p></div><button className="secondary" onClick={()=>openModal(portfolioTab === "income" ? "income" : portfolioTab === "expenses" ? "expense" : portfolioTab === "investments" ? "investment" : portfolioTab === "loans" ? "loan" : portfolioTab === "insurance" ? "insurance" : "goal")}>Add {portfolioTab === "income" ? "income" : portfolioTab === "expenses" ? "expense" : portfolioTab === "investments" ? "investment" : portfolioTab === "loans" ? "loan" : portfolioTab === "insurance" ? "insurance" : "goal"}</button></div>
        <div className="portfolioTabs" aria-label="Portfolio categories">
          <button type="button" className={portfolioTab === "income" ? "active" : ""} aria-pressed={portfolioTab === "income"} onClick={()=>setPortfolioTab("income")}>Income <span>{income.length}</span></button>
          <button type="button" className={portfolioTab === "expenses" ? "active" : ""} aria-pressed={portfolioTab === "expenses"} onClick={()=>setPortfolioTab("expenses")}>Expenses <span>{expenses.length}</span></button>
          <button type="button" className={portfolioTab === "investments" ? "active" : ""} aria-pressed={portfolioTab === "investments"} onClick={()=>setPortfolioTab("investments")}>Investments <span>{investments.length}</span></button>
          <button type="button" className={portfolioTab === "loans" ? "active" : ""} aria-pressed={portfolioTab === "loans"} onClick={()=>setPortfolioTab("loans")}>Loans &amp; debt <span>{loans.length}</span></button>
          <button type="button" className={portfolioTab === "insurance" ? "active" : ""} aria-pressed={portfolioTab === "insurance"} onClick={()=>setPortfolioTab("insurance")}>Insurance <span>{insurance.length}</span></button>
          <button type="button" className={portfolioTab === "goals" ? "active" : ""} aria-pressed={portfolioTab === "goals"} onClick={()=>setPortfolioTab("goals")}>Goals <span>{goals.length}</span></button>
        </div>
        <div className="portfolioTabContent" aria-live="polite">
          {portfolioTab === "income" && <><div className="listSummary"><div><span>Planned monthly income</span><strong>{income.length ? money(financials.monthlyIncome) : "—"}</strong></div><small>{income.length ? `${income.length} income source${income.length===1?"":"s"}` : "Add income sources to include them in your plan"}</small></div>{income.length>0 && <button className="listToggle" type="button" aria-expanded={showAllIncome} aria-controls="income-records" onClick={()=>setShowAllIncome(v=>!v)}>{showAllIncome?"Hide entries":`Manage entries (${income.length})`}</button>}{income.length===0 && <Empty text="No income sources added yet." />}<div id="income-records" hidden={!showAllIncome}>{income.map(item=><Row key={item.id} title={item.name} sub={`${item.type} · ${item.frequency}`} val={money(item.amount)} actions={<Actions onEdit={()=>openModal("income",item)} onDelete={()=>removeRow("income",item.id)}/>} />)}</div></>}
          {portfolioTab === "expenses" && <><div className="listSummary"><div><span>Planned monthly expenses</span><strong>{expenses.length ? money(financials.livingExpenses) : "—"}</strong></div><small>{expenses.length ? `${expenses.length} recurring item${expenses.length===1?"":"s"}` : "Add recurring expenses to include them in your plan"}</small></div>{expenses.length>0 && <button className="listToggle" type="button" aria-expanded={showAllExpenses} aria-controls="expense-records" onClick={()=>setShowAllExpenses(v=>!v)}>{showAllExpenses?"Hide entries":`Manage entries (${expenses.length})`}</button>}{expenses.length===0 && <Empty text="No recurring expenses added yet." />}<div id="expense-records" hidden={!showAllExpenses}>{expenses.map(item=><Row key={item.id} title={item.name} sub={`${item.category} · ${item.frequency}`} val={money(item.amount)} actions={<Actions onEdit={()=>openModal("expense",item)} onDelete={()=>removeRow("expenses",item.id)}/>} />)}</div></>}
          {portfolioTab === "investments" && <><div className="listSummary"><div><span>Current investment value</span><strong>{investments.length ? money(financials.currentInvestmentValue) : "—"}</strong></div><small>{investments.length ? `${money(financials.investmentGainLoss)} gain / loss · ${investments.length} holding${investments.length===1?"":"s"}` : "Add holdings to track your portfolio"}</small></div>{investments.length>0 && <button className="listToggle" type="button" aria-expanded={showAllInvestments} aria-controls="investment-records" onClick={()=>setShowAllInvestments(v=>!v)}>{showAllInvestments?"Hide entries":`Manage entries (${investments.length})`}</button>}{investments.length===0 && <Empty text="No investments added yet." />}<div id="investment-records" hidden={!showAllInvestments}>{investments.map(item=><Row key={item.id} title={item.name} sub={`${item.type} · ${item.category} · ${item.mode}`} val={money(item.currentValue)} actions={<Actions onEdit={()=>openModal("investment",item)} onDelete={()=>removeRow("investments",item.id)}/>} />)}</div></>}
          {portfolioTab === "loans" && <><div className="listSummary"><div><span>Outstanding debt</span><strong>{loans.length ? money(financials.outstandingDebt) : "—"}</strong></div><small>{loans.length ? `${money(financials.debtPayments)} monthly EMI · ${loans.length} loan${loans.length===1?"":"s"}` : "Add a loan to track balances and EMIs"}</small></div>{loans.length>0 && <button className="listToggle" type="button" aria-expanded={showAllLoans} aria-controls="loan-records" onClick={()=>setShowAllLoans(v=>!v)}>{showAllLoans?"Hide entries":`Manage entries (${loans.length})`}</button>}{loans.length===0 && <Empty text="No loans added yet." />}<div id="loan-records" hidden={!showAllLoans}>{loans.map(item=><Row key={item.id} title={item.name} sub={`${item.type} · ${item.interestRate}% · ${item.tenureMonths} months`} val={money(item.outstanding)} actions={<Actions onEdit={()=>openModal("loan",item)} onDelete={()=>removeRow("loans",item.id)}/>} />)}</div></>}
          {portfolioTab === "insurance" && <><div className="listSummary"><div><span>Insurance cover tracked</span><strong>{insurance.length ? money(insurance.reduce((total, item) => total + item.coverage, 0)) : "—"}</strong></div><small>{insurance.length ? `${insurance.length} polic${insurance.length===1?"y":"ies"} · life ${money(financials.lifeCover)} · health ${money(financials.healthCover)}` : "Add a policy to track cover and renewal context"}</small></div>{insurance.length>0 && <button className="listToggle" type="button" aria-expanded={showAllInsurance} aria-controls="insurance-records" onClick={()=>setShowAllInsurance(v=>!v)}>{showAllInsurance?"Hide policies":`Manage policies (${insurance.length})`}</button>}{insurance.length===0 && <Empty text="No insurance policies added yet." />}<div id="insurance-records" hidden={!showAllInsurance}>{insurance.map(item=><Row key={item.id} title={item.type} sub={`${item.provider || "Provider not added"} · ${item.frequency}`} val={money(item.coverage)} actions={<Actions onEdit={()=>openModal("insurance",item)} onDelete={()=>removeRow("insurance",item.id)}/>} />)}</div></>}
          {portfolioTab === "goals" && <><div className="listSummary"><div><span>Total saved toward goals</span><strong>{goals.length ? money(financials.goals.reduce((total, goal) => total + goal.currentAmount, 0)) : "—"}</strong></div><small>{goals.length ? `${money(financials.goals.reduce((total, goal) => total + goal.targetAmount, 0))} target total · ${money(financials.goals.reduce((total, goal) => total + goal.requiredMonthlyContribution, 0))}/mo needed across all goals` : "Add goals to track targets and monthly contributions"}</small></div>{goals.length>0 && <button className="listToggle" type="button" aria-expanded={showAllGoals} aria-controls="goal-records" onClick={()=>setShowAllGoals(v=>!v)}>{showAllGoals?"Hide goals":`Manage goals (${goals.length})`}</button>}{goals.length===0 && <Empty text="No goals added yet." />}<div id="goal-records" hidden={!showAllGoals}>{financials.goals.map((item,index)=>{const storedGoal=goals.find(g=>g.name===item.name && g.targetAmount===item.targetAmount && g.currentAmount===item.currentAmount && g.targetDate===item.targetDate) || goals[index];return <div className="goal" key={storedGoal?.id || `${item.name}-${index}`}><div><b>{item.name}</b><small>{money(item.currentAmount)} of {money(item.targetAmount)} · {item.progress.toFixed(0)}% · {item.monthsRemaining} months left</small></div><div className="goalValue">{money(item.requiredMonthlyContribution)}/mo</div><div className="progress"><i style={{width:`${item.progress}%`}}/></div><div className="goalActions"><Actions onEdit={()=>storedGoal && openModal("goal",storedGoal)} onDelete={()=>{if(storedGoal?.id) removeRow("goals",storedGoal.id);}}/></div></div>})}</div></>}
        </div>
      </section>
      <section className="wideGrid"><div className="card block"><div className="blockhead"><div><div className="eyebrow">SPENDING PATTERN</div><h2>Where your recurring money goes</h2><p>Monthly normalized values from your expense records.</p></div></div>{spendingByCategory.length ? <div className="categoryBars">{spendingByCategory.map(([category, amount])=><div className="categoryBar" key={category}><div><span>{category}</span><b>{money(amount)}</b></div><div className="barTrack"><i style={{width:`${Math.min(100,(amount/Math.max(1,spendingByCategory[0][1]))*100)}%`}}/></div></div>)}</div> : <Empty text="Add expenses to see spending patterns." />}</div><div className="card block"><div className="blockhead"><div><div className="eyebrow">SCENARIO LAB</div><h2>What if I save more?</h2><p>A simple deterministic scenario. The amount is kept in this browser only after you change it.</p></div></div>{hasCashFlowInputs ? <><label className="label">Extra monthly saving <b>{money(scenarioExtra)}</b></label><input className="range" type="range" min="0" max="50000" step="1000" value={scenarioExtra} onChange={e=>updateScenarioExtra(numberValue(e.target.value))}/><div className="scenarioCards"><Metric label="Next free cash flow" value={money(scenario.nextFreeCashFlow)} /><Metric label="Emergency months after 12 mo" value={financials.essentialMonthlyExpenses > 0 ? `${scenario.nextEmergencyMonths.toFixed(1)} mo` : "—"} /><Metric label="Cash after goal contributions" value={goals.length ? money(scenario.cashAfterGoals) : "—"} /></div><small className="scenarioNote">Combined monthly goal contributions: {money(scenario.goalContributionNeed)}. Monthly investment contributions of {money(financials.investmentContributions)} are already counted in free cash flow.</small><button className="secondary fullScenario" onClick={()=>{openModal("scenario");setAnswer("");}}>Ask DhanView to explain</button></> : <Empty text="Add income, expenses, loans, or investments before running a scenario." />}</div></section>

      <section className="card monthTracker" id="transactions" aria-labelledby="month-tracker-title">
        <div className="blockhead monthTrackerHead">
          <div><div className="eyebrow">MONTH BY MONTH</div><h2 id="month-tracker-title">Monthly entries</h2><p>Add each dated income or expense once, with its category and source. Review and manage your actual entries by month; recurring plan amounts stay separate.</p></div>
           <div className="monthEntryActions"><TransactionCsvImport onImport={importCsvTransactions}/><button className="primary" type="button" onClick={()=>openModal("transaction")}>＋ Add entry</button></div>
        </div>
        <div className="monthTrackerControls">
          <Field label="Year"><select value={spendingYear} onChange={e=>{setSpendingYear(Number(e.target.value));setSpendingMonth("all");}}>{Array.from({length:25},(_,index)=>new Date().getFullYear()-index).map(year=><option value={year} key={year}>{year}</option>)}</select></Field>
          <Field label="Month"><select value={spendingMonth} onChange={e=>setSpendingMonth(e.target.value)}><option value="all">All months</option>{Array.from({length:12},(_,month)=><option value={month} key={month}>{new Date(2020,month,1).toLocaleString("en-IN",{month:"long"})}</option>)}</select></Field>
        </div>
        {yearTransactionsError ? <div className="error" role="alert"><span>{yearTransactionsError}</span><button className="secondary" type="button" onClick={()=>setYearTransactionsReload(v=>v+1)}>Retry</button></div> : yearTransactionsLoading ? <div className="empty" role="status">Loading entries for {spendingYear}…</div> : yearTransactions.length === 0 ? <Empty text={`No transaction entries for ${spendingYear} yet. Add an expense and choose its date to start building your spending history.`} /> : <>
          <div className="monthSummaryCards">
            <Metric label={spendingMonth === "all" ? `${spendingYear} recorded spending` : `${new Date(spendingYear,Number(spendingMonth),1).toLocaleString("en-IN",{month:"long"})} spending`} value={money(selectedPeriodSpending)} />
            <Metric label="Average month with entries" value={money(averageRecordedMonth)} />
            <Metric label="12-month run-rate" value={annualizedSpending === null ? "Need 3 months" : money(annualizedSpending)} />
          </div>
          <div className="monthTrendHeader"><h3>Recorded spending by month</h3><span>Peak: {peakSpendingMonth.expenses ? `${new Date(spendingYear,peakSpendingMonth.month,1).toLocaleString("en-IN",{month:"long"})} · ${money(peakSpendingMonth.expenses)}` : "No spending entries"}</span></div>
          <div className="monthTrend" aria-label={`Recorded expense entries for each month of ${spendingYear}`}>
            {monthlyTransactionSummary.map((item)=>{
              const maxExpense=Math.max(1,...monthlyTransactionSummary.map((month)=>month.expenses));
              const isSelected=spendingMonth===String(item.month);
              return <button className={`monthTrendColumn${isSelected?" selected":""}`} type="button" key={item.month} title={`${new Date(spendingYear,item.month,1).toLocaleString("en-IN",{month:"long"})}: ${money(item.expenses)}${item.count?` from ${item.count} entries`:" · no entries"}`} aria-label={`Filter ${new Date(spendingYear,item.month,1).toLocaleString("en-IN",{month:"long"})} ${spendingYear}, recorded spending ${money(item.expenses)}`} aria-pressed={isSelected} onClick={()=>setSpendingMonth(isSelected?"all":String(item.month))}>
                <span className="monthTrendValue">{item.expenses ? money(item.expenses) : "—"}</span><span className="monthTrendTrack"><i style={{height:item.expenses?`${Math.max(5,(item.expenses/maxExpense)*100)}%`:"0%"}}/></span><span className="monthTrendLabel">{new Date(spendingYear,item.month,1).toLocaleString("en-IN",{month:"short"})}</span>
              </button>;
            })}
          </div>
          <p className="monthTrackerNote">Run-rate is a simple estimate based on months with recorded expenses; it is not a prediction. Months without entries are shown as “—”, not treated as zero.</p>
          {yearTransactionsTruncated && <p className="monthTrackerNote" role="status">Showing the first 5,000 entries for this year. Choose a month to focus the view.</p>}
          <div className="monthEntriesHeader"><h3>{spendingMonth === "all" ? `Entries in ${spendingYear}` : `${new Date(spendingYear,Number(spendingMonth),1).toLocaleString("en-IN",{month:"long"})} ${spendingYear}`}</h3><span>{filteredYearTransactions.length} {filteredYearTransactions.length===1?"entry":"entries"}</span></div>
          {visibleYearTransactions.length ? <div className="transactionTable monthEntriesTable"><div className="txRow txHead monthEntryRow"><span>Date</span><span>Description</span><span>Category</span><span>Amount</span><span>Source &amp; actions</span></div>{visibleYearTransactions.map((item)=><div className="txRow monthEntryRow" key={item.id}><span>{formatDate(item.transactionDate)}</span><span><b>{item.description}</b></span><span>{item.category||"Uncategorized"}</span><span className={/income|credit/i.test(item.transactionType)?"txPositive":""}>{/income|credit/i.test(item.transactionType)?"+":"-"}{money(item.amount)}</span><span><small className="transactionSource">{item.source || "Manual"}</small><span className="rowactions"><button className="mini" onClick={()=>openModal("transaction",item)}>Edit</button><button className="del" onClick={()=>removeRow("transactions",item.id)}>Delete</button></span></span></div>)}</div> : <Empty text="No entries in this month." />}
          {filteredYearTransactions.length>visibleYearTransactions.length && <small className="moreText">Showing the latest {visibleYearTransactions.length} entries in this view.</small>}
        </>}
      </section>

      <section className="card coach" id="ai-coach"><div className="coachIntro"><div><div className="eyebrow">✦ DHANVIEW AI COACH</div><h2>Ask DhanView anything about your money.</h2><p>DhanView uses your recorded data and calculated summaries to explain your finances. Debt questions include only loan type, balance, rate, EMI and remaining term; other questions use calculated summaries. Login credentials are never sent. The Financial Engine remains the source of truth; answers that fail fact checks fall back to engine guidance.</p></div><div className="coachMark">✦</div></div><div className="promptSuggestions"><span className="suggestionLabel">Try asking</span><div className="prompts">{prompts.map(([icon,title,text])=><button className={`prompt ${question===text?"selected":""}`} key={title} onClick={()=>{setQuestion(text);setAnswer("");setError("")}}><em aria-hidden="true">{icon}</em><strong>{title}</strong></button>)}</div></div><label className="label" htmlFor="coach-question">Or ask your own question</label><textarea id="coach-question" value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={event=>{if((event.ctrlKey||event.metaKey)&&event.key==="Enter"){event.preventDefault();if(!aiLoading) void askDhanView();}}} placeholder="Example: How should I balance my emergency fund and investing?" rows={5}/><small className="note">DhanView uses <code>NEXT_PUBLIC_AI_ENDPOINT</code> when configured, including on localhost. Otherwise it uses the local Ollama gateway at <code>http://localhost:8787/api/coach</code>. If a local model is unavailable or an AI answer fails checks, DhanView shows deterministic engine guidance.</small><small className="note">Press Ctrl+Enter (or Cmd+Enter) to send your question with your DhanView financial context.</small><div className="coachActions"><button className="primary" disabled={aiLoading} onClick={()=>askDhanView()}>{aiLoading?"DhanView is thinking…":"Ask DhanView for guidance →"}</button><button className="secondary" disabled={aiLoading} onClick={()=>askDhanView("Review my finances and tell me the main areas I should review next. Use only the facts in my DhanView data.","review")}>Run financial review</button></div>{answer && <AiResponse answer={answer} grounding={answerGrounding} />}<small className="note">Educational guidance only. DhanView is not a SEBI-registered investment adviser or IRDAI insurance intermediary. Always verify product-specific decisions and current rules independently.</small></section>

      <footer className="footer"><div><strong>DhanView</strong><span>Personal finance &amp; planning</span><Link href="/release-notes/">Release notes <span aria-hidden="true">↗</span></Link></div><div>Built with <span aria-label="love">♥</span> by <b>Harish Sarma</b> · © 2026</div></footer>

      {modal === "profile" && <Modal title="Profile settings" close={closeModal} save={saveModal} busy={saveBusy} error={error}><div className="formGrid two"><Field label="Your name"><input value={form.name||""} onChange={e=>setField("name",e.target.value)}/></Field><Field label="Age"><input type="number" min="18" max="100" value={form.age||""} onChange={e=>setField("age",e.target.value)}/></Field><Field label="Dependents"><input type="number" min="0" value={form.dependents||""} onChange={e=>setField("dependents",e.target.value)}/></Field><Field label="Country"><input value={form.country||""} onChange={e=>setField("country",e.target.value)} placeholder="Optional"/></Field><Field label="Primary goal"><select value={form.primaryGoal||""} onChange={e=>setField("primaryGoal",e.target.value)}><option value="">Not set</option>{["Build emergency fund","Save for marriage","Invest more","Pay off debt","Major purchase","Build wealth","Other"].map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Risk profile"><select value={form.riskProfile||""} onChange={e=>setField("riskProfile",e.target.value)}><option value="">Not assessed</option>{["Conservative","Moderate","Aggressive"].map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Investment horizon"><select value={form.investmentHorizon||""} onChange={e=>setField("investmentHorizon",e.target.value)}><option value="">Not set</option>{["< 1 year","1–3 years","3–5 years","5+ years"].map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Liquid emergency savings"><input type="number" min="0" value={form.cashSavings||""} onChange={e=>setField("cashSavings",e.target.value)}/></Field><Field label="Life / term cover"><input type="number" min="0" value={form.lifeCover||""} onChange={e=>setField("lifeCover",e.target.value)}/></Field><Field label="Health cover"><input type="number" min="0" value={form.healthCover||""} onChange={e=>setField("healthCover",e.target.value)}/></Field></div></Modal>}
      {modal === "security" && <Modal title="Account & security" close={closeModal} save={updatePassword} busy={false}><div className="securityPanel"><div className="securityItem"><span>Signed-in email</span><b>{authEmail || "Authenticated account"}</b></div><div className="securityItem"><span>Data protection</span><b>Supabase Auth + Postgres RLS</b></div><div className="securityItem"><span>Change password</span><b>Updates your current account password</b></div><Field label="New password"><input type="password" minLength={8} value={securityPassword} onChange={e=>setSecurityPassword(e.target.value)} placeholder="At least 8 characters"/></Field><Field label="Confirm new password"><input type="password" minLength={8} value={securityConfirm} onChange={e=>setSecurityConfirm(e.target.value)} placeholder="Re-enter password"/></Field></div></Modal>}
      {(modal === "income" || modal === "expense" || modal === "investment" || modal === "loan" || modal === "insurance" || modal === "goal" || modal === "transaction") && <DataModal type={modal} form={form} setField={setField} saveModal={saveModal} closeModal={closeModal} busy={saveBusy} error={error} autoCategorize={modal === "transaction" ? autoCategorize : undefined} categorizing={categorizing} />}
      {modal === "scenario" && <Modal title="Scenario explanation" close={closeModal} wide><div className="scenarioExplain"><div className="scenarioCards"><Metric label="Extra saving" value={money(scenarioExtra)} /><Metric label="Next free cash flow" value={money(scenario.nextFreeCashFlow)} /><Metric label="After goal contributions" value={goals.length ? money(scenario.cashAfterGoals) : "—"} /><Metric label="Emergency cover after 12 mo" value={`${scenario.nextEmergencyMonths.toFixed(1)} months`} /></div><button className="primary" disabled={aiLoading} onClick={()=>askDhanView(`I am considering adding ${money(scenarioExtra)} of extra monthly savings. Explain what this changes in my current DhanView financial picture, including cash flow, emergency fund coverage and goal funding. Use the engine facts only.`,"scenario",{...scenario,extraMonthlySaving:scenarioExtra})}>{aiLoading?"DhanView is thinking…":"Ask DhanView to explain this scenario →"}</button>{answer && <AiResponse answer={answer} grounding={answerGrounding} />}</div></Modal>}
    </main>
  );
}

function formatDate(value: string) { return value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : "—"; }
function Stat({label,value,note,positive=false}:{label:string;value:string;note:string;positive?:boolean}){return <div className="stat"><small>{label}</small><strong>{value}</strong><span className={positive?"positive":""}>{note}</span></div>}
function Metric({label,value}:{label:string;value:string}){return <div className="metric"><span>{label}</span><strong>{value}</strong></div>}
function Actions({onEdit,onDelete}:{onEdit:()=>void;onDelete:()=>void}){return <div className="rowactions"><button className="mini" onClick={onEdit}>Edit</button><button className="del" onClick={onDelete}>Delete</button></div>}
function Empty({text}:{text:string}){return <div className="empty">{text}</div>}
function Row({title,sub,val,actions}:{title:string;sub:string;val:string;actions:React.ReactNode}){return <div className="row"><div><b>{title}</b><small>{sub}</small></div><div className="rowright"><b>{val}</b>{actions}</div></div>}
function Block({title,sub,add,onAdd,children}:{title:string;sub:string;add:string;onAdd:()=>void;children:React.ReactNode}){return <section className="card block"><div className="blockhead"><div><h2>{title}</h2><p>{sub}</p></div><button className="secondary" onClick={onAdd}>{add}</button></div>{children}</section>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="field"><span>{label}</span>{children}</label>}

function Modal({title,close,save,busy,children,wide=false,error}:{title:string;close:()=>void;save?:()=>void;busy?:boolean;children:React.ReactNode;wide?:boolean;error?:string}){return <div className="backdrop" onMouseDown={busy?undefined:close}><div className={`modal ${wide?"modalWide":""}`} onMouseDown={e=>e.stopPropagation()}><div className="modalhead"><div><h2>{title}</h2></div><button className="x" disabled={busy} onClick={close}>×</button></div><div className="modalbody">{error && <div className="error modalError" role="alert">{error}</div>}{children}<div className="modalactions"><button
  type="button"
  className="secondary"
  disabled={busy}
  onClick={close}
>
  Cancel
</button>
 <button
  type="button"
  className="primary"
  disabled={busy}
  onClick={save}
>
  {busy ? "Saving…" : "Save changes"}
</button></div></div></div></div>}

function DataModal({type,form,setField,saveModal,closeModal,busy,error,autoCategorize,categorizing}:{type:ModalType;form:FormState;setField:(k:string,v:string|number)=>void;saveModal:()=>void;closeModal:()=>void;busy:boolean;error?:string;autoCategorize?:()=>void;categorizing?:boolean}){
  const titles:Record<string,string>={income:"Add income",expense:"Add expense",investment:"Add investment",loan:"Add loan",insurance:"Add insurance",goal:"Add financial goal",transaction:"Add transaction"};
  return <Modal title={titles[type]||"DhanView"} close={closeModal} save={saveModal} busy={busy} error={error} wide={type==="investment"||type==="transaction"}><div className="formGrid two">
    {type==="income" && <><Field label="Source"><input value={form.name||""} onChange={e=>setField("name",e.target.value)} placeholder="Salary, rent, freelance…"/></Field><Field label="Description"><select value={form.type||"Salary"} onChange={e=>setField("type",e.target.value)}>{incomeTypes.map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Amount"><input type="number" min="0" value={form.amount||""} onChange={e=>setField("amount",e.target.value)}/></Field><Field label="Frequency"><select value={form.frequency||"Monthly"} onChange={e=>setField("frequency",e.target.value)}>{frequencies.map(v=><option key={v}>{v}</option>)}</select></Field></>}
    {type==="expense" && <><Field label="Description"><input value={form.name||""} onChange={e=>setField("name",e.target.value)} placeholder="Rent, groceries…"/></Field><Field label="Category"><select value={form.category||"Housing"} onChange={e=>setField("category",e.target.value)}>{expenseCategories.map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Amount"><input type="number" min="0" value={form.amount||""} onChange={e=>setField("amount",e.target.value)}/></Field><Field label="Frequency"><select value={form.frequency||"Monthly"} onChange={e=>setField("frequency",e.target.value)}>{frequencies.map(v=><option key={v}>{v}</option>)}</select></Field></>}
    {type==="investment" && <><Field label="Name"><input value={form.name||""} onChange={e=>setField("name",e.target.value)} placeholder="SBI ELSS, stock…"/></Field><Field label="Type"><select value={form.type||"Mutual Fund"} onChange={e=>setField("type",e.target.value)}>{investmentTypes.map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Category"><select value={form.category||"Equity"} onChange={e=>setField("category",e.target.value)}>{investmentCategories.map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Mode"><select value={form.mode||"SIP"} onChange={e=>setField("mode",e.target.value)}>{["SIP","Lump sum","Employer","Other"].map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Monthly contribution"><input type="number" min="0" value={form.monthlyAmount||""} onChange={e=>setField("monthlyAmount",e.target.value)}/></Field><Field label="Total invested"><input type="number" min="0" value={form.investedAmount||""} onChange={e=>setField("investedAmount",e.target.value)}/></Field><Field label="Current value"><input type="number" min="0" value={form.currentValue||""} onChange={e=>setField("currentValue",e.target.value)}/></Field><Field label="Start date"><input type="date" value={form.startDate||""} onChange={e=>setField("startDate",e.target.value)}/></Field></>}
    {type==="loan" && <><Field label="Name"><input value={form.name||""} onChange={e=>setField("name",e.target.value)} placeholder="Car loan"/></Field><Field label="Loan type"><select value={form.type||"Car Loan"} onChange={e=>setField("type",e.target.value)}>{loanTypes.map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Original amount"><input type="number" min="0" value={form.originalAmount||""} onChange={e=>setField("originalAmount",e.target.value)}/></Field><Field label="Outstanding"><input type="number" min="0" value={form.outstanding||""} onChange={e=>setField("outstanding",e.target.value)}/></Field><Field label="Monthly EMI"><input type="number" min="0" value={form.emi||""} onChange={e=>setField("emi",e.target.value)}/></Field><Field label="Interest rate %"><input type="number" step="0.01" min="0" value={form.interestRate||""} onChange={e=>setField("interestRate",e.target.value)}/></Field><Field label="Tenure remaining months"><input type="number" min="0" value={form.tenureMonths||""} onChange={e=>setField("tenureMonths",e.target.value)}/></Field></>}
    {type==="insurance" && <><Field label="Policy type"><select value={form.type||"Life / Term"} onChange={e=>setField("type",e.target.value)}>{insuranceTypes.map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Provider"><input value={form.provider||""} onChange={e=>setField("provider",e.target.value)}/></Field><Field label="Coverage"><input type="number" min="0" value={form.coverage||""} onChange={e=>setField("coverage",e.target.value)}/></Field><Field label="Premium"><input type="number" min="0" value={form.premium||""} onChange={e=>setField("premium",e.target.value)}/></Field><Field label="Premium frequency"><select value={form.frequency||"Yearly"} onChange={e=>setField("frequency",e.target.value)}>{frequencies.map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Renewal date"><input type="date" value={form.renewalDate||""} onChange={e=>setField("renewalDate",e.target.value)}/></Field></>}
    {type==="goal" && <><Field label="Goal type"><select value={form.type||"Other"} onChange={e=>setField("type",e.target.value)}>{goalTypes.map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Goal name"><input value={form.name||""} onChange={e=>setField("name",e.target.value)} placeholder="Marriage, home, emergency fund…"/></Field><Field label="Target amount"><input type="number" min="0" value={form.targetAmount||""} onChange={e=>setField("targetAmount",e.target.value)}/></Field><Field label="Current amount"><input type="number" min="0" value={form.currentAmount||""} onChange={e=>setField("currentAmount",e.target.value)}/></Field><Field label="Target date"><input type="date" value={form.targetDate||""} onChange={e=>setField("targetDate",e.target.value)}/></Field></>}
    {type==="transaction" && <><Field label="Transaction date (month and year)"><input type="date" value={form.transactionDate||""} onChange={e=>setField("transactionDate",e.target.value)}/></Field><Field label="Description"><input value={form.description||""} onChange={e=>setField("description",e.target.value)} placeholder="Amazon, salary credit, rent…"/></Field><Field label="Amount"><input type="number" min="0" value={form.amount||""} onChange={e=>setField("amount",e.target.value)}/></Field><Field label="Type"><select value={form.transactionType||"Expense"} onChange={e=>setField("transactionType",e.target.value)}>{["Expense","Income","Credit","Debit"].map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Category"><div className="inlineInput"><input value={form.category||""} onChange={e=>setField("category",e.target.value)} placeholder="Leave blank for Other"/><button type="button" className="mini" onClick={autoCategorize} disabled={categorizing}>{categorizing?"Thinking…":"Auto-categorize"}</button></div></Field><Field label="Source"><select value={form.source||"Manual"} onChange={e=>setField("source",e.target.value)}>{["Manual","Imported","Bank", "Card", "Other"].map(v=><option key={v}>{v}</option>)}</select></Field></>}
  </div></Modal>
}
