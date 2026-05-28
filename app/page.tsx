"use client";

import { useState } from "react";

type Summary = {
  title: string;
  tldr: string;
  key_points: string[];
  topics: string[];
  sentiment: "positive" | "neutral" | "negative" | "mixed";
};

type Result = {
  summary: Summary;
  meta: { source_type: "url" | "text"; truncated: boolean; model: string };
};

const SENTIMENT_STYLES: Record<string, string> = {
  positive: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  neutral: "bg-neutral-500/15 text-neutral-300 border-neutral-500/30",
  negative: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  mixed: "bg-amber-500/15 text-amber-300 border-amber-500/30",
};

const EXAMPLE =
  "https://en.wikipedia.org/wiki/Web_scraping";

export default function Page() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function summarize() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const resp = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? "Something went wrong.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          AI Content Summarizer
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-400">
          Paste a URL or any text and get a clean, structured summary — TL;DR,
          key points, topics, and sentiment. Powered by Llama 3.3 70B (via
          Groq), with page fetching and text extraction handled server-side.
        </p>
      </header>

      <section className="space-y-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste a URL (https://…) or any block of text…"
          rows={5}
          className="w-full resize-y rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-neutral-600"
        />
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setInput(EXAMPLE)}
            className="text-xs text-neutral-500 hover:text-neutral-300"
          >
            Try an example URL
          </button>
          <button
            onClick={summarize}
            disabled={loading || !input.trim()}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-40"
          >
            {loading ? "Summarizing…" : "Summarize"}
          </button>
        </div>
      </section>

      {error && (
        <div className="mt-6 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {result && (
        <section className="mt-8 space-y-5 rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-xl font-semibold text-white">
              {result.summary.title}
            </h2>
            <span
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium capitalize ${
                SENTIMENT_STYLES[result.summary.sentiment] ?? SENTIMENT_STYLES.neutral
              }`}
            >
              {result.summary.sentiment}
            </span>
          </div>

          <p className="text-sm leading-relaxed text-neutral-300">
            {result.summary.tldr}
          </p>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Key points
            </h3>
            <ul className="space-y-2">
              {result.summary.key_points.map((point, i) => (
                <li key={i} className="flex gap-2 text-sm text-neutral-300">
                  <span className="text-emerald-400">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-2">
            {result.summary.topics.map((topic, i) => (
              <span
                key={i}
                className="rounded-full bg-neutral-800 px-3 py-1 text-xs text-neutral-300"
              >
                {topic}
              </span>
            ))}
          </div>

          <p className="border-t border-neutral-900 pt-4 text-xs text-neutral-600">
            Source: {result.meta.source_type === "url" ? "fetched URL" : "pasted text"}
            {result.meta.truncated && " (truncated to first 15k characters)"} ·
            Model: {result.meta.model}
          </p>
        </section>
      )}

      <footer className="mt-12 border-t border-neutral-900 pt-6 text-xs text-neutral-600">
        Built by Cesar Seabra · Next.js + Groq (Llama 3.3 70B) · structured
        output via function calling, server-side URL fetching, and rate
        limiting.
      </footer>
    </main>
  );
}
