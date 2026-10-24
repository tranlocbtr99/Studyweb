import type { ReadDb } from './auth';
import { sha256 } from './auth';
const WINDOW_SECONDS = 15 * 60;
const MAX_ACCOUNT_ATTEMPTS = 8;
const MAX_IP_ATTEMPTS = 30;
// Every login attempt consumes budget before password verification.
// Both account and IP buckets are keyed by SHA-256 to avoid storing raw identifiers.
// Cloudflare's connecting IP is trusted only when Workers are deployed behind Cloudflare.
// Missing IP fails closed: it is never treated as an unlimited anonymous bucket.
export async function enforceLoginLimit(db: ReadDb, email: string, connectingIp?: string):
  Promise<{ allowed: boolean; retryAfter?: number; unavailable?: boolean }> {
  if (!connectingIp || connectingIp.length > 128) return { allowed: false, unavailable: true };
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / WINDOW_SECONDS) * WINDOW_SECONDS;
  const buckets: Array<[string, number]> = [
    ['account:' + await sha256(email), MAX_ACCOUNT_ATTEMPTS],
    ['ip:' + await sha256(connectingIp), MAX_IP_ATTEMPTS]
  ];
  try {
    // Each UPSERT is atomic within D1. Partial consumption is safe (fail closed).
    for (const [key, limit] of buckets) {
      await db.prepare(`INSERT INTO login_rate_limits(bucket_key,window_start,attempts,updated_at)
        VALUES(?,?,1,?) ON CONFLICT(bucket_key) DO UPDATE SET
        attempts=CASE WHEN window_start=excluded.window_start THEN attempts+1 ELSE 1 END,
        window_start=excluded.window_start,updated_at=excluded.updated_at`)
        .bind(key, windowStart, now).run();
      const row = await db.prepare('SELECT attempts FROM login_rate_limits WHERE bucket_key=? AND window_start=?')
        .bind(key, windowStart).first<{ attempts: number }>();
      if (!row || row.attempts > limit) return { allowed: false, retryAfter: WINDOW_SECONDS - (now - windowStart) };
    }
    return { allowed: true };
  } catch {
    return { allowed: false, unavailable: true };
  }
}
