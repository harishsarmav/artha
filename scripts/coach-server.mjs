import http from "node:http";

const PORT = Number(process.env.AI_PORT || 8787);
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434/api/chat";
const MODEL = process.env.OLLAMA_MODEL || "gpt-oss:20b";

function clean(text) {
  return String(text || "")
    .replace(/\\###/g, "###")
    .replace(/\\##/g, "##")
    .replace(/\\#/g, "#")
    .replace(/\\\*\*/g, "**")
    .replace(/\\\*/g, "*")
    .replace(/\\_/g, "_")
    .trim();
}

function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => {
      data += chunk;
      if (data.length > 2_000_000) {
        reject(new Error("Request is too large."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (req.method !== "POST" || req.url !== "/api/coach") {
    return json(res, 404, { error: "Not found." });
  }

  try {
    const body = JSON.parse(await readBody(req));
    const question = String(body.question || "").trim();

    if (!question) {
      return json(res, 400, { error: "Question is required." });
    }

    const financialContext = body.financialContext || {};
    const systemPrompt = `
You are Artha, an AI personal finance coach for users in India.

Your job is to help users understand their personal finances in simple, practical language.

Rules:
1. Give educational financial guidance.
2. Do not claim to be a SEBI-registered investment adviser.
3. Do not guarantee returns.
4. Do not tell users to definitely buy, sell, or hold a specific security.
5. Explain risk, diversification, liquidity, fees, taxes and time horizon when relevant.
6. Use only the supplied financial context. Never invent missing data.
7. Never infer a loan or expense category that is not present in the supplied data.
8. If information is missing, say what is missing.
9. Use INR and Indian financial terminology where appropriate.
10. For insurance, explain coverage factors rather than endorsing a provider.
11. Prefer concise headings and bullets. Use tables when they improve readability.
12. When Artha supplies calculated figures, use those figures rather than inventing or changing them.

Financial context:
${JSON.stringify(financialContext, null, 2)}
`;

    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ],
        stream: false,
        options: {
          temperature: 0.3,
          num_ctx: 2048,
          num_predict: 800,
        },
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      return json(res, 502, { error: "Ollama request failed.", details });
    }

    const data = await response.json();
    return json(res, 200, {
      answer: clean(data.message?.content || "I could not generate a response."),
      provider: "ollama",
      model: MODEL,
    });
  } catch (error) {
    return json(res, 502, {
      error:
        error instanceof Error
          ? error.message
          : "Artha could not connect to Ollama. Make sure Ollama is running.",
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Artha AI proxy listening on http://localhost:${PORT}`);
  console.log(`Ollama model: ${MODEL}`);
});
