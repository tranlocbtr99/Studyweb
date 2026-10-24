import { randomBytes, randomUUID, pbkdf2Sync } from 'node:crypto';

const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account, STUDYWEB_ADMIN_EMAIL: rawEmail, STUDYWEB_ADMIN_PASSWORD: password } = process.env;
if (!token || !account || !rawEmail || !password) throw new Error('Required environment variables are missing');
const email = rawEmail.trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Invalid administrator email');
if (password.length < 16 || password.length > 256) throw new Error('Administrator password must contain 16–256 characters');

const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/d1/database/2cb0dbe3-3421-4a6e-9c71-e64d6451647e/query`;
async function query(sql, params = []) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params })
  });
  const body = await response.json();
  if (!response.ok || !body.success || body.result?.some(item => item.success === false)) {
    throw new Error(`Cloudflare D1 request failed (HTTP ${response.status}); verify permissions and schema`);
  }
  return body.result?.[0]?.results ?? [];
}
const admins = await query("SELECT COUNT(*) AS n FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE r.code='admin'");
if (Number(admins[0]?.n) !== 0) throw new Error('Administrator already exists; refusing bootstrap');
const existing = await query('SELECT id FROM users WHERE email=?', [email]);
if (existing.length) throw new Error('Email already exists; refusing bootstrap');
const salt = randomBytes(16);
const hash = `pbkdf2$310000$${salt.toString('hex')}$${pbkdf2Sync(password, salt, 310000, 32, 'sha256').toString('hex')}`;
const userId = randomUUID();
const roleId = randomUUID();
// Single SQL statement makes the creation atomic. Refuse if an admin was created concurrently.
const sql = `WITH guard AS (SELECT 1 AS ok WHERE NOT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE r.code='admin'))
INSERT INTO users(id,email,password_hash,status,created_at)
SELECT ?,?,?,'active',? FROM guard`;
await query(sql, [userId, email, hash, Math.floor(Date.now()/1000)]);
// Role binding is idempotent and reuses an existing role when present.
await query("INSERT OR IGNORE INTO roles(id,code) VALUES(?,'admin')", [roleId]);
await query("INSERT INTO user_roles(user_id,role_id) SELECT ?,id FROM roles WHERE code='admin' AND NOT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE r.code='admin')", [userId]);
const confirmed = await query("SELECT COUNT(*) AS n FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE r.code='admin' AND ur.user_id=?", [userId]);
if (Number(confirmed[0]?.n) !== 1) throw new Error('Admin role assignment not confirmed; inspect database manually');
console.log('First administrator provisioned successfully; no credentials printed');
