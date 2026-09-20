"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "./lib/supabase";
import { calculateFinancials } from "./lib/financial-engine";
import { prompts } from "./lib/prompts";

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
const profileDefaults: Omit<Profile, "id"> = { name: "", age: 34, dependents: 0, country: "India", riskProfile: "Moderate", investmentHorizon: "5+ years", primaryGoal: "Build wealth", lifeCover: 0, healthCover: 0, cashSavings: 0 };
const frequencies = ["Monthly", "Weekly", "Quarterly", "Half-yearly", "Yearly"];
const incomeTypes = ["Salary", "Rental", "Freelance", "Business", "Interest", "Dividend", "Pension", "Capital gains", "Other"];
const expenseCategories = ["Housing", "Food", "Transport", "Utilities", "Healthcare", "Insurance", "Education", "Shopping", "Entertainment", "Subscriptions", "Other"];
const investmentTypes = ["Mutual Fund", "ELSS", "Stock", "ETF", "FD", "PPF", "NPS", "Bond", "Gold", "Other"];
const investmentCategories = ["Equity", "Debt", "Hybrid", "Cash", "Gold", "Real Estate", "Other"];
const loanTypes = ["Home Loan", "Car Loan", "Personal Loan", "Education Loan", "Credit Card", "Two-wheeler Loan", "Other"];
const insuranceTypes = ["Life / Term", "Health", "Personal Accident", "Other"];
const goalTypes = ["Emergency fund", "Marriage", "Home", "Education", "Vehicle", "Retirement", "Travel", "Other"];
function getAiTarget() {
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    return "http://localhost:8787/api/coach";
  }
  return process.env.NEXT_PUBLIC_AI_ENDPOINT || "";
}

function normalizeProfile(row: any, fallbackName = "") : Profile {
  return { id: row?.user_id ?? row?.id ?? "", name: row?.full_name ?? row?.name ?? fallbackName, age: numberValue(row?.age ?? profileDefaults.age), dependents: numberValue(row?.dependents), country: row?.country ?? "India", riskProfile: row?.risk_profile ?? row?.riskProfile ?? "Moderate", investmentHorizon: row?.investment_horizon ?? row?.investmentHorizon ?? "5+ years", primaryGoal: row?.primary_goal ?? row?.primaryGoal ?? "Build wealth", lifeCover: numberValue(row?.life_cover ?? row?.lifeCover), healthCover: numberValue(row?.health_cover ?? row?.healthCover), cashSavings: numberValue(row?.cash_savings ?? row?.cashSavings) };
}
function mapRows<T extends Record<string, any>>(rows: T[] | null) { return (rows ?? []).map((row) => ({ ...row })); }

