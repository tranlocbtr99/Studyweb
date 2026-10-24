import { randomBytes, randomUUID, pbkdf2Sync } from 'node:crypto';

const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account,
  STUDYWEB_NEW_ADMIN_EMAIL: rawEmail, STUDYWEB_NEW_ADMIN_PASSWORD: password } = process.env;
if (!token || !account || !rawEmail || !password) throw new Error('Required GitHub secrets are missing');
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
    throw new Error(`D1 query failed (HTTP ${response.status})`);
  return body.result?.[0]?.results ?? [];
}
const roles = await query("SELECT id FROM roles WHERE code='admin'");
if (roles.length !== 1) throw new Error('Admin role missing or ambiguous');
if ((await query('SELECT id FROM users WHERE email=?', [email])).length)
  throw new Error('Email already exists; refusing to modify or promote existing user');
const salt = randomBytes(16);
const hash = `pbkdf2$310000$${salt.toString('hex')}$${pbkdf2Sync(password, salt, 310000, 32, 'sha256').toString('hex')}`;
const id = randomUUID();
await query("INSERT INTO users(id,email,password_hash,status,created_at) VALUES(?,?,?,'disabled',?)",
  [id, email, hash, Math.floor(Date.now()/1000)]);
try {
  await query('INSERT INTO user_roles(user_id,role_id) VALUES(?,?)', [id, roles[0].id]);
  await query("UPDATE users SET status='active' WHERE id=? AND status='disabled'", [id]);
  const verified = await query("SELECT users.id FROM users JOIN user_roles ON users.id=user_roles.user_id JOIN roles ON roles.id=user_roles.role_id WHERE users.id=? AND users.status='active' AND roles.code='admin'", [id]);
  if (verified.length !== 1) throw new Error('Administrator verification failed');
  console.log('Additional administrator created successfully; credentials not printed');
} catch (error) {
  // Fail closed: a partially created account stays disabled; never delete existing users.
  await query("UPDATE users SET status='disabled' WHERE id=?", [id]).catch(() => {});
  throw error;
}
