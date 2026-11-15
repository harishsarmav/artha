import http from "node:http";

const PORT = 8787;
const OLLAMA_BASE = "http://127.0.0.1:11434";
const MODEL = "gpt-oss:20b";
const MAX_BODY_BYTES = 32_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:3000",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, apikey, x-client-info",
  "Vary": "Origin",
  "Access-Control-Max-Age": "86400",
};

function sendJson(res, status, body) {
  res.writeHead(status, {
    ...corsHeaders,
    "Content-Type": "application/json; charset=utf-8",
  });

  res.end(JSON.stringify(body));
}

function normalizeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function deterministicCategory(description, transactionType = "Expense") {
  const text = String(description || "").toLowerCase();

  if (/salary|payroll|dividend|interest credit/.test(text)) {
    return "Income";
  }

  if (/rent|housing|maintenance|society/.test(text)) {
    return "Housing";
  }

  if (
    /swiggy|zomato|restaurant|cafe|food|grocer|blinkit|zepto|bigbasket/.test(
      text
    )
  ) {
    return "Food";
  }

  if (/uber|ola|rapido|petrol|fuel|parking|metro|transport/.test(text)) {
    return "Transport";
  }

  if (/electric|water|internet|mobile|jio|airtel|utility|gas/.test(text)) {
    return "Utilities";
  }

  if (/hospital|pharmacy|medical|doctor|clinic|apollo/.test(text)) {
    return "Healthcare";
  }

  if (/amazon|flipkart|myntra|shopping|mall/.test(text)) {
    return "Shopping";
  }

  if (/netflix|prime|spotify|movie|cinema|entertainment/.test(text)) {
    return "Entertainment";
  }

  if (/emi|loan|hdfc loan|sbi loan|card payment/.test(text)) {
    return "Debt / EMI";
  }

  if (/sip|mutual fund|zerodha|groww|upstox|stock|etf|nps|ppf|fd/.test(text)) {
    return "Investments";
  }

  if (String(transactionType).toLowerCase() === "income") {
    return "Income";
  }

  return "Other";
}

function flattenFactValues(value, prefix = "", output = new Map()) {
  if (!value || typeof value !== "object") return output;
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    output.set(path, child);
    if (child && typeof child === "object") flattenFactValues(child, path, output);
  }
  return output;
}

function numericMentions(value) {
  return (String(value).match(/-?\d[\d,]*(?:\.\d+)?/g) || [])
    .map((token) => Number(token.replace(/,/g, "")))
    .filter(Number.isFinite);
}

function verifyProviderAnswer(raw, facts, question, scenario) {
  try {
    const parsed = JSON.parse(String(raw).replace(/^```(?:json)?\s*|\s*```$/g, "").trim());
    const answer = typeof parsed.answer === "string" ? parsed.answer.trim() : "";
    const used = Array.isArray(parsed.facts_used) ? parsed.facts_used : [];
    if (!answer || answer.length > 6000 || used.some((key) => typeof key !== "string")) return null;

    const allowedFacts = flattenFactValues(facts);
    flattenFactValues(scenario, "scenario", allowedFacts);
    const factKeys = new Set(allowedFacts.keys());
    const validKeys = used.filter((key) => factKeys.has(key));
    const missingOnly = /not recorded|not provided|not enough information|cannot determine|can't determine|don't have enough/i.test(answer);
    if ((used.length === 0 && !missingOnly) || validKeys.length !== used.length) return null;

    const allowedNumbers = new Set();
    for (const value of allowedFacts.values()) {
      if (typeof value === "number" && Number.isFinite(value)) {
        allowedNumbers.add(value);
        allowedNumbers.add(Math.round(value));
        allowedNumbers.add(Math.round(value * 10) / 10);
      } else if (typeof value === "string") numericMentions(value).forEach((number) => allowedNumbers.add(number));
    }
    numericMentions(question).forEach((number) => allowedNumbers.add(number));
    if (numericMentions(answer).some((number) => !allowedNumbers.has(number))) return null;
    return answer;
  } catch {
    return null;
  }
}

