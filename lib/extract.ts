// Turns user input into clean text for summarization. If the input looks like
// a URL, we fetch the page and strip it down to readable text; otherwise we
// treat the input as raw text. Input is capped to bound token cost.

export const MAX_INPUT_CHARS = 15_000;

export function looksLikeUrl(input: string): boolean {
  return /^https?:\/\/\S+$/i.test(input.trim());
}

export async function fetchReadableText(url: string): Promise<string> {
  const resp = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; AI-Summarizer/1.0; +https://github.com/uniatrix)",
      Accept: "text/html,application/xhtml+xml",
    },
    // Don't hang on slow pages.
    signal: AbortSignal.timeout(12_000),
  });

  if (!resp.ok) {
    throw new Error(`Could not fetch the page (HTTP ${resp.status}).`);
  }

  const contentType = resp.headers.get("content-type") ?? "";
  const body = await resp.text();

  if (contentType.includes("application/json")) {
    return body;
  }
  return htmlToText(body);
}

export function htmlToText(html: string): string {
  let text = html;
  // Drop non-content blocks entirely.
  text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");
  text = text.replace(/<!--[\s\S]*?-->/g, " ");
  // Preserve some structure as line breaks.
  text = text.replace(/<\/(p|div|h[1-6]|li|br|tr|section|article)>/gi, "\n");
  // Strip remaining tags.
  text = text.replace(/<[^>]+>/g, " ");
  // Decode the most common entities.
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&mdash;/gi, "—");
  // Collapse whitespace.
  text = text.replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*/g, "\n\n").trim();
  return text;
}

export async function prepareInput(
  input: string,
): Promise<{ text: string; sourceType: "url" | "text"; truncated: boolean }> {
  const trimmed = input.trim();
  let text: string;
  let sourceType: "url" | "text";

  if (looksLikeUrl(trimmed)) {
    text = await fetchReadableText(trimmed);
    sourceType = "url";
  } else {
    text = trimmed;
    sourceType = "text";
  }

  const truncated = text.length > MAX_INPUT_CHARS;
  if (truncated) text = text.slice(0, MAX_INPUT_CHARS);

  return { text, sourceType, truncated };
}
