"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  context,
  monthly,
  Income,
  Expense,
  Investment,
  Loan,
  Goal,
} from "./lib/finance";
import { prompts } from "./lib/prompts";

const money = (n: number) => "₹" + Math.round(n || 0).toLocaleString("en-IN");
const id = () => crypto.randomUUID();
const num = (v: string | number) => Number(v) || 0;

type Profile = {
  name: string;
  age: number;
  dependents: number;
  goal: string;
  risk: string;
  horizon: string;
  lifeCover: number;
  healthCover: number;
};

type FormState = Record<string, string | number>;

const emptyProfile: Profile = {
  name: "",
  age: 34,
  dependents: 0,
  goal: "Build wealth",
  risk: "Moderate",
  horizon: "5+ years",
  lifeCover: 0,
  healthCover: 0,
};

const incomeTypes = [
  "Salary",
  "Rental",
  "Freelance",
  "Business",
  "Interest",
  "Dividend",
  "Pension",
  "Capital gains",
  "Other",
];

const expenseCats = [
  "Housing",
  "Food",
  "Transport",
  "Utilities",
  "Healthcare",
  "Insurance",
  "Education",
  "Shopping",
  "Entertainment",
  "EMI",
  "Subscriptions",
  "Other",
];

const investTypes = [
  "Mutual Fund",
  "ELSS",
  "Stock",
  "ETF",
  "FD",
  "PPF",
  "NPS",
  "Bond",
  "Gold",
  "Other",
];

const loanTypes = [
  "Home Loan",
  "Car Loan",
  "Personal Loan",
  "Education Loan",
  "Credit Card",
  "Two-wheeler Loan",
  "Other",
];

const frequencies = ["Monthly", "Weekly", "Quarterly", "Half-yearly", "Yearly"];

const localAiEndpoint =
  process.env.NEXT_PUBLIC_AI_ENDPOINT ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:8787/api/coach"
    : "");

