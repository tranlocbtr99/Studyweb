import { describe, it, expect } from 'vitest';
import app from '../src/index';
describe('public API', () => {
  it('returns health status', async () => {
    const res = await app.request('/api/v1/health');
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('ok');
  });
  it('does not expose write routes without authorization', async () => {
    const res = await app.request('/api/v1/attempts', { method: 'POST' });
    expect(res.status).toBe(404);
  });
  it('validates exam IDs before database access', async () => {
    const res = await app.request('/api/v1/exams/invalid%20id');
    expect(res.status).toBe(400);
  });
});