export default function Home() {
  const router = useRouter();
  const [sessionReady, setSessionReady] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [saveBusy, setSaveBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [profileMenu, setProfileMenu] = useState(false);
  const [modal, setModal] = useState<ModalType>("");
  const [edit, setEdit] = useState<any>(null);
  const [form, setForm] = useState<FormState>({});
  const [securityPassword, setSecurityPassword] = useState("");
  const [securityConfirm, setSecurityConfirm] = useState("");
  const [profile, setProfile] = useState<Profile>({ id: "", ...profileDefaults });
  const [authEmail, setAuthEmail] = useState("");
  const [income, setIncome] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [insurance, setInsurance] = useState<Insurance[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [scenarioExtra, setScenarioExtra] = useState(5000);
  const [categorizing, setCategorizing] = useState(false);

  const closeModal = () => { setModal(""); setEdit(null); setForm({}); setSecurityPassword(""); setSecurityConfirm(""); };
  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2600); };
  const setField = (key: string, value: string | number) => setForm((old) => ({ ...old, [key]: value }));

  const loadAll = useCallback(async (userId: string, userName: string) => {
    setLoadingData(true); setError("");
    const [profileRes, incomeRes, expenseRes, investmentRes, loanRes, insuranceRes, goalRes, txRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
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
    const localProfile = typeof window !== "undefined" ? localStorage.getItem("artha-profile") : null;
    const hasLegacy = typeof window !== "undefined" && ["artha-income", "artha-expenses", "artha-investments", "artha-loans", "artha-goals"].some((key) => !!localStorage.getItem(key));

    if (rowsEmpty && (localProfile || hasLegacy)) {
      try {
        const local = (key: string) => { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } };
        const p = local("artha-profile");
        const nextProfile = { id: userId, ...profileDefaults, ...p, name: p?.name || userName };
        const legacyProfilePayload = {
          full_name: nextProfile.name,
          age: numberValue(nextProfile.age),
          dependents: numberValue(nextProfile.dependents),
          country: nextProfile.country || "India",
          risk_profile: nextProfile.risk || nextProfile.riskProfile || "Moderate",
          investment_horizon: nextProfile.horizon || nextProfile.investmentHorizon || "5+ years",
          primary_goal: nextProfile.goal || nextProfile.primaryGoal || "Build wealth",
          life_cover: numberValue(nextProfile.lifeCover),
          health_cover: numberValue(nextProfile.healthCover),
          cash_savings: numberValue(nextProfile.cashSavings),
        };
        const legacyProfileExisting = await supabase.from("profiles").select("user_id").eq("user_id", userId).maybeSingle();
        if (legacyProfileExisting.error) throw legacyProfileExisting.error;
        if (legacyProfileExisting.data) {
          const legacyProfileUpdate = await supabase.from("profiles").update(legacyProfilePayload).eq("user_id", userId);
          if (legacyProfileUpdate.error) throw legacyProfileUpdate.error;
        } else {
          const legacyProfileInsert = await supabase.from("profiles").insert({ ...legacyProfilePayload, user_id: userId });
          if (legacyProfileInsert.error) throw legacyProfileInsert.error;
        }
        for (const row of local("artha-income") || []) {
          const result = await supabase.from("income").insert({
            user_id: userId,
            source: row.name || "Income",
            description: row.type || "Other",
            amount: numberValue(row.amount),
            frequency: String(row.frequency || "Monthly"),
          });
          if (result.error) throw result.error;
        }
        for (const row of local("artha-expenses") || []) {
          const result = await supabase.from("expenses").insert({
            user_id: userId,
            description: row.name || "Expense",
            category: row.category || "Other",
            amount: numberValue(row.amount),
            frequency: String(row.frequency || "Monthly"),
            is_essential: false,
          });
          if (result.error) throw result.error;
        }
        for (const row of local("artha-investments") || []) {
          const result = await supabase.from("investments").insert({
            user_id: userId,
            name: row.name || "Investment",
            type: row.type || "Other",
            category: row.category || "Other",
            contribution_type: row.mode || "Lump sum",
            monthly_amount: numberValue(row.monthlyAmount),
            invested_amount: numberValue(row.investedAmount),
            current_value: numberValue(row.currentValue),
            start_date: row.startDate || null,
          });
          if (result.error) throw result.error;
        }
        for (const row of local("artha-loans") || []) {
          const result = await supabase.from("loans").insert({
            user_id: userId,
            type: row.type || "Other",
            description: row.name || "Loan",
            original_amount: numberValue(row.originalAmount),
            outstanding_amount: numberValue(row.outstanding),
            emi_amount: numberValue(row.emi),
            interest_rate: numberValue(row.interestRate),
            tenure_months: numberValue(row.tenureMonths),
            remaining_months: numberValue(row.tenureMonths),
          });
          if (result.error) throw result.error;
        }
        for (const row of local("artha-goals") || []) {
          if (!row.targetDate) continue;
          const result = await supabase.from("goals").insert({
            user_id: userId,
            type: row.type || "Other",
            name: row.name || "Goal",
            target_amount: numberValue(row.targetAmount),
            current_amount: numberValue(row.currentAmount),
            target_date: row.targetDate,
          });
          if (result.error) throw result.error;
        }
        ["artha-profile", "artha-income", "artha-expenses", "artha-investments", "artha-loans", "artha-goals"].forEach((key) => localStorage.removeItem(key));
        showToast("Your previous Artha data was moved into your account.");
        return loadAll(userId, userName);
      } catch (migrationError) { console.warn("Artha legacy migration skipped", migrationError); }
    }

    setProfile(profileRes.data ? normalizeProfile(profileRes.data, userName) : { id: userId, ...profileDefaults, name: userName });
    setIncome(mapRows(incomeRes.data).map((r: any) => ({
      id: r.id,
      name: r.source || "Income",
      type: r.description || "Other",
      amount: numberValue(r.amount),
      frequency: r.frequency || "Monthly",
    })));
    setExpenses(mapRows(expenseRes.data).map((r: any) => ({
      id: r.id,
      name: r.description || "Expense",
      category: r.category || "Other",
      amount: numberValue(r.amount),
      frequency: r.frequency || "Monthly",
    })));
    setInvestments(mapRows(investmentRes.data).map((r: any) => ({
      id: r.id,
      name: r.name || r.fund_name || "Investment",
      type: r.type || "Other",
      category: r.category || "Other",
      mode: r.contribution_type || "Lump sum",
      monthlyAmount: numberValue(r.monthly_amount),
      investedAmount: numberValue(r.invested_amount),
      currentValue: numberValue(r.current_value),
      startDate: r.start_date,
    })));
    setLoans(mapRows(loanRes.data).map((r: any) => ({
      id: r.id,
      name: r.description || r.lender || r.type || "Loan",
      type: r.type || "Other",
      originalAmount: numberValue(r.original_amount),
      outstanding: numberValue(r.outstanding_amount),
      emi: numberValue(r.emi_amount),
      interestRate: numberValue(r.interest_rate),
      tenureMonths: numberValue(r.remaining_months ?? r.tenure_months),
    })));
    setInsurance(mapRows(insuranceRes.data).map((r: any) => ({
      id: r.id,
      type: r.type || "Other",
      provider: r.provider || "",
      coverage: numberValue(r.coverage_amount),
      premium: numberValue(r.premium_amount),
      frequency: r.premium_frequency || "Yearly",
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

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!data.session) { router.replace("/auth"); return; }
      setSessionReady(true);
      setAuthEmail(data.session.user.email || "");
      const name = data.session.user.user_metadata?.full_name || data.session.user.email?.split("@")[0] || "there";
      try { await loadAll(data.session.user.id, name); }
      catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unable to load your financial data."); setLoadingData(false); }
    };
    bootstrap();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") router.replace("/auth"); });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, [loadAll, router]);

  const financials = useMemo(() => calculateFinancials({
    profile: { name: profile.name, age: profile.age, dependents: profile.dependents, riskProfile: profile.riskProfile, investmentHorizon: profile.investmentHorizon, primaryGoal: profile.primaryGoal, lifeCover: profile.lifeCover, healthCover: profile.healthCover, cashSavings: profile.cashSavings },
    income, expenses, investments, loans, insurance, goals,
  }), [profile, income, expenses, investments, loans, insurance, goals]);

  const spendingByCategory = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((item) => map.set(item.category, (map.get(item.category) || 0) + convertMonthly(item.amount, item.frequency)));
    return [...map.entries()].sort((a,b)=>b[1]-a[1]);
  }, [expenses]);

  const scenario = useMemo(() => {
    const extra = Math.max(0, scenarioExtra);
    const nextFreeCashFlow = financials.freeCashFlow + extra;
    const currentEmergency = financials.cashSavings;
    const nextEmergencyMonths = financials.essentialMonthlyExpenses > 0 ? (currentEmergency + extra * 12) / financials.essentialMonthlyExpenses : 0;
    const fundedGoals = financials.goals.filter((g) => g.requiredMonthlyContribution > 0 && g.requiredMonthlyContribution <= nextFreeCashFlow).length;
    return { nextFreeCashFlow, nextEmergencyMonths, fundedGoals };
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
    const lines = ["### Artha's engine-based view", ""];

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

    lines.push("", "This fallback uses Artha's deterministic engine facts only; no AI inference was used.");
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
    else if (type === "transaction") setForm(item ? { transactionDate:item.transactionDate, description:item.description, amount:item.amount, transactionType:item.transactionType, category:item.category, source:item.source } : { transactionDate:new Date().toISOString().slice(0,10), description:"", amount:"", transactionType:"Expense", category:"", source:"Manual" });
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
          full_name: String(form.name || "").trim(),
          age: numberValue(form.age),
          dependents: numberValue(form.dependents),
          country: String(form.country || "India").trim(),
          risk_profile: String(form.riskProfile || "Moderate"),
          investment_horizon: String(form.investmentHorizon || "5+ years"),
          primary_goal: String(form.primaryGoal || "Build wealth"),
          life_cover: numberValue(form.lifeCover),
          health_cover: numberValue(form.healthCover),
          cash_savings: numberValue(form.cashSavings),
        };

        // The auth trigger normally creates this row at signup. Update it directly
        // first so profile saving only needs the profile UPDATE/SELECT RLS policies.
        const updated = await supabase
          .from("profiles")
          .update(payload)
          .eq("user_id", userId)
          .select("*")
          .maybeSingle();

        if (updated.error) throw updated.error;

        let savedProfile = updated.data;

        // Fallback for older accounts created before the profile trigger existed.
        if (!savedProfile) {
          const inserted = await supabase
            .from("profiles")
            .insert({ ...payload, user_id: userId })
            .select("*")
            .single();

          if (inserted.error) throw inserted.error;
          savedProfile = inserted.data;
        }

        setProfile(normalizeProfile(savedProfile, payload.full_name));
        closeModal();
        showToast("Profile saved successfully.");
        return;
      }

      if (modal === "income") {
        const source = String(form.name || "Income").trim();
        const description = String(form.type || "Other").trim();
        const payload = {
          source,
          description,
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
          name: row.source || "Income",
          type: row.description || "Other",
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
        const description = String(form.name || "Expense").trim();
        const payload = {
          description,
          category: String(form.category || "Other"),
          amount: numberValue(form.amount),
          frequency: String(form.frequency || "Monthly"),
          is_essential: false,
        };

        const result = edit
          ? await supabase.from("expenses").update(payload).eq("id", edit.id).eq("user_id", userId).select("*").single()
          : await supabase.from("expenses").insert({ ...payload, user_id: userId }).select("*").single();

        if (result.error) throw result.error;
        if (!result.data) throw new Error("Expense was saved but no row was returned.");

        const row = result.data;
        const item: Expense = {
          id: row.id,
          name: row.description || "Expense",
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
          contribution_type: String(form.mode || "Lump sum"),
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
          mode: row.contribution_type || "Lump sum",
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
          description: String(form.name || "Loan"),
          original_amount: numberValue(form.originalAmount),
          outstanding_amount: numberValue(form.outstanding),
          emi_amount: numberValue(form.emi),
          interest_rate: numberValue(form.interestRate),
          tenure_months: numberValue(form.tenureMonths),
          remaining_months: numberValue(form.tenureMonths),
        };

        const result = edit
          ? await supabase.from("loans").update(payload).eq("id", edit.id).eq("user_id", userId).select("*").single()
          : await supabase.from("loans").insert({ ...payload, user_id: userId }).select("*").single();

        if (result.error) throw result.error;
        if (!result.data) throw new Error("Loan was saved but no row was returned.");

        const row = result.data;
        const item: Loan = {
          id: row.id,
          name: row.description || row.lender || row.type || "Loan",
          type: row.type || "Other",
          originalAmount: numberValue(row.original_amount),
          outstanding: numberValue(row.outstanding_amount),
          emi: numberValue(row.emi_amount),
          interestRate: numberValue(row.interest_rate),
          tenureMonths: numberValue(row.remaining_months ?? row.tenure_months),
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
          coverage_amount: numberValue(form.coverage),
          premium_amount: numberValue(form.premium),
          premium_frequency: String(form.frequency || "Yearly"),
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
          coverage: numberValue(row.coverage_amount),
          premium: numberValue(row.premium_amount),
          frequency: row.premium_frequency || "Yearly",
          renewalDate: row.renewal_date,
        };

        setInsurance((items) =>
          edit ? items.map((v) => (v.id === edit.id ? item : v)) : [item, ...items]
        );
        closeModal();
        showToast("Insurance saved.");
        return;
      }

      if (modal === "goal") {
        const payload = {
          type: String(form.type || "Other"),
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
          transaction_date: String(form.transactionDate || new Date().toISOString().slice(0, 10)),
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
        closeModal();
        showToast("Transaction saved.");
        return;
      }
    } catch (saveError: any) {
      const message = saveError?.message || saveError?.error_description || "Unable to save changes.";
      const details = saveError?.details ? ` Details: ${saveError.details}` : "";
      const hint = saveError?.hint ? ` Hint: ${saveError.hint}` : "";
      const code = saveError?.code ? ` [${saveError.code}]` : "";
      const status = saveError?.status ? ` (HTTP ${saveError.status})` : "";

      let rawText = "";
      try {
        rawText = JSON.stringify(saveError, Object.getOwnPropertyNames(saveError));
      } catch {
        rawText = String(saveError);
      }

      const errorText = `${message}${code}${status}${details}${hint}`;
      console.error(`Artha save error: ${errorText}`);
      console.error("Artha save error raw:", rawText);
      setError(errorText === "Unable to save changes." && rawText ? `${errorText} Raw: ${rawText}` : errorText);
    } finally {
      setSaveBusy(false);
    }
  }

  async function removeRow(table: string, id: string) {
    if (!window.confirm("Delete this item from your Artha account?")) return;
    const { error } = await supabase.from(table).delete().eq("id", id).eq("user_id", profile.id);
    if (error) { setError(error.message); return; }
    if (table === "income") setIncome(v=>v.filter(x=>x.id!==id));
    if (table === "expenses") setExpenses(v=>v.filter(x=>x.id!==id));
    if (table === "investments") setInvestments(v=>v.filter(x=>x.id!==id));
    if (table === "loans") setLoans(v=>v.filter(x=>x.id!==id));
    if (table === "insurance") {
      const nextInsurance = insurance.filter(x=>x.id!==id);
      setInsurance(nextInsurance);
      const life = nextInsurance.filter(v=>/life|term/i.test(v.type)).reduce((a,v)=>a+numberValue(v.coverage),0);
      const health = nextInsurance.filter(v=>/health|medical/i.test(v.type)).reduce((a,v)=>a+numberValue(v.coverage),0);
      const coverageUpdate = await supabase.from("profiles").update({ life_cover: life, health_cover: health }).eq("user_id", profile.id);
      if (!coverageUpdate.error) setProfile(p=>({...p, lifeCover: life, healthCover: health}));
    }
    if (table === "goals") setGoals(v=>v.filter(x=>x.id!==id));
    if (table === "transactions") setTransactions(v=>v.filter(x=>x.id!==id));
    showToast("Deleted.");
  }

  async function askArtha(
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

    const target = getAiTarget();
    const isLocal = typeof window !== "undefined" && window.location.hostname === "localhost";

    if (!target) {
      setAnswer(localFallbackAnswer(nextQuestion, mode));
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
          financialContext: aiContext,
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

      setAnswer(data.answer || localFallbackAnswer(nextQuestion, mode));
    } catch (err) {
      if (isLocal) {
        setAnswer(localFallbackAnswer(nextQuestion, mode));
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
        showToast(`Artha categorized this as ${localCategory}.`);
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
      showToast(`Artha categorized this as ${category}.`);
    } catch (err) {
      if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        setField("category", localCategory);
        showToast(`Artha categorized this as ${localCategory}.`);
      } else {
        setError(err instanceof Error ? err.message : "Unable to categorize.");
      }
    } finally {
      setCategorizing(false);
    }
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut({ scope:"local" });
    if (error) { setError(error.message); return; }
    router.replace("/auth"); router.refresh();
  }

  async function updatePassword() {
    if (securityPassword.length < 8) { setError("Use at least 8 characters."); return; }
    if (securityPassword !== securityConfirm) { setError("Passwords do not match."); return; }
    const { error } = await supabase.auth.updateUser({ password: securityPassword });
    if (error) { setError(error.message); return; }
    closeModal(); showToast("Password updated.");
  }

  if (!sessionReady || loadingData) return <div className="loading"><div><div className="loadingMark">✦</div><strong>Loading your Artha workspace…</strong></div></div>;

  return (
    <main className="shell">
      <header className="appHeader"><div className="headerInner"><div className="brandWrap"><div className="brandSymbol">✦</div><div><div className="brand">Artha</div><div className="tag">Your AI Financial Coach</div></div></div><div className="headerActions"><div className="secureBadge"><span>●</span> Secure</div><div className="profileArea"><button className="profileButton" onClick={()=>setProfileMenu(v=>!v)} aria-expanded={profileMenu}><span className="profileAvatar">{(profile.name||"A").charAt(0).toUpperCase()}</span><span className="profileButtonText">{profile.name || "Profile"}</span><span className="profileChevron">{profileMenu?"⌃":"⌄"}</span></button>{profileMenu && <div className="profileMenu"><button className="profileMenuUser profileMenuUserButton" onClick={()=>{setProfileMenu(false);openModal("profile");}}><span className="profileMenuAvatar">{(profile.name||"A").charAt(0).toUpperCase()}</span><span><strong>{profile.name||"Your profile"}</strong><small>Personal account</small></span></button><div className="profileMenuDivider"/><button className="profileMenuItem" onClick={()=>{setProfileMenu(false);openModal("profile");}}>👤 <span>Profile settings</span></button><button className="profileMenuItem" onClick={()=>{setProfileMenu(false);openModal("security");}}>🔐 <span>Account & security</span></button><button className="profileMenuItem signOut" onClick={handleSignOut}>↪ <span>Sign out</span></button></div>}</div></div></div></header>

      <section className="hero"><div><div className="eyebrow">YOUR MONEY, ONE PLACE</div><h1>Hi {profile.name || "there"} 👋<br/>Let&apos;s understand your money.</h1><p>Track cash flow, investments, loans, protection and goals. Artha keeps the calculations deterministic and uses AI to explain what the numbers mean.</p></div><div className="heroActions"><button className="primary" onClick={()=>openModal("transaction")}>＋ Add transaction</button><button className="secondary" onClick={()=>openModal("profile")}>Edit profile</button></div></section>

      {error && <div className="error pageError">{error}<button onClick={()=>setError("")}>×</button></div>}
      {toast && <div className="toast">✓ {toast}</div>}

      <section className="stats"><Stat label="Monthly income" value={money(financials.monthlyIncome)} note={`${income.length} source${income.length===1?"":"s"}`} /><Stat label="Monthly outflow" value={money(financials.monthlyOutflow)} note="Living + EMI + investments" /><Stat label="Free cash flow" value={money(financials.freeCashFlow)} note={`${financials.savingsRate.toFixed(1)}% savings rate`} positive={financials.freeCashFlow>=0} /><Stat label="Tracked net worth" value={money(financials.trackedNetWorth)} note={`${money(financials.currentInvestmentValue)} investments · ${money(financials.outstandingDebt)} debt`} /></section>

      <section className="insightGrid"><div className="card insightCard"><div className="cardHeader"><div><div className="eyebrow">FINANCIAL HEALTH</div><h2>What the engine sees</h2><p>Deterministic metrics from the information you entered.</p></div><span className="healthPill">{financials.health.cashFlow === "positive" ? "Cash flow positive" : "Cash flow needs attention"}</span></div><div className="healthGrid"><Metric label="Savings rate" value={`${financials.savingsRate.toFixed(1)}%`} /><Metric label="Debt service" value={`${financials.debtServiceRatio.toFixed(1)}%`} /><Metric label="Emergency cover" value={`${financials.emergencyCoverageMonths.toFixed(1)} mo`} /><Metric label="Investing rate" value={`${financials.investmentContributionRate.toFixed(1)}%`} /></div><div className="healthNotes"><div><b>Emergency target</b><span>{money(financials.emergencyFundTarget3Months)}–{money(financials.emergencyFundTarget6Months)}</span></div><div><b>Goal funding</b><span>{financials.health.goalFunding === "covered" ? "Current free cash flow covers required goal contributions." : "Required goal contributions need review against current free cash flow."}</span></div></div></div><div className="card snapshot"><div className="eyebrow">QUICK REVIEW</div><h2>12-month outlook</h2><div className="forecastSummary"><strong>{money(financials.freeCashFlow * 12)}</strong><span>annual free cash flow at today&apos;s run rate</span></div><div className="forecastBars" aria-label="Twelve month run-rate cash flow"><div className="forecastBarsInner">{financials.projectedCashFlow.map(item=><div className="forecastCol" key={item.month}><i style={{height:`${Math.max(8, Math.min(100, Math.abs(item.freeCashFlow)/(Math.max(1,Math.abs(financials.freeCashFlow))*1.15)*100))}%`}}/><span>{item.month.slice(5)}</span></div>)}</div></div><div className="snapshotRow"><span>Cash savings</span><b>{money(financials.cashSavings)}</b></div><div className="snapshotRow"><span>Life cover</span><b>{money(financials.lifeCover)}</b></div><div className="snapshotRow"><span>Health cover</span><b>{money(financials.healthCover)}</b></div><div className="snapshotRow"><span>Outstanding debt</span><b>{money(financials.outstandingDebt)}</b></div><small className="forecastNote">Run-rate only: assumes today&apos;s recurring income, expenses, debt payments and investment contributions stay constant.</small></div></section>

      <section className="dashboardGrid"><Block title="Income" sub="Monthly and recurring income sources." add="Add income" onAdd={()=>openModal("income")}>{income.length ? income.map(item=><Row key={item.id} title={item.name} sub={`${item.type} · ${item.frequency}`} val={money(item.amount)} actions={<Actions onEdit={()=>openModal("income",item)} onDelete={()=>removeRow("income",item.id)}/>} />) : <Empty text="No income added yet." />}</Block><Block title="Expenses" sub="Recurring spending. EMI is tracked separately in loans." add="Add expense" onAdd={()=>openModal("expense")}>{expenses.length ? expenses.slice(0,8).map(item=><Row key={item.id} title={item.name} sub={`${item.category} · ${item.frequency}`} val={money(item.amount)} actions={<Actions onEdit={()=>openModal("expense",item)} onDelete={()=>removeRow("expenses",item.id)}/>} />) : <Empty text="No recurring expenses added yet." />} {expenses.length>8 && <small className="moreText">Showing 8 of {expenses.length}. Use Transactions for detailed activity.</small>}</Block><Block title="Investments" sub="Holdings, contributions and current value." add="Add investment" onAdd={()=>openModal("investment")}><div className="strip">Current value <b>{money(financials.currentInvestmentValue)}</b> · Gain/loss <b>{money(financials.investmentGainLoss)}</b></div>{investments.length ? investments.map(item=><Row key={item.id} title={item.name} sub={`${item.type} · ${item.category} · ${item.mode}`} val={money(item.currentValue)} actions={<Actions onEdit={()=>openModal("investment",item)} onDelete={()=>removeRow("investments",item.id)}/>} />) : <Empty text="No investments added yet." />}</Block><Block title="Loans & debt" sub="Outstanding balances and EMIs." add="Add loan" onAdd={()=>openModal("loan")}><div className="strip">Outstanding <b>{money(financials.outstandingDebt)}</b> · Monthly EMI <b>{money(financials.debtPayments)}</b></div>{loans.length ? loans.map(item=><Row key={item.id} title={item.name} sub={`${item.type} · ${item.interestRate}% · ${item.tenureMonths} months`} val={money(item.outstanding)} actions={<Actions onEdit={()=>openModal("loan",item)} onDelete={()=>removeRow("loans",item.id)}/>} />) : <Empty text="No loans added yet." />}</Block></section>

      <section className="wideGrid"><div className="card block"><div className="blockhead"><div><div className="eyebrow">PROTECTION</div><h2>Insurance</h2><p>Keep policy coverage and renewal context in one place.</p></div><button className="secondary" onClick={()=>openModal("insurance")}>Add insurance</button></div>{insurance.length ? insurance.map(item=><Row key={item.id} title={item.type} sub={`${item.provider || "Provider not added"} · ${item.frequency}`} val={money(item.coverage)} actions={<Actions onEdit={()=>openModal("insurance",item)} onDelete={()=>removeRow("insurance",item.id)}/>} />) : <Empty text="No insurance policies added yet." />}</div><div className="card block"><div className="blockhead"><div><div className="eyebrow">GOALS</div><h2>Financial goals</h2><p>Required monthly contributions are calculated from target date and amount.</p></div><button className="secondary" onClick={()=>openModal("goal")}>Add goal</button></div>{financials.goals.length ? financials.goals.map((item,index)=>{const storedGoal=goals.find(g=>g.name===item.name && g.targetAmount===item.targetAmount && g.currentAmount===item.currentAmount && g.targetDate===item.targetDate) || goals[index];return <div className="goal" key={storedGoal?.id || `${item.name}-${index}`}><div><b>{item.name}</b><small>{money(item.currentAmount)} of {money(item.targetAmount)} · {item.progress.toFixed(0)}% · {item.monthsRemaining} months</small></div><div className="goalValue">{money(item.requiredMonthlyContribution)}/mo</div><div className="progress"><i style={{width:`${item.progress}%`}}/></div><div className="goalActions"><Actions onEdit={()=>storedGoal && openModal("goal",storedGoal)} onDelete={()=>{if(storedGoal?.id) removeRow("goals",storedGoal.id);}}/></div></div>}) : <Empty text="No goals added yet." />}</div></section>

      <section className="wideGrid"><div className="card block"><div className="blockhead"><div><div className="eyebrow">SPENDING PATTERN</div><h2>Where your recurring money goes</h2><p>Monthly normalized values from your expense records.</p></div></div>{spendingByCategory.length ? <div className="categoryBars">{spendingByCategory.map(([category, amount])=><div className="categoryBar" key={category}><div><span>{category}</span><b>{money(amount)}</b></div><div className="barTrack"><i style={{width:`${Math.min(100,(amount/Math.max(1,spendingByCategory[0][1]))*100)}%`}}/></div></div>)}</div> : <Empty text="Add expenses to see spending patterns." />}</div><div className="card block"><div className="blockhead"><div><div className="eyebrow">SCENARIO LAB</div><h2>What if I save more?</h2><p>A simple deterministic scenario. No return assumption.</p></div></div><label className="label">Extra monthly saving <b>{money(scenarioExtra)}</b></label><input className="range" type="range" min="0" max="50000" step="1000" value={scenarioExtra} onChange={e=>setScenarioExtra(numberValue(e.target.value))}/><div className="scenarioCards"><Metric label="Next free cash flow" value={money(scenario.nextFreeCashFlow)} /><Metric label="Emergency months after 12 mo" value={`${scenario.nextEmergencyMonths.toFixed(1)} mo`} /><Metric label="Goals supported" value={`${scenario.fundedGoals}/${financials.goals.length}`} /></div><button className="secondary fullScenario" onClick={()=>{openModal("scenario");setAnswer("");}}>Ask Artha to explain</button></div></section>

      <section className="card transactionCard"><div className="blockhead"><div><div className="eyebrow">TRANSACTIONS</div><h2>Recent activity</h2><p>Optional detailed transactions for richer AI review and categorization.</p></div><button className="secondary" onClick={()=>openModal("transaction")}>Add transaction</button></div>{transactions.length ? <div className="transactionTable"><div className="txRow txHead"><span>Date</span><span>Description</span><span>Category</span><span>Amount</span><span/></div>{transactions.map(item=><div className="txRow" key={item.id}><span>{formatDate(item.transactionDate)}</span><span><b>{item.description}</b><small>{item.source}</small></span><span>{item.category || "Uncategorized"}</span><span className={/income|credit/i.test(item.transactionType)?"txPositive":""}>{/income|credit/i.test(item.transactionType)?"+":"-"}{money(item.amount)}</span><span className="rowactions"><button className="mini" onClick={()=>openModal("transaction",item)}>Edit</button><button className="del" onClick={()=>removeRow("transactions",item.id)}>Delete</button></span></div>)}</div> : <Empty text="No detailed transactions yet. Add a few to make Artha's reviews more useful." />}</section>

      <section className="card coach"><div className="coachIntro"><div><div className="eyebrow">✦ ARTHA AI COACH</div><h2>Ask Artha anything about your money.</h2><p>AI receives your current database records plus deterministic engine facts. It does not decide the calculations itself.</p></div><div className="coachMark">✦</div></div><div className="prompts">{prompts.map(([icon,title,text])=><button className={`prompt ${question===text?"selected":""}`} key={title} onClick={()=>{setQuestion(text);setAnswer("");setError("")}}><em>{icon}</em><strong>{title}</strong><small>Use prompt →</small></button>)}</div><label className="label" htmlFor="coach-question">Or ask your own question</label><textarea id="coach-question" value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Example: How should I balance my emergency fund and investing?" rows={5}/><small className="note">On localhost, Artha uses the local AI gateway at <code>http://localhost:8787/api/coach</code>. If it is unavailable, Artha automatically falls back to deterministic engine guidance.</small><div className="coachActions"><button className="primary" disabled={aiLoading} onClick={()=>askArtha()}>{aiLoading?"Artha is thinking…":"Ask Artha for guidance →"}</button><button className="secondary" disabled={aiLoading} onClick={()=>askArtha("Review my finances and tell me the main areas I should review next. Use only the facts in my Artha data.","review")}>Run financial review</button></div>{answer && <div className="output"><div className="outputTitle">Artha says</div><div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown></div></div>}<small className="note">Educational guidance only. Artha is not a SEBI-registered investment adviser or IRDAI insurance intermediary. Always verify product-specific decisions and current rules independently.</small></section>

      <footer className="footer"><div><strong>Artha</strong><span>Your AI Financial Coach</span></div><div>Built with <span aria-label="love">♥</span> by <b>Harish Sarma</b> · © 2026</div></footer>

      {modal === "profile" && <Modal title="Profile settings" close={closeModal} save={saveModal} busy={saveBusy}><div className="formGrid two"><Field label="Your name"><input value={form.name||""} onChange={e=>setField("name",e.target.value)}/></Field><Field label="Age"><input type="number" min="18" max="100" value={form.age||""} onChange={e=>setField("age",e.target.value)}/></Field><Field label="Dependents"><input type="number" min="0" value={form.dependents||0} onChange={e=>setField("dependents",e.target.value)}/></Field><Field label="Country"><input value={form.country||"India"} onChange={e=>setField("country",e.target.value)}/></Field><Field label="Primary goal"><select value={form.primaryGoal||"Build wealth"} onChange={e=>setField("primaryGoal",e.target.value)}>{["Build emergency fund","Save for marriage","Invest more","Pay off debt","Major purchase","Build wealth","Other"].map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Risk profile"><select value={form.riskProfile||"Moderate"} onChange={e=>setField("riskProfile",e.target.value)}>{["Conservative","Moderate","Aggressive","Not assessed"].map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Investment horizon"><select value={form.investmentHorizon||"5+ years"} onChange={e=>setField("investmentHorizon",e.target.value)}>{["< 1 year","1–3 years","3–5 years","5+ years"].map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Liquid emergency savings"><input type="number" min="0" value={form.cashSavings||""} onChange={e=>setField("cashSavings",e.target.value)}/></Field><Field label="Life / term cover"><input type="number" min="0" value={form.lifeCover||""} onChange={e=>setField("lifeCover",e.target.value)}/></Field><Field label="Health cover"><input type="number" min="0" value={form.healthCover||""} onChange={e=>setField("healthCover",e.target.value)}/></Field></div></Modal>}
      {modal === "security" && <Modal title="Account & security" close={closeModal} save={updatePassword} busy={false}><div className="securityPanel"><div className="securityItem"><span>Signed-in email</span><b>{authEmail || "Authenticated account"}</b></div><div className="securityItem"><span>Data protection</span><b>Supabase Auth + Postgres RLS</b></div><div className="securityItem"><span>Change password</span><b>Updates your current account password</b></div><Field label="New password"><input type="password" minLength={8} value={securityPassword} onChange={e=>setSecurityPassword(e.target.value)} placeholder="At least 8 characters"/></Field><Field label="Confirm new password"><input type="password" minLength={8} value={securityConfirm} onChange={e=>setSecurityConfirm(e.target.value)} placeholder="Re-enter password"/></Field></div></Modal>}
      {(modal === "income" || modal === "expense" || modal === "investment" || modal === "loan" || modal === "insurance" || modal === "goal" || modal === "transaction") && <DataModal type={modal} form={form} setField={setField} saveModal={saveModal} closeModal={closeModal} busy={saveBusy} autoCategorize={modal === "transaction" ? autoCategorize : undefined} categorizing={categorizing} />}
      {modal === "scenario" && <Modal title="Scenario explanation" close={closeModal} wide><div className="scenarioExplain"><div className="scenarioCards"><Metric label="Extra saving" value={money(scenarioExtra)} /><Metric label="Next free cash flow" value={money(scenario.nextFreeCashFlow)} /><Metric label="Emergency cover after 12 mo" value={`${scenario.nextEmergencyMonths.toFixed(1)} months`} /></div><button className="primary" disabled={aiLoading} onClick={()=>askArtha(`I am considering adding ${money(scenarioExtra)} of extra monthly savings. Explain what this changes in my current Artha financial picture, including cash flow, emergency fund coverage and goal funding. Use the engine facts only.`,"scenario",{...scenario,extraMonthlySaving:scenarioExtra})}>{aiLoading?"Artha is thinking…":"Ask Artha to explain this scenario →"}</button>{answer && <div className="output"><div className="outputTitle">Artha says</div><div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown></div></div>}</div></Modal>}
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

function Modal({title,close,save,busy,children,wide=false}:{title:string;close:()=>void;save?:()=>void;busy?:boolean;children:React.ReactNode;wide?:boolean}){return <div className="backdrop" onMouseDown={close}><div className={`modal ${wide?"modalWide":""}`} onMouseDown={e=>e.stopPropagation()}><div className="modalhead"><div><h2>{title}</h2></div><button className="x" onClick={close}>×</button></div><div className="modalbody">{children}<div className="modalactions"><button
  type="button"
  className="secondary"
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

function DataModal({type,form,setField,saveModal,closeModal,busy,autoCategorize,categorizing}:{type:ModalType;form:FormState;setField:(k:string,v:string|number)=>void;saveModal:()=>void;closeModal:()=>void;busy:boolean;autoCategorize?:()=>void;categorizing?:boolean}){
  const titles:Record<string,string>={income:"Add income",expense:"Add expense",investment:"Add investment",loan:"Add loan",insurance:"Add insurance",goal:"Add financial goal",transaction:"Add transaction"};
  return <Modal title={titles[type]||"Artha"} close={closeModal} save={saveModal} busy={busy} wide={type==="investment"||type==="transaction"}><div className="formGrid two">
    {type==="income" && <><Field label="Source"><input value={form.name||""} onChange={e=>setField("name",e.target.value)} placeholder="Salary, rent, freelance…"/></Field><Field label="Description"><select value={form.type||"Salary"} onChange={e=>setField("type",e.target.value)}>{incomeTypes.map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Amount"><input type="number" min="0" value={form.amount||""} onChange={e=>setField("amount",e.target.value)}/></Field><Field label="Frequency"><select value={form.frequency||"Monthly"} onChange={e=>setField("frequency",e.target.value)}>{frequencies.map(v=><option key={v}>{v}</option>)}</select></Field></>}
    {type==="expense" && <><Field label="Description"><input value={form.name||""} onChange={e=>setField("name",e.target.value)} placeholder="Rent, groceries…"/></Field><Field label="Category"><select value={form.category||"Housing"} onChange={e=>setField("category",e.target.value)}>{expenseCategories.map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Amount"><input type="number" min="0" value={form.amount||""} onChange={e=>setField("amount",e.target.value)}/></Field><Field label="Frequency"><select value={form.frequency||"Monthly"} onChange={e=>setField("frequency",e.target.value)}>{frequencies.map(v=><option key={v}>{v}</option>)}</select></Field></>}
    {type==="investment" && <><Field label="Name"><input value={form.name||""} onChange={e=>setField("name",e.target.value)} placeholder="SBI ELSS, stock…"/></Field><Field label="Type"><select value={form.type||"Mutual Fund"} onChange={e=>setField("type",e.target.value)}>{investmentTypes.map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Category"><select value={form.category||"Equity"} onChange={e=>setField("category",e.target.value)}>{investmentCategories.map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Mode"><select value={form.mode||"SIP"} onChange={e=>setField("mode",e.target.value)}>{["SIP","Lump sum","Employer","Other"].map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Monthly contribution"><input type="number" min="0" value={form.monthlyAmount||""} onChange={e=>setField("monthlyAmount",e.target.value)}/></Field><Field label="Total invested"><input type="number" min="0" value={form.investedAmount||""} onChange={e=>setField("investedAmount",e.target.value)}/></Field><Field label="Current value"><input type="number" min="0" value={form.currentValue||""} onChange={e=>setField("currentValue",e.target.value)}/></Field><Field label="Start date"><input type="date" value={form.startDate||""} onChange={e=>setField("startDate",e.target.value)}/></Field></>}
    {type==="loan" && <><Field label="Name"><input value={form.name||""} onChange={e=>setField("name",e.target.value)} placeholder="Car loan"/></Field><Field label="Loan type"><select value={form.type||"Car Loan"} onChange={e=>setField("type",e.target.value)}>{loanTypes.map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Original amount"><input type="number" min="0" value={form.originalAmount||""} onChange={e=>setField("originalAmount",e.target.value)}/></Field><Field label="Outstanding"><input type="number" min="0" value={form.outstanding||""} onChange={e=>setField("outstanding",e.target.value)}/></Field><Field label="Monthly EMI"><input type="number" min="0" value={form.emi||""} onChange={e=>setField("emi",e.target.value)}/></Field><Field label="Interest rate %"><input type="number" step="0.01" min="0" value={form.interestRate||""} onChange={e=>setField("interestRate",e.target.value)}/></Field><Field label="Tenure remaining months"><input type="number" min="0" value={form.tenureMonths||""} onChange={e=>setField("tenureMonths",e.target.value)}/></Field></>}
    {type==="insurance" && <><Field label="Policy type"><select value={form.type||"Life / Term"} onChange={e=>setField("type",e.target.value)}>{insuranceTypes.map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Provider"><input value={form.provider||""} onChange={e=>setField("provider",e.target.value)}/></Field><Field label="Coverage"><input type="number" min="0" value={form.coverage||""} onChange={e=>setField("coverage",e.target.value)}/></Field><Field label="Premium"><input type="number" min="0" value={form.premium||""} onChange={e=>setField("premium",e.target.value)}/></Field><Field label="Premium frequency"><select value={form.frequency||"Yearly"} onChange={e=>setField("frequency",e.target.value)}>{frequencies.map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Renewal date"><input type="date" value={form.renewalDate||""} onChange={e=>setField("renewalDate",e.target.value)}/></Field></>}
    {type==="goal" && <><Field label="Goal type"><select value={form.type||"Other"} onChange={e=>setField("type",e.target.value)}>{goalTypes.map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Goal name"><input value={form.name||""} onChange={e=>setField("name",e.target.value)} placeholder="Marriage, home, emergency fund…"/></Field><Field label="Target amount"><input type="number" min="0" value={form.targetAmount||""} onChange={e=>setField("targetAmount",e.target.value)}/></Field><Field label="Current amount"><input type="number" min="0" value={form.currentAmount||""} onChange={e=>setField("currentAmount",e.target.value)}/></Field><Field label="Target date"><input type="date" value={form.targetDate||""} onChange={e=>setField("targetDate",e.target.value)}/></Field></>}
    {type==="transaction" && <><Field label="Date"><input type="date" value={form.transactionDate||""} onChange={e=>setField("transactionDate",e.target.value)}/></Field><Field label="Description"><input value={form.description||""} onChange={e=>setField("description",e.target.value)} placeholder="Amazon, salary credit, rent…"/></Field><Field label="Amount"><input type="number" min="0" value={form.amount||""} onChange={e=>setField("amount",e.target.value)}/></Field><Field label="Type"><select value={form.transactionType||"Expense"} onChange={e=>setField("transactionType",e.target.value)}>{["Expense","Income","Credit","Debit"].map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Category"><div className="inlineInput"><input value={form.category||""} onChange={e=>setField("category",e.target.value)} placeholder="Leave blank for Other"/><button type="button" className="mini" onClick={autoCategorize} disabled={categorizing}>{categorizing?"Thinking…":"Auto-categorize"}</button></div></Field><Field label="Source"><select value={form.source||"Manual"} onChange={e=>setField("source",e.target.value)}>{["Manual","Imported","Bank", "Card", "Other"].map(v=><option key={v}>{v}</option>)}</select></Field></>}
  </div></Modal>
}
