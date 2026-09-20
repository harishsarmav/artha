import { createClient } from "npm:@supabase/supabase-js@2";
import { calculateFinancials } from "../_shared/financial-engine.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function publishableKey() {
  const direct = Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (direct) return direct;

  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.default === "string") return parsed.default;
    } catch {
      // Fall through to the legacy anon key.
    }
  }

  return Deno.env.get("SUPABASE_ANON_KEY") || "";
}

function numberValue(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeRows(data: any[] | null) { return data ?? []; }

async function getUserContext(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) throw new Error("Authentication required.");
  const token = auth.replace(/^Bearer\s+/i, "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = publishableKey();
  if (!supabaseUrl || !supabaseKey) throw new Error("Supabase server configuration is incomplete.");

  const client = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Your session is invalid or expired.");
  const userId = userData.user.id;
  const [profile, income, expenses, investments, loans, insurance, goals, transactions] = await Promise.all([
    client.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    client.from("income").select("*").eq("user_id", userId),
    client.from("expenses").select("*").eq("user_id", userId),
    client.from("investments").select("*").eq("user_id", userId),
    client.from("loans").select("*").eq("user_id", userId),
    client.from("insurance").select("*").eq("user_id", userId),
    client.from("goals").select("*").eq("user_id", userId),
    client.from("transactions").select("*").eq("user_id", userId).order("transaction_date", { ascending: false }).limit(100),
  ]);
  const firstError = [profile, income, expenses, investments, loans, insurance, goals, transactions].find((x) => x.error)?.error;
  if (firstError) throw firstError;
  const profileRow = profile.data ?? {};
  const input = {
    profile: {
      name: profileRow.full_name ?? userData.user.user_metadata?.full_name ?? "",
      age: numberValue(profileRow.age), dependents: numberValue(profileRow.dependents), riskProfile: profileRow.risk_profile ?? "",
      investmentHorizon: profileRow.investment_horizon ?? "", primaryGoal: profileRow.primary_goal ?? "",
      lifeCover: numberValue(profileRow.life_cover), healthCover: numberValue(profileRow.health_cover), cashSavings: numberValue(profileRow.cash_savings),
    },
    income: normalizeRows(income.data).map((x:any)=>({amount:numberValue(x.amount),frequency:x.frequency})),
    expenses: normalizeRows(expenses.data).map((x:any)=>({amount:numberValue(x.amount),frequency:x.frequency,category:x.category||"Other"})),
    investments: normalizeRows(investments.data).map((x:any)=>({investedAmount:numberValue(x.invested_amount),currentValue:numberValue(x.current_value),monthlyAmount:numberValue(x.monthly_amount),category:x.category||"Other"})),
    loans: normalizeRows(loans.data).map((x:any)=>({outstanding:numberValue(x.outstanding_amount),emi:numberValue(x.emi_amount),interestRate:numberValue(x.interest_rate),type:x.type||"Other"})),
    insurance: normalizeRows(insurance.data).map((x:any)=>({type:x.type||"Other",coverage:numberValue(x.coverage_amount),premium:numberValue(x.premium_amount),frequency:x.premium_frequency||"Yearly"})),
    goals: normalizeRows(goals.data).map((x:any)=>({name:x.name,targetAmount:numberValue(x.target_amount),currentAmount:numberValue(x.current_amount),targetDate:x.target_date})),
  };
  return { client, userId, profileRow, transactions: normalizeRows(transactions.data), financials: calculateFinancials(input) };
}

function deterministicCategory(description: string, transactionType: string) {
  const text = description.toLowerCase();
  if (/salary|payroll|paytm salary|income|dividend|interest credit/.test(text)) return "Income";
  if (/rent|housing|maintenance|society/.test(text)) return "Housing";
  if (/swiggy|zomato|restaurant|cafe|food|grocer|blinkit|zepto|bigbasket/.test(text)) return "Food";
  if (/uber|ola|rapido|petrol|fuel|parking|metro|transport/.test(text)) return "Transport";
  if (/electric|water|internet|mobile|jio|airtel|utility|gas/.test(text)) return "Utilities";
  if (/hospital|pharmacy|medical|doctor|clinic|apollo/.test(text)) return "Healthcare";
  if (/amazon|flipkart|myntra|shopping|mall/.test(text)) return "Shopping";
  if (/netflix|prime|spotify|movie|cinema|entertainment/.test(text)) return "Entertainment";
  if (/emi|loan|hdfc loan|sbi loan|card payment/.test(text)) return "Debt / EMI";
  if (/sip|mutual fund|zerodha|groww|upstox|stock|etf|nps|ppf|fd/.test(text)) return "Investments";
  if (transactionType.toLowerCase() === "income") return "Income";
  return "Other";
}

function fallbackAnswer(question: string, f: any) {
  const q = question.toLowerCase();
  const lines: string[] = ["### Artha's engine-based view", ""];
  if (f.monthlyIncome === 0) lines.push("You have not entered recurring income yet, so cash-flow conclusions are limited.");
  else {
    lines.push(`Your normalized monthly income is **${Math.round(f.monthlyIncome).toLocaleString("en-IN")}** and monthly outflow is **${Math.round(f.monthlyOutflow).toLocaleString("en-IN")}**.`);
    lines.push(`That leaves free cash flow of **${Math.round(f.freeCashFlow).toLocaleString("en-IN")}** and a savings rate of **${f.savingsRate.toFixed(1)}%**.`);
  }
  if (/emergency|fund/.test(q)) lines.push(`Your current cash savings are **${Math.round(f.cashSavings).toLocaleString("en-IN")}**, against an engine target range of **${Math.round(f.emergencyFundTarget3Months).toLocaleString("en-IN")}–${Math.round(f.emergencyFundTarget6Months).toLocaleString("en-IN")}**.`);
  if (/invest/.test(q)) lines.push(`Your tracked investments are worth **${Math.round(f.currentInvestmentValue).toLocaleString("en-IN")}**, versus **${Math.round(f.investedAmount).toLocaleString("en-IN")}** invested.`);
  if (/loan|debt|emi/.test(q)) lines.push(`Outstanding debt is **${Math.round(f.outstandingDebt).toLocaleString("en-IN")}** with monthly debt payments of **${Math.round(f.debtPayments).toLocaleString("en-IN")}**, a debt-service ratio of **${f.debtServiceRatio.toFixed(1)}%**.`);
  if (/goal/.test(q)) {
    if (!f.goals.length) lines.push("You have not added a financial goal yet.");
    else f.goals.slice(0,5).forEach((g:any)=>lines.push(`For **${g.name || "this goal"}**, the engine estimates **${Math.round(g.requiredMonthlyContribution).toLocaleString("en-IN")}/month** is required to cover the remaining amount by the target date.`));
  }
  if (/insurance|cover/.test(q)) lines.push(`Tracked protection is **${Math.round(f.lifeCover).toLocaleString("en-IN")}** life/term cover and **${Math.round(f.healthCover).toLocaleString("en-IN")}** health cover.`);
  lines.push("", "I am using the calculated facts above rather than inventing missing numbers. Product-specific or market-sensitive decisions should be verified separately.");
  return lines.join("\n");
}

class QuotaError extends Error {
  status = 429;
  constructor(message: string) { super(message); this.name = "QuotaError"; }
}

async function consumeDailyQuota(client: any) {
  const limit = 30;
  const { data, error } = await client.rpc("consume_ai_quota", { p_limit: limit });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.allowed) {
    throw new QuotaError(
      `Daily AI limit reached (${limit} requests). Your deterministic Artha engine is still available.`,
    );
  }

  return { limit, remaining: Number(row.remaining ?? 0) };
}

