import {
  FunctionCallingConfigMode,
  GoogleGenAI,
  type FunctionDeclaration,
} from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { prepareInput } from "@/lib/extract";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

// Google Gemini free tier — no credit card required. Fast Flash model that
// supports function calling, which gives us reliable structured JSON output.
const MODEL = "gemini-2.5-flash";
const MAX_OUTPUT_TOKENS = 1024;

const SUMMARY_FUNCTION: FunctionDeclaration = {
  name: "format_summary",
  description: "Return a structured summary of the provided content.",
  parametersJsonSchema: {
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

const SYSTEM_INSTRUCTION =
  "You are an expert analyst. You read content and produce a concise, " +
  "faithful, structured summary. Never invent facts that are not in the " +
  "source. Always respond by calling the format_summary function.";

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "anonymous";
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing GEMINI_API_KEY." },
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

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: `Summarize the following ${prepared.sourceType === "url" ? "web page" : "text"}:\n\n${prepared.text}`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        tools: [{ functionDeclarations: [SUMMARY_FUNCTION] }],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.ANY,
            allowedFunctionNames: ["format_summary"],
          },
        },
      },
    });

    const call = response.functionCalls?.[0];
    if (!call || call.name !== "format_summary" || !call.args) {
      return NextResponse.json(
        { error: "The model did not return a structured summary." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      summary: call.args,
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
