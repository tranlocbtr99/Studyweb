import { randomBytes, pbkdf2Sync } from 'node:crypto';

const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account,
  STUDYWEB_ADMIN_EMAIL: rawEmail, STUDYWEB_ADMIN_PASSWORD: password } = process.env;
if (!token || !account || !rawEmail || !password) throw new Error('Required protected secrets are missing');
const email = rawEmail.trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Invalid email');
if (password.length < 16 || password.length > 256) throw new Error('Password must contain 16–256 characters');
const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/d1/database/2cb0dbe3-3421-4a6e-9c71-e64d6451647e/query`;
async function query(sql, params = []) {
  const response = await fetch(url, { method: 'POST', headers: {
    Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'
  }, body: JSON.stringify({ sql, params }) });
  const body = await response.json();
  if (!response.ok || !body.success || body.result?.some(item => item.success === false))
    throw new Error(`D1 request failed (HTTP ${response.status})`);
  return body.result?.[0]?.results ?? [];
}
const admins = await query(`SELECT users.id FROM users
  JOIN user_roles ur ON ur.user_id=users.id JOIN roles r ON r.id=ur.role_id
  WHERE users.email=? AND users.status='active' AND r.code='admin'`, [email]);
if (admins.length !== 1) throw new Error('Existing active administrator with this email not found; no changes made');
const salt = randomBytes(16);
const hash = `pbkdf2$310000$${salt.toString('hex')}$${pbkdf2Sync(password, salt, 310000, 32, 'sha256').toString('hex')}`;
await query("UPDATE users SET password_hash=? WHERE id=? AND email=? AND status='active'",
  [hash, admins[0].id, email]);
// Invalidate existing sessions only for the target admin.
await query('UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL',
  [Math.floor(Date.now()/1000), admins[0].id]);
console.log('Administrator password reset completed; existing sessions revoked; no credentials printed');
