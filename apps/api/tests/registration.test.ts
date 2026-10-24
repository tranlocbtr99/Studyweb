import { describe, expect, it } from 'vitest';
import app from '../src/index';

const origin = 'http://localhost';
const headers = { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.10' };

describe('student self-registration boundary', () => {
  it('rejects cross-origin registration before database access', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST', headers: { Origin: 'https://other.example', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@example.com', password: 'correct-horse-battery' })
    });
    expect(res.status).toBe(403);
  });
  it('rejects invalid email and weak password before database access', async () => {
    for (const input of [
      { email: 'invalid', password: 'correct-horse-battery' },
      { email: 'student@example.com', password: 'short' },
      { email: 'student@example.com', password: 'correct-horse-battery', role: 'admin' }
    ]) {
      const res = await app.request('/api/v1/auth/register', { method: 'POST', headers, body: JSON.stringify(input) });
      expect(res.status).toBe(400);
    }
  });
  it('does not allow requests without trusted client IP', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@example.com', password: 'correct-horse-battery' })
    });
    expect(res.status).toBe(503);
  });
});
