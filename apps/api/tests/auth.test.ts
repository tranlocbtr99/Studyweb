import { describe, it, expect } from 'vitest';
import app from '../src/index';
const token = 'a'.repeat(64);
async function environment(role = 'student', valid = true) {
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))).map(b => b.toString(16).padStart(2, '0')).join('');
  return { EXAM_CORE: { prepare(sql: string) {
    let args: unknown[] = [];
    return { bind(...v: unknown[]) { args = v; return this; },
      async first() { return valid && sql.includes('FROM sessions') && args[0] === hash ? { id: 'user-1' } : null; },
      async all() { return { results: sql.includes('FROM user_roles') ? [{ code: role }] : [] }; } };
  } }, EXAM_RESULTS: {} };
}
describe('session authorization', () => {
  it('rejects requests without session', async () => {
    expect((await app.request('/api/v1/me')).status).toBe(401);
  });
  it('rejects malformed tokens', async () => {
    expect((await app.request('/api/v1/me', { headers: { cookie: 'studyweb_session=bad' } })).status).toBe(401);
  });
  it('rejects unknown or expired session', async () => {
    const env = await environment('student', false);
    expect((await app.request('/api/v1/me', { headers: { cookie: 'studyweb_session=' + token } }, env)).status).toBe(401);
  });
  it('returns identity for valid session', async () => {
    const env = await environment();
    const response = await app.request('/api/v1/me', { headers: { cookie: 'studyweb_session=' + token } }, env);
    expect(response.status).toBe(200);
    expect((await response.json()).user.id).toBe('user-1');
  });
  it('requires admin role', async () => {
    const env = await environment();
    expect((await app.request('/api/v1/admin/status', { headers: { cookie: 'studyweb_session=' + token } }, env)).status).toBe(403);
    const admin = await environment('admin');
    expect((await app.request('/api/v1/admin/status', { headers: { cookie: 'studyweb_session=' + token } }, admin)).status).toBe(200);
  });
});
