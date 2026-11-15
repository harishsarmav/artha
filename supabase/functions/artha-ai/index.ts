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
    client.from("loans").select("outstanding,emi,interest_rate,type").eq("user_id", userId),
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
  return { ...authContext, financials: calculateFinancials(input) };
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
  const lines: string[] = ["### DhanView's engine-based view", ""];
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
        try { const parsed = JSON.parse(ai.replace(/```json|```/g, "").trim()); return json(req, { category: parsed.category || "Other", confidence: Number(parsed.confidence)||0, reason: parsed.reason || "AI classification." }); } catch { /* fallback */ }
      }
      return json(req, { category: "Other", confidence: 0.25, reason: "Not enough information for a reliable category." });
    }

    const ctx = await getUserContext(authContext);
    const f = ctx.financials;
    await consumeDailyQuota(ctx.client, ctx.userId);
    // Minimize third-party disclosure: never send names of the user's goals.
    const providerFacts = {
      ...f,
      goals: Array.isArray(f.goals)
        ? f.goals.map((goal: any, index: number) => ({ ...goal, name: `Goal ${index + 1}` }))
        : [],
    };
    const facts = JSON.stringify(providerFacts, null, 2);
    const system = `You are DhanView, a careful Indian personal-finance coach. The Financial Engine is the source of truth. Use only the supplied calculated facts and user records. Do not silently recalculate, invent missing numbers, or claim access to bank/broker data. Explain assumptions clearly. For investment/insurance topics, provide educational decision factors rather than product recommendations. If facts are missing, say so. Keep answers practical and readable in markdown.\n\nCALCULATED FACTS:\n${facts}`;
    const userPrompt = mode === "review" ? "Review my financial picture and explain the main areas I should review next, using only these facts." : mode === "scenario" ? `${question}\nScenario facts: ${JSON.stringify(body.scenario || {})}` : question;
    const ai = await callProvider(system, userPrompt);
    const answer = ai || fallbackAnswer(question, f);
    return json(req, { answer, provider: ai ? (Deno.env.get("AI_PROVIDER") || "openai_compatible") : "deterministic" });
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
      safeMessage = "The AI data schema does not match this app version. Apply the current Supabase schema migrations, then retry.";
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
