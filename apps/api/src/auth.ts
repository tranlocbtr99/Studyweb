import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
export type ReadQuery = { bind(...args: unknown[]): ReadQuery; all(): Promise<{ results: unknown[] }>; first<T = unknown>(): Promise<T | null>; run(): Promise<unknown> };
export type ReadDb = { prepare(query: string): ReadQuery; batch(queries: ReadQuery[]): Promise<unknown> };
export type Env = {
  Bindings: { EXAM_CORE: ReadDb; EXAM_RESULTS: ReadDb; AI?: {run(model:string,input:Record<string,unknown>):Promise<unknown>;toMarkdown?(file:{name:string;blob:Blob}):Promise<{format?:string;data?:string}|Array<{format?:string;data?:string}>>}; RELEASE_SHA?: string };
  Variables: { identity: { id: string; roles: string[] } };
};
export const sha256 = async (token: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))).map(b => b.toString(16).padStart(2, '0')).join('');
export const unauthorized = (c: Context<Env>, code: string, status: 401 | 403) =>
  c.json({ error: { code, message: status === 401 ? 'Authentication required' : 'Permission denied', requestId: c.res.headers.get('X-Request-ID') ?? '' } }, status);
export const sameOrigin = createMiddleware<Env>(async (c, next) => {
  const origin = c.req.header('Origin');
  // Cookie-authenticated writes must carry a browser Origin header.
  if (!origin || origin !== new URL(c.req.url).origin)
    return c.json({ error: { code: 'CSRF_REJECTED', message: 'Origin check failed' } }, 403);
  await next();
});
export const requireSession = createMiddleware<Env>(async (c, next) => {
  const token = getCookie(c, 'studyweb_session');
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return unauthorized(c, 'UNAUTHENTICATED', 401);
  try {
    const row = await c.env.EXAM_CORE.prepare(
      "SELECT users.id AS id FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.revoked_at IS NULL AND sessions.expires_at>? AND users.status='active' AND users.deleted_at IS NULL"
    ).bind(await sha256(token), Math.floor(Date.now() / 1000)).first<{ id: string }>();
    if (!row) return unauthorized(c, 'UNAUTHENTICATED', 401);
    const roles = await c.env.EXAM_CORE.prepare(
      'SELECT roles.code AS code FROM user_roles JOIN roles ON roles.id=user_roles.role_id WHERE user_roles.user_id=?'
    ).bind(row.id).all();
    c.set('identity', { id: row.id, roles: roles.results.map(r => (r as { code: string }).code) });
    await next();
  } catch {
    return c.json({ error: { code: 'AUTH_UNAVAILABLE', message: 'Authentication service unavailable' } }, 503);
  }
});
export const requireRole = (role: string) => createMiddleware<Env>(async (c, next) => {
  if (!c.get('identity')?.roles.includes(role)) return unauthorized(c, 'FORBIDDEN', 403);
  await next();
});

