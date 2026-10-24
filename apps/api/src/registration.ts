import { Hono } from 'hono';
import { z } from 'zod';
import { sameOrigin, sha256 } from './auth';
import { hashPassword } from './password';
import type { Env } from './auth';

const registration = new Hono<Env>();
const schema = z.object({ email: z.email().max(254), password: z.string().min(12).max(256) }).strict();
registration.post('/', sameOrigin, async c => {
  if (Number(c.req.header('content-length') || 0) > 4096)
    return c.json({ error: { code: 'BAD_REQUEST' } }, 413);
  let input: unknown;
  try { input = await c.req.json(); }
  catch { return c.json({ error: { code: 'BAD_REQUEST' } }, 400); }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return c.json({ error: { code: 'BAD_REQUEST' } }, 400);
  const email = parsed.data.email.trim().toLowerCase();
  const ip = c.req.header('CF-Connecting-IP');
  if (!ip || ip.length > 128) {
    console.error('studyweb.auth.registration: missing_or_invalid_client_ip');
    return c.json({ error: { code: 'REGISTRATION_UNAVAILABLE' } }, 503);
  }
  const now = Math.floor(Date.now() / 1000);
  const start = Math.floor(now / 3600) * 3600;
  let stage = 'rate_limit';
  try {
    for (const bucket of ['register:ip:' + await sha256(ip), 'register:email:' + await sha256(email)]) {
      await c.env.EXAM_CORE.prepare(`INSERT INTO login_rate_limits(bucket_key,window_start,attempts,updated_at)
        VALUES(?,?,1,?) ON CONFLICT(bucket_key) DO UPDATE SET
        attempts=CASE WHEN window_start=excluded.window_start THEN attempts+1 ELSE 1 END,
        window_start=excluded.window_start,updated_at=excluded.updated_at`)
        .bind(bucket, start, now).run();
      const row = await c.env.EXAM_CORE.prepare('SELECT attempts FROM login_rate_limits WHERE bucket_key=? AND window_start=?')
        .bind(bucket, start).first<{ attempts: number }>();
      if (!row || row.attempts > 3) return c.json({ error: { code: 'RATE_LIMITED' } }, 429);
    }
    stage = 'duplicate_check';
    const existing = await c.env.EXAM_CORE.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
    if (existing) return c.json({ error: { code: 'EMAIL_UNAVAILABLE' } }, 409);
    const id = crypto.randomUUID();
    stage = 'password_hashing';
    const hash = await hashPassword(parsed.data.password);
    const roleId = crypto.randomUUID();
    stage = 'user_creation';
    await c.env.EXAM_CORE.batch([
      c.env.EXAM_CORE.prepare('INSERT INTO users(id,email,password_hash,status,created_at) VALUES(?,?,?,?,?)').bind(id,email,hash,'active',now),
      c.env.EXAM_CORE.prepare("INSERT OR IGNORE INTO roles(id,code) VALUES(?,'student')").bind(roleId),
      c.env.EXAM_CORE.prepare("INSERT INTO user_roles(user_id,role_id) SELECT ?,id FROM roles WHERE code='student'").bind(id)
    ]);
    return c.json({ status: 'registered' }, 201);
  } catch (cause) {
    console.error('studyweb.auth.registration: failure', stage, cause instanceof Error ? cause.name : 'unknown');
    return c.json({ error: { code: 'REGISTRATION_UNAVAILABLE' } }, 503);
  }
});
export default registration;
