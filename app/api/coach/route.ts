import { NextResponse } from "next/server";

function clean(text: string) {
  return text
    .replace(/\\###/g, "###")
    .replace(/\\##/g, "##")
    .replace(/\\#/g, "#")
    .replace(/\\\*\*/g, "**")
    .replace(/\\\*/g, "*")
    .replace(/\\_/g, "_")
    .trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const question = String(body.question || "").trim();

    if (!question) {
      return NextResponse.json(
        { error: "Question is required." },
        { status: 400 }
      );
    }

    const url =
      process.env.OLLAMA_URL || "http://localhost:11434/api/chat";

    const model =
      process.env.OLLAMA_MODEL || "gpt-oss:20b";

    const financialContext = body.financialContext || {};

    const systemPrompt = `
You are Artha, an AI personal finance coach for users in India.

Your job is to help users understand their personal finances
in simple, practical language.

Important rules:

1. Give educational financial guidance.
2. Do not claim to be a SEBI-registered investment adviser.
3. Do not guarantee returns.
4. Do not tell users to definitely buy, sell, or hold a specific security.
5. Explain risk, diversification, liquidity, fees, taxes and time horizon when relevant.
6. Use the financial context supplied by Artha.
7. Never invent financial information.
8. If information is missing, clearly say what is missing.
9. Use INR and Indian financial terminology where appropriate.
10. For insurance, explain coverage needs and factors to compare rather than endorsing a provider.
11. For investments, explain concepts such as SIPs, diversification, volatility, compounding and asset allocation.
12. Prefer concise answers.
13. Use headings and bullet points where useful.
14. Use tables only when they genuinely improve readability.
15. When Artha has already calculated a figure, use that figure rather than recalculating it.

User financial context:

${JSON.stringify(financialContext, null, 2)}
`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: question,
          },
        ],
        stream: false,

        // Important for machines with limited VRAM.
        options: {
          temperature: 0.3,
          num_ctx: 2048,
          num_predict: 800,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      return NextResponse.json(
        {
          error: "Ollama request failed.",
          details: errorText,
        },
        { status: 502 }
      );
    }

    const data = await response.json();

    const answer = clean(
      data.message?.content ||
        "I could not generate a response."
    );

    return NextResponse.json({
      answer,
      provider: "ollama",
      model,
    });
  } catch (error) {
    console.error("Artha AI error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Artha could not connect to Ollama. Make sure Ollama is running.",
      },
      { status: 502 }
    );
  }
}