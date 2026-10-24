import { describe, it, expect } from 'vitest';
import app from '../src/index';
import { hashPassword, verifyPassword } from '../src/password';
describe('passwords and login CSRF', () => {
  it('hashes passwords with randomized salts and rejects wrong password', async () => {
    const a = await hashPassword('correct-horse-battery');
    const b = await hashPassword('correct-horse-battery');
    expect(a).not.toBe(b);
    expect(await verifyPassword('correct-horse-battery', a)).toBe(true);
    expect(await verifyPassword('incorrect', a)).toBe(false);
  });
  it('rejects cross-site and missing Origin before DB access', async () => {
    const body = JSON.stringify({ email: 'test@example.com', password: 'secret-password' });
    for (const origin of [undefined, 'https://evil.example']) {
      const res = await app.request('/api/v1/auth/login', {
        method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body
      });
      expect(res.status).toBe(403);
    }
  });
  it('rejects invalid payloads on same origin', async () => {
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST', headers: { Origin: 'http://localhost', 'content-type': 'application/json' }, body: '{}'
    });
    expect(res.status).toBe(400);
  });
  it('requires Origin on logout', async () => {
    const res = await app.request('/api/v1/auth/logout', { method: 'POST' });
    expect(res.status).toBe(403);
  });
});
