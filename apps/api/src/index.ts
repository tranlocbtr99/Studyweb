import { Hono } from 'hono';
import { z } from 'zod';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { requireSession, requireRole, sameOrigin, sha256 } from './auth';
import { verifyPassword } from './password';
import { enforceLoginLimit } from './login-limit';
import type { Env } from './auth';
import admin from './admin';
import student from './student';
const app = new Hono<Env>();
const error = (code: string, message: string, requestId: string) => ({ error: { code, message, requestId } });
app.use('*', async (c, next) => {
  const requestId = crypto.randomUUID();
  c.header('X-Request-ID', requestId);
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('X-Frame-Options', 'DENY');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  c.header('Strict-Transport-Security', 'max-age=31536000');
  c.header('Cache-Control', 'no-store');
  await next();
});
const credentials = z.object({ email: z.email().max(254), password: z.string().min(1).max(256) }).strict();
app.post('/api/v1/auth/login', sameOrigin, async c => {
  if (Number(c.req.header('content-length') || 0) > 4096) return c.json(error('BAD_REQUEST', 'Payload too large', ''), 413);
  let data: unknown;
  try { data = await c.req.json(); } catch { return c.json(error('BAD_REQUEST', 'Invalid JSON', ''), 400); }
  const parsed = credentials.safeParse(data);
  if (!parsed.success) return c.json(error('BAD_REQUEST', 'Invalid credentials format', ''), 400);
  const { email, password } = parsed.data;
  const limit = await enforceLoginLimit(c.env.EXAM_CORE, email.trim().toLowerCase(), c.req.header('CF-Connecting-IP'));
  if (!limit.allowed) {
    if (limit.retryAfter) c.header('Retry-After', String(limit.retryAfter));
    return c.json(error(limit.unavailable ? 'AUTH_UNAVAILABLE' : 'RATE_LIMITED', limit.unavailable ? 'Authentication service unavailable' : 'Too many login attempts', ''), limit.unavailable ? 503 : 429);
  }
  try {
    const user = await c.env.EXAM_CORE.prepare("SELECT id, password_hash FROM users WHERE email=? AND status='active'")
      .bind(email.trim().toLowerCase()).first<{ id: string; password_hash: string }>();
    if (!user || !(await verifyPassword(password, user.password_hash)))
      return c.json(error('INVALID_CREDENTIALS', 'Invalid email or password', ''), 401);
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
    const now = Math.floor(Date.now() / 1000);
    await c.env.EXAM_CORE.prepare('INSERT INTO sessions(id,user_id,token_hash,expires_at,revoked_at) VALUES(?,?,?,?,NULL)')
      .bind(crypto.randomUUID(), user.id, await sha256(token), now + 86400).run();
    setCookie(c, 'studyweb_session', token, { httpOnly: true, secure: true, sameSite: 'Strict', path: '/', maxAge: 86400 });
    return c.json({ status: 'authenticated' });
  } catch {
    return c.json(error('AUTH_UNAVAILABLE', 'Authentication service unavailable', ''), 503);
  }
});
app.post('/api/v1/auth/logout', sameOrigin, requireSession, async c => {
  const token = getCookie(c, 'studyweb_session')!;
  try {
    await c.env.EXAM_CORE.prepare('UPDATE sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL')
      .bind(Math.floor(Date.now() / 1000), await sha256(token)).run();
    deleteCookie(c, 'studyweb_session', { path: '/', secure: true });
    return c.json({ status: 'logged_out' });
  } catch { return c.json(error('AUTH_UNAVAILABLE', 'Authentication service unavailable', ''), 503); }
});
app.get('/api/v1/health', c => c.json({ status: 'ok', service: 'studyweb-api' }));
app.get('/api/v1/subjects', async c => {
  try {
    const rows = await c.env.EXAM_CORE.prepare('SELECT id, slug, title FROM subjects ORDER BY title LIMIT 100').all();
    return c.json({ subjects: rows.results });
  } catch { return c.json(error('DB_UNAVAILABLE', 'Database unavailable', ''), 503); }
});
const examId = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
app.get('/api/v1/exams/:id', async c => {
  const parsed = examId.safeParse(c.req.param('id'));
  if (!parsed.success) return c.json(error('BAD_ID', 'Invalid exam ID', ''), 400);
  try {
    const row = await c.env.EXAM_CORE.prepare('SELECT id, subject_id AS subjectId, title FROM exams WHERE id = ?').bind(parsed.data).first();
    if (!row) return c.json(error('NOT_FOUND', 'Exam not found', ''), 404);
    return c.json({ exam: row });
  } catch { return c.json(error('DB_UNAVAILABLE', 'Database unavailable', ''), 503); }
});
app.route('/api/v1/admin',admin);
app.route('/api/v1/student',student);
app.get('/api/v1/me', requireSession, c => c.json({ user: c.get('identity') }));
app.get('/api/v1/admin/status', requireSession, requireRole('admin'), c => c.json({ status: 'authorized' }));
// Student attempts store trusted private grading snapshots in EXAM_RESULTS; submission remains disabled until atomic finalization.
app.notFound(c => c.json(error('NOT_FOUND', 'Route not found', ''), 404));
app.onError((_, c) => c.json(error('INTERNAL_ERROR', 'Internal server error', ''), 500));
export default app;
