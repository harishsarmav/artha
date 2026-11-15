import { createClient } from "npm:@supabase/supabase-js@2";
import { calculateFinancials } from "../_shared/financial-engine.ts";

const allowedOrigins = new Set(
  (Deno.env.get("ALLOWED_ORIGINS") ||
    "https://harishsarmav.github.io,http://localhost:3000,http://127.0.0.1:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

function corsHeaders(req: Request): Record<string, string> | null {
  const origin = req.headers.get("Origin");
  if (origin && !allowedOrigins.has(origin)) return null;
  return {
    ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const json = (req: Request, body: unknown, status = 200) => {
  const headers = corsHeaders(req);
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...(headers ?? {}), "Content-Type": "application/json" },
  });
};

class AuthError extends Error {
  status = 401;
  constructor(message: string) { super(message); this.name = "AuthError"; }
}

class ProviderError extends Error {
  constructor(readonly status: number) { super(`AI provider returned HTTP ${status}.`); this.name = "ProviderError"; }
}

function publishableKey() {
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (raw) {
    try { return JSON.parse(raw).default; } catch { /* legacy fallback */ }
  }
  return Deno.env.get("SUPABASE_ANON_KEY") || "";
}

function numberValue(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeRows(data: any[] | null) { return data ?? []; }

async function getAuthenticatedContext(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) throw new AuthError("Authentication required.");
  const token = auth.replace(/^Bearer\s+/i, "");
  const client = createClient(Deno.env.get("SUPABASE_URL")!, publishableKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData.user) throw new AuthError("Your session is invalid or expired.");
  return { client, userId: userData.user.id };
}

async function getUserContext(authContext: { client: any; userId: string }) {
  const { client, userId } = authContext;
  const [profile, income, expenses, investments, loans, insurance, goals] = await Promise.all([
    client.from("profiles").select("age,dependents,risk_profile,investment_horizon,primary_goal,life_cover,health_cover,cash_savings").eq("id", userId).maybeSingle(),
    client.from("income").select("amount,frequency").eq("user_id", userId),
    client.from("expenses").select("amount,frequency,category").eq("user_id", userId),
    client.from("investments").select("invested_amount,current_value,monthly_amount,category").eq("user_id", userId),
    client.from("loans").select("outstanding,emi,interest_rate,type,tenure_months").eq("user_id", userId),
    client.from("insurance").select("type,coverage,premium,frequency").eq("user_id", userId),
    client.from("goals").select("target_amount,current_amount,target_date").eq("user_id", userId),
  ]);
  const firstError = [profile, income, expenses, investments, loans, insurance, goals].find((x) => x.error)?.error;
  if (firstError) throw firstError;
  const profileRow = profile.data ?? {};
  const input = {
    profile: {
      name: "",
      age: numberValue(profileRow.age), dependents: numberValue(profileRow.dependents), riskProfile: profileRow.risk_profile ?? "",
      investmentHorizon: profileRow.investment_horizon ?? "", primaryGoal: profileRow.primary_goal ?? "",
      lifeCover: numberValue(profileRow.life_cover), healthCover: numberValue(profileRow.health_cover), cashSavings: numberValue(profileRow.cash_savings),
    },
    income: normalizeRows(income.data).map((x:any)=>({amount:numberValue(x.amount),frequency:x.frequency})),
    expenses: normalizeRows(expenses.data).map((x:any)=>({amount:numberValue(x.amount),frequency:x.frequency,category:x.category||"Other"})),
    investments: normalizeRows(investments.data).map((x:any)=>({investedAmount:numberValue(x.invested_amount),currentValue:numberValue(x.current_value),monthlyAmount:numberValue(x.monthly_amount),category:x.category||"Other"})),
    loans: normalizeRows(loans.data).map((x:any)=>({outstanding:numberValue(x.outstanding),emi:numberValue(x.emi),interestRate:numberValue(x.interest_rate),type:x.type||"Other"})),
    insurance: normalizeRows(insurance.data).map((x:any)=>({type:x.type||"Other",coverage:numberValue(x.coverage),premium:numberValue(x.premium),frequency:x.frequency||"Yearly"})),
    goals: normalizeRows(goals.data).map((x:any,index:number)=>({name:`Goal ${index + 1}`,targetAmount:numberValue(x.target_amount),currentAmount:numberValue(x.current_amount),targetDate:x.target_date})),
  };
  const loanDetails = normalizeRows(loans.data).map((x: any, index: number) => ({
    loan: `Loan ${index + 1}`,
    type: x.type || "Other",
    outstanding: numberValue(x.outstanding),
    annualInterestRate: numberValue(x.interest_rate),
    monthlyEmi: numberValue(x.emi),
    remainingMonths: numberValue(x.tenure_months),
  }));
  return { ...authContext, financials: calculateFinancials(input), loanDetails };
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

function fallbackAnswer(question: string, f: any, loanDetails: any[] = []) {
  const q = question.toLowerCase();
  const lines: string[] = ["### DhanView's engine-based view", ""];
  if (f.monthlyIncome === 0) lines.push("You have not entered recurring income yet, so cash-flow conclusions are limited.");
  else {
    lines.push(`Your normalized monthly income is **${Math.round(f.monthlyIncome).toLocaleString("en-IN")}** and monthly outflow is **${Math.round(f.monthlyOutflow).toLocaleString("en-IN")}**.`);
    lines.push(`That leaves free cash flow of **${Math.round(f.freeCashFlow).toLocaleString("en-IN")}** and a savings rate of **${f.savingsRate.toFixed(1)}%**.`);
  }
  if (/emergency|fund/.test(q)) lines.push(`Your current cash savings are **${Math.round(f.cashSavings).toLocaleString("en-IN")}**, against an engine target range of **${Math.round(f.emergencyFundTarget3Months).toLocaleString("en-IN")}–${Math.round(f.emergencyFundTarget6Months).toLocaleString("en-IN")}**.`);
  if (/invest/.test(q)) lines.push(`Your tracked investments are worth **${Math.round(f.currentInvestmentValue).toLocaleString("en-IN")}**, versus **${Math.round(f.investedAmount).toLocaleString("en-IN")}** invested.`);
  if (/loan|debt|emi/.test(q)) {
    lines.push(`Outstanding debt is **${Math.round(f.outstandingDebt).toLocaleString("en-IN")}** with monthly debt payments of **${Math.round(f.debtPayments).toLocaleString("en-IN")}**, a debt-service ratio of **${f.debtServiceRatio.toFixed(1)}%**.`);
    const openLoans = loanDetails.filter((loan) => numberValue(loan.outstanding) > 0);
    if (!openLoans.length) {
      lines.push("No outstanding loan records are available in the data currently loaded, so I cannot rank your debts or calculate an EMI or prepayment scenario.");
    } else {
      lines.push("Recorded loan details:");
      openLoans.forEach((loan) => {
        const rate = numberValue(loan.annualInterestRate) > 0 ? `${numberValue(loan.annualInterestRate)}% annual rate` : "interest rate not recorded";
        const emi = numberValue(loan.monthlyEmi) > 0 ? `${Math.round(numberValue(loan.monthlyEmi)).toLocaleString("en-IN")} monthly EMI` : "EMI not recorded";
        const term = numberValue(loan.remainingMonths) > 0 ? `${numberValue(loan.remainingMonths)} months remaining` : "remaining term not recorded";
        lines.push(`- **${loan.type || "Loan"}**: ${Math.round(numberValue(loan.outstanding)).toLocaleString("en-IN")} outstanding · ${rate} · ${emi} · ${term}.`);
      });
      const avalanche = [...openLoans].filter((loan) => numberValue(loan.annualInterestRate) > 0).sort((a, b) => numberValue(b.annualInterestRate) - numberValue(a.annualInterestRate));
      const missingRate = openLoans.some((loan) => numberValue(loan.annualInterestRate) <= 0);
      lines.push(avalanche.length ? `Avalanche order from recorded rates: ${avalanche.map((loan) => loan.type || "Loan").join(" → ")}${missingRate ? "; loans without a recorded rate cannot be ranked" : ""}.` : "Avalanche order cannot be ranked because interest rates are not recorded.");
      const snowball = [...openLoans].sort((a, b) => numberValue(a.outstanding) - numberValue(b.outstanding));
      lines.push(`Snowball order by recorded balance: ${snowball.map((loan) => loan.type || "Loan").join(" → ")}.`);
    }
    lines.push("In general, avalanche directs extra payments to the highest-rate loan after paying each loan's minimum EMI; snowball directs them to the smallest balance. These are strategy descriptions, not a prepayment calculation.");
    lines.push("To compare EMI or prepayment scenarios, provide the extra monthly amount or lump sum, any lender prepayment fees, and whether the lender would reduce the EMI or shorten the term.");
  }
  if (/goal/.test(q)) {
    if (!f.goals.length) lines.push("You have not added a financial goal yet.");
    else f.goals.slice(0,5).forEach((g:any)=>lines.push(`For **${g.name || "this goal"}**, the engine estimates **${Math.round(g.requiredMonthlyContribution).toLocaleString("en-IN")}/month** is required to cover the remaining amount by the target date.`));
  }
  if (/insurance|cover/.test(q)) lines.push(`Tracked protection is **${Math.round(f.lifeCover).toLocaleString("en-IN")}** life/term cover and **${Math.round(f.healthCover).toLocaleString("en-IN")}** health cover.`);
  lines.push("", "I am using the calculated facts above rather than inventing missing numbers. Product-specific or market-sensitive decisions should be verified separately.");
  return lines.join("\n");
}

function flattenFactValues(value: unknown, prefix = "", output = new Map<string, unknown>()) {
  if (!value || typeof value !== "object") return output;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    output.set(path, child);
    if (child && typeof child === "object") flattenFactValues(child, path, output);
  }
  return output;
}

function numericMentions(value: string) {
  return (value.match(/-?\d[\d,]*(?:\.\d+)?/g) || []).map((token) => Number(token.replace(/,/g, ""))).filter(Number.isFinite);
}

function verifyProviderAnswer(raw: string, facts: unknown, question: string, scenario: unknown) {
  try {
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim());
    const answer = typeof parsed.answer === "string" ? parsed.answer.trim() : "";
    const used = Array.isArray(parsed.facts_used) ? parsed.facts_used : [];
    if (!answer || answer.length > 6000 || used.some((key: unknown) => typeof key !== "string")) return null;

    const allowedFacts = flattenFactValues(facts);
    flattenFactValues(scenario, "scenario", allowedFacts);
    const factKeys = new Set(allowedFacts.keys());
    const validKeys = used.filter((key: string) => factKeys.has(key));
    const missingOnly = /not recorded|not provided|not enough information|cannot determine|can't determine|don't have enough/i.test(answer);
    if ((used.length === 0 && !missingOnly) || validKeys.length !== used.length) return null;

    const allowedNumbers = new Set<number>();
    for (const value of allowedFacts.values()) {
      if (typeof value === "number" && Number.isFinite(value)) {
        allowedNumbers.add(value); allowedNumbers.add(Math.round(value)); allowedNumbers.add(Math.round(value * 10) / 10);
      } else if (typeof value === "string") numericMentions(value).forEach((number) => allowedNumbers.add(number));
    }
    numericMentions(question).forEach((number) => allowedNumbers.add(number));
    const unsupportedNumber = numericMentions(answer).some((number) => !allowedNumbers.has(number));
    if (unsupportedNumber) return null;
    return answer;
  } catch {
    return null;
  }
}

