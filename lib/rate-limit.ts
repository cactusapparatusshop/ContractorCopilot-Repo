import "server-only";

type Bucket = { count: number; resetAt: number };

declare global {
  // eslint-disable-next-line no-var
  var contractorCopilotRateLimit: Map<string, Bucket> | undefined;
}

const buckets = globalThis.contractorCopilotRateLimit ?? new Map<string, Bucket>();
if (process.env.NODE_ENV !== "production") globalThis.contractorCopilotRateLimit = buckets;

/** Lightweight per-instance protection. Use an edge/Redis limiter for a fleet. */
export function takeRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const existing = buckets.get(key);
  const bucket = !existing || existing.resetAt <= now ? { count: 0, resetAt: now + windowMs } : existing;
  bucket.count += 1;
  buckets.set(key, bucket);

  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
  };
}
