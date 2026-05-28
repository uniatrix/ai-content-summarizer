import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { prepareInput } from "@/lib/extract";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

// Cheapest current model — keeps per-request cost to a fraction of a cent.
const MODEL = "claude-haiku-4-5-20251001";
const MAX_OUTPUT_TOKENS = 1024;

const SUMMARY_TOOL: Anthropic.Tool = {
  name: "format_summary",
  description: "Return a structured summary of the provided content.",
  input_schema: {
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
};

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "anonymous";
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing ANTHROPIC_API_KEY." },
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

  const anthropic = new Anthropic({ apiKey });

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      // Prompt caching on the static system instructions reduces cost/latency
      // across requests.
      system: [
        {
          type: "text",
          text:
            "You are an expert analyst. You read content and produce a concise, " +
            "faithful, structured summary. Never invent facts that are not in the " +
            "source. Always respond by calling the format_summary tool.",
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [SUMMARY_TOOL],
      tool_choice: { type: "tool", name: "format_summary" },
      messages: [
        {
          role: "user",
          content: `Summarize the following ${prepared.sourceType === "url" ? "web page" : "text"}:\n\n${prepared.text}`,
        },
      ],
    });

    const toolUse = message.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );
    if (!toolUse) {
      return NextResponse.json(
        { error: "The model did not return a structured summary." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      summary: toolUse.input,
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
