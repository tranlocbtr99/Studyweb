const base = 'https://studyweb-api.tranlocbtr99.workers.dev';
const origin = base;
const adminEmail = process.env.STUDYWEB_ADMIN_EMAIL?.trim();
if (!adminEmail) throw new Error('Missing administrator email secret');
const adminPassword = process.env.STUDYWEB_ADMIN_PASSWORD;
if (!adminPassword) throw new Error('Missing administrator password secret');
const cases = [
  { name: 'health', path: '/api/v1/health', method: 'GET', expected: [200] },
  { name: 'subjects_d1_read', path: '/api/v1/subjects', method: 'GET', expected: [200] },
  { name: 'login_validation', path: '/api/v1/auth/login', method: 'POST',
    body: { email: 'invalid-email', password: 'placeholder' }, expected: [400] },
  { name: 'admin_login_real', path: '/api/v1/auth/login', method: 'POST',
    body: { email: adminEmail, password: adminPassword }, expected: [200, 429] },
  { name: 'register_existing_admin', path: '/api/v1/auth/register', method: 'POST',
    body: { email: adminEmail, password: 'diagnostic-only-placeholder-012345' }, expected: [409, 429] }
];
let unexpected = 0;
for (const item of cases) {
  try {
    const res = await fetch(base + item.path, {
      method: item.method,
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: item.body ? JSON.stringify(item.body) : undefined,
      redirect: 'manual',
      signal: AbortSignal.timeout(15000)
    });
    let code = 'non_json';
    try {
      const body = await res.json();
      if (typeof body?.error?.code === 'string' && /^[A-Z_]{2,50}$/.test(body.error.code)) code = body.error.code;
      else if (body?.status === 'ok') code = 'HEALTH_OK';
    } catch {}
    const expected = item.expected.includes(res.status);
    if (item.name === 'admin_login_real' && res.status === 200) {
      const cookiePresent = (res.headers.get('set-cookie') || '').includes('studyweb_session=');
      console.log(JSON.stringify({ check: 'session_cookie', present: cookiePresent }));
      if (!cookiePresent) unexpected++;
    }
    if (!expected) unexpected++;
    console.log(JSON.stringify({ check: item.name, httpStatus: res.status, applicationCode: code, expected }));
  } catch (err) {
    unexpected++;
    console.log(JSON.stringify({ check: item.name, networkError: err?.name === 'TimeoutError' ? 'timeout' : 'request_failed' }));
  }
}
console.log(JSON.stringify({ unexpectedChecks: unexpected, note: 'No credentials, raw response bodies or account identifiers printed' }));
