// Best-effort in-memory rate limiter (per IP, per warm serverless instance).
// This bounds casual abuse; the real cost backstop is a monthly spend limit
// set on the Anthropic API key itself plus the strict input/output caps.

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS = 10; // per IP per window

const hits = new Map<string, number[]>();

export function rateLimit(ip: string): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - recent[0])) / 1000);
    hits.set(ip, recent);
    return { ok: false, retryAfter };
  }

  recent.push(now);
  hits.set(ip, recent);

  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (hits.size > 5_000) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
    }
  }

  return { ok: true, retryAfter: 0 };
}