async function callProvider(system: string, user: string) {
  const provider = (Deno.env.get("AI_PROVIDER") || "openai_compatible").toLowerCase();
  const apiKey = Deno.env.get("AI_API_KEY") || "";
  const baseUrl = (Deno.env.get("AI_BASE_URL") || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = Deno.env.get("AI_MODEL") || "gpt-4o-mini";

  if (!apiKey && provider !== "ollama") return null;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST required." }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "chat";
    const question = String(body.question || "").trim().slice(0, 6000);
    if (!question) return json({ error: "A question is required." }, 400);
    const ctx = await getUserContext(req);
    const f = ctx.financials;

    if (mode === "categorize") {
      const baseCategory = deterministicCategory(question, String(body.transactionType || "Expense"));
      if (baseCategory !== "Other") return json({ category: baseCategory, confidence: 0.85, reason: "Matched a deterministic transaction rule." });
      await consumeDailyQuota(ctx.client);
      const system = "Classify the transaction into exactly one category: Housing, Food, Transport, Utilities, Healthcare, Shopping, Entertainment, Debt / EMI, Investments, Income, Other. Return only JSON: {\"category\":\"...\",\"confidence\":0.0,\"reason\":\"...\"}. Never invent merchant facts.";
      const ai = await callProvider(system, `Transaction: ${question}\nAmount: ${numberValue(body.amount)}\nType: ${String(body.transactionType||"Expense")}`);
      if (ai) {
        try {
          const parsed = JSON.parse(ai.replace(/```json|```/g, "").trim());
          const allowed = new Set([
            "Housing", "Food", "Transport", "Utilities", "Healthcare",
            "Shopping", "Entertainment", "Debt / EMI", "Investments", "Income", "Other",
          ]);
          const category = allowed.has(parsed.category) ? parsed.category : "Other";
          const confidence = Math.min(1, Math.max(0, Number(parsed.confidence) || 0));
          return json({
            category,
            confidence,
            reason: typeof parsed.reason === "string" ? parsed.reason : "AI classification.",
          });
        } catch {
          // Fall through to the deterministic low-confidence result.
        }
      }
      return json({ category: "Other", confidence: 0.25, reason: "Not enough information for a reliable category." });
    }

    await consumeDailyQuota(ctx.client);
    const facts = JSON.stringify(f, null, 2);
    const system = `You are Artha, a careful Indian personal-finance coach. The Financial Engine is the source of truth. Use only the supplied calculated facts and user records. Do not silently recalculate, invent missing numbers, or claim access to bank/broker data. Explain assumptions clearly. For investment/insurance topics, provide educational decision factors rather than product recommendations. If facts are missing, say so. Keep answers practical and readable in markdown.\n\nCALCULATED FACTS:\n${facts}`;
    const userPrompt = mode === "review" ? "Review my financial picture and explain the main areas I should review next, using only these facts." : mode === "scenario" ? `${question}\nScenario facts: ${JSON.stringify(body.scenario || {})}` : question;
    const ai = await callProvider(system, userPrompt);
    const answer = ai || fallbackAnswer(question, f);
    return json({ answer, facts: f, provider: ai ? (Deno.env.get("AI_PROVIDER") || "openai_compatible") : "deterministic" });
  } catch (error) {
    const status = error instanceof QuotaError ? error.status : 500;
    return json({ error: error instanceof Error ? error.message : "Unable to process the request." }, status);
  }
});