export default function Home() {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [income, setIncome] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [ready, setReady] = useState(false);
  const [setup, setSetup] = useState(false);
  const [modal, setModal] = useState("");
  const [edit, setEdit] = useState<any>(null);
  const [form, setForm] = useState<FormState>({});
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const get = (key: string) => localStorage.getItem(key);
      const p = get("artha-profile");

      setProfile(p ? JSON.parse(p) : emptyProfile);
      setIncome(get("artha-income") ? JSON.parse(get("artha-income")!) : []);
      setExpenses(get("artha-expenses") ? JSON.parse(get("artha-expenses")!) : []);
      setInvestments(
        get("artha-investments") ? JSON.parse(get("artha-investments")!) : []
      );
      setLoans(get("artha-loans") ? JSON.parse(get("artha-loans")!) : []);
      setGoals(get("artha-goals") ? JSON.parse(get("artha-goals")!) : []);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;

    const values: [string, unknown][] = [
      ["artha-profile", profile],
      ["artha-income", income],
      ["artha-expenses", expenses],
      ["artha-investments", investments],
      ["artha-loans", loans],
      ["artha-goals", goals],
    ];

    values.forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value));
    });
  }, [profile, income, expenses, investments, loans, goals, ready]);

  const financialContext = useMemo(
    () => context({ income, expenses, investments, loans, goals, profile }),
    [income, expenses, investments, loans, goals, profile]
  );

  const monthlyIncome = financialContext.income.monthly;
  const monthlyOutflow = financialContext.cashFlow.monthlyOutflow;
  const monthlySurplus = financialContext.cashFlow.monthlySurplus;

  const open = (type: string, item?: any) => {
    setModal(type);
    setEdit(item || null);

    setForm(
      item
        ? { ...item }
        : type === "insurance"
          ? { lifeCover: profile.lifeCover, healthCover: profile.healthCover }
          : type === "income"
            ? { name: "Salary", type: "Salary", amount: "", frequency: "Monthly" }
            : type === "expense"
              ? { name: "", category: "Housing", amount: "", frequency: "Monthly" }
              : type === "investment"
                ? {
                    name: "",
                    type: "Mutual Fund",
                    category: "Equity",
                    mode: "SIP",
                    monthlyAmount: "",
                    investedAmount: "",
                    currentValue: "",
                    startDate: "",
                  }
                : type === "loan"
                  ? {
                      name: "",
                      type: "Car Loan",
                      originalAmount: "",
                      outstanding: "",
                      emi: "",
                      interestRate: "",
                      tenureMonths: "",
                    }
                  : { name: "", targetAmount: "", currentAmount: "", targetDate: "" }
    );
  };

  const close = () => {
    setModal("");
    setEdit(null);
    setForm({});
  };

  const save = () => {
    if (modal === "insurance") {
      setProfile({
        ...profile,
        lifeCover: num(form.lifeCover),
        healthCover: num(form.healthCover),
      });
    }

    if (modal === "income") {
      const item: Income = {
        id: edit?.id || id(),
        name: String(form.name || "Income"),
        type: String(form.type || "Other"),
        amount: num(form.amount),
        frequency: String(form.frequency || "Monthly"),
      };
      setIncome((items) =>
        edit ? items.map((v) => (v.id === edit.id ? item : v)) : [...items, item]
      );
    }

    if (modal === "expense") {
      const item: Expense = {
        id: edit?.id || id(),
        name: String(form.name || "Expense"),
        category: String(form.category || "Other"),
        amount: num(form.amount),
        frequency: String(form.frequency || "Monthly"),
      };
      setExpenses((items) =>
        edit ? items.map((v) => (v.id === edit.id ? item : v)) : [...items, item]
      );
    }

    if (modal === "investment") {
      const item: Investment = {
        id: edit?.id || id(),
        name: String(form.name || "Investment"),
        type: String(form.type || "Other"),
        category: String(form.category || "Other"),
        mode: String(form.mode || "Lump sum"),
        monthlyAmount: num(form.monthlyAmount),
        investedAmount: num(form.investedAmount),
        currentValue: num(form.currentValue),
        startDate: String(form.startDate || ""),
      };
      setInvestments((items) =>
        edit ? items.map((v) => (v.id === edit.id ? item : v)) : [...items, item]
      );
    }

    if (modal === "loan") {
      const item: Loan = {
        id: edit?.id || id(),
        name: String(form.name || "Loan"),
        type: String(form.type || "Other"),
        originalAmount: num(form.originalAmount),
        outstanding: num(form.outstanding),
        emi: num(form.emi),
        interestRate: num(form.interestRate),
        tenureMonths: num(form.tenureMonths),
      };
      setLoans((items) =>
        edit ? items.map((v) => (v.id === edit.id ? item : v)) : [...items, item]
      );
    }

    if (modal === "goal") {
      const item: Goal = {
        id: edit?.id || id(),
        name: String(form.name || "Goal"),
        targetAmount: num(form.targetAmount),
        currentAmount: num(form.currentAmount),
        targetDate: String(form.targetDate || ""),
      };
      setGoals((items) =>
        edit ? items.map((v) => (v.id === edit.id ? item : v)) : [...items, item]
      );
    }

    close();
  };

  async function askArtha() {
    if (!question.trim()) {
      setError("Choose a quick question or enter your own question first.");
      return;
    }

    if (!localAiEndpoint) {
      setError(
        "The AI backend is not connected to this web preview yet. The dashboard works normally; AI hosting will be connected separately."
      );
      return;
    }

    setLoading(true);
    setError("");
    setAnswer("");

    try {
      const response = await fetch(localAiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          financialContext,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to get guidance.");
      }

      setAnswer(data.answer || "No answer returned.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to get guidance.");
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return <div className="loading">Loading Artha…</div>;

  const expenseLabel = (expense: Expense) => {
    const category = expense.category || "Other";
    const frequency = expense.frequency || "";
    return frequency ? `${category} · ${frequency}` : category;
  };

  return (
    <main className="shell">
      <header>
        <div>
          <b className="brand">Artha</b>
          <div className="tag">Your AI Financial Coach</div>
        </div>
        <button className="ghost" onClick={() => setSetup(true)}>
          Profile
        </button>
      </header>

      <section className="hero">
        <span>YOUR MONEY, ONE PLACE</span>
        <h1>
          Hi {profile.name || "there"} 👋
          <br />
          Let&apos;s understand your money.
        </h1>
        <p>
          Track cash flow, investments, loans, protection and goals — then ask
          Artha to explain what it means.
        </p>
      </section>

      <section className="stats">
        <Stat label="Monthly income" value={money(monthlyIncome)} />
        <Stat label="Monthly outflow" value={money(monthlyOutflow)} />
        <Stat label="Available" value={money(monthlySurplus)} />
        <Stat
          label="Savings rate"
          value={`${financialContext.cashFlow.savingsRate}%`}
        />
      </section>

      <section className="dashboardGrid">
        <div className="primaryColumn">
          <Block
            title="Income"
            sub="Salary, rental and other income."
            add="Add income"
            onAdd={() => open("income")}
          >
            {income.length ? (
              income.map((item) => (
                <Row
                  key={item.id}
                  title={item.name}
                  sub={`${item.type || "Other"} · ${item.frequency || "Monthly"}`}
                  val={money(item.amount)}
                  actions={
                    <button className="mini" onClick={() => open("income", item)}>
                      Edit
                    </button>
                  }
                />
              ))
            ) : (
              <Empty text="No income sources added yet." />
            )}
          </Block>

          <Block
            title="Expenses"
            sub="Edit or delete anything entered incorrectly."
            add="Add expense"
            onAdd={() => open("expense")}
          >
            {expenses.length ? (
              expenses.map((item) => (
                <Row
                  key={item.id}
                  title={item.name || "Expense"}
                  sub={expenseLabel(item)}
                  val={money(item.amount)}
                  actions={
                    <>
                      <button className="mini" onClick={() => open("expense", item)}>
                        Edit
                      </button>
                      <button
                        className="del"
                        onClick={() =>
                          setExpenses((items) => items.filter((v) => v.id !== item.id))
                        }
                      >
                        Delete
                      </button>
                    </>
                  }
                />
              ))
            ) : (
              <Empty text="No expenses tracked yet." />
            )}
          </Block>
        </div>

        <aside className="sideColumn">
          <section className="card profile">
            <small className="eyebrow">PROFILE</small>
            <h2>{profile.name || "Your profile"}</h2>
            <div className="profilegrid">
              <span>
                Age <b>{profile.age}</b>
              </span>
              <span>
                Dependents <b>{profile.dependents}</b>
              </span>
              <span>
                Risk <b>{profile.risk}</b>
              </span>
              <span>
                Horizon <b>{profile.horizon}</b>
              </span>
              <span>
                Goal <b>{profile.goal}</b>
              </span>
              <span>
                Life cover <b>{money(profile.lifeCover)}</b>
              </span>
              <span>
                Health cover <b>{money(profile.healthCover)}</b>
              </span>
            </div>
            <button className="secondary full" onClick={() => open("insurance")}>
              Edit insurance cover
            </button>
          </section>

          <section className="card snapshot">
            <div className="eyebrow">FINANCIAL SNAPSHOT</div>
            <h2>Where you stand</h2>
            <SnapshotRow label="Monthly surplus" value={money(monthlySurplus)} />
            <SnapshotRow
              label="Investments"
              value={money(financialContext.investments.currentValue)}
            />
            <SnapshotRow
              label="Outstanding debt"
              value={money(financialContext.debt.outstanding)}
            />
            <SnapshotRow
              label="Monthly EMI"
              value={money(financialContext.debt.monthlyEmi)}
            />
          </section>
        </aside>

        <div className="wideSection">
          <Block
            title="Investments"
            sub="Mutual funds, ELSS, SIPs, stocks, ETFs and more."
            add="Add investment"
            onAdd={() => open("investment")}
          >
            <div className="strip">
              Invested <b>{money(financialContext.investments.investedAmount)}</b> · Current{" "}
              <b>{money(financialContext.investments.currentValue)}</b> · Gain/Loss{" "}
              <b>{money(financialContext.investments.gain)}</b>
            </div>
            {investments.length ? (
              investments.map((item) => (
                <Row
                  key={item.id}
                  title={item.name}
                  sub={`${item.type} · ${item.category} · ${item.mode}`}
                  val={money(item.currentValue)}
                  actions={
                    <>
                      <button
                        className="mini"
                        onClick={() => open("investment", item)}
                      >
                        Edit
                      </button>
                      <button
                        className="del"
                        onClick={() =>
                          setInvestments((items) => items.filter((v) => v.id !== item.id))
                        }
                      >
                        Delete
                      </button>
                    </>
                  }
                />
              ))
            ) : (
              <Empty text="No investments added yet." />
            )}
          </Block>
        </div>

        <div className="splitSection">
          <Block
            title="Loans & debt"
            sub="Home, car, personal, education loans and cards."
            add="Add loan"
            onAdd={() => open("loan")}
          >
            <div className="strip">
              Outstanding <b>{money(financialContext.debt.outstanding)}</b> · Monthly EMI{" "}
              <b>{money(financialContext.debt.monthlyEmi)}</b>
            </div>
            {loans.length ? (
              loans.map((item) => (
                <Row
                  key={item.id}
                  title={item.name}
                  sub={`${item.type} · ${item.interestRate}% · ${item.tenureMonths} months`}
                  val={money(item.outstanding)}
                  actions={
                    <>
                      <button className="mini" onClick={() => open("loan", item)}>
                        Edit
                      </button>
                      <button
                        className="del"
                        onClick={() =>
                          setLoans((items) => items.filter((v) => v.id !== item.id))
                        }
                      >
                        Delete
                      </button>
                    </>
                  }
                />
              ))
            ) : (
              <Empty text="No loans added yet." />
            )}
          </Block>

          <Block
            title="Financial goals"
            sub="Track targets and progress."
            add="Add goal"
            onAdd={() => open("goal")}
          >
            {goals.length ? (
              goals.map((item) => {
                const progress = item.targetAmount
                  ? Math.min(100, (item.currentAmount / item.targetAmount) * 100)
                  : 0;

                return (
                  <div className="goal" key={item.id}>
                    <div>
                      <b>{item.name}</b>
                      <small>
                        {money(item.currentAmount)} of {money(item.targetAmount)} ·{" "}
                        {progress.toFixed(0)}%
                      </small>
                    </div>
                    <div className="rowactions">
                      <button className="mini" onClick={() => open("goal", item)}>
                        Edit
                      </button>
                      <button
                        className="del"
                        onClick={() =>
                          setGoals((items) => items.filter((v) => v.id !== item.id))
                        }
                      >
                        Delete
                      </button>
                    </div>
                    <div className="progress">
                      <i style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <Empty text="No goals added yet." />
            )}
          </Block>
        </div>
      </section>

      <section className="card coach">
        <div className="coachIntro">
          <div>
            <div className="badge">✦ ARTHA AI COACH</div>
            <h2>Protection + investing guidance</h2>
            <p>
              Ask Artha about your emergency fund, investments, insurance,
              savings, loans or financial goals.
            </p>
          </div>
          <div className="coachMark">✦</div>
        </div>

        <div className="quick">
          <b>Quick questions</b>
          <div className="prompts">
            {prompts.map(([icon, title, text]) => (
              <button
                key={title}
                className={`prompt ${question === text ? "selected" : ""}`}
                onClick={() => {
                  setQuestion(text);
                  setError("");
                }}
              >
                <em>{icon}</em>
                <strong>{title}</strong>
                <small>Use prompt →</small>
              </button>
            ))}
          </div>
        </div>

        <label className="label" htmlFor="coach-question">
          Or ask Artha anything
        </label>
        <textarea
          id="coach-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Example: How much emergency fund should I build?"
          rows={5}
        />
        <button className="primary coachButton" disabled={loading} onClick={askArtha}>
          {loading ? "Artha is thinking…" : "Ask Artha for guidance →"}
        </button>

        {error && <div className="error">{error}</div>}

        {answer && (
          <div className="output">
            <div className="outputTitle">Artha says</div>
            <div className="markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
            </div>
          </div>
        )}

        <small className="note">
          Educational guidance only. Artha is not a SEBI-registered investment
          adviser or IRDAI insurance intermediary.
        </small>
      </section>

      <footer className="footer">
        <div>
          <strong>Artha</strong>
          <span>Your AI Financial Coach</span>
        </div>
        <div className="creator">
          Built with <span aria-label="love">♥</span> by <b>Harish Sarma</b> · © 2026 Artha
        </div>
      </footer>

      {setup && (
        <Modal title="Set up Artha" close={() => setSetup(false)}>
          <Field l="Your name">
            <input
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              placeholder="Your name"
            />
          </Field>
          <Field l="Age">
            <input
              type="number"
              value={profile.age}
              onChange={(e) => setProfile({ ...profile, age: num(e.target.value) })}
            />
          </Field>
          <Field l="Dependents">
            <input
              type="number"
              value={profile.dependents}
              onChange={(e) =>
                setProfile({ ...profile, dependents: num(e.target.value) })
              }
            />
          </Field>
          <Field l="Primary goal">
            <select
              value={profile.goal}
              onChange={(e) => setProfile({ ...profile, goal: e.target.value })}
            >
              {["Build wealth", "Emergency fund", "Marriage", "House", "Retirement", "Education", "Custom"].map(
                (value) => <option key={value}>{value}</option>
              )}
            </select>
          </Field>
          <Field l="Risk tolerance">
            <select
              value={profile.risk}
              onChange={(e) => setProfile({ ...profile, risk: e.target.value })}
            >
              {["Conservative", "Moderate", "Aggressive"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
          <Field l="Investment horizon">
            <select
              value={profile.horizon}
              onChange={(e) => setProfile({ ...profile, horizon: e.target.value })}
            >
              {["Less than 3 years", "3–5 years", "5+ years", "10+ years"].map(
                (value) => <option key={value}>{value}</option>
              )}
            </select>
          </Field>
          <Field l="Existing life / term cover">
            <input
              type="number"
              value={profile.lifeCover}
              onChange={(e) =>
                setProfile({ ...profile, lifeCover: num(e.target.value) })
              }
            />
          </Field>
          <Field l="Existing health cover">
            <input
              type="number"
              value={profile.healthCover}
              onChange={(e) =>
                setProfile({ ...profile, healthCover: num(e.target.value) })
              }
            />
          </Field>
          <div className="modalactions">
            <button className="primary" onClick={() => setSetup(false)}>
              Save profile
            </button>
          </div>
        </Modal>
      )}

      {modal && (
        <Modal title={`${edit ? "Edit" : "Add"} ${modal}`} close={close}>
          {modal === "insurance" ? (
            <>
              <Field l="Life / term cover">
                <input
                  type="number"
                  value={form.lifeCover || ""}
                  onChange={(e) => setForm({ ...form, lifeCover: e.target.value })}
                />
              </Field>
              <Field l="Health cover">
                <input
                  type="number"
                  value={form.healthCover || ""}
                  onChange={(e) => setForm({ ...form, healthCover: e.target.value })}
                />
              </Field>
            </>
          ) : modal === "income" ? (
            <>
              <Field l="Name">
                <input
                  value={form.name || ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field l="Type">
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {incomeTypes.map((value) => <option key={value}>{value}</option>)}
                </select>
              </Field>
              <Field l="Amount">
                <input
                  type="number"
                  value={form.amount || ""}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </Field>
              <Field l="Frequency">
                <select
                  value={form.frequency}
                  onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                >
                  {frequencies.map((value) => <option key={value}>{value}</option>)}
                </select>
              </Field>
            </>
          ) : modal === "expense" ? (
            <>
              <Field l="Name">
                <input
                  value={form.name || ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field l="Category">
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {expenseCats.map((value) => <option key={value}>{value}</option>)}
                </select>
              </Field>
              <Field l="Amount">
                <input
                  type="number"
                  value={form.amount || ""}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </Field>
              <Field l="Frequency">
                <select
                  value={form.frequency}
                  onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                >
                  {frequencies.map((value) => <option key={value}>{value}</option>)}
                </select>
              </Field>
            </>
          ) : modal === "investment" ? (
            <>
              <Field l="Fund / investment name">
                <input
                  value={form.name || ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="SBI Long Term Equity Fund"
                />
              </Field>
              <Field l="Type">
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {investTypes.map((value) => <option key={value}>{value}</option>)}
                </select>
              </Field>
              <Field l="Category">
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {["ELSS", "Equity", "Debt", "Hybrid", "Index", "Other"].map(
                    (value) => <option key={value}>{value}</option>
                  )}
                </select>
              </Field>
              <Field l="Mode">
                <select
                  value={form.mode}
                  onChange={(e) => setForm({ ...form, mode: e.target.value })}
                >
                  <option>SIP</option>
                  <option>Lump sum</option>
                </select>
              </Field>
              <Field l="Monthly SIP">
                <input
                  type="number"
                  value={form.monthlyAmount || ""}
                  onChange={(e) =>
                    setForm({ ...form, monthlyAmount: e.target.value })
                  }
                />
              </Field>
              <Field l="Total invested">
                <input
                  type="number"
                  value={form.investedAmount || ""}
                  onChange={(e) =>
                    setForm({ ...form, investedAmount: e.target.value })
                  }
                />
              </Field>
              <Field l="Current value">
                <input
                  type="number"
                  value={form.currentValue || ""}
                  onChange={(e) =>
                    setForm({ ...form, currentValue: e.target.value })
                  }
                />
              </Field>
              <Field l="Start date">
                <input
                  type="date"
                  value={form.startDate || ""}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </Field>
            </>
          ) : modal === "loan" ? (
            <>
              <Field l="Loan name">
                <input
                  value={form.name || ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="SBI Car Loan"
                />
              </Field>
              <Field l="Type">
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {loanTypes.map((value) => <option key={value}>{value}</option>)}
                </select>
              </Field>
              <Field l="Original amount">
                <input
                  type="number"
                  value={form.originalAmount || ""}
                  onChange={(e) =>
                    setForm({ ...form, originalAmount: e.target.value })
                  }
                />
              </Field>
              <Field l="Outstanding">
                <input
                  type="number"
                  value={form.outstanding || ""}
                  onChange={(e) =>
                    setForm({ ...form, outstanding: e.target.value })
                  }
                />
              </Field>
              <Field l="Monthly EMI">
                <input
                  type="number"
                  value={form.emi || ""}
                  onChange={(e) => setForm({ ...form, emi: e.target.value })}
                />
              </Field>
              <Field l="Interest rate %">
                <input
                  type="number"
                  step=".01"
                  value={form.interestRate || ""}
                  onChange={(e) =>
                    setForm({ ...form, interestRate: e.target.value })
                  }
                />
              </Field>
              <Field l="Tenure remaining months">
                <input
                  type="number"
                  value={form.tenureMonths || ""}
                  onChange={(e) =>
                    setForm({ ...form, tenureMonths: e.target.value })
                  }
                />
              </Field>
            </>
          ) : (
            <>
              <Field l="Goal name">
                <input
                  value={form.name || ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field l="Target amount">
                <input
                  type="number"
                  value={form.targetAmount || ""}
                  onChange={(e) =>
                    setForm({ ...form, targetAmount: e.target.value })
                  }
                />
              </Field>
              <Field l="Current amount">
                <input
                  type="number"
                  value={form.currentAmount || ""}
                  onChange={(e) =>
                    setForm({ ...form, currentAmount: e.target.value })
                  }
                />
              </Field>
              <Field l="Target date">
                <input
                  type="date"
                  value={form.targetDate || ""}
                  onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
                />
              </Field>
            </>
          )}

          <div className="modalactions">
            <button className="secondary" onClick={close}>
              Cancel
            </button>
            <button className="primary" onClick={save}>
              Save changes
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="snapshotRow">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function Block({
  title,
  sub,
  add,
  onAdd,
  children,
}: {
  title: string;
  sub: string;
  add: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="card block">
      <div className="blockhead">
        <div>
          <h2>{title}</h2>
          <p>{sub}</p>
        </div>
        <button className="secondary" onClick={onAdd}>
          {add}
        </button>
      </div>
      {children}
    </section>
  );
}

function Row({
  title,
  sub,
  val,
  actions,
}: {
  title: string;
  sub: string;
  val: string;
  actions: React.ReactNode;
}) {
  return (
    <div className="row">
      <div>
        <b>{title}</b>
        <small>{sub}</small>
      </div>
      <div className="rowright">
        <b>{val}</b>
        {actions}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

function Field({ l, children }: { l: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{l}</span>
      {children}
    </label>
  );
}

function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="backdrop" onMouseDown={close}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modalhead">
          <h2>{title}</h2>
          <button className="x" onClick={close}>
            ×
          </button>
        </div>
        <div className="modalbody">{children}</div>
      </div>
    </div>
  );
}