function buildFallbackAnswer(question, financialContext) {
  const f = financialContext?.financials || {};
  const loans = Array.isArray(financialContext?.records?.loans) ? financialContext.records.loans : [];

  const income = normalizeNumber(f.monthlyIncome);
  const outflow = normalizeNumber(f.monthlyOutflow);
  const freeCashFlow = normalizeNumber(f.freeCashFlow);
  const savingsRate = normalizeNumber(f.savingsRate);
  const cashSavings = normalizeNumber(f.cashSavings);
  const emergency3 = normalizeNumber(f.emergencyFundTarget3Months);
  const emergency6 = normalizeNumber(f.emergencyFundTarget6Months);

  const lines = [
    "### DhanView's engine-based view",
    "",
  ];

  if (income > 0) {
    lines.push(
      `Your normalized monthly income is **${Math.round(
        income
      ).toLocaleString("en-IN")}** and monthly outflow is **${Math.round(
        outflow
      ).toLocaleString("en-IN")}**.`
    );

    lines.push(
      `That leaves free cash flow of **${Math.round(
        freeCashFlow
      ).toLocaleString("en-IN")}**, with a savings rate of **${savingsRate.toFixed(
        1
      )}%**.`
    );
  }

  const q = String(question || "").toLowerCase();

  if (/emergency|fund|cash/.test(q)) {
    lines.push(
      `Cash savings are **${Math.round(
        cashSavings
      ).toLocaleString("en-IN")}**, while the engine's 3–6 month target range is **${Math.round(
        emergency3
      ).toLocaleString("en-IN")}–${Math.round(
        emergency6
      ).toLocaleString("en-IN")}**.`
    );
  }

  if (/loan|debt|emi/.test(q)) {
    lines.push(
      `Outstanding debt is **${Math.round(normalizeNumber(f.outstandingDebt)).toLocaleString("en-IN")}** with monthly debt payments of **${Math.round(normalizeNumber(f.debtPayments)).toLocaleString("en-IN")}**.`
    );
    const openLoans = loans.filter((loan) => normalizeNumber(loan.outstanding) > 0);
    if (!openLoans.length) {
      lines.push("No outstanding loan records are available in the data currently loaded, so I cannot rank your debts or calculate an EMI or prepayment scenario.");
    } else {
      lines.push("Recorded loan details:");
      openLoans.forEach((loan) => {
        const label = loan.name || loan.type || "Loan";
        const rate = normalizeNumber(loan.interestRate) > 0 ? `${normalizeNumber(loan.interestRate)}% annual rate` : "interest rate not recorded";
        const emi = normalizeNumber(loan.emi) > 0 ? `${Math.round(normalizeNumber(loan.emi)).toLocaleString("en-IN")} monthly EMI` : "EMI not recorded";
        const term = normalizeNumber(loan.tenureMonths) > 0 ? `${normalizeNumber(loan.tenureMonths)} months remaining` : "remaining term not recorded";
        lines.push(`- **${label}**: ${Math.round(normalizeNumber(loan.outstanding)).toLocaleString("en-IN")} outstanding · ${rate} · ${emi} · ${term}.`);
      });
      const avalanche = [...openLoans].filter((loan) => normalizeNumber(loan.interestRate) > 0).sort((a, b) => normalizeNumber(b.interestRate) - normalizeNumber(a.interestRate));
      const missingRate = openLoans.some((loan) => normalizeNumber(loan.interestRate) <= 0);
      lines.push(avalanche.length ? `Avalanche order from recorded rates: ${avalanche.map((loan) => loan.name || loan.type || "Loan").join(" → ")}${missingRate ? "; loans without a recorded rate cannot be ranked" : ""}.` : "Avalanche order cannot be ranked because interest rates are not recorded.");
      const snowball = [...openLoans].sort((a, b) => normalizeNumber(a.outstanding) - normalizeNumber(b.outstanding));
      lines.push(`Snowball order by recorded balance: ${snowball.map((loan) => loan.name || loan.type || "Loan").join(" → ")}.`);
    }
    lines.push("In general, avalanche directs extra payments to the highest-rate loan after paying each loan's minimum EMI; snowball directs them to the smallest balance. These are strategy descriptions, not a prepayment calculation.");
    lines.push("To compare EMI or prepayment scenarios, provide the extra monthly amount or lump sum, any lender prepayment fees, and whether the lender would reduce the EMI or shorten the term.");
  }

  if (/invest|sip|stock|mutual|portfolio/.test(q)) {
    lines.push(
      `Tracked investments are worth **${Math.round(
        normalizeNumber(f.currentInvestmentValue)
      ).toLocaleString("en-IN")}** versus **${Math.round(
        normalizeNumber(f.investedAmount)
      ).toLocaleString("en-IN")}** invested.`
    );
  }

  lines.push(
    "",
    "This fallback uses DhanView's deterministic engine facts only; no AI inference was used."
  );

  return lines.join("\n");
}

