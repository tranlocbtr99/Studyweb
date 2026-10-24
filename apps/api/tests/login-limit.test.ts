import { describe, it, expect, vi, afterEach } from 'vitest';
import { enforceLoginLimit } from '../src/login-limit';
afterEach(() => vi.restoreAllMocks());
function fakeDb() {
  const values = new Map<string, { start: number; count: number }>();
  return { prepare(sql: string) {
    let args: unknown[] = [];
    return {
      bind(...v: unknown[]) { args = v; return this; },
      async run() {
        if (!sql.startsWith('INSERT INTO login_rate_limits')) throw Error('unexpected SQL');
        const [key, start] = args as [string, number];
        const old = values.get(key);
        values.set(key, { start, count: old?.start === start ? old.count + 1 : 1 });
      },
      async first() {
        const [key, start] = args as [string, number];
        const entry = values.get(key);
        return entry?.start === start ? { attempts: entry.count } : null;
      }
    };
  } };
}
describe('login throttling', () => {
  it('rejects missing client IP rather than bypassing protection', async () => {
    expect((await enforceLoginLimit(fakeDb(), 'u@example.com')).unavailable).toBe(true);
  });
  it('blocks the ninth attempt for one account', async () => {
    const db = fakeDb();
    for (let i = 0; i < 8; i++) expect((await enforceLoginLimit(db, 'u@example.com', '1.2.3.4')).allowed).toBe(true);
    const blocked = await enforceLoginLimit(db, 'u@example.com', '1.2.3.4');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });
  it('blocks a shared IP after thirty attempts across accounts', async () => {
    const db = fakeDb();
    for (let i = 0; i < 30; i++) expect((await enforceLoginLimit(db, 'user' + i + '@example.com', '1.2.3.4')).allowed).toBe(true);
    expect((await enforceLoginLimit(db, 'extra@example.com', '1.2.3.4')).allowed).toBe(false);
  });
  it('fails closed on D1 error', async () => {
    const db = { prepare() { throw new Error('D1 down'); } };
    expect((await enforceLoginLimit(db, 'u@example.com', '1.2.3.4')).unavailable).toBe(true);
  });
});
