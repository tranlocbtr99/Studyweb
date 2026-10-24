import { describe, it, expect } from 'vitest';
import app from '../src/index';
import type { ReadDb, ReadQuery } from '../src/auth';

const token = 'a'.repeat(64);
async function fixture(role = 'admin') {
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))), b => b.toString(16).padStart(2, '0')).join('');
  const statements: Array<{ sql: string; args: unknown[] }> = [];
  const core: ReadDb = {
    prepare(sql: string): ReadQuery {
      const record = { sql, args: [] as unknown[] };
      return {
        bind(...args: unknown[]) { record.args = args; return this; },
        async first<T = unknown>() { return (sql.includes('FROM sessions') && record.args[0] === hash ? { id: 'admin-user' } : null) as T | null; },
        async all() { return { results: sql.includes('FROM user_roles') ? [{ code: role }] : [] }; },
        async run() { statements.push(record); return {}; }
      };
    },
    async batch(queries: ReadQuery[]) {
      for (const query of queries) await query.run();
      return [];
    }
  };
  return { env: { EXAM_CORE: core, EXAM_RESULTS: core }, statements };
}
function request(body: unknown, origin = 'http://localhost') {
  return { method: 'POST', headers: { Origin: origin, Cookie: 'studyweb_session=' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
describe('admin subjects', () => {
  it('requires authentication', async () => {
    const res = await app.request('/api/v1/admin/subjects', { method: 'POST', headers: { Origin: 'http://localhost' }, body: '{}' });
    expect(res.status).toBe(401);
  });
  it('denies non-admin users before writing', async () => {
    const { env, statements } = await fixture('student');
    const res = await app.request('/api/v1/admin/subjects', request({ slug: 'economics', title: 'Economics' }), env);
    expect(res.status).toBe(403);
    expect(statements).toHaveLength(0);
  });
  it('denies cross-origin admin requests', async () => {
    const { env, statements } = await fixture();
    const res = await app.request('/api/v1/admin/subjects', request({ slug: 'economics', title: 'Economics' }, 'https://evil.example'), env);
    expect(res.status).toBe(403);
    expect(statements).toHaveLength(0);
  });
  it('rejects invalid payload without writing', async () => {
    const { env, statements } = await fixture();
    const res = await app.request('/api/v1/admin/subjects', request({ slug: 'Invalid Slug', title: 'Economics' }), env);
    expect(res.status).toBe(400);
    expect(statements).toHaveLength(0);
  });
  it('creates a subject and its audit record together', async () => {
    const { env, statements } = await fixture();
    const res = await app.request('/api/v1/admin/subjects', request({ slug: 'economics', title: 'Economics' }), env);
    expect(res.status).toBe(201);
    const result = await res.json();
    expect(result.subject.slug).toBe('economics');
    expect(statements).toHaveLength(2);
    expect(statements[0].sql).toContain('INSERT INTO subjects');
    expect(statements[1].sql).toContain('INSERT INTO core_audit_logs');
    expect(statements[1].args[1]).toBe('admin-user');
    expect(statements[1].args[3]).toBe(result.subject.id);
  });
});
