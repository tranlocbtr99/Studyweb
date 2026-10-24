import { describe, expect, it } from 'vitest';
import app from '../src/index';
import { hashPassword } from '../src/password';

describe('real password verification and session write', () => {
  it('authenticates and persists a session with a valid password', async () => {
    const password = 'synthetic-test-password-2026';
    const hash = await hashPassword(password);
    let inserted = false;
    const db = {
      prepare(sql: string) {
        let args: unknown[] = [];
        return {
          bind(...values: unknown[]) { args = values; return this; },
          async first() {
            if (sql.includes('FROM login_rate_limits')) return { attempts: 1 };
            if (sql.includes('FROM users WHERE')) return { id: 'test-user', password_hash: hash };
            throw Error('unexpected query');
          },
          async run() {
            if (sql.startsWith('INSERT INTO sessions')) {
              expect(args[1]).toBe('test-user');
              expect(String(args[2])).toMatch(/^[a-f0-9]{64}$/);
              inserted = true;
              return {};
            }
            if (sql.startsWith('INSERT INTO login_rate_limits')) return {};
            throw Error('unexpected write');
          }
        };
      }
    };
    const response = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { Origin: 'http://localhost', 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.10' },
      body: JSON.stringify({ email: 'test@example.com', password })
    }, { EXAM_CORE: db, EXAM_RESULTS: db });
    expect(response.status).toBe(200);
    expect(inserted).toBe(true);
    expect(response.headers.get('set-cookie')).toContain('studyweb_session=');
  }, 30000);
});