async function callOllama(system, user) {
  const response = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      messages: [
        {
          role: "system",
          content: system,
        },
        {
          role: "user",
          content: user,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama returned HTTP ${response.status}.`);
  }

  const data = await response.json();

  return data?.message?.content?.trim() || "";
}

const server = http.createServer(async (req, res) => {
  // ------------------------------------------------------------
  // CORS PREFLIGHT
  // ------------------------------------------------------------
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  // ------------------------------------------------------------
  // AI COACH
  // ------------------------------------------------------------
  if (req.method === "POST" && req.url === "/api/coach") {
    try {
      let raw = "";
      let bodyTooLarge = false;

      req.on("data", (chunk) => {
        if (Buffer.byteLength(raw) + chunk.length > MAX_BODY_BYTES) {
          bodyTooLarge = true;
          return;
        }
        if (!bodyTooLarge) raw += chunk;
      });

      await new Promise((resolve, reject) => {
        req.on("end", resolve);
        req.on("error", reject);
      });

      if (bodyTooLarge) {
        sendJson(res, 413, { error: "Request body is too large." });
        return;
      }

      let body = {};

      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        sendJson(res, 400, {
          error: "Invalid JSON request body.",
        });
        return;
      }

      const mode = String(body.mode || "chat");
      const question = String(body.question || "").trim();

      if (!question) {
        sendJson(res, 400, {
          error: "A question is required.",
        });
        return;
      }

      // ----------------------------------------------------------
      // TRANSACTION CATEGORIZATION
      // ----------------------------------------------------------
      if (mode === "categorize") {
        const category = deterministicCategory(
          question,
          body.transactionType || "Expense"
        );

        sendJson(res, 200, {
          category,
          confidence: category === "Other" ? 0.25 : 0.85,
          reason:
            category === "Other"
              ? "Not enough information for a reliable deterministic category."
              : "Matched a deterministic transaction rule.",
        });

        return;
      }

      const financialContext = body.financialContext || {};
      const loanDetails = Array.isArray(financialContext.records?.loans)
        ? financialContext.records.loans.map((loan, index) => ({
            loan: `Loan ${index + 1}`,
            type: loan.type || "Other",
            outstanding: normalizeNumber(loan.outstanding),
            annualInterestRate: normalizeNumber(loan.interestRate),
            monthlyEmi: normalizeNumber(loan.emi),
            remainingMonths: normalizeNumber(loan.tenureMonths),
          }))
        : [];
      const providerFacts = { ...financialContext.financials, loanDetails };
      const facts = JSON.stringify(providerFacts, null, 2);

      const scenario = mode === "scenario" ? (body.scenario || {}) : {};
      const system = `You are DhanView, a careful Indian personal-finance explainer. The supplied Financial Engine output and recorded loan details are the only source of user-specific facts. Do not add outside facts, current market information, tax rules, rates, products, predictions, or guarantees. Do not invent loan details. You may explain standard strategy concepts the user asks about, but distinguish those general descriptions from the user data. For debt questions compare avalanche using recorded interest rates and snowball using recorded balances; identify missing fields instead of assuming them. If the records cannot answer the question, say what is missing and ask one short clarifying question. For investment and insurance topics, provide general educational considerations only. Keep the answer concise and use no numbered list.\n\nReturn ONLY valid JSON in this shape: {"answer":"...","facts_used":["exact.fact.path"]}. Each path must be copied from the supplied facts. For scenario facts, use paths prefixed with scenario. Use an empty facts_used array only when the answer clearly says the records do not contain enough information. Do not include a number in the answer unless that exact value appears in the question or supplied facts.\n\nCALCULATED FINANCIAL FACTS:\n${facts}\n\nSCENARIO FACTS:\n${JSON.stringify(scenario)}`;

      let rawAnswer = "";
      let providerFailureReason = "";

      try {
        const userPrompt = mode === "scenario" ? `${question}\nUse the required JSON response.` : `${question}\nUse the required JSON response.`;
        rawAnswer = await callOllama(system, userPrompt);
      } catch (ollamaError) {
        // Do not log request context or provider error payloads.
        providerFailureReason = "local_model_unavailable";
      }

      const verifiedAnswer = rawAnswer ? verifyProviderAnswer(rawAnswer, providerFacts, question, scenario) : null;
      const answer = verifiedAnswer || buildFallbackAnswer(question, financialContext);
      const fallbackReason = verifiedAnswer ? undefined : rawAnswer ? "answer_not_verified" : providerFailureReason || "local_model_unavailable";

      sendJson(res, 200, {
        answer,
        provider: verifiedAnswer ? "ollama" : "deterministic",
        grounding: verifiedAnswer ? "verified" : "fallback",
        fallbackReason,
      });

      return;
    } catch (error) {
      // Keep request/provider details out of local logs.

      sendJson(res, 500, {
        error: "Unable to process the AI request. Please try again.",
      });

      return;
    }
  }

  // ------------------------------------------------------------
  // NOT FOUND
  // ------------------------------------------------------------
  sendJson(res, 404, {
    error: "Not found",
  });
});

server.listen(PORT, "127.0.0.1", () => {
  // Local-only listener; no request or financial data is logged.
});
