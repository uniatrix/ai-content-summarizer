# AI Content Summarizer

Paste a **URL or any text** and get a clean, **structured summary** — title,
TL;DR, key points, topic tags, and sentiment. The app fetches and extracts
page text server-side, then asks **Llama 3.3 70B (via Groq)** to return a
typed object via function calling.

**Live demo:** _add your Vercel URL here_

![App screenshot](docs/screenshot.png)

## What it demonstrates

- **LLM / API integration** — Groq's OpenAI-compatible API, using **function
  calling for reliable structured (JSON) output** instead of brittle string
  parsing. Model-agnostic by design: swap to OpenAI, Anthropic, or any other
  function-calling-capable provider with a one-line change.
- **Server-side web fetching + extraction** — turns a URL into clean, readable
  text (scripts/styles/markup stripped) before summarizing.
- **Production hygiene** — input/output token caps, a per-IP rate limiter, and
  graceful error handling, so a public demo stays cheap and abuse-resistant.

## Cost: zero

This demo runs on **Groq's free tier** — no credit card required, no per-call
billing. Free-tier rate limits at the provider are the natural cost ceiling;
this app's input/output caps and per-IP limiter keep usage well inside them.

## Run it locally

```bash
npm install
cp .env.example .env.local   # then paste your free GROQ_API_KEY
npm run dev                  # http://localhost:3000
```

Get a free key at [console.groq.com/keys](https://console.groq.com/keys).

## Deploy

Import the repo on Vercel and add `GROQ_API_KEY` as an Environment Variable.
The key is never committed — only `.env.local` (gitignored) locally and
Vercel's encrypted env in production.

## Tech

Next.js (App Router) · React · TypeScript · Tailwind CSS · Groq SDK
(Llama 3.3 70B) · Vercel

---

Built by **Cesar Seabra** — [github.com/uniatrix](https://github.com/uniatrix)