class QuotaError extends Error {
  status = 429;
  constructor(message: string) { super(message); this.name = "QuotaError"; }
}

async function consumeDailyQuota(client: any, userId: string) {
  const limit = 30;
  // The database performs an atomic upsert; concurrent requests cannot race past the limit.
  const { data, error } = await client.rpc("consume_ai_quota", {
    p_user_id: userId,
  });
  if (error) {
    if (error.message?.includes("AI_DAILY_LIMIT_REACHED")) {
      throw new QuotaError(`Daily AI limit reached (${limit} requests). Your deterministic DhanView engine is still available.`);
    }
    throw error;
  }
  const used = Number(data);
  return { limit, remaining: Math.max(0, limit - used) };
}

async function callProvider(system: string, user: string) {
  const provider = (Deno.env.get("AI_PROVIDER") || "openai_compatible").toLowerCase();
  const apiKey = Deno.env.get("AI_API_KEY") || "";
  const baseUrl = (Deno.env.get("AI_BASE_URL") || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = Deno.env.get("AI_MODEL") || "gpt-4o-mini";
  if (!apiKey && provider !== "ollama") return null;
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({ model, temperature: 0.2, messages: [{ role:"system", content:system }, { role:"user", content:user }] }),
  });
  if (!response.ok) throw new ProviderError(response.status);
  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || null;
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (!cors) return new Response("Origin not allowed.", { status: 403 });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(req, { error: "POST required." }, 405);
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return json(req, { error: "Content-Type must be application/json." }, 415);
    }
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > 32_000) {
      return json(req, { error: "Request body is too large." }, 413);
    }
    let body: any;
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return json(req, { error: "Invalid request body." }, 400);
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json(req, { error: "Invalid request body." }, 400);
    }
    const mode = body.mode || "chat";
    if (!["chat", "review", "scenario", "categorize"].includes(mode)) {
      return json(req, { error: "Unsupported request mode." }, 400);
    }
    const question = String(body.question || "").trim().slice(0, 6000);
    if (!question) return json(req, { error: "A question is required." }, 400);
    const authContext = await getAuthenticatedContext(req);

    if (mode === "categorize") {
      const baseCategory = deterministicCategory(question, String(body.transactionType || "Expense"));
      if (baseCategory !== "Other") return json(req, { category: baseCategory, confidence: 0.85, reason: "Matched a deterministic transaction rule." });
      await consumeDailyQuota(authContext.client, authContext.userId);
      const system = "Classify the transaction into exactly one category: Housing, Food, Transport, Utilities, Healthcare, Shopping, Entertainment, Debt / EMI, Investments, Income, Other. Return only JSON: {\"category\":\"...\",\"confidence\":0.0,\"reason\":\"...\"}. Never invent merchant facts.";
      // The amount is not needed to categorize; send only the description and type.
      const ai = await callProvider(system, `Transaction description: ${question}\nType: ${String(body.transactionType||"Expense")}`);
      if (ai) {
        try {
          const parsed = JSON.parse(ai.replace(/```json|```/g, "").trim());
          const allowed = ["Housing", "Food", "Transport", "Utilities", "Healthcare", "Shopping", "Entertainment", "Debt / EMI", "Investments", "Income", "Other"];
          const category = allowed.includes(parsed.category) ? parsed.category : "Other";
          const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
          return json(req, { category, confidence, reason: category === "Other" ? "Not enough information for a reliable category." : "Suggested from the transaction description; review before saving." });
        } catch { /* deterministic fallback */ }
      }
      return json(req, { category: "Other", confidence: 0.25, reason: "Not enough information for a reliable category." });
    }

    const ctx = await getUserContext(authContext);
    const f = ctx.financials;
    await consumeDailyQuota(ctx.client, ctx.userId);
    // Minimize third-party disclosure: never send names of the user's goals.
    const needsLoanDetails = /loan|debt|emi|avalanche|snowball|prepay/i.test(question);
    const providerFacts = {
      ...f,
      ...(needsLoanDetails ? { loanDetails: ctx.loanDetails } : {}),
      goals: Array.isArray(f.goals)
        ? f.goals.map((goal: any, index: number) => ({ ...goal, name: `Goal ${index + 1}` }))
        : [],
    };
    const facts = JSON.stringify(providerFacts, null, 2);
    const system = `You are DhanView, a careful Indian personal-finance explainer. The supplied Financial Engine output and recorded loan details are the only source of user-specific facts. Do not add outside facts, current market information, tax rules, rates, products, predictions, or guarantees. Do not invent or infer loan details. You may explain standard strategy concepts the user asks about, but label them as general and separate them from the user's recorded data. For debt questions, compare avalanche using recorded interest rates and snowball using recorded balances; identify missing fields instead of assuming them. If the records cannot answer the question, say what is missing and ask one short clarifying question. For investment and insurance topics, provide general educational considerations only. Keep the answer concise and use no numbered list.\n\nReturn ONLY valid JSON in this shape: {"answer":"...","facts_used":["exact.fact.path"]}. Each path must be copied from the supplied facts. For scenario facts, use paths prefixed with scenario. Use an empty facts_used array only when the answer clearly says the records do not contain enough information. Do not include a number in the answer unless that exact value appears in the question or supplied facts.\n\nCALCULATED FACTS AND MINIMIZED LOAN DETAILS:\n${facts}`;
    const scenario = mode === "scenario" ? (body.scenario || {}) : {};
    const userPrompt = mode === "review" ? "Review my financial picture and identify only what these facts support. Use the required JSON response." : mode === "scenario" ? `${question}\nScenario facts: ${JSON.stringify(scenario)}\nUse the required JSON response.` : `${question}\nUse the required JSON response.`;
    const ai = await callProvider(system, userPrompt);
    const verifiedAnswer = ai ? verifyProviderAnswer(ai, providerFacts, question, scenario) : null;
    const answer = verifiedAnswer || fallbackAnswer(question, f, ctx.loanDetails);
    const provider = (Deno.env.get("AI_PROVIDER") || "openai_compatible").toLowerCase();
    const fallbackReason = verifiedAnswer ? undefined
      : !Deno.env.get("AI_API_KEY") && provider !== "ollama" ? "provider_not_configured"
      : ai ? "answer_not_verified" : "provider_returned_empty";
    return json(req, { answer, provider: verifiedAnswer ? provider : "deterministic", grounding: verifiedAnswer ? "verified" : "fallback", fallbackReason });
  } catch (error) {
    const databaseCode = error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code || "")
      : "";
    const safeDatabaseCode = /^[A-Z0-9_]{3,32}$/.test(databaseCode) ? databaseCode : "";
    let status = 500;
    let code = "AI_INTERNAL";
    let safeMessage = "DhanView could not complete the AI request. Please check the Edge Function logs and try again.";

    if (error instanceof QuotaError) {
      status = error.status;
      code = "AI_DAILY_LIMIT";
      safeMessage = error.message;
    } else if (error instanceof AuthError) {
      status = error.status;
      code = "AUTH_REQUIRED";
      safeMessage = "Your session is missing or expired. Sign in again and retry.";
    } else if (error instanceof ProviderError) {
      status = error.status === 429 ? 503 : 502;
      code = `AI_PROVIDER_${error.status}`;
      if (error.status === 401 || error.status === 403) {
        safeMessage = "The AI provider rejected its credentials. Check AI_API_KEY and AI_PROVIDER in Supabase Edge Function secrets.";
      } else if (error.status === 429) {
        safeMessage = "The AI provider is rate-limited or out of quota. Check its account limits and try again later.";
      } else if (error.status === 400 || error.status === 404) {
        safeMessage = "The AI provider rejected the model or endpoint. Check AI_BASE_URL and AI_MODEL in Supabase Edge Function secrets.";
      } else {
        safeMessage = "The AI provider is temporarily unavailable. Try again shortly.";
      }
    } else if (safeDatabaseCode === "PGRST202" || safeDatabaseCode === "42883") {
      status = 503;
      code = safeDatabaseCode;
      safeMessage = "The AI quota function is missing from Supabase. Apply supabase/migrations/002_security_hardening.sql, then retry.";
    } else if (["PGRST204", "PGRST205", "42703", "42P01"].includes(safeDatabaseCode)) {
      status = 503;
      code = safeDatabaseCode;
      safeMessage = `The AI data schema does not match this app version (${safeDatabaseCode}). Apply any unapplied Supabase migrations, including 004_ai_required_fields.sql, refresh the schema cache, then redeploy artha-ai and retry.`;
    } else if (safeDatabaseCode === "42501") {
      status = 403;
      code = safeDatabaseCode;
      safeMessage = "Supabase denied access to the signed-in account data. Check the owner-only RLS policies and retry.";
    } else if (safeDatabaseCode) {
      code = safeDatabaseCode;
      safeMessage = `The AI request failed in Supabase (code ${safeDatabaseCode}). Check the Edge Function logs for that database error.`;
    }

    // Log only a classified code, never the question, financial facts, tokens, or provider response body.
    console.error("[artha-ai] request failed", { code, providerStatus: error instanceof ProviderError ? error.status : undefined });
    return json(req, { error: safeMessage, code }, status);
  }
});
