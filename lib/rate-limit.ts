// Rate limit en memoria por IP (primer nivel; el tope diario durable
// vive en testigos_consultas). Se resetea con cada instancia/deploy.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const MAX_TRACKED_IPS = 10_000;

const hits = new Map<string, number[]>();

export function checkRateLimit(ip: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const recientes = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);

  if (recientes.length >= MAX_PER_WINDOW) {
    hits.set(ip, recientes);
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((WINDOW_MS - (now - recientes[0])) / 1000)),
    };
  }

  recientes.push(now);
  hits.set(ip, recientes);

  if (hits.size > MAX_TRACKED_IPS) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
    }
  }

  return { allowed: true, retryAfter: 0 };
}
