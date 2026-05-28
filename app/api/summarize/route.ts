import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import { prepareInput } from "@/lib/extract";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

// Groq's free tier — no credit card needed. Llama 3.3 70B is fast and
// supports tool/function calling, which we use for reliable structured output.
const MODEL = "llama-3.3-70b-versatile";
const MAX_OUTPUT_TOKENS = 1024;

const SUMMARY_TOOL = {
  type: "function" as const,
  function: {
    name: "format_summary",
    description: "Return a structured summary of the provided content.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "A short, descriptive title." },
        tldr: { type: "string", description: "One or two sentence takeaway." },
        key_points: {
          type: "array",
          items: { type: "string" },
          description: "3 to 7 of the most important points.",
        },
        topics: {
          type: "array",
          items: { type: "string" },
          description: "Up to 6 short topic/keyword tags.",
        },
        sentiment: {
          type: "string",
          enum: ["positive", "neutral", "negative", "mixed"],
          description: "Overall tone of the content.",
        },
      },
      required: ["title", "tldr", "key_points", "topics", "sentiment"],
    },
  },
};

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "anonymous";
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing GROQ_API_KEY." },
      { status: 500 },
    );
  }

  const limit = rateLimit(clientIp(req));
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Rate limit reached. Try again in ${limit.retryAfter}s.` },
      { status: 429 },
    );
  }

  let input: string;
  try {
    const body = await req.json();
    input = String(body?.input ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!input.trim()) {
    return NextResponse.json(
      { error: "Provide a URL or some text to summarize." },
      { status: 400 },
    );
  }

  let prepared;
  try {
    prepared = await prepareInput(input);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not read the input." },
      { status: 400 },
    );
  }

  if (prepared.text.trim().length < 20) {
    return NextResponse.json(
      { error: "Not enough readable content to summarize." },
      { status: 400 },
    );
  }

  const client = new Groq({ apiKey });

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      tools: [SUMMARY_TOOL],
      tool_choice: { type: "function", function: { name: "format_summary" } },
      messages: [
        {
          role: "system",
          content:
            "You are an expert analyst. You read content and produce a concise, " +
            "faithful, structured summary. Never invent facts that are not in the " +
            "source. Always respond by calling the format_summary tool.",
        },
        {
          role: "user",
          content: `Summarize the following ${prepared.sourceType === "url" ? "web page" : "text"}:\n\n${prepared.text}`,
        },
      ],
    });

    const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "format_summary") {
      return NextResponse.json(
        { error: "The model did not return a structured summary." },
        { status: 502 },
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      return NextResponse.json(
        { error: "The model returned malformed structured output." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      summary: parsed,
      meta: {
        source_type: prepared.sourceType,
        truncated: prepared.truncated,
        model: MODEL,
      },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Summarization failed: ${detail}` },
      { status: 502 },
    );
  }
}
