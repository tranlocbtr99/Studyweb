import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('PBKDF2 authentication compatibility', () => {
  it('creates a hash accepted by the login verifier', async () => {
    const password = 'Studyweb-local-test-2026!@#';
    const hash = await hashPassword(password);
    expect(hash).toMatch(/^pbkdf2\\$310000\\$[a-f0-9]{32}\\$[a-f0-9]{64}$/);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword(password + 'x', hash)).toBe(false);
  }, 30000);
  it('rejects malformed records without throwing', async () => {
    expect(await verifyPassword('some-password', 'bad-record')).toBe(false);
  });
});
