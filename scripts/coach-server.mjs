import http from "node:http";

const PORT = 8787;
const OLLAMA_BASE = "http://127.0.0.1:11434";
const MODEL = "gpt-oss:20b";

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

function buildFallbackAnswer(question, financialContext) {
  const f = financialContext?.financials || {};

  const income = normalizeNumber(f.monthlyIncome);
  const outflow = normalizeNumber(f.monthlyOutflow);
  const freeCashFlow = normalizeNumber(f.freeCashFlow);
  const savingsRate = normalizeNumber(f.savingsRate);
  const cashSavings = normalizeNumber(f.cashSavings);
  const emergency3 = normalizeNumber(f.emergencyFundTarget3Months);
  const emergency6 = normalizeNumber(f.emergencyFundTarget6Months);

  const lines = [
    "### Artha's engine-based view",
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
      `Outstanding debt is **${Math.round(
        normalizeNumber(f.outstandingDebt)
      ).toLocaleString("en-IN")}** with monthly debt payments of **${Math.round(
        normalizeNumber(f.debtPayments)
      ).toLocaleString("en-IN")}**.`
    );
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
    "This fallback uses Artha's deterministic engine facts only; no AI inference was used."
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

      req.on("data", (chunk) => {
        raw += chunk;
      });

      await new Promise((resolve, reject) => {
        req.on("end", resolve);
        req.on("error", reject);
      });

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
      const facts = JSON.stringify(
        financialContext.financials || {},
        null,
        2
      );

      const system = `
You are Artha, a careful Indian personal-finance coach.

The Financial Engine is the source of truth.

Use only the supplied financial facts and records.

Rules:
- Never invent financial facts.
- Never silently change calculated numbers.
- Do not pretend to have access to bank, broker, tax, or insurance systems.
- Explain financial concepts clearly.
- For investments and insurance, provide educational decision factors rather than pretending to provide regulated product-specific advice.
- If information is missing, explicitly say so.
- Keep the response practical and readable.
- Use markdown.

CALCULATED FINANCIAL FACTS:
${facts}
`;

      let answer = "";

      try {
        answer = await callOllama(system, question);
      } catch (ollamaError) {
        // Do not log request context or provider error payloads.

        answer = buildFallbackAnswer(question, financialContext);
      }

      sendJson(res, 200, {
        answer,
        provider:
          answer.includes("engine-based view")
            ? "deterministic"
            : "ollama",
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