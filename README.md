# AI Content Summarizer

Paste a **URL or any text** and get a clean, **structured summary** — title,
TL;DR, key points, topic tags, and sentiment — powered by the **Claude API**.
The app fetches and extracts page text server-side, then asks Claude to return
a typed object via tool use.

**Live demo:** _add your Vercel URL here_

![App screenshot](docs/screenshot.png)

## What it demonstrates

- **LLM / API integration** — Claude API via the official SDK, using
  **tool use for reliable structured (JSON) output** instead of brittle
  string parsing.
- **Prompt engineering & caching** — a cached system prompt for lower cost and
  latency across requests.
- **Server-side web fetching + extraction** — turns a URL into clean, readable
  text (scripts/styles/markup stripped) before summarizing.
- **Production hygiene** — input/output token caps, a per-IP rate limiter, and
  graceful error handling, so a public demo stays cheap and abuse-resistant.

## Cost controls

This is a public demo on the owner's API key, so cost is bounded by:

- **Model:** Claude Haiku (cheapest) — a fraction of a cent per request.
- **Input cap:** source text truncated to 15,000 characters.
- **Output cap:** `max_tokens` limited.
- **Rate limit:** per-IP request limiting.
- **Backstop:** a **monthly spend limit set on the Anthropic key itself**
  (configure in the Anthropic console).

## Run it locally

```bash
npm install
cp .env.example .env.local   # then paste your ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

## Deploy

Import the repo on Vercel and add `ANTHROPIC_API_KEY` as an Environment
Variable. The key is never committed — only `.env.local` (gitignored) locally
and Vercel's encrypted env in production.

## Tech

Next.js (App Router) · React · TypeScript · Tailwind CSS · Claude API
(`@anthropic-ai/sdk`) · Vercel

---

Built by **Cesar Seabra** — [github.com/uniatrix](https://github.com/uniatrix)
